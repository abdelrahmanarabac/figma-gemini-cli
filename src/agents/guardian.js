/**
 * Guardian Expert — Pre-render validation middleware.
 *
 * The last line of defense. Validates EVERY command batch
 * against design system rules before committing to canvas.
 */

import { Expert } from './expert.js';

// ── Rule Definitions ─────────────────────────────────

const KNOWN_TOKEN_PREFIXES = [
  'color/', 'spacing/', 'radius/', 'font/', 'shadow/',
  'primary', 'secondary', 'surface', 'destructive', 'success', 'warning', 'info',
];

const SPACING_SCALE = new Set([
  0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128,
]);

const RULES = {
  NO_RAW_COLORS: {
    id: 'NO_RAW_COLORS',
    severity: 'warning',
    message: 'Raw hex color detected. Prefer design token references.',
    check(cmd, context = {}) {
      const props = cmd.params?.props || {};
      const violations = [];
      const colorProps = ['fill', 'stroke'];
      
      for (const prop of colorProps) {
        const val = props[prop];
        if (typeof val === 'string' && val.startsWith('#') && !KNOWN_TOKEN_PREFIXES.some(p => val.startsWith(p))) {
          // Check if this raw hex is actually a resolved token value
          const tokenSet = context.tokens?.semantic || {};
          const isResolvedToken = Object.values(tokenSet).some(
            t => t && t.value && t.value.trim().toLowerCase() === val.trim().toLowerCase()
          );
          if (!isResolvedToken) {
            violations.push({ prop, value: val });
          }
        }
      }
      return violations;
    },
  },

  ROOT_SIZING: {
    id: 'ROOT_SIZING',
    severity: 'error',
    message: 'Root frame must have explicit numeric width and height.',
    check(cmd) {
      if (!cmd.params?.parentId && cmd.params?.type === 'FRAME') {
        const props = cmd.params?.props || {};
        const w = props.width;
        const h = props.height;
        const violations = [];
        // Only error on completely undefined width/height for root frames.
        // allow 'hug' or 'fill' because standalone components might use it.
        if (w === undefined) {
          violations.push({ prop: 'width', value: 'undefined' });
        }
        if (h === undefined) {
          violations.push({ prop: 'height', value: 'undefined' });
        }
        return violations;
      }
      return [];
    },
  },

  NAMING: {
    id: 'NAMING',
    severity: 'info',
    message: 'Node uses default generic name.',
    check(cmd) {
      const name = cmd.params?.props?.name;
      const defaults = ['Frame', 'Rectangle', 'Ellipse', 'Line', 'Text', 'Group'];
      if (name && defaults.includes(name) && cmd.params?.type !== 'TEXT') {
        return [{ prop: 'name', value: name }];
      }
      return [];
    },
  },

  MIN_DIMENSIONS: {
    id: 'MIN_DIMENSIONS',
    severity: 'warning',
    message: 'Interactive element may be too small for touch targets (< 44px).',
    check(cmd) {
      const props = cmd.params?.props || {};
      const name = (props.name || '').toLowerCase();
      const isInteractive = ['button', 'btn', 'link', 'input', 'select', 'toggle', 'switch', 'checkbox', 'radio']
        .some(kw => name.includes(kw));
      if (!isInteractive) return [];

      const violations = [];
      if (typeof props.width === 'number' && props.width < 44) {
        violations.push({ prop: 'width', value: props.width, min: 44 });
      }
      if (typeof props.height === 'number' && props.height < 44) {
        violations.push({ prop: 'height', value: props.height, min: 44 });
      }
      return violations;
    },
  },

  SPACING_SCALE: {
    id: 'SPACING_SCALE',
    severity: 'info',
    message: 'Spacing value is not on the 4px base scale.',
    check(cmd) {
      const props = cmd.params?.props || {};
      const spacingProps = ['itemSpacing', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical'];
      const violations = [];
      for (const prop of spacingProps) {
        const val = props[prop];
        if (typeof val === 'number' && val > 0 && !SPACING_SCALE.has(val)) {
          violations.push({ prop, value: val, nearestScale: findNearest(val) });
        }
      }
      return violations;
    },
  },
};

function findNearest(val) {
  let closest = 0;
  let minDiff = Infinity;
  for (const s of SPACING_SCALE) {
    const diff = Math.abs(s - val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}

// ── Guardian Expert ──────────────────────────────────

export class GuardianExpert extends Expert {
  name = 'guardian';
  description = 'Pre-render validation middleware. Validates command batches against design system rules.';
  capabilities = ['validation', 'consistency', 'quality'];
  priority = 90; // Runs near-last (before a11y)
  phase = 'post';

  relevance(intent) {
    // Always relevant for render/generate tasks
    if (['render', 'generate', 'update'].includes(intent.action)) return 1.0;
    if (intent.tags.includes('validation')) return 0.9;
    return 0.1;
  }

  /**
   * Validate a command batch against all rules.
   * @param {Object[]} commands - Parsed command batch
   * @param {Object} context - Pipeline context data (tokens, etc.)
   * @returns {ValidationReport}
   */
  validate(commands, context = {}) {
    const statKeyBySeverity = {
      error: 'errors',
      warning: 'warnings',
      info: 'info',
    };

    const report = {
      pass: true,
      totalCommands: commands.length,
      violations: [],
      stats: { errors: 0, warnings: 0, info: 0 },
    };

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      for (const rule of Object.values(RULES)) {
        const issues = rule.check(cmd, context);
        if (issues.length > 0) {
          for (const issue of issues) {
            report.violations.push({
              ruleId: rule.id,
              severity: rule.severity,
              message: rule.message,
              commandIndex: i,
              commandType: cmd.params?.type || cmd.command,
              nodeName: cmd.params?.props?.name || 'unnamed',
              ...issue,
            });
            report.stats[statKeyBySeverity[rule.severity] || 'info']++;
          }
        }
      }
    }

    // Only fail on errors, not warnings/info
    report.pass = report.stats.errors === 0;
    return report;
  }

  async execute(ctx, task, pipelineData = {}) {
    const commands = pipelineData.commands || [];

    if (commands.length === 0) {
      return {
        success: true,
        data: { validated: true, report: { pass: true, violations: [], stats: { errors: 0, warnings: 0, info: 0 } } },
        metadata: { commandCount: 0 },
        warnings: [],
        errors: [],
      };
    }

    const report = this.validate(commands, pipelineData);

    return {
      success: report.pass,
      data: { validated: true, report },
      metadata: { commandCount: commands.length, ruleCount: Object.keys(RULES).length },
      warnings: report.violations
        .filter(v => v.severity === 'warning')
        .map(v => `[${v.ruleId}] ${v.nodeName}: ${v.message} (${v.prop}=${v.value})`),
      errors: report.violations
        .filter(v => v.severity === 'error')
        .map(v => `[${v.ruleId}] ${v.nodeName}: ${v.message} (${v.prop}=${v.value})`),
    };
  }
}

/**
 * @typedef {Object} ValidationReport
 * @property {boolean} pass
 * @property {number} totalCommands
 * @property {Object[]} violations
 * @property {{ errors: number, warnings: number, info: number }} stats
 */
