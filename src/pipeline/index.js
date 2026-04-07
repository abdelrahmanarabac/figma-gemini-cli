/**
 * Pipeline Orchestrator
 *
 * Direct function calls — no classes, no routing, no scoring.
 *
 *   prepare(ctx)         → scan Figma inventory
 *   build(jsx)           → compile JSX → commands
 *   validate(commands)   → Guardian + A11y checks
 *
 * Usage:
 *   import { run } from '../pipeline/index.js';
 *   const result = await run(ctx, jsx, { mode: 'Light' });
 */

import { prepare } from './prepare.js';
import { buildAsync } from './build.js';
import { validate } from './validate.js';

export { prepare } from './prepare.js';
export { buildAsync as build, buildAsync } from './build.js';
export { validate, validateGuardian, validateA11y } from './validate.js';

/**
 * Full pipeline: prepare → build → validate → (render is handled by caller).
 *
 * @param {Object} ctx - CLI context with eval/render/command methods
 * @param {string} jsx - JSX string to compile and validate
 * @param {Object} [options]
 * @param {string} [options.mode='Light'] - Theme mode
 * @returns {{ jsx, commands, validation, inventory, duration }}
 */
export async function run(ctx, jsx, options = {}) {
  const start = Date.now();

  // 1. Scan Figma inventory
  const { inventory, tokens } = await prepare(ctx);

  // 2. Compile JSX to commands
  const compiled = await buildAsync(jsx);

  if (compiled.commands.length === 0) {
    return {
      success: false,
      jsx,
      commands: [],
      validation: null,
      inventory,
      duration: Date.now() - start,
      errors: compiled.errors.length > 0
        ? compiled.errors
        : ['No commands generated from JSX'],
    };
  }

  // 3. Validate commands
  const validation = validate(compiled.commands, { tokens, mode: options.mode });

  return {
    success: validation.pass,
    jsx,
    commands: compiled.commands,
    compiled,
    validation,
    inventory,
    duration: Date.now() - start,
    errors: [],
  };
}
