import { execSync, spawn } from 'child_process';
import { platform, homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import { getDaemonPort, getDaemonUrl } from './daemon-config.js';

const IS_WINDOWS = platform() === 'win32';
const IS_MAC = platform() === 'darwin';

const DAEMON_PID_FILE = join(homedir(), '.figma-cli-daemon.pid');
const DAEMON_LOG_FILE = join(homedir(), '.figma-cli-daemon.log');

export async function isDaemonRunning() {
  const daemonPort = getDaemonPort();
  try {
    const res = await fetch(`http://127.0.0.1:${daemonPort}/health`, {
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
  const response = await fetch(`${getDaemonUrl()}/command`, {
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
  const daemonPort = getDaemonPort();

  cleanStaleDaemon();

  const proc = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DAEMON_PORT: String(daemonPort),
    }
  });

  proc.unref();
  return true;
}

export function startFigma() {
  if (IS_WINDOWS) {
    const figmaPath = join(process.env.LOCALAPPDATA || '', 'Figma', 'Figma.exe');
    if (existsSync(figmaPath)) {
      spawn(figmaPath, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
  } else if (IS_MAC) {
    try {
      spawn('open', ['-a', 'Figma', '--args', '--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' }).unref();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
