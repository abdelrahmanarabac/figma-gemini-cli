/**
 * Pipeline: Validate
 *
 * Merged Guardian + A11y checks into a single validation module.
 * No classes, no Expert base — just pure functions and rule objects.
 */

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

// ── Guardian Rules ───────────────────────────────────

const KNOWN_TOKEN_PREFIXES = [
  'color/', 'spacing/', 'radius/', 'font/', 'shadow/',
  'primary', 'secondary', 'surface', 'destructive', 'success', 'warning', 'info',
];

const SPACING_SCALE = new Set([
  0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128,
]);

function findNearest(val) {
  let closest = 0;
  let minDiff = Infinity;
  for (const s of SPACING_SCALE) {
    const diff = Math.abs(s - val);
    if (diff < minDiff) { minDiff = diff; closest = s; }
  }
  return closest;
}

const GUARDIAN_RULES = {
  NO_RAW_COLORS: {
    id: 'NO_RAW_COLORS',
    severity: 'warning',
    message: 'Raw hex color detected. Prefer design token references.',
    check(cmd, context = {}) {
      const props = cmd.params?.props || {};
      const violations = [];
      for (const prop of ['fill', 'stroke']) {
        const val = props[prop];
        if (typeof val === 'string' && val.startsWith('#') && !KNOWN_TOKEN_PREFIXES.some(p => val.startsWith(p))) {
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
        const violations = [];
        if (props.width === undefined) violations.push({ prop: 'width', value: 'undefined' });
        if (props.height === undefined) violations.push({ prop: 'height', value: 'undefined' });
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
      if (typeof props.width === 'number' && props.width < 44) violations.push({ prop: 'width', value: props.width, min: 44 });
      if (typeof props.height === 'number' && props.height < 44) violations.push({ prop: 'height', value: props.height, min: 44 });
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

// ── Guardian Validator ───────────────────────────────

export function validateGuardian(commands, context = {}) {
  const statKeyBySeverity = { error: 'errors', warning: 'warnings', info: 'info' };
  const report = {
    pass: true,
    totalCommands: commands.length,
    violations: [],
    stats: { errors: 0, warnings: 0, info: 0 },
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    for (const rule of Object.values(GUARDIAN_RULES)) {
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

  report.pass = report.stats.errors === 0;
  return report;
}

// ── A11y Validator ───────────────────────────────────

function inferBackground(nodeId, childToParent, nodeMap) {
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
  return { r: 255, g: 255, b: 255 };
}

export function validateA11y(commands) {
  const report = { pass: true, checks: [], score: 100, issues: [] };
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

    // Contrast ratio
    if (type === 'TEXT' && props.fill && typeof props.fill === 'string') {
      const textColor = hexToRgb(props.fill);
      const bgColor = inferBackground(id, childToParent, nodeMap);
      if (textColor && bgColor) {
        const ratio = contrastRatio(textColor, bgColor);
        const fontSize = props.fontSize || 14;
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && (props.fontWeight === 700 || props.fontWeight === 'bold'));
        const threshold = isLargeText ? 3.0 : 4.5;
        if (ratio < threshold) {
          report.issues.push({
            type: 'contrast', severity: 'error', node: name,
            ratio: ratio.toFixed(2), threshold,
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

    // Touch targets
    const nameLower = name.toLowerCase();
    const isInteractive = ['button', 'btn', 'link', 'input', 'select', 'toggle', 'switch', 'checkbox', 'radio']
      .some(kw => nameLower.includes(kw));
    if (isInteractive) {
      const w = typeof props.width === 'number' ? props.width : 999;
      const h = typeof props.height === 'number' ? props.height : 999;
      if (w < 44 || h < 44) {
        report.issues.push({
          type: 'touch-target', severity: 'warning', node: name,
          width: w, height: h,
          message: `Touch target ${w}×${h}px is below 44×44px minimum`,
        });
        report.score -= 10;
      } else {
        report.checks.push({ type: 'touch-target', node: name, result: 'pass' });
      }
    }

    // Empty text
    if (type === 'TEXT') {
      const text = props.characters || '';
      if (text.length === 0) {
        report.issues.push({ type: 'empty-text', severity: 'info', node: name, message: 'Empty text node detected' });
        report.score -= 2;
      }
    }
  }

  report.score = Math.max(0, report.score);
  report.pass = report.issues.filter(i => i.severity === 'error').length === 0;
  return report;
}

// ── Combined Entry ───────────────────────────────────

export function validate(commands, context = {}) {
  const guardian = validateGuardian(commands, context);
  const a11y = validateA11y(commands);
  return {
    pass: guardian.pass && a11y.pass,
    guardian,
    a11y,
  };
}
