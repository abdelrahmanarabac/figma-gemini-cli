/**
 * Data module for design tokens.
 * Values are dynamically resolved by LLM, relying on context provided via GEMINI.md/Qwen.md.
 */

export function checkInventory(requiredTokens, existingTokens) {
  const existingSet = new Set(existingTokens.map(t => t.toLowerCase()));
  const missing = [];
  const existing = [];

  for (const token of requiredTokens) {
    if (existingSet.has(token.toLowerCase())) {
      existing.push(token);
    } else {
      missing.push(token);
    }
  }

  return { missing, existing };
}

export function recommendToken(hexValue) {
  return null; // AI handles token recommendation dynamically
}

export function getDefaultTokenSet() {
  return {
    semantic: {},
    spacing: {},
    radius: {},
  };
}

export function mergeTokenSets(base = {}, incoming = {}) {
  return {
    semantic: { ...(base.semantic || {}), ...(incoming.semantic || {}) },
    spacing: { ...(base.spacing || {}), ...(incoming.spacing || {}) },
    radius: { ...(base.radius || {}), ...(incoming.radius || {}) },
    typography: { ...(base.typography || {}), ...(incoming.typography || {}) },
    component: { ...(base.component || {}), ...(incoming.component || {}) },
    primitives: { ...(base.primitives || {}), ...(incoming.primitives || {}) },
  };
}
