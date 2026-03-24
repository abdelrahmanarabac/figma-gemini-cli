/**
 * Orchestrator — The MoE Gating Network & Pipeline Coordinator.
 *
 * Decomposes user intent → scores experts → dispatches top-K →
 * aggregates results → logs to memory.
 */

import chalk from 'chalk';

export class Orchestrator {
  /**
   * @param {import('./expert.js').Expert[]} experts
   * @param {import('../memory/design-memory.js').DesignMemory} memory
   */
  constructor(experts = [], memory = null) {
    this.experts = experts;
    this.memory = memory;
    this.minRelevance = 0.3;
    this.trace = [];
  }

  /**
   * Register an expert at runtime.
   * @param {import('./expert.js').Expert} expert
   */
  register(expert) {
    this.experts.push(expert);
  }

  /**
   * Parse user input into a structured intent.
   * @param {string} rawInput
   * @param {Object} context - Current state (canvas, tokens, etc.)
   * @returns {import('./expert.js').Intent}
   */
  parseIntent(rawInput, context = {}) {
    const lower = rawInput.toLowerCase();

    // Detect primary action
    let action = 'generate';
    if (lower.startsWith('audit') || lower.includes('check')) action = 'audit';
    else if (lower.startsWith('render') || lower.includes('render')) action = 'render';
    else if (lower.startsWith('update') || lower.includes('update')) action = 'update';
    else if (lower.includes('token') || lower.includes('color') || lower.includes('palette')) action = 'tokens';
    else if (lower.includes('responsive') || lower.includes('breakpoint')) action = 'responsive';
    else if (lower.includes('accessibility') || lower.includes('a11y') || lower.includes('contrast')) action = 'accessibility';

    // Extract capability tags
    const tags = [];
    const tagMap = {
      color: ['color', 'palette', 'fill', 'bg', 'background', 'theme', 'dark', 'light'],
      layout: ['layout', 'flex', 'grid', 'responsive', 'stack', 'column', 'row', 'sidebar'],
      typography: ['text', 'font', 'heading', 'title', 'paragraph', 'copy', 'writing'],
      token: ['token', 'variable', 'design system', 'spacing', 'radius'],
      component: ['button', 'card', 'input', 'form', 'nav', 'modal', 'dialog', 'badge', 'table', 'list'],
      icon: ['icon', 'svg', 'illustration', 'image', 'chart', 'graph'],
      validation: ['audit', 'check', 'validate', 'accessibility', 'a11y', 'contrast'],
      interaction: ['hover', 'click', 'prototype', 'animation', 'transition'],
    };

    for (const [tag, keywords] of Object.entries(tagMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        tags.push(tag);
      }
    }

    // Always include component tag for generate/render
    if ((action === 'generate' || action === 'render') && !tags.includes('component')) {
      tags.push('component');
    }

    return {
      raw: rawInput,
      action,
      tags,
      params: { ...context },
    };
  }

  /**
   * Gate: Score all experts for the given intent, return top-K.
   * @param {import('./expert.js').Intent} intent
   * @returns {{ expert: import('./expert.js').Expert, score: number }[]}
   */
  gate(intent) {
    const scored = this.experts
      .map(expert => ({
        expert,
        score: expert.relevance(intent),
      }))
      .filter(e => e.score >= this.minRelevance)
      .sort((a, b) => {
        // Sort by score desc, then priority asc (lower = earlier)
        if (b.score !== a.score) return b.score - a.score;
        return a.expert.priority - b.expert.priority;
      });

    return scored;
  }

  /**
   * Execute the full MoE pipeline for a user intent.
   *
   * @param {import('../cli/context.js').CommandContext} ctx
   * @param {string} rawInput - User's natural language input
   * @param {Object} context - Current state
   * @param {Object} options - Pipeline options
   * @returns {Promise<PipelineResult>}
   */
  async execute(ctx, rawInput, context = {}, options = {}) {
    const startTime = Date.now();
    this.trace = [];

    // 1. Parse intent
    const intent = this.parseIntent(rawInput, context);
    this._log('intent', `Action: ${intent.action}, Tags: [${intent.tags.join(', ')}]`);

    // 2. Gate — select relevant experts
    const selected = this.gate(intent);

    if (selected.length === 0) {
      this._log('gate', 'No experts matched. Falling back to Builder.');
      // Fallback to direct render
      return {
        success: false,
        error: 'No experts matched the intent',
        trace: this.trace,
      };
    }

    this._log('gate', `Selected ${selected.length} experts: ${selected.map(s => `${s.expert.name}(${s.score.toFixed(2)})`).join(', ')}`);

    // 3. Execute pipeline — sequential, output chains
    const results = {};
    let pipelineData = { intent, commands: [], jsx: '' };
    let overallSuccess = true;

    for (const { expert, score } of selected) {
      const task = {
        id: `${expert.name}-${Date.now()}`,
        type: intent.action,
        description: intent.raw,
        input: pipelineData,
        dependencies: [],
      };

      try {
        this._log('execute', `→ ${expert.name} (score: ${score.toFixed(2)})`);
        const result = await expert.execute(ctx, task, pipelineData);
        results[expert.name] = result;

        // Chain outputs
        if (result.data) {
          if (result.data.commands) pipelineData.commands = result.data.commands;
          if (result.data.jsx) pipelineData.jsx = result.data.jsx;
          if (result.data.tokens) pipelineData.tokens = result.data.tokens;
          // Spread any extra data
          pipelineData = { ...pipelineData, ...result.data };
        }

        if (result.warnings && result.warnings.length > 0) {
          this._log('warning', `${expert.name}: ${result.warnings.join('; ')}`);
        }

        if (!result.success) {
          this._log('error', `${expert.name} failed: ${(result.errors || []).join('; ')}`);
          // Don't break — let Guardian-type agents still run
          if (expert.name === 'builder') overallSuccess = false;
        }
      } catch (err) {
        this._log('error', `${expert.name} threw: ${err.message}`);
        results[expert.name] = { success: false, errors: [err.message] };
      }
    }

    // 4. Record to memory
    if (this.memory) {
      try {
        await this.memory.recordExecution({
          intent,
          selected: selected.map(s => ({ name: s.expert.name, score: s.score })),
          results,
          duration: Date.now() - startTime,
        });
      } catch { /* Memory failures are non-critical */ }
    }

    const duration = Date.now() - startTime;
    this._log('complete', `Pipeline finished in ${duration}ms`);

    return {
      success: overallSuccess,
      results,
      trace: this.trace,
      duration,
      pipelineData,
    };
  }

  /**
   * Print pipeline trace to console (verbose mode).
   */
  printTrace() {
    console.log(chalk.gray('\n── MoE Pipeline Trace ──'));
    for (const entry of this.trace) {
      const icon = {
        intent: '🧠',
        gate: '🔀',
        execute: '⚡',
        warning: '⚠️',
        error: '❌',
        complete: '✅',
      }[entry.type] || '•';

      const color = {
        intent: chalk.cyan,
        gate: chalk.blue,
        execute: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        complete: chalk.green,
      }[entry.type] || chalk.gray;

      console.log(color(`  ${icon} [${entry.type}] ${entry.message}`));
    }
    console.log(chalk.gray('────────────────────────\n'));
  }

  /** @private */
  _log(type, message) {
    this.trace.push({ type, message, timestamp: Date.now() });
  }
}

/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success
 * @property {Object<string, import('./expert.js').ExpertResult>} results
 * @property {Array} trace
 * @property {number} duration
 * @property {Object} pipelineData
 */
