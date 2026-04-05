/**
 * Transport Bridge — CLI-side client for talking to the daemon.
 * Sends structured commands via HTTP, receives JSON responses.
 */

import { getDaemonUrl } from '../utils/daemon-config.js';

/**
 * Send a structured command to the daemon.
 * @param {string} command - Command name (e.g. 'node.create')
 * @param {object} params - Command parameters
 * @param {{ timeout?: number, retries?: number }} opts
 * @returns {Promise<{ status: string, data?: any, error?: any }>}
 */
export async function sendCommand(command, params = {}, opts = {}) {
    const daemonUrl = getDaemonUrl();
    const timeout = opts.timeout || 30000;
    const maxRetries = opts.retries || 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(`${daemonUrl}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, params }),
                signal: controller.signal,
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMsg = data.error || `Daemon returned ${res.status}`;
                throw new Error(`[Transport Error] Command: ${command} | Detail: ${errorMsg}`);
            }

            return data;
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') continue;
            if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                continue;
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    if (lastError?.cause?.code === 'ECONNREFUSED') {
        throw new Error(`[Connection Error] Daemon unreachable at ${daemonUrl}. Ensure "figma-gemini-cli connect" is running.`);
    }
    throw lastError;
}

/**
 * Check daemon health.
 * @returns {Promise<{ status: string, plugin: boolean }>}
 */
export async function checkHealth() {
    const daemonUrl = getDaemonUrl();
    try {
        const res = await fetch(`${daemonUrl}/health`, { signal: AbortSignal.timeout(3000) });
        return await res.json();
    } catch {
        return { status: 'unreachable', plugin: false };
    }
}

/**
 * Send a batch of commands.
 * Automatically chunks large arrays to prevent payload overflows.
 * @param {object[]} commands - Array of { command, params }
 * @returns {Promise<object>}
 */
export async function sendBatch(commands, opts = {}) {
    if (!Array.isArray(commands) || commands.length <= 500) {
        return sendCommand('batch', { commands }, { timeout: opts.timeout || 60000 });
    }

    const CHUNK_SIZE = 500;
    const results = [];
    for (let i = 0; i < commands.length; i += CHUNK_SIZE) {
        const chunk = commands.slice(i, i + CHUNK_SIZE);
        const res = await sendCommand('batch', { commands: chunk }, { timeout: opts.timeout || 60000 });
        results.push(res);
    }
    return { status: 'ok', data: results };
}
