/**
 * Design Memory — Persistent learning store for the MoE agent system.
 *
 * Stores patterns, token history, user preferences, error catalogs,
 * and execution logs to disk as JSON files.
 *
 * Location: ~/.figma-cli/memory/
 */

import { promises as fsPromises, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MEMORY_DIR = join(homedir(), '.figma-cli', 'memory');

function ensureDir() {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadStore(name) {
  ensureDir();
  const filePath = join(MEMORY_DIR, `${name}.json`);
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

async function saveStore(name, data) {
  ensureDir();
  const filePath = join(MEMORY_DIR, `${name}.json`);
  try {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

export class DesignMemory {
  constructor() {
    this.patterns = loadStore('patterns');
    this.tokenHistory = loadStore('token-history');
    this.preferences = loadStore('preferences');
    this.errors = loadStore('errors');
    this.executions = loadStore('executions');
  }

  // ── Pattern Library ───────────────────────────────

  /**
   * Store a reusable component pattern.
   * @param {string} name - e.g. 'button/primary'
   * @param {{ jsx: string, tokens: string[], variants: string[] }} pattern
   */
  savePattern(name, pattern) {
    this.patterns[name] = {
      ...pattern,
      savedAt: new Date().toISOString(),
      useCount: (this.patterns[name]?.useCount || 0),
    };
    saveStore('patterns', this.patterns);
  }

  /**
   * Retrieve a pattern by name.
   * @param {string} name
   * @returns {Object|null}
   */
  getPattern(name) {
    const pattern = this.patterns[name];
    if (pattern) {
      pattern.useCount = (pattern.useCount || 0) + 1;
      saveStore('patterns', this.patterns);
    }
    return pattern || null;
  }

  /**
   * List all stored pattern names.
   * @returns {string[]}
   */
  listPatterns() {
    return Object.keys(this.patterns);
  }

  // ── Token History ─────────────────────────────────

  /**
   * Record a token value change.
   * @param {string} tokenName
   * @param {string} oldValue
   * @param {string} newValue
   * @param {string} reason
   */
  recordTokenChange(tokenName, oldValue, newValue, reason = '') {
    if (!this.tokenHistory[tokenName]) {
      this.tokenHistory[tokenName] = [];
    }
    this.tokenHistory[tokenName].push({
      from: oldValue,
      to: newValue,
      reason,
      date: new Date().toISOString(),
    });
    saveStore('token-history', this.tokenHistory);
  }

  /**
   * Get change history for a token.
   * @param {string} tokenName
   * @returns {Array}
   */
  getTokenHistory(tokenName) {
    return this.tokenHistory[tokenName] || [];
  }

  // ── User Preferences ──────────────────────────────

  /**
   * Record a user style preference.
   * @param {string} key - e.g. 'cornerRadius', 'defaultSpacing'
   * @param {any} value
   */
  recordPreference(key, value) {
    this.preferences[key] = {
      value,
      updatedAt: new Date().toISOString(),
      changeCount: (this.preferences[key]?.changeCount || 0) + 1,
    };
    saveStore('preferences', this.preferences);
  }

  /**
   * Get a preference value.
   * @param {string} key
   * @param {any} defaultValue
   * @returns {any}
   */
  getPreference(key, defaultValue = null) {
    return this.preferences[key]?.value ?? defaultValue;
  }

  /**
   * Get all preferences.
   * @returns {Object}
   */
  getAllPreferences() {
    const result = {};
    for (const [key, entry] of Object.entries(this.preferences)) {
      result[key] = entry.value;
    }
    return result;
  }

  // ── Error Catalog ─────────────────────────────────

  /**
   * Log an error with optional fix.
   * @param {string} errorType - e.g. 'svg-parse-fail'
   * @param {string} message
   * @param {string} fix - How it was resolved
   */
  logError(errorType, message, fix = '') {
    if (!this.errors[errorType]) {
      this.errors[errorType] = { count: 0, instances: [] };
    }
    this.errors[errorType].count++;
    this.errors[errorType].instances.push({
      message,
      fix,
      date: new Date().toISOString(),
    });
    // Keep only last 20 instances per error type
    if (this.errors[errorType].instances.length > 20) {
      this.errors[errorType].instances = this.errors[errorType].instances.slice(-20);
    }
    saveStore('errors', this.errors);
  }

  /**
   * Get error catalog summary.
   * @returns {Object}
   */
  getErrorSummary() {
    const summary = {};
    for (const [type, data] of Object.entries(this.errors)) {
      summary[type] = {
        count: data.count,
        lastSeen: data.instances[data.instances.length - 1]?.date,
        lastFix: data.instances[data.instances.length - 1]?.fix,
      };
    }
    return summary;
  }

  // ── Execution Log ─────────────────────────────────

  /**
   * Record an MoE pipeline execution.
   * @param {Object} execution
   */
  async recordExecution(execution) {
    if (!this.executions.history) {
      this.executions.history = [];
    }
    this.executions.history.push({
      ...execution,
      date: new Date().toISOString(),
    });
    // Keep last 100 executions
    if (this.executions.history.length > 100) {
      this.executions.history = this.executions.history.slice(-100);
    }
    this.executions.stats = this.executions.stats || {};
    this.executions.stats.totalRuns = (this.executions.stats.totalRuns || 0) + 1;
    this.executions.stats.avgDuration = Math.round(
      this.executions.history.reduce((sum, e) => sum + (e.duration || 0), 0) / this.executions.history.length
    );
    saveStore('executions', this.executions);
  }

  /**
   * Get execution stats.
   * @returns {Object}
   */
  getStats() {
    return {
      totalRuns: this.executions.stats?.totalRuns || 0,
      avgDuration: this.executions.stats?.avgDuration || 0,
      patternCount: Object.keys(this.patterns).length,
      preferenceCount: Object.keys(this.preferences).length,
      errorTypes: Object.keys(this.errors).length,
    };
  }
}
