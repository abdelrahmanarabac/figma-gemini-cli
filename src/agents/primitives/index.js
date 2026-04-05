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

export function resolveTokenValue(tokens, candidates = [], fallback) {
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length < 2) continue;
    const [category, key] = candidate;
    if (tokens && tokens[category] && tokens[category][key]) {
      return tokens[category][key].value;
    }
  }
  return fallback;
}

function normalizeStyleName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/\/+/g, '/')
    .trim();
}

function detectStylePrefix(styleNames = []) {
  const counts = new Map();

  for (const styleName of styleNames) {
    const lower = String(styleName || '').toLowerCase();
    const marker = '/typography/';
    const markerIndex = lower.indexOf(marker);

    if (markerIndex >= 0) {
      const prefix = styleName.slice(0, markerIndex);
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
      continue;
    }

    if (lower.startsWith('typography/')) {
      counts.set('', (counts.get('') || 0) + 1);
    }
  }

  let bestPrefix = null;
  let bestCount = 0;
  for (const [prefix, count] of counts.entries()) {
    if (count > bestCount) {
      bestPrefix = prefix;
      bestCount = count;
    }
  }

  return bestPrefix;
}

export function createTypographyContext(runtimeConfig = {}, inventory = {}) {
  const typographyConfig = runtimeConfig.typography || {};
  const rawStyles = Array.isArray(inventory.textStyles) ? inventory.textStyles : [];
  const styleNames = rawStyles
    .map(style => (typeof style === 'string' ? style : style?.name))
    .filter(Boolean);

  return {
    enabled: typographyConfig.preferTextStyles !== false,
    stylePrefix: typographyConfig.stylePrefix !== undefined
      ? typographyConfig.stylePrefix
      : detectStylePrefix(styleNames),
    aliases: typographyConfig.roles || {},
    styleNames,
    stylesByNormalizedName: new Map(
      styleNames.map(name => [normalizeStyleName(name), name])
    ),
  };
}

export function resolveTextStyle(typography, roles) {
  if (!typography?.enabled) return null;

  const roleList = (Array.isArray(roles) ? roles : [roles]).filter(Boolean);
  if (roleList.length === 0) return null;

  const candidateNames = [];
  for (const role of roleList) {
    if (typography.aliases?.[role]) {
      candidateNames.push(typography.aliases[role]);
    }

    if (role.includes('/typography/')) {
      candidateNames.push(role);
    } else {
      if (typography.stylePrefix === '') {
        candidateNames.push(`typography/${role}`);
      } else if (typography.stylePrefix) {
        candidateNames.push(`${typography.stylePrefix}/typography/${role}`);
      }

      candidateNames.push(`typography/${role}`);
      candidateNames.push(role);
    }
  }

  const seen = new Set();
  for (const candidate of candidateNames) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const exact = typography.stylesByNormalizedName?.get(normalizeStyleName(candidate));
    if (exact) {
      return exact;
    }
  }

  if (typeof typography.stylePrefix === 'string' && typography.stylePrefix.length >= 0) {
    const primaryRole = roleList[0];
    if (primaryRole && !primaryRole.includes('/typography/')) {
      return typography.stylePrefix
        ? `${typography.stylePrefix}/typography/${primaryRole}`
        : `typography/${primaryRole}`;
    }
  }

  return null;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function formatProp(name, value) {
  if (value === undefined || value === null || value === false) return null;
  if (value === true) return name;
  if (typeof value === 'number') return `${name}={${value}}`;
  return `${name}="${escapeAttribute(value)}"`;
}

export function textProps(options = {}) {
  const {
    typography,
    role,
    size,
    weight,
    leading,
    tracking,
    ...rest
  } = options;

  const props = [];
  const styleName = resolveTextStyle(typography, role);

  if (styleName) {
    props.push(['style', styleName]);
  } else {
    props.push(['size', size]);
    props.push(['weight', weight]);
    props.push(['leading', leading]);
    props.push(['tracking', tracking]);
  }

  for (const [key, value] of Object.entries(rest)) {
    props.push([key, value]);
  }

  return props
    .map(([key, value]) => formatProp(key, value))
    .filter(Boolean)
    .join(' ');
}
