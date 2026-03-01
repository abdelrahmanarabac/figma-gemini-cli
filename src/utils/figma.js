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

export function isDaemonRunning() {
  try {
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${DAEMON_PORT}/health`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 1000
    });
    return response.trim() === '200';
  } catch {
    return false;
  }
}

export async function daemonExec(action, data = {}) {
  const response = await fetch(`http://localhost:${DAEMON_PORT}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(60000)
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.result;
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
  if (isDaemonRunning()) {
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
  // Try daemon first
  if (isDaemonRunning()) {
    try {
      return await daemonExec('render', { jsx });
    } catch (e) {
      // Continue to fallbacks
    }
  }

  // Fallback: direct connection
  const client = await getFigmaClient();
  return await client.render(jsx);
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
      execSync('pkill -x Figma 2>/dev/null || true', { stdio: 'pipe' });
    } else if (IS_WINDOWS) {
      execSync('taskkill /IM Figma.exe /F 2>nul', { stdio: 'pipe' });
    } else {
      execSync('pkill -x figma 2>/dev/null || true', { stdio: 'pipe' });
    }
  } catch (e) {}
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

export function startDaemon(force = false, mode = 'auto') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonPath = join(__dirname, '..', 'daemon.js');
  
  if (isDaemonRunning() && !force) return;

  const args = [daemonPath];
  if (mode === 'plugin') args.push('--plugin');
  
  const proc = spawn('node', args, {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();
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
