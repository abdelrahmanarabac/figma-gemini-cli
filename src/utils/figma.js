import { execSync, spawn } from 'child_process';
import { platform, homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { FigmaClient } from '../core/figma-client.js';
import { getCdpPort } from '../figma-patch.js';
import chalk from 'chalk';

const IS_WINDOWS = platform() === 'win32';
const IS_MAC = platform() === 'darwin';
const IS_LINUX = platform() === 'linux';

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

  const pid = parseInt(readFileSync(DAEMON_PID_FILE, 'utf8').trim(), 10);
  if (pid) {
    try {
      // Sending signal 0 checks if the OS process is alive without killing it.
      process.kill(pid, 0);
      // If it IS alive but the HTTP health check failed, it's a zombie. Kill it.
      process.kill(pid, 'SIGKILL');
    } catch (e) {
      // Process is dead (ESRCH), so we just safely proceed to cleanup.
    }
  }
  // Remove the stale file
  unlinkSync(DAEMON_PID_FILE);
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

let _figmaClient = null;

export async function getFigmaClient() {
  if (!_figmaClient) {
    _figmaClient = new FigmaClient();
    await _figmaClient.connect();
  }
  return _figmaClient;
}

export async function fastEval(code) {
  // Try daemon first
  if (await isDaemonRunning()) {
    try {
      return await daemonExec('eval', { code });
    } catch (e) {
      // Continue to fallbacks
    }
  }

  // Fallback: direct connection
  const client = await getFigmaClient();
  return await client.eval(code);
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

export function getFigmaPath() {
  if (IS_MAC) {
    return '/Applications/Figma.app/Contents/MacOS/Figma';
  } else if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(localAppData, 'Figma', 'Figma.exe');
  } else {
    return '/usr/bin/figma';
  }
}

export function startFigma() {
  const port = getCdpPort();
  const figmaPath = getFigmaPath();
  if (IS_MAC) {
    execSync(`open -a Figma --args --remote-debugging-port=${port}`, { stdio: 'pipe' });
  } else if (IS_WINDOWS) {
    spawn(figmaPath, [`--remote-debugging-port=${port}`], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(figmaPath, [`--remote-debugging-port=${port}`], { detached: true, stdio: 'ignore' }).unref();
  }
}

export function killFigma() {
  try {
    if (IS_MAC) {
      try { execSync('pkill -x Figma', { stdio: 'ignore' }); } catch (e) { }
    } else if (IS_WINDOWS) {
      try { execSync('taskkill /IM Figma.exe /F', { stdio: 'ignore' }); } catch (e) { }
    } else {
      try { execSync('pkill -x figma', { stdio: 'ignore' }); } catch (e) { }
    }
  } catch (e) { }
}

export function getManualStartCommand() {
  const port = getCdpPort();
  const figmaPath = getFigmaPath();
  if (IS_MAC) {
    return `open -a Figma --args --remote-debugging-port=${port}`;
  } else if (IS_WINDOWS) {
    return `"${figmaPath}" --remote-debugging-port=${port}`;
  } else {
    return `${figmaPath} --remote-debugging-port=${port}`;
  }
}

export function stopDaemon() {
  cleanStaleDaemon();
  try {
    if (IS_MAC || IS_LINUX) {
      try { execSync(`lsof -ti:${DAEMON_PORT} | xargs kill -9`, { stdio: 'ignore' }); } catch (e) { }
    } else if (IS_WINDOWS) {
      try {
        const pids = execSync(`netstat -ano | findstr :${DAEMON_PORT}`, { encoding: 'utf8' });
        const lines = pids.trim().split('\\n');
        for (const line of lines) {
          const parts = line.trim().split(/\\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          }
        }
      } catch (e) { }
    }
  } catch { }
}

export async function startDaemon(force = false, mode = 'auto') {
  if (await isDaemonRunning() && !force) return;

  // 1. Check for port conflicts
  try {
    const testRes = await fetch(`http://127.0.0.1:${DAEMON_PORT}/health`, { signal: AbortSignal.timeout(500) });
    if (testRes.status === 200 && !force) {
      return; // Already running
    }
  } catch (e) {
    // Port might be in use by another app or just not responding correctly
  }

  // 1. Clean up any corrupted state before starting
  cleanStaleDaemon();

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonPath = join(__dirname, '..', 'transport', 'daemon.js');

  // 2. Open log file in append mode. Node OS layer handles writing seamlessly.
  const { openSync } = await import('fs');
  const logFd = openSync(DAEMON_LOG_FILE, 'a');

  const args = [daemonPath];
  if (mode === 'plugin') args.push('--plugin');

  // 3. Pass the log file descriptor to stdout and stderr
  // Array format: [stdin, stdout, stderr]
  const proc = spawn('node', args, {
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });

  proc.unref(); // Let CLI exit while daemon runs in background

  // 4. Verification Loop (Simple polling)
  const startTime = Date.now();
  while (Date.now() - startTime < 5000) {
    if (await isDaemonRunning()) {
      return; // Success!
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // Check if port is in use but not by us
  throw new Error(`Daemon failed to start on port ${DAEMON_PORT}. Ensure the port is not in use by another application. Check logs at: ${DAEMON_LOG_FILE}`);
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
