#!/usr/bin/env node

/**
 * Figma CLI — Entry Point
 */

// Enforce UTF-8 encoding for terminal output (crucial for Windows/CMD)
if (process.stdout.isTTY) {
    process.stdout.setDefaultEncoding('utf8');
}

import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { FigmaClient } from './core/figma-client.js';
import { CliRouter } from './cli/router.js';
import { fastEval, fastRender, getFigmaClient } from './utils/figma.js';
import { loadConfig, saveConfig } from './utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// Initialize config dir if missing
const CONFIG_DIR = join(homedir(), '.figma-cli');
try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch { }

const router = new CliRouter('figma-gemini-cli', pkg.version, pkg.description, {
  config: { load: loadConfig, save: saveConfig },
  getFigmaClient,
  getActivePage: FigmaClient.getActivePage,
  fastEval,
  fastRender
});

(async () => {
  await router.discoverCommands(join(__dirname, 'commands'));
  await router.discoverCommands(join(__dirname, 'capabilities'));
  router.run(process.argv);
})();
