/**
 * Expert — Base class for all MoE (Mix of Experts) agents.
 *
 * Every expert has:
 *  - A name, description, and capability tags
 *  - A relevance() function (the "gate" — returns 0.0–1.0 weight)
 *  - An execute() function (the "work")
 *  - Access to shared Design Memory
 */

export class Expert {
  /** @type {string} Unique expert identifier */
  name = '';

  /** @type {string} Human-readable role description */
  description = '';

  /**
   * Capability tags used by the Orchestrator's gating network
   * to match intents to experts.
   * @type {string[]}
   */
  capabilities = [];

  /**
   * Priority order — lower runs first when multiple experts
   * are selected for the same sub-task.
   * @type {number}
   */
  priority = 50;

  /**
   * Compute relevance weight for a given intent.
   * The Orchestrator calls this on every expert to decide
   * which ones to activate (top-K selection).
   *
   * @param {Intent} intent - Decomposed user intent
   * @returns {number} 0.0 (irrelevant) to 1.0 (critical)
   */
  relevance(intent) {
    return 0;
  }

  /**
   * Quick boolean check — can this expert handle this intent at all?
   * @param {Intent} intent
   * @returns {boolean}
   */
  canHandle(intent) {
    return this.relevance(intent) > 0.3;
  }

  /**
   * Execute the expert's core logic.
   *
   * @param {import('../cli/context.js').CommandContext} ctx - CLI context
   * @param {Task} task - The sub-task assigned by the Orchestrator
   * @param {Object} pipelineData - Output from previous experts in the chain
   * @returns {Promise<ExpertResult>}
   */
  async execute(ctx, task, pipelineData = {}) {
    throw new Error(`Expert "${this.name}" has not implemented execute().`);
  }
}

/**
 * @typedef {Object} Intent
 * @property {string} raw - Original user input
 * @property {string} action - Detected action (generate, render, audit, update, etc.)
 * @property {string[]} tags - Extracted capability tags (color, layout, token, text, etc.)
 * @property {Object} params - Extracted parameters
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Unique task ID
 * @property {string} type - Sub-task type
 * @property {string} description - What this sub-task requires
 * @property {Object} input - Input data for this sub-task
 * @property {string[]} dependencies - IDs of tasks that must complete first
 */

/**
 * @typedef {Object} ExpertResult
 * @property {boolean} success
 * @property {any} data - Expert-specific output
 * @property {Object} metadata - Timing, decisions made, etc.
 * @property {string[]} warnings - Non-fatal issues
 * @property {string[]} errors - Fatal issues
 */
