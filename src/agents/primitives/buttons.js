/**
 * Button Primitives — 4 variants with Dark/Light mode support.
 *
 * Every function returns render-ready JSX for the Figma pipeline.
 * Options: { label, w, mode }
 */

import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const buttons = {

  primary(opts = {}) {
    const { label = 'Button', w = 'hug', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/button/primary/bg'], ['semantic', 'color/primary']], '#3b82f6');
    const color = resolveTokenValue(tokens, [['component', 'color/button/primary/text'], ['semantic', 'color/on-primary']], '#ffffff');
    const radius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    const px = resolveTokenValue(tokens, [['component', 'spacing/button/padding-inline'], ['spacing', 'spacing/lg']], 24);
    const py = resolveTokenValue(tokens, [['component', 'spacing/button/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color });
    return `<Frame name={Button_Primary} w={${w}} h={48} flex={row} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} justify={center} items={center}>
  <Text ${labelText}>${label}</Text>
</Frame>`;
  },

  secondary(opts = {}) {
    const { label = 'Button', mode = 'Light', w = 'hug', tokens, typography } = opts;
    const bg = resolveTokenValue(
      tokens,
      [['component', 'color/button/secondary/bg'], ['semantic', mode === 'Dark' ? 'color/surface-container-high' : 'color/surface-container']],
      mode === 'Dark' ? '#1e293b' : '#f1f5f9'
    );
    const color = resolveTokenValue(
      tokens,
      [['component', 'color/button/secondary/text'], ['semantic', 'color/on-surface']],
      mode === 'Dark' ? '#e2e8f0' : '#1e293b'
    );
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const radius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    const px = resolveTokenValue(tokens, [['component', 'spacing/button/padding-inline'], ['spacing', 'spacing/lg']], 24);
    const py = resolveTokenValue(tokens, [['component', 'spacing/button/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color });
    return `<Frame name={Button_Secondary} w={${w}} h={48} flex={row} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} justify={center} items={center} stroke={${border}}>
  <Text ${labelText}>${label}</Text>
</Frame>`;
  },

  ghost(opts = {}) {
    const { label = 'Button', mode = 'Light', w = 'hug', tokens, typography } = opts;
    const color = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/primary-light', '#93c5fd') : resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const radius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    const px = resolveTokenValue(tokens, [['component', 'spacing/button/padding-inline'], ['spacing', 'spacing/lg']], 24);
    const py = resolveTokenValue(tokens, [['component', 'spacing/button/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color });
    return `<Frame name={Button_Ghost} w={${w}} h={48} flex={row} rounded={${radius}} px={${px}} py={${py}} justify={center} items={center}>
  <Text ${labelText}>${label}</Text>
</Frame>`;
  },

  destructive(opts = {}) {
    const { label = 'Delete', mode = 'Light', w = 'hug', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/button/destructive/bg'], ['semantic', 'color/destructive']], mode === 'Dark' ? '#dc2626' : '#ef4444');
    const color = resolveTokenValue(tokens, [['component', 'color/button/destructive/text'], ['semantic', 'color/on-destructive']], '#ffffff');
    const radius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    const px = resolveTokenValue(tokens, [['component', 'spacing/button/padding-inline'], ['spacing', 'spacing/lg']], 24);
    const py = resolveTokenValue(tokens, [['component', 'spacing/button/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color });
    return `<Frame name={Button_Destructive} w={${w}} h={48} flex={row} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} justify={center} items={center}>
  <Text ${labelText}>${label}</Text>
</Frame>`;
  },

  icon(opts = {}) {
    const { label = '', w = 44, iconSvg = '', mode = 'Light', tokens, typography } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9');
    const color = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#1e293b');
    const radius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    if (iconSvg) {
      return `<Frame name={IconButton} w={${w}} h={44} flex={row} bg={${bg}} rounded={${radius}} justify={center} items={center}>
  <SVG content={${iconSvg}} w={20} h={20} />
</Frame>`;
    }
    const iconLabel = textProps({ typography, role: 'label/large', size: 14, weight: 'semibold', color });
    return `<Frame name={IconButton} w={${w}} h={44} flex={row} bg={${bg}} rounded={${radius}} justify={center} items={center}>
  <Text ${iconLabel}>${label || '•'}</Text>
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
