/**
 * Primitives Index — Exports all template primitives and layout composers.
 *
 * Used by Builder expert to compose UI from matched components.
 */

export { buttons, matchButtonVariant } from './buttons.js';
export { cards, matchCardType } from './cards.js';
export { inputs, form, matchInputType } from './inputs.js';
export { navigation } from './navigation.js';
export { dataDisplay, table } from './data-display.js';
export { feedback } from './feedback.js';
export { grid, stack, split, centered, dashboard, inferLayout } from './layouts.js';

/**
 * Safely resolve a design token or return a fallback.
 * @param {Object} tokens - The tokens object from pipelineData
 * @param {string} category - e.g. 'semantic', 'spacing', 'radius'
 * @param {string} key - e.g. 'color/primary', 'spacing/md'
 * @param {string} fallback - The raw value to use if token is missing
 * @returns {string} The resolved value
 */
export function resolveToken(tokens, category, key, fallback) {
  if (tokens && tokens[category] && tokens[category][key]) {
    return tokens[category][key].value;
  }
  return fallback;
}
