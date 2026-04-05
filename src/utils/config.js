import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.figma-cli');
const LEGACY_CONFIG_DIR = join(homedir(), '.figma-gemini-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const LEGACY_CONFIG_FILE = join(LEGACY_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_NAMES = ['.figma-cli.yml', '.figma-cli.yaml', '.figma-cli.json'];

function readJsonFile(filePath) {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return {};
}

function parseScalar(rawValue) {
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  if (rawValue === 'null') return null;

  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function stripYamlComment(line) {
  let result = '';
  let quote = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if ((char === '"' || char === "'") && line[i - 1] !== '\\') {
      quote = quote === char ? null : (quote || char);
    }
    if (char === '#' && !quote) {
      break;
    }
    result += char;
  }

  return result;
}

function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of lines) {
    const line = stripYamlComment(rawLine);
    if (!line.trim()) continue;

    const indent = line.match(/^\s*/)?.[0]?.length || 0;
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].value;
    if (!rawValue) {
      current[key] = {};
      stack.push({ indent, value: current[key] });
      continue;
    }

    current[key] = parseScalar(rawValue);
  }

  return root;
}

function serializeScalar(value) {
  if (typeof value === 'string') {
    if (value === '' || /[:#\n]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function serializeSimpleYaml(value, indent = 0) {
  const padding = ' '.repeat(indent);
  const lines = [];

  for (const [key, entry] of Object.entries(value || {})) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      lines.push(`${padding}${key}:`);
      lines.push(serializeSimpleYaml(entry, indent + 2));
    } else {
      lines.push(`${padding}${key}: ${serializeScalar(entry)}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

function deepMerge(base = {}, override = {}) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function loadProjectConfigFile(filePath) {
  if (!filePath || !existsSync(filePath)) return {};

  try {
    const contents = readFileSync(filePath, 'utf8');
    const extension = extname(filePath).toLowerCase();
    if (extension === '.json') {
      return JSON.parse(contents);
    }
    return parseSimpleYaml(contents);
  } catch {
    return {};
  }
}

export function findProjectConfigPath(startDir = process.cwd()) {
  let currentDir = resolve(startDir);

  while (true) {
    for (const fileName of PROJECT_CONFIG_NAMES) {
      const candidate = join(currentDir, fileName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

export function loadProjectConfig(startDir = process.cwd()) {
  const configPath = findProjectConfigPath(startDir);
  return {
    path: configPath,
    config: loadProjectConfigFile(configPath),
  };
}

export function loadConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  const globalConfig = deepMerge(
    readJsonFile(LEGACY_CONFIG_FILE),
    readJsonFile(CONFIG_FILE),
  );
  const projectState = loadProjectConfig(cwd);
  const merged = deepMerge(globalConfig, projectState.config);

  return {
    ...merged,
    paths: {
      global: existsSync(CONFIG_FILE) ? CONFIG_FILE : (existsSync(LEGACY_CONFIG_FILE) ? LEGACY_CONFIG_FILE : null),
      project: projectState.path,
    },
    sources: {
      global: globalConfig,
      project: projectState.config,
    },
  };
}

export function saveConfig(config, options = {}) {
  const targetFile = options.file || CONFIG_FILE;
  const targetDir = dirname(targetFile);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetFile, JSON.stringify(config, null, 2));
}

export function saveProjectConfig(config, options = {}) {
  const cwd = options.cwd || process.cwd();
  const filePath = options.file || join(cwd, '.figma-cli.yml');
  const targetDir = dirname(filePath);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const yaml = serializeSimpleYaml(config);
  writeFileSync(filePath, `${yaml}\n`, 'utf8');
}

export function setConfig(key, value, options = {}) {
  const loaded = loadConfig(options);
  const config = deepMerge(loaded.sources?.global || {}, {});
  config[key] = value;
  saveConfig(config, options);
}

export function getConfig(key, options = {}) {
  const config = loadConfig(options);
  return config[key];
}

export function buildProjectConfig(overrides = {}) {
  return deepMerge({
    version: 1,
    preferences: {
      useExistingTokens: true,
      useExistingComponents: true,
      createMissingTokens: false,
    },
    theme: {
      mode: 'Light',
    },
    typography: {
      preferTextStyles: true,
      stylePrefix: null,
    },
  }, overrides);
}

export function resolveGenerationPreferences(options = {}, runtimeConfig = {}, inventory = {}) {
  const configuredPreferences = runtimeConfig.preferences || {};

  return {
    useExistingTokens: options.useExistingTokens !== undefined
      ? options.useExistingTokens
      : configuredPreferences.useExistingTokens !== undefined
        ? configuredPreferences.useExistingTokens
        : Boolean(inventory.tokenSummary?.collectionCount),
    useExistingComponents: options.useExistingComponents !== undefined
      ? options.useExistingComponents
      : configuredPreferences.useExistingComponents !== undefined
        ? configuredPreferences.useExistingComponents
        : Boolean(inventory.componentSummary?.count),
    createMissingTokens: options.createMissingTokens !== undefined
      ? options.createMissingTokens
      : configuredPreferences.createMissingTokens !== undefined
        ? configuredPreferences.createMissingTokens
        : false,
  };
}
