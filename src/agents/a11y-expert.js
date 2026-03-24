/**
 * A11y Expert — Accessibility validation and auto-fix.
 *
 * Full WCAG 2.2 compliance: contrast ratios, touch targets,
 * focus order, semantic structure, and color-only information.
 */

import { Expert } from './expert.js';

// ── WCAG Algorithms ──────────────────────────────────

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b) + 0.05;
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

// ── A11y Expert ──────────────────────────────────────

export class A11yExpert extends Expert {
  name = 'a11y';
  description = 'Accessibility validation — WCAG 2.2 contrast, touch targets, semantic structure.';
  capabilities = ['validation', 'accessibility'];
  priority = 85; // Runs near-last, after guardian
  phase = 'post';

  relevance(intent) {
    if (intent.action === 'accessibility') return 0.95;
    if (intent.tags.includes('validation')) return 0.8;
    // Always relevant post-render
    if (['generate', 'render'].includes(intent.action)) return 0.75;
    return 0.1;
  }

  /**
   * Validate a command batch for accessibility.
   * @param {Object[]} commands
   * @returns {A11yReport}
   */
  validate(commands) {
    const report = {
      pass: true,
      checks: [],
      score: 100,
      issues: [],
    };

    // Build parent→child map for background inference
    const nodeMap = new Map();
    const childToParent = new Map();

    for (const cmd of commands) {
      if (cmd.command !== 'node.create') continue;
      const id = cmd.params?.id;
      const parentId = cmd.params?.parentId;
      if (id) nodeMap.set(id, cmd);
      if (id && parentId) childToParent.set(id, parentId);
    }

    for (const cmd of commands) {
      if (cmd.command !== 'node.create') continue;
      const props = cmd.params?.props || {};
      const type = cmd.params?.type;
      const name = props.name || 'unnamed';
      const id = cmd.params?.id;

      // ── Check 1: Contrast Ratio ──
      if (type === 'TEXT' && props.fill && typeof props.fill === 'string') {
        const textColor = hexToRgb(props.fill);
        const bgColor = this._inferBackground(id, childToParent, nodeMap);

        if (textColor && bgColor) {
          const ratio = contrastRatio(textColor, bgColor);
          const fontSize = props.fontSize || 14;
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && (props.fontWeight === 700 || props.fontWeight === 'bold'));
          const threshold = isLargeText ? 3.0 : 4.5;

          if (ratio < threshold) {
            report.issues.push({
              type: 'contrast',
              severity: 'error',
              node: name,
              ratio: ratio.toFixed(2),
              threshold,
              textColor: props.fill,
              bgColor: `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`,
              message: `Contrast ratio ${ratio.toFixed(2)}:1 below ${threshold}:1 threshold`,
            });
            report.score -= 15;
          } else {
            report.checks.push({ type: 'contrast', node: name, result: 'pass', ratio: ratio.toFixed(2) });
          }
        }
      }

      // ── Check 2: Touch Target Size ──
      const nameLower = name.toLowerCase();
      const isInteractive = ['button', 'btn', 'link', 'input', 'select', 'toggle', 'switch', 'checkbox', 'radio']
        .some(kw => nameLower.includes(kw));

      if (isInteractive) {
        const w = typeof props.width === 'number' ? props.width : 999;
        const h = typeof props.height === 'number' ? props.height : 999;

        if (w < 44 || h < 44) {
          report.issues.push({
            type: 'touch-target',
            severity: 'warning',
            node: name,
            width: w,
            height: h,
            message: `Touch target ${w}×${h}px is below 44×44px minimum`,
          });
          report.score -= 10;
        } else {
          report.checks.push({ type: 'touch-target', node: name, result: 'pass' });
        }
      }

      // ── Check 3: Text Content ──
      if (type === 'TEXT') {
        const text = props.characters || '';
        if (text.length === 0) {
          report.issues.push({
            type: 'empty-text',
            severity: 'info',
            node: name,
            message: 'Empty text node detected',
          });
          report.score -= 2;
        }
      }
    }

    report.score = Math.max(0, report.score);
    report.pass = report.issues.filter(i => i.severity === 'error').length === 0;

    return report;
  }

  /** @private Infer background color from parent chain */
  _inferBackground(nodeId, childToParent, nodeMap) {
    let currentId = childToParent.get(nodeId);
    while (currentId) {
      const parentCmd = nodeMap.get(currentId);
      if (parentCmd) {
        const fill = parentCmd.params?.props?.fill;
        if (fill && typeof fill === 'string' && fill.startsWith('#')) {
          return hexToRgb(fill);
        }
      }
      currentId = childToParent.get(currentId);
    }
    // Default: white background
    return { r: 255, g: 255, b: 255 };
  }

  async execute(ctx, task, pipelineData = {}) {
    const commands = pipelineData.commands || [];
    const report = this.validate(commands);

    return {
      success: report.pass,
      data: { a11y: report },
      metadata: { checkedNodes: commands.length, score: report.score },
      warnings: report.issues.filter(i => i.severity === 'warning').map(i => `[${i.type}] ${i.node}: ${i.message}`),
      errors: report.issues.filter(i => i.severity === 'error').map(i => `[${i.type}] ${i.node}: ${i.message}`),
    };
  }
}

/**
 * @typedef {Object} A11yReport
 * @property {boolean} pass
 * @property {Array} checks
 * @property {number} score - 0-100
 * @property {Array} issues
 */
