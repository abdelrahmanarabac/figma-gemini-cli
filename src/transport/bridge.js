/**
 * Transport Bridge — CLI-side client for talking to the daemon.
 * Sends structured commands via HTTP, receives JSON responses.
 */

const DAEMON_URL = `http://127.0.0.1:${process.env.DAEMON_PORT || 3456}`;

/**
 * Send a structured command to the daemon.
 * @param {string} command - Command name (e.g. 'node.create')
 * @param {object} params - Command parameters
 * @param {{ timeout?: number }} opts
 * @returns {Promise<{ status: string, data?: any, error?: any }>}
 */
export async function sendCommand(command, params = {}, opts = {}) {
    const timeout = opts.timeout || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(`${DAEMON_URL}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, params }),
            signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Daemon returned ${res.status}`);
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`Command "${command}" timed out after ${timeout}ms`);
        }
        if (err.cause?.code === 'ECONNREFUSED') {
            throw new Error('Daemon not running. Start with: figma-ds-cli connect');
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Check daemon health.
 * @returns {Promise<{ status: string, plugin: boolean }>}
 */
export async function checkHealth() {
    try {
        const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(3000) });
        return await res.json();
    } catch {
        return { status: 'unreachable', plugin: false };
    }
}

/**
 * Send a batch of commands.
 * @param {object[]} commands - Array of { command, params }
 * @returns {Promise<object>}
 */
export async function sendBatch(commands, opts = {}) {
    return sendCommand('batch', { commands }, { timeout: opts.timeout || 60000 });
}
