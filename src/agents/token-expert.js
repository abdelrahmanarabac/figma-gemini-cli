/**
 * Token Expert — Design token intelligence.
 *
 * Checks token inventory, creates missing tokens,
 * recommends token usage, and manages the token lifecycle.
 */

import { Expert } from './expert.js';

// ── Default Token Templates ─────────────────────────

const DEFAULT_SEMANTIC_TOKENS = {
  'color/primary': { type: 'COLOR', value: '#3b82f6', description: 'Primary brand color' },
  'color/primary-hover': { type: 'COLOR', value: '#2563eb', description: 'Primary hover state' },
  'color/secondary': { type: 'COLOR', value: '#64748b', description: 'Secondary/muted color' },
  'color/surface': { type: 'COLOR', value: '#ffffff', description: 'Default surface background' },
  'color/surface-elevated': { type: 'COLOR', value: '#f8fafc', description: 'Elevated surface (cards)' },
  'color/on-surface': { type: 'COLOR', value: '#0f172a', description: 'Text on surface' },
  'color/on-surface-muted': { type: 'COLOR', value: '#64748b', description: 'Secondary text' },
  'color/destructive': { type: 'COLOR', value: '#ef4444', description: 'Error/destructive actions' },
  'color/success': { type: 'COLOR', value: '#22c55e', description: 'Success states' },
  'color/warning': { type: 'COLOR', value: '#f59e0b', description: 'Warning states' },
  'color/info': { type: 'COLOR', value: '#3b82f6', description: 'Info states' },
  'color/border': { type: 'COLOR', value: '#e2e8f0', description: 'Default border color' },
  'color/border-strong': { type: 'COLOR', value: '#cbd5e1', description: 'Emphasized borders' },
};

const DEFAULT_SPACING_TOKENS = {
  'spacing/xs': { type: 'FLOAT', value: 4 },
  'spacing/sm': { type: 'FLOAT', value: 8 },
  'spacing/md': { type: 'FLOAT', value: 16 },
  'spacing/lg': { type: 'FLOAT', value: 24 },
  'spacing/xl': { type: 'FLOAT', value: 32 },
  'spacing/2xl': { type: 'FLOAT', value: 48 },
  'spacing/3xl': { type: 'FLOAT', value: 64 },
};

const DEFAULT_RADIUS_TOKENS = {
  'radius/none': { type: 'FLOAT', value: 0 },
  'radius/sm': { type: 'FLOAT', value: 4 },
  'radius/md': { type: 'FLOAT', value: 8 },
  'radius/lg': { type: 'FLOAT', value: 12 },
  'radius/xl': { type: 'FLOAT', value: 16 },
  'radius/2xl': { type: 'FLOAT', value: 24 },
  'radius/full': { type: 'FLOAT', value: 9999 },
};

export class TokenExpert extends Expert {
  name = 'token-expert';
  description = 'Token intelligence — checks, creates, and recommends design tokens.';
  capabilities = ['token', 'color', 'spacing', 'design-system'];
  priority = 10; // Runs early — tokens must exist before building

  relevance(intent) {
    if (intent.action === 'tokens') return 0.95;
    if (intent.tags.includes('token')) return 0.9;
    if (intent.tags.includes('color')) return 0.7;
    // Always relevant for generate/render (ensure tokens exist)
    if (['generate', 'render'].includes(intent.action)) return 0.6;
    return 0.1;
  }

  /**
   * Check which tokens from a required set are missing.
   * @param {string[]} requiredTokens - Token names needed
   * @param {string[]} existingTokens - Currently available token names
   * @returns {{ missing: string[], existing: string[] }}
   */
  checkInventory(requiredTokens, existingTokens) {
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

  /**
   * Find hex-to-token mapping recommendations.
   * @param {string} hexValue
   * @returns {string|null} Recommended token name
   */
  recommendToken(hexValue) {
    for (const [name, def] of Object.entries(DEFAULT_SEMANTIC_TOKENS)) {
      if (def.value.toLowerCase() === hexValue.toLowerCase()) {
        return name;
      }
    }
    return null;
  }

  /**
   * Get the full default token set for scaffolding.
   */
  getDefaultTokenSet() {
    return {
      semantic: DEFAULT_SEMANTIC_TOKENS,
      spacing: DEFAULT_SPACING_TOKENS,
      radius: DEFAULT_RADIUS_TOKENS,
    };
  }

  async execute(ctx, task, pipelineData = {}) {
    const warnings = [];
    const recommendations = [];

    // Scan commands for raw color values that could be tokens
    const commands = pipelineData.commands || [];
    for (const cmd of commands) {
      const props = cmd.params?.props || {};
      if (props.fill && typeof props.fill === 'string' && props.fill.startsWith('#')) {
        const rec = this.recommendToken(props.fill);
        if (rec) {
          recommendations.push({
            prop: 'fill',
            currentValue: props.fill,
            recommendedToken: rec,
            nodeName: props.name || 'unnamed',
          });
        }
      }
    }

    if (recommendations.length > 0) {
      warnings.push(`${recommendations.length} raw colors could use tokens`);
    }

    return {
      success: true,
      data: {
        tokens: this.getDefaultTokenSet(),
        recommendations,
      },
      metadata: { scannedCommands: commands.length, recommendations: recommendations.length },
      warnings,
      errors: [],
    };
  }
}
