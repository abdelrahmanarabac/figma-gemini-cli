/**
 * Pipeline: Build
 *
 * Compiles JSX strings into Figma command arrays.
 * The AI agent generates the JSX; this module just parses it.
 */

export function build(jsx) {
  // Lazy import to avoid circular deps
  const { compileJSX } = require('../parser/jsx.js');
  const result = compileJSX(jsx);

  return {
    commands: result.commands || [],
    diagnostics: result.diagnostics || [],
    errors: result.errors || [],
    ok: result.ok,
    metadata: result.metadata || {},
    ast: result.ast || null,
  };
}

export async function buildAsync(jsx) {
  const { compileJSX } = await import('../parser/jsx.js');
  const result = compileJSX(jsx);

  return {
    commands: result.commands || [],
    diagnostics: result.diagnostics || [],
    errors: result.errors || [],
    ok: result.ok,
    metadata: result.metadata || {},
    ast: result.ast || null,
  };
}
