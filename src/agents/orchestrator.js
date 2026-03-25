/**
 * Orchestrator — The MoE 3-Phase Pipeline Coordinator.
 *
 * Phase 1 (PRE):   TokenExpert, Visual, UXWriter — gather context
 * Phase 2 (BUILD): Builder — produce JSX from context
 * Phase 3 (POST):  Responsive, A11y, Guardian — validate & enhance
 *
 * Key fix: Pre-processors write to their own namespace in pipelineData.
 * Only the Builder writes to jsx/commands. Post-processors validate.
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
    if (lower.startsWith('test') || lower.includes('smoke') || lower.includes('regression') || lower.includes('snapshot')) action = 'test';
    else if (lower.startsWith('audit') || lower.includes('check')) action = 'audit';
    else if (lower.startsWith('inspect')) action = 'inspect';
    else if (lower === 'get' || lower.startsWith('get ')) action = 'get';
    else if (lower.startsWith('find')) action = 'find';
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
      testing: ['test', 'smoke', 'regression', 'snapshot', 'qa'],
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
        // Sort by priority (within same phase, lower priority runs first)
        return a.expert.priority - b.expert.priority;
      });

    return scored;
  }

  /**
   * Execute the full MoE 3-phase pipeline.
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
    const intent = this.parseIntent(rawInput, { ...context, ...options });
    this._log('intent', `Action: ${intent.action}, Tags: [${intent.tags.join(', ')}]`);

    // 2. Gate — select relevant experts
    const selected = this.gate(intent);

    if (selected.length === 0) {
      this._log('gate', 'No experts matched. Falling back to Builder.');
      return {
        success: false,
        error: 'No experts matched the intent',
        trace: this.trace,
      };
    }

    // ── Separate by phase ──
    const phases = { pre: [], build: [], post: [] };
    for (const s of selected) {
      const phase = s.expert.phase || 'pre';
      if (phases[phase]) {
        phases[phase].push(s);
      } else {
        phases.pre.push(s); // fallback
      }
    }

    this._log('gate', `Selected ${selected.length} experts — Pre: ${phases.pre.map(s => s.expert.name).join(', ') || 'none'} | Build: ${phases.build.map(s => s.expert.name).join(', ') || 'none'} | Post: ${phases.post.map(s => s.expert.name).join(', ') || 'none'}`);

    let pipelineData = { intent, commands: [], jsx: '' };
    const results = {};
    let overallSuccess = true;

    const task = {
      id: `pipeline-${Date.now()}`,
      type: intent.action,
      description: intent.raw,
      input: { intent },
      dependencies: [],
    };

    // ── Phase 1: PRE-PROCESSORS (gather context) ──
    // Pre-processors add to their own namespaces. They CANNOT write jsx or commands.
    for (const { expert, score } of phases.pre) {
      try {
        this._log('execute', `[PRE] → ${expert.name} (${score.toFixed(2)})`);
        if (expert.name === 'token-expert') {
           pipelineData.tokens = expert.getDefaultTokenSet();
        }
        const result = await expert.execute(ctx, task, pipelineData);
        results[expert.name] = result;

        if (result.data) {
          for (const [key, value] of Object.entries(result.data)) {
            // Pre-processors must NOT overwrite jsx or commands
            if (key !== 'jsx' && key !== 'commands') {
              pipelineData[key] = value;
            }
          }
        }

        if (result.warnings && result.warnings.length > 0) {
          this._log('warning', `${expert.name}: ${result.warnings.join('; ')}`);
        }
      } catch (err) {
        this._log('error', `${expert.name} threw: ${err.message}`);
        results[expert.name] = { success: false, errors: [err.message] };
      }
    }

    // ── Phase 2: BUILDER (produce JSX + commands) ──
    // Only the Builder writes to jsx and commands.
    for (const { expert, score } of phases.build) {
      try {
        this._log('execute', `[BUILD] → ${expert.name} (${score.toFixed(2)})`);
        const result = await expert.execute(ctx, task, pipelineData);
        results[expert.name] = result;

        if (result.data) {
          if (result.data.jsx) pipelineData.jsx = result.data.jsx;
          if (result.data.commands) pipelineData.commands = result.data.commands;
          // Also merge other data (templateUsed, etc.)
          for (const [key, value] of Object.entries(result.data)) {
            if (key !== 'jsx' && key !== 'commands') {
              pipelineData[key] = value;
            }
          }
        }

        if (!result.success) {
          this._log('error', `${expert.name} failed: ${(result.errors || []).join('; ')}`);
          overallSuccess = false;
        }
      } catch (err) {
        this._log('error', `${expert.name} threw: ${err.message}`);
        results[expert.name] = { success: false, errors: [err.message] };
        overallSuccess = false;
      }
    }

    // ── Phase 3: POST-PROCESSORS (validate & enhance) ──
    // Post-processors can read jsx/commands but write to their own namespaces.
    for (const { expert, score } of phases.post) {
      try {
        this._log('execute', `[POST] → ${expert.name} (${score.toFixed(2)})`);
        const result = await expert.execute(ctx, task, pipelineData);
        results[expert.name] = result;

        if (result.data) {
          for (const [key, value] of Object.entries(result.data)) {
            pipelineData[key] = value;
          }
        }

        if (result.warnings && result.warnings.length > 0) {
          this._log('warning', `${expert.name}: ${result.warnings.join('; ')}`);
        }

        if (!result.success && expert.name === 'guardian') {
          // Guardian failure is critical
          this._log('error', `${expert.name} failed: ${(result.errors || []).join('; ')}`);
          overallSuccess = false;
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
          selected: selected.map(s => ({ name: s.expert.name, score: s.score, phase: s.expert.phase })),
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
    console.log(chalk.gray('\n── MoE 3-Phase Pipeline Trace ──'));
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
    console.log(chalk.gray('────────────────────────────────\n'));
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
