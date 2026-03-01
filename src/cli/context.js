import chalk from 'chalk';

export class CommandContext {
  /**
   * @param {Object} options - Global CLI options (e.g. { json: true })
   * @param {Object} deps - Injected dependencies
   * @param {{ load: Function, save: Function }} deps.config - Config handlers
   * @param {() => Promise<any>} deps.getFigmaClient - Factory to get a connected Figma CDP client
   * @param {() => number} deps.getCdpPort - Gets the active port
   * @param {(code: string) => Promise<any>} deps.fastEval - Execute code in Figma (daemon + fallback)
   * @param {(jsx: string) => Promise<any>} deps.fastRender - Render JSX in Figma (daemon + fallback)
   */
  constructor(options = {}, deps = {}) {
    // If output is piped or explicitly requests JSON, use strict JSON output.
    this.isJson = options.json || !process.stdout.isTTY;

    // Injected dependencies from the router to decouple Context from implementations
    this._deps = deps;
    this._figmaClient = null;
  }

  // ── Output ───────────────────────────────────────────

  log(message, jsonPayload = null) {
    if (this.isJson) {
      if (jsonPayload) {
        console.log(JSON.stringify(jsonPayload, null, 2));
      }
      return;
    }
    console.log(message);
  }

  logSuccess(message, jsonPayload = null) {
    if (this.isJson) {
      if (jsonPayload) {
        console.log(JSON.stringify(jsonPayload, null, 2));
      }
      return;
    }
    console.log(chalk.green(`✓ ${message}`));
  }

  logWarning(message) {
    if (this.isJson) return;
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  logError(message, jsonPayload = null) {
    if (this.isJson) {
      console.log(JSON.stringify(jsonPayload || { error: message }, null, 2));
      return;
    }
    console.log(chalk.red(`✗ ${message}`));
  }

  // ── Figma Execution ──────────────────────────────────

  /**
   * Execute Figma Plugin API code. Primary execution path.
   * Uses daemon if available, falls back to direct CDP.
   * @param {string} code - JavaScript code to evaluate in Figma
   * @returns {Promise<any>}
   */
  async eval(code) {
    if (!this._deps.fastEval) throw new Error('fastEval dependency not injected');
    return await this._deps.fastEval(code);
  }

  /**
   * Render JSX-like syntax in Figma.
   * Uses daemon if available, falls back to direct CDP.
   * @param {string} jsx - JSX string to render
   * @returns {Promise<any>}
   */
  async render(jsx) {
    if (!this._deps.fastRender) throw new Error('fastRender dependency not injected');
    return await this._deps.fastRender(jsx);
  }

  // ── Dependencies ─────────────────────────────────────

  get config() {
    if (!this._deps.config) throw new Error('Config dependency not injected');
    return this._deps.config;
  }

  get cdpPort() {
    if (!this._deps.getCdpPort) throw new Error('getCdpPort dependency not injected');
    return this._deps.getCdpPort();
  }

  async getActivePage() {
    if (!this._deps.getActivePage) throw new Error('getActivePage dependency not injected');
    return await this._deps.getActivePage(this.cdpPort);
  }

  async getFigmaClient() {
    if (!this._deps.getFigmaClient) throw new Error('FigmaClient dependency not injected');

    if (!this._figmaClient) {
      this._figmaClient = await this._deps.getFigmaClient();
    }
    return this._figmaClient;
  }

  async close() {
    if (this._figmaClient && typeof this._figmaClient.close === 'function') {
      this._figmaClient.close();
      this._figmaClient = null;
    }
  }
}
