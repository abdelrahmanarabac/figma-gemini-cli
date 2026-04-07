import chalk from 'chalk';
import ora from 'ora';

export class CommandContext {
  /**
   * @param {Object} options - Global CLI options (e.g. { json: true })
   * @param {Object} deps - Injected dependencies
   */
  constructor(options = {}, deps = {}) {
    this.isJson = Boolean(options.json);
    this.isInteractive = Boolean(process.stdout.isTTY);
    this._deps = deps;
    this._figmaClient = null;
    this._pipeline = null;
  }

  // ── Pipeline ─────────────────────────────────────────

  /**
   * Returns the pipeline module (prepare, build, validate, run).
   * @returns {Promise<Object>}
   */
  async getPipeline() {
    if (!this._pipeline) {
      this._pipeline = await import('../pipeline/index.js');
    }
    return this._pipeline;
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
      start() { return this; },
      stop() { return this; },
      succeed(message, jsonPayload = null) {
        if (message) ctx.logSuccess(message, jsonPayload);
        return this;
      },
      fail(message, jsonPayload = null) {
        if (message) ctx.logError(message, jsonPayload);
        return this;
      },
      warn(message, jsonPayload = null) {
        if (message) ctx.logWarning(message, jsonPayload);
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

  analyzeError(err) {
    const msg = (err.message || err.toString()).toLowerCase();

    if (msg.includes('econrefused') || msg.includes('unreachable') || msg.includes('not connected')) {
      return { category: 'Connection', suggestion: 'Run "node src/index.js connect" in a separate terminal to start the daemon, then open the Figma plugin.' };
    }
    if (msg.includes('eaddrinuse')) {
      return { category: 'Port Conflict', suggestion: 'Another instance of the daemon is already running. Check for existing processes or use a different port.' };
    }
    if (msg.includes('unclosed tag') || msg.includes('parse error')) {
      return { category: 'Syntax', suggestion: 'Check your JSX string for unclosed tags or invalid prop syntax. Ensure braces {} are balanced.' };
    }
    if (msg.includes('timeout')) {
      return { category: 'Timeout', suggestion: 'The Figma plugin took too long to respond. The document might be too large or the plugin might be paused.' };
    }

    return { category: 'Internal', suggestion: 'Check the error message for details.' };
  }

  logError(message, jsonPayload = null) {
    if (this.isJson) {
      this._printJson(jsonPayload || { status: 'error', error: message });
      return;
    }
    console.log(chalk.red(`${this._getSymbol('error')} ${message}`));

    const analysis = this.analyzeError(new Error(message));
    if (analysis && analysis.category) {
      console.log(chalk.yellow(`   ↳ [${analysis.category}] ${analysis.suggestion}`));
    }

    if (jsonPayload) {
      console.log(chalk.gray(JSON.stringify(jsonPayload, null, 2)));
    }
  }

  // ── Figma Execution ──────────────────────────────────

  async eval(code) {
    try {
      // First try: operation-based dispatch (safe, CSP-compliant)
      const result = await this.command('eval', { code });
      return result?.data;
    } catch (e) {
      // Fallback: fast eval via daemon direct transport
      if (this._deps.fastEval) {
        try {
          return await this._deps.fastEval(code);
        } catch (fastErr) {
          // If fastEval also fails, throw the original error
          throw e;
        }
      }
      throw e;
    }
  }

  /**
   * Execute a named eval operation using the safe operation-based dispatch.
   * This is the preferred method — avoids raw code strings entirely.
   * @param {string} op - Operation name (e.g. 'variables.list', 'canvas.info')
   * @param {object} args - Operation arguments
   * @returns {Promise<any>}
   */
  async evalOp(op, args = {}) {
    const result = await this.command('eval', { op, args });
    return result?.data;
  }

  async render(jsx) {
    const { parseJSX } = await import('../parser/jsx.js');
    const { sendBatch } = await import('../transport/bridge.js');
    const { commands, errors } = parseJSX(jsx);

    if (commands.length === 0) {
      throw new Error('Failed to parse JSX:\n' + errors.join('\n'));
    }

    return await sendBatch(commands);
  }

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
