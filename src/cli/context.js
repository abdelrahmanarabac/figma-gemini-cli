import chalk from 'chalk';
import ora from 'ora';

export class CommandContext {
  /**
   * @param {Object} options - Global CLI options (e.g. { json: true })
   * @param {Object} deps - Injected dependencies
   */
  constructor(options = {}, deps = {}) {
    // JSON is opt-in. Non-interactive shells still suppress spinners,
    // but should keep human-readable output unless --json is requested.
    this.isJson = Boolean(options.json);
    this.isInteractive = Boolean(process.stdout.isTTY);

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

  _printJson(payload) {
    console.log(JSON.stringify(payload ?? {}, null, 2));
  }

  output(jsonPayload, renderHuman = null) {
    if (this.isJson) {
      this._printJson(jsonPayload);
      return;
    }

    if (typeof renderHuman === 'function') {
      renderHuman();
      return;
    }

    if (jsonPayload !== undefined) {
      console.log(jsonPayload);
    }
  }

  startSpinner(text) {
    if (this.isInteractive && !this.isJson) {
      return ora(text).start();
    }

    const ctx = this;
    return {
      text,
      start() {
        return this;
      },
      stop() {
        return this;
      },
      succeed(message, jsonPayload = null) {
        if (message) {
          ctx.logSuccess(message, jsonPayload);
        }
        return this;
      },
      fail(message, jsonPayload = null) {
        if (message) {
          ctx.logError(message, jsonPayload);
        }
        return this;
      },
      warn(message, jsonPayload = null) {
        if (message) {
          ctx.logWarning(message, jsonPayload);
        }
        return this;
      },
    };
  }

  log(message, jsonPayload = null) {
    if (this.isJson) {
      this._printJson(jsonPayload ?? { message });
      return;
    }
    console.log(message);
  }

  logSuccess(message, jsonPayload = null) {
    if (this.isJson) {
      this._printJson(jsonPayload ?? { status: 'success', message });
      return;
    }
    console.log(chalk.green(`${this._getSymbol('success')} ${message}`));
    if (jsonPayload) {
      console.log(chalk.gray(JSON.stringify(jsonPayload, null, 2)));
    }
  }

  logWarning(message, jsonPayload = null) {
    if (this.isJson) {
      this._printJson(jsonPayload ?? { status: 'warning', message });
      return;
    }
    console.log(chalk.yellow(`${this._getSymbol('warning')} ${message}`));
  }

  logError(message, jsonPayload = null) {
    if (this.isJson) {
      this._printJson(jsonPayload || { status: 'error', error: message });
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
