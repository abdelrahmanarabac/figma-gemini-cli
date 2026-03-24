/**
 * Button Primitives — 4 variants with Dark/Light mode support.
 *
 * Every function returns render-ready JSX for the Figma pipeline.
 * Options: { label, w, mode }
 */

import { resolveToken } from './index.js';

export const buttons = {

  primary(opts = {}) {
    const { label = 'Button', w = 'hug', mode = 'Light', tokens } = opts;
    const bg = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const color = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');
    return `<Frame name={Button_Primary} w={${w}} h={48} bg={${bg}} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={${color}}>${label}</Text>
</Frame>`;
  },

  secondary(opts = {}) {
    const { label = 'Button', w = 'hug', mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9');
    const color = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#1e293b');
    const border = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/border-dark', '#334155') : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    return `<Frame name={Button_Secondary} w={${w}} h={48} bg={${bg}} rounded={12} px={24} py={12} justify={center} items={center} stroke={${border}}>
  <Text size={16} weight={semibold} color={${color}}>${label}</Text>
</Frame>`;
  },

  ghost(opts = {}) {
    const { label = 'Button', w = 'hug', mode = 'Light', tokens } = opts;
    const color = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/primary-light', '#93c5fd') : resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    return `<Frame name={Button_Ghost} w={${w}} h={48} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={${color}}>${label}</Text>
</Frame>`;
  },

  destructive(opts = {}) {
    const { label = 'Delete', w = 'hug', mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/destructive-dark', '#dc2626') : resolveToken(tokens, 'semantic', 'color/destructive', '#ef4444');
    const color = resolveToken(tokens, 'semantic', 'color/on-destructive', '#ffffff');
    return `<Frame name={Button_Destructive} w={${w}} h={48} bg={${bg}} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={${color}}>${label}</Text>
</Frame>`;
  },

  icon(opts = {}) {
    const { label = '', w = 44, iconSvg = '', mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9');
    const color = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#1e293b');
    if (iconSvg) {
      return `<Frame name={IconButton} w={${w}} h={44} bg={${bg}} rounded={12} justify={center} items={center}>
  <SVG content={${iconSvg}} w={20} h={20} />
</Frame>`;
    }
    return `<Frame name={IconButton} w={${w}} h={44} bg={${bg}} rounded={12} justify={center} items={center}>
  <Text size={14} weight={semibold} color={${color}}>${label || '•'}</Text>
</Frame>`;
  },
};

/**
 * Match a description to a button variant.
 * @param {string} description
 * @returns {string} variant key
 */
export function matchButtonVariant(description) {
  const lower = description.toLowerCase();
  if (lower.includes('destructive') || lower.includes('delete') || lower.includes('remove') || lower.includes('danger')) return 'destructive';
  if (lower.includes('ghost') || lower.includes('text button') || lower.includes('link')) return 'ghost';
  if (lower.includes('secondary') || lower.includes('outline') || lower.includes('cancel')) return 'secondary';
  if (lower.includes('icon button') || lower.includes('icon btn')) return 'icon';
  return 'primary';
}
