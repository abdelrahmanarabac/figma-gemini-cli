import { execSync, spawn } from 'child_process';
import { platform, homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import chalk from 'chalk';

const IS_WINDOWS = platform() === 'win32';
const IS_MAC = platform() === 'darwin';

const DAEMON_PORT = 3456;
const DAEMON_PID_FILE = join(homedir(), '.figma-cli-daemon.pid');
const DAEMON_LOG_FILE = join(homedir(), '.figma-cli-daemon.log');

export async function isDaemonRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/health`, {
      signal: AbortSignal.timeout(500)
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export function cleanStaleDaemon() {
  if (!existsSync(DAEMON_PID_FILE)) return;
  try { unlinkSync(DAEMON_PID_FILE); } catch {}
}

export async function daemonExec(action, data = {}) {
  const response = await fetch(`http://127.0.0.1:${DAEMON_PORT}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: action, params: data }),
    signal: AbortSignal.timeout(60000)
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data;
}

export async function fastEval(code) {
  if (await isDaemonRunning()) {
    return await daemonExec('eval', { code });
  }
  throw new Error('Figma CLI Daemon not running. Run "connect" first.');
}

export async function fastRender(jsx) {
  const { parseJSX } = await import('../parser/jsx.js');
  const { sendBatch } = await import('../transport/bridge.js');
  
  const { commands, errors } = parseJSX(jsx);
  if (commands.length === 0) {
    throw new Error('Failed to parse JSX: ' + (errors[0] || 'Unknown error'));
  }
  
  return await sendBatch(commands);
}

export function startDaemon(force = false) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonPath = join(__dirname, '..', 'transport', 'daemon.js');

  cleanStaleDaemon();

  const proc = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore'
  });

  proc.unref();
  return true;
}

export function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return { r, g, b };
}
