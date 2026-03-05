#!/usr/bin/env node

/**
 * Figma CLI Daemon v2 — Plugin-only.
 *
 * HTTP server accepts commands from CLI.
 * WebSocket server connects to Figma plugin.
 * Request queue serializes access (Figma is single-threaded).
 *
 * No CDP. No eval. Structured commands only.
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const PORT = parseInt(process.env.DAEMON_PORT) || 3456;
const CONFIG_DIR = join(homedir(), '.figma-cli');
const PID_FILE = join(CONFIG_DIR, 'daemon.pid');

// Plugin connection state
let pluginWs = null;
let pluginConnected = false;
const pendingRequests = new Map();

// Request queue — serialize plugin access
const requestQueue = [];
let processing = false;

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Cleanup ───────────────────────────────────────────

function cleanup() {
    try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch { }
    process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
    log(`FATAL: ${err.stack}`);
    cleanup();
});

// ── Queue ─────────────────────────────────────────────

async function enqueue(command, params) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ command, params, resolve, reject });
        processQueue();
    });
}

async function processQueue() {
    if (processing || requestQueue.length === 0) return;
    processing = true;

    const { command, params, resolve, reject } = requestQueue.shift();

    try {
        const result = await sendToPlugin(command, params);
        resolve(result);
    } catch (err) {
        reject(err);
    } finally {
        processing = false;
        if (requestQueue.length > 0) processQueue();
    }
}

function sendToPlugin(command, params) {
    return new Promise((resolve, reject) => {
        if (!pluginConnected || !pluginWs) {
            reject(new Error('Plugin not connected. Open FigCli plugin in Figma.'));
            return;
        }

        const id = randomUUID();
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Command "${command}" timed out after 30s`));
        }, 30000);

        pendingRequests.set(id, { resolve, reject, timeout });

        pluginWs.send(JSON.stringify({
            action: 'command',
            id,
            command,
            params,
        }));
    });
}

// ── HTTP Server ───────────────────────────────────────

async function handleRequest(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
        res.end(JSON.stringify({
            status: 'ok',
            plugin: pluginConnected,
            queue: requestQueue.length,
            pid: process.pid,
        }));
        return;
    }

    // Command execution
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { command, params } = JSON.parse(body);

                if (!command) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ status: 'error', error: 'Missing "command" field' }));
                    return;
                }

                // Health can be handled locally
                if (command === 'health') {
                    res.end(JSON.stringify({ status: 'ok', data: { plugin: pluginConnected } }));
                    return;
                }

                const result = await enqueue(command, params || {});
                res.end(JSON.stringify({ status: 'ok', data: result }));
            } catch (err) {
                res.writeHead(err.message.includes('Plugin not connected') ? 503 : 500);
                res.end(JSON.stringify({ status: 'error', error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
}

// ── Start Servers ─────────────────────────────────────

const httpServer = createServer(handleRequest);
const wss = new WebSocketServer({ server: httpServer, path: '/plugin' });

// Plugin WebSocket handling
wss.on('connection', (ws) => {
    log('Plugin connected');
    pluginWs = ws;
    pluginConnected = true;

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);

            // Hello handshake
            if (msg.type === 'hello') {
                log(`Plugin hello: v${msg.version}`);
                return;
            }

            // Pong response (heartbeat)
            if (msg.type === 'pong') return;

            // Command result
            if (msg.type === 'result' && msg.id) {
                const pending = pendingRequests.get(msg.id);
                if (pending) {
                    pendingRequests.delete(msg.id);
                    clearTimeout(pending.timeout);
                    if (msg.error) {
                        pending.reject(new Error(msg.error));
                    } else {
                        pending.resolve(msg.result);
                    }
                }
            }
        } catch (err) {
            log(`Message parse error: ${err.message}`);
        }
    });

    ws.on('close', () => {
        log('Plugin disconnected');
        pluginConnected = false;
        pluginWs = null;
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Plugin disconnected'));
        }
        pendingRequests.clear();
    });

    ws.on('error', (err) => {
        log(`Plugin WS error: ${err.message}`);
    });
});

// Heartbeat
setInterval(() => {
    if (pluginConnected && pluginWs) {
        pluginWs.send(JSON.stringify({ action: 'ping', id: Date.now().toString() }));
    }
}, 5000);

// Start listening
try {
    httpServer.listen(PORT, '127.0.0.1', () => {
        try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch { }
        writeFileSync(PID_FILE, process.pid.toString());
        log(`Daemon started on :${PORT} (PID ${process.pid})`);
        log('Waiting for plugin connection...');
    });
} catch (err) {
    log(`Failed to start: ${err.message}`);
    process.exit(1);
}
