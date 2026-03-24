import chalk from 'chalk';

export class CommandContext {
  /**
   * @param {Object} options - Global CLI options (e.g. { json: true })
   * @param {Object} deps - Injected dependencies
   */
  constructor(options = {}, deps = {}) {
    // If output is piped or explicitly requests JSON, use strict JSON output.
    this.isJson = options.json || !process.stdout.isTTY;

    // Injected dependencies from the router to decouple Context from implementations
    this._deps = deps;
    this._figmaClient = null;
    this._agentSystem = null;
  }

  // ── MoE Agent System ────────────────────────────────

  /**
   * Lazy-loaded agent system: orchestrator, experts, and memory.
   * @returns {{ orchestrator: import('../agents/orchestrator.js').Orchestrator, memory: import('../memory/design-memory.js').DesignMemory, experts: Object }}
   */
  get agents() {
    if (!this._agentSystem) {
      // Lazy-init: loads synchronously on first access, then cached
      this._agentSystem = this._initAgents();
    }
    return this._agentSystem;
  }

  async _initAgents() {
    if (this._agentSystemResolved) return this._agentSystemResolved;
    const { createAgentSystem } = await import('../agents/index.js');
    this._agentSystemResolved = createAgentSystem();
    return this._agentSystemResolved;
  }

  /**
   * Async getter for agent system.
   * @returns {Promise<{ orchestrator: any, memory: any, experts: Object }>}
   */
  async getAgents() {
    if (this._agentSystemResolved) return this._agentSystemResolved;
    return await this._initAgents();
  }

  // ── Output ───────────────────────────────────────────

  _getSymbol(type) {
    const symbols = {
      success: '[OK]',
      warning: '[!]',
      error: '[X]'
    };
    return symbols[type] || '';
  }

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
    console.log(chalk.green(`${this._getSymbol('success')} ${message}`));
    if (jsonPayload) {
      console.log(chalk.gray(JSON.stringify(jsonPayload, null, 2)));
    }
  }

  logWarning(message) {
    if (this.isJson) return;
    console.log(chalk.yellow(`${this._getSymbol('warning')} ${message}`));
  }

  logError(message, jsonPayload = null) {
    if (this.isJson) {
      console.log(JSON.stringify(jsonPayload || { error: message }, null, 2));
      return;
    }
    console.log(chalk.red(`${this._getSymbol('error')} ${message}`));
    if (jsonPayload) {
      console.log(chalk.gray(JSON.stringify(jsonPayload, null, 2)));
    }
  }

  // ── Figma Execution ──────────────────────────────────

  /**
   * Execute Figma Plugin API code via structured command protocol.
   * @param {string} code - JavaScript code to evaluate in Figma
   * @returns {Promise<any>}
   */
  async eval(code) {
    try {
      const result = await this.command('eval', { code });
      return result?.data;
    } catch (e) {
      if (this._deps.fastEval) {
        return await this._deps.fastEval(code);
      }
      throw e;
    }
  }

  /**
   * Render JSX-like syntax in Figma via structured commands.
   * @param {string} jsx - JSX string to render
   * @returns {Promise<any>}
   */
  async render(jsx) {
    const { parseJSX } = await import('../parser/jsx.js');
    const { sendBatch } = await import('../transport/bridge.js');
    const { commands, errors } = parseJSX(jsx);

    if (commands.length === 0) {
      throw new Error('Failed to parse JSX:\n' + errors.join('\n'));
    }

    return await sendBatch(commands);
  }

  /**
   * Send a structured command to the Figma plugin.
   * @param {string} name - Command name
   * @param {Object} params - Command parameters
   * @returns {Promise<any>}
   */
  async command(name, params = {}) {
    const { sendCommand } = await import('../transport/bridge.js');
    return await sendCommand(name, params);
  }

  // ── Dependencies ─────────────────────────────────────

  get config() {
    if (!this._deps.config) throw new Error('Config dependency not injected');
    return this._deps.config;
  }

  async close() {
    if (this._figmaClient && typeof this._figmaClient.close === 'function') {
      this._figmaClient.close();
      this._figmaClient = null;
    }
  }
}
