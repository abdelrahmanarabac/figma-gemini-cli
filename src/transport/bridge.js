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
    const maxRetries = opts.retries || 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                const errorMsg = data.error || `Daemon returned ${res.status}`;
                throw new Error(`[Transport Error] Command: ${command} | Action: ${params.id || 'N/A'} | Details: ${errorMsg}`);
            }

            return data;
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') {
                // If timed out, maybe the daemon is busy, retry?
                continue;
            }
            if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
                // If connection refused, wait a bit and retry (in case daemon is restarting)
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                continue;
            }
            throw err; // For other errors (parsing, etc.), fail early
        } finally {
            clearTimeout(timer);
        }
    }

    if (lastError.cause?.code === 'ECONNREFUSED') {
        throw new Error('[Connection Error] Daemon unreachable at ' + DAEMON_URL + '. Ensure the CLI daemon is running ("figma-gemini-cli connect").');
    }
    throw lastError;
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
