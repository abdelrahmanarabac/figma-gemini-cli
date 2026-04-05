#!/usr/bin/env node

/**
 * Figma CLI Daemon v2 — Plugin-only.
 * 
 * HTTP server accepts commands from CLI.
 * WebSocket server connects to Figma plugin.
 * Request queue serializes access (Figma is single-threaded).
 * Pure relay for streaming actions.
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const PORT = parseInt(process.env.DAEMON_PORT) || 3456;
const CONFIG_DIR = join(homedir(), '.figma-cli');
const PID_FILE = join(CONFIG_DIR, 'daemon.pid');

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function checkLiveness() {
    if (existsSync(PID_FILE)) {
        try {
            const oldPid = parseInt(readFileSync(PID_FILE, 'utf8'));
            if (oldPid && !isNaN(oldPid)) {
                process.kill(oldPid, 0); // Check if process exists
                log(`Another daemon is already running (PID ${oldPid})`);
                process.exit(1);
            }
        } catch (e) {
            try { unlinkSync(PID_FILE); } catch (e) {} // Clean stale PID
        }
    }
}
checkLiveness();

// Plugin connection state
let pluginWs = null;
let pluginConnected = false;
const pendingRequests = new Map();

// CLI Stream state (only one concurrent stream supported for simplicity)
let streamWs = null;

// ── Command Processor ─────────────────────────────────

async function sendToPlugin(command, params) {
    return new Promise((resolve, reject) => {
        if (!pluginConnected || !pluginWs) {
            reject(new Error('Figma plugin not connected. Run "connect" first.'));
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
                const result = await sendToPlugin(command, params);
                res.end(JSON.stringify({ status: 'ok', data: result }));
            } catch (err) {
                res.writeHead(err.message.includes('not connected') ? 503 : 500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
}

// ── Start Servers ─────────────────────────────────────

const httpServer = createServer(handleRequest);
const wssPlugin = new WebSocketServer({ noServer: true });
const wssStream = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
    if (request.url === '/plugin') {
        wssPlugin.handleUpgrade(request, socket, head, (ws) => {
            wssPlugin.emit('connection', ws, request);
        });
    } else if (request.url === '/stream') {
        wssStream.handleUpgrade(request, socket, head, (ws) => {
            wssStream.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Stream WebSocket handling (CLI Side)
wssStream.on('connection', (ws) => {
    log('CLI Stream connected');
    streamWs = ws;

    ws.on('message', (data) => {
        // Relay EVERYTHING from CLI directly to Plugin
        if (pluginConnected && pluginWs) {
            pluginWs.send(data.toString());
        } else {
            ws.send(JSON.stringify({ action: 'stream.error', error: 'Plugin not connected' }));
        }
    });

    ws.on('close', () => {
        log('CLI Stream disconnected');
        if (streamWs === ws) streamWs = null;
    });
});

// Plugin WebSocket handling (Figma Side)
wssPlugin.on('connection', (ws) => {
    log('Plugin connected');
    pluginWs = ws;
    pluginConnected = true;

    // Heartbeat ping
    const heartbeatParams = { alive: true };
    ws.on('pong', () => { heartbeatParams.alive = true; });
    const pingInterval = setInterval(() => {
        if (!heartbeatParams.alive) {
            log('Plugin heartbeat timeout. Terminating connection.');
            ws.terminate();
            return;
        }
        heartbeatParams.alive = false;
        ws.ping();
    }, 30000);

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);

            // 1. Relay all stream events back to CLI
            if (msg.action && msg.action.startsWith('stream.')) {
                if (streamWs && streamWs.readyState === 1) {
                    streamWs.send(raw.toString());
                }
                return;
            }

            // 2. Resolve pending single commands
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
                return;
            }

            // Hello handshake
            if (msg.type === 'hello') {
                log(`Plugin hello: v${msg.version}`);
            }
        } catch (err) {
            log(`Message parse error: ${err.message}`);
        }
    });

    ws.on('close', () => {
        log('Plugin disconnected');
        pluginConnected = false;
        pluginWs = null;
        clearInterval(pingInterval);
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

httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use by another application.`);
        process.exit(1);
    }
    log(`HTTP Server Error: ${err.message}`);
});

try {
    httpServer.listen(PORT, '127.0.0.1', () => {
        try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch { }
        writeFileSync(PID_FILE, process.pid.toString());
        log(`Daemon started on :${PORT} (PID ${process.pid})`);
    });
} catch (err) {
    log(`Failed to start: ${err.message}`);
    process.exit(1);
}

function cleanup() {
    log('Daemon shutting down...');
    if (existsSync(PID_FILE)) {
        try { unlinkSync(PID_FILE); } catch (e) { log(`Failed to delete PID file: ${e.message}`); }
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
    if (existsSync(PID_FILE)) {
        try { unlinkSync(PID_FILE); } catch (e) {}
    }
});
