import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.figma-ds-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function setConfig(key, value) {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

export function getConfig(key) {
  const config = loadConfig();
  return config[key];
}
