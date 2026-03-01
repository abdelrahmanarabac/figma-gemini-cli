/**
 * Figma Patch
 *
 * Patches Figma Desktop to enable remote debugging.
 * Newer Figma versions block --remote-debugging-port by default.
 */

import { readFileSync, writeFileSync, accessSync, constants, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

// Fixed CDP port (figma-use has 9222 hardcoded)
const CDP_PORT = 9222;

// The string that blocks remote debugging
const BLOCK_STRING = Buffer.from('removeSwitch("remote-debugging-port")');
// The patched string (changes "port" to "Xort" to disable the block)
const PATCH_STRING = Buffer.from('removeSwitch("remote-debugXing-port")');

/**
 * Get the CDP port (always 9222 for figma-use compatibility)
 */
export function getCdpPort() {
  return CDP_PORT;
}

/**
 * Get the path to Figma's app.asar file
 */
export function getAsarPath() {
  if (process.platform === 'darwin') {
    return '/Applications/Figma.app/Contents/Resources/app.asar';
  }

  if (process.platform === 'linux') {
    return '/opt/figma/resources/app.asar';
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return null;

    const figmaDir = join(localAppData, 'Figma');
    try {
      // Find latest app-* folder
      const folders = readdirSync(figmaDir).filter(f => f.startsWith('app-'));
      if (folders.length === 0) return null;

      // Sort by version (simple lexicographical sort works for app-X.Y.Z)
      const latest = folders.sort().reverse()[0];
      return join(figmaDir, latest, 'resources', 'app.asar');
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Check if Figma is patched
 * @returns {boolean|null} true=patched, false=not patched, null=can't determine
 */
export function isPatched() {
  const asarPath = getAsarPath();
  if (!asarPath) return null;

  try {
    const content = readFileSync(asarPath);

    if (content.includes(PATCH_STRING)) {
      return true; // Already patched
    }

    if (content.includes(BLOCK_STRING)) {
      return false; // Needs patching
    }

    return null; // Can't determine (maybe old Figma version)
  } catch {
    return null;
  }
}

/**
 * Check if we have write access to the Figma app.asar file
 * @returns {boolean} true if we can write, false otherwise
 */
export function canPatchFigma() {
  const asarPath = getAsarPath();
  if (!asarPath) return false;

  try {
    accessSync(asarPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Patch Figma to enable remote debugging
 * @returns {boolean} true if patched successfully
 */
export function patchFigma() {
  const asarPath = getAsarPath();
  if (!asarPath) {
    throw new Error('Cannot detect Figma installation path for this platform');
  }

  // Check write access first
  if (!canPatchFigma()) {
    if (process.platform === 'darwin') {
      throw new Error('No write access to Figma. Grant Terminal "Full Disk Access" in System Settings → Privacy & Security');
    } else {
      throw new Error('No write access to Figma. Try running as administrator.');
    }
  }

  const content = readFileSync(asarPath);
  const blockIndex = content.indexOf(BLOCK_STRING);

  if (blockIndex < 0) {
    // Check if already patched
    if (content.includes(PATCH_STRING)) {
      return true; // Already patched
    }
    throw new Error('Could not find the string to patch. Figma version may be incompatible.');
  }

  // Apply patch
  PATCH_STRING.copy(content, blockIndex);
  writeFileSync(asarPath, content);

  // On macOS, re-sign the app
  if (process.platform === 'darwin') {
    try {
      execSync('codesign --force --deep --sign - /Applications/Figma.app', { stdio: 'ignore' });
    } catch {
      // Codesign might fail but patch might still work
    }
  }

  return true;
}

/**
 * Unpatch Figma to restore original state (re-enables remote debugging block)
 * @returns {boolean} true if unpatched successfully
 */
export function unpatchFigma() {
  const asarPath = getAsarPath();
  if (!asarPath) {
    throw new Error('Cannot detect Figma installation path for this platform');
  }

  const content = readFileSync(asarPath);
  const patchIndex = content.indexOf(PATCH_STRING);

  if (patchIndex < 0) {
    // Check if already unpatched (original state)
    if (content.includes(BLOCK_STRING)) {
      return true; // Already in original state
    }
    throw new Error('Could not find the patched string. Figma may not have been patched by this tool.');
  }

  // Restore original
  BLOCK_STRING.copy(content, patchIndex);
  writeFileSync(asarPath, content);

  // On macOS, re-sign the app
  if (process.platform === 'darwin') {
    try {
      execSync('codesign --force --deep --sign - /Applications/Figma.app', { stdio: 'ignore' });
    } catch {
      // Codesign might fail but unpatch might still work
    }
  }

  return true;
}

/**
 * Get the command to start Figma with remote debugging
 */
export function getFigmaCommand(port = 9222) {
  switch (process.platform) {
    case 'darwin':
      return `open -a Figma --args --remote-debugging-port=${port}`;
    case 'win32':
      return `"%LOCALAPPDATA%\\Figma\\Figma.exe" --remote-debugging-port=${port}`;
    case 'linux':
      return `figma --remote-debugging-port=${port}`;
    default:
      return null;
  }
}

/**
 * Get the path to Figma binary
 */
export function getFigmaBinaryPath() {
  switch (process.platform) {
    case 'darwin':
      return '/Applications/Figma.app/Contents/MacOS/Figma';
    case 'win32':
      return `${process.env.LOCALAPPDATA}\\Figma\\Figma.exe`;
    case 'linux':
      return '/usr/bin/figma';
    default:
      return null;
  }
}

export default {
  getAsarPath,
  isPatched,
  canPatchFigma,
  patchFigma,
  unpatchFigma,
  getFigmaCommand,
  getFigmaBinaryPath,
  getCdpPort
};
