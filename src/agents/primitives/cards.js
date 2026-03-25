/**
 * Card Primitives — 6 types with Dark/Light mode support.
 *
 * Types: basic, stat, pricing, image, profile, feature
 * Every function returns render-ready JSX for the Figma pipeline.
 */

import { resolveToken } from './index.js';

export const cards = {

  basic(opts = {}) {
    const { title = 'Card Title', description = 'Description text goes here.', w = 360, mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const descColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const border = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    return `<Frame name={Card} w={${w}} h={hug} bg={${bg}} flex={col} p={24} gap={16} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={${border}}>
  <Text size={18} weight={semibold} color={${titleColor}} w={fill}>${title}</Text>
  <Text size={14} color={${descColor}} w={fill}>${description}</Text>
</Frame>`;
  },

  stat(opts = {}) {
    const { label = 'Total Revenue', value = '12,500', trend = '+12%', w = 280, mode = 'Light', iconSvg = '', tokens } = opts;
    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const border = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    const labelColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const valueColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const positive = typeof trend === 'string' && trend.startsWith('+');
    const trendBg = positive ? (mode === 'Dark' ? '#064e3b' : resolveToken(tokens, 'semantic', 'color/success-light', '#ecfdf5')) : (mode === 'Dark' ? '#7f1d1d' : resolveToken(tokens, 'semantic', 'color/destructive-light', '#fef2f2'));
    const trendColor = positive ? resolveToken(tokens, 'semantic', 'color/success', '#059669') : resolveToken(tokens, 'semantic', 'color/destructive', '#dc2626');

    const iconBlock = iconSvg
      ? `  <SVG content={${iconSvg}} w={24} h={24} />\n`
      : '';

    return `<Frame name={StatCard_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={24} gap={12} rounded={16} shadow={0 2 8 rgba(0,0,0,0.04)} stroke={${border}}>
${iconBlock}  <Text size={13} weight={medium} color={${labelColor}} w={fill}>${label}</Text>
  <Frame flex={row} items={center} gap={8} w={fill} h={hug}>
    <Text size={28} weight={bold} color={${valueColor}}>${value}</Text>
    <Frame flex={row} bg={${trendBg}} rounded={6} px={8} py={4} items={center}>
      <Text size={12} weight={semibold} color={${trendColor}}>${trend}</Text>
    </Frame>
  </Frame>
</Frame>`;
  },

  pricing(opts = {}) {
    const {
      name = 'Basic', price = '\\`$9', period = '/mo',
      features = ['Feature 1', 'Feature 2', 'Feature 3'],
      ctaLabel = 'Get Started', primary = false,
      w = 320, mode = 'Light', tokens
    } = opts;
    const bg = primary ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff'));
    const textColor = primary ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#f1f5f9') : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827'));
    const subColor = primary ? resolveToken(tokens, 'semantic', 'color/primary-light', '#dbeafe') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#94a3b8') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280'));
    const featureColor = primary ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-variant', '#cbd5e1') : resolveToken(tokens, 'semantic', 'color/on-surface-variant', '#374151'));
    const btnBg = primary ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-elevated', '#334155') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9'));
    const btnColor = primary ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#1e293b'));
    const shadow = primary ? 'shadow={0 8 24 rgba(59,130,246,0.3)}' : 'shadow={0 2 8 rgba(0,0,0,0.04)}';
    const border = primary ? '' : `stroke={${mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0')}}`;

    const featsJsx = features.map(f =>
      `    <Text size={14} color={${featureColor}} w={fill}>\u2713 ${f}</Text>`
    ).join('\n');

    return `<Frame name={Plan_${name}} w={${w}} h={hug} bg={${bg}} flex={col} p={32} gap={20} rounded={16} ${shadow} ${border}>
  <Text size={14} weight={semibold} color={${subColor}} w={fill}>${name.toUpperCase()}</Text>
  <Frame flex={row} items={end} gap={4} w={fill} h={hug}>
    <Text size={40} weight={bold} color={${textColor}}>${price}</Text>
    <Text size={16} color={${subColor}}>${period}</Text>
  </Frame>
  <Frame name={Features} w={fill} h={hug} flex={col} gap={12}>
${featsJsx}
  </Frame>
  <Frame name={CTA_${name}} w={fill} h={48} flex={row} bg={${btnBg}} rounded={12} justify={center} items={center}>
    <Text size={16} weight={semibold} color={${btnColor}}>${ctaLabel}</Text>
  </Frame>
</Frame>`;
  },

  image(opts = {}) {
    const { title = 'Title', description = 'Description', w = 360, imageH = 200, mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const descColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const border = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    const placeholder = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#e2e8f0');
    return `<Frame name={ImageCard} w={${w}} h={hug} bg={${bg}} flex={col} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={${border}} overflow={hidden}>
  <Rectangle name={Image_Placeholder} w={fill} h={${imageH}} bg={${placeholder}} />
  <Frame w={fill} h={hug} flex={col} p={20} gap={12}>
    <Text size={18} weight={semibold} color={${titleColor}} w={fill}>${title}</Text>
    <Text size={14} color={${descColor}} w={fill}>${description}</Text>
  </Frame>
</Frame>`;
  },

  profile(opts = {}) {
    const { name = 'John Doe', role = 'Software Engineer', email = 'john@example.com', w = 320, mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const nameColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const roleColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const emailColor = mode === 'Dark' ? '#60a5fa' : resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const border = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    const avatarBg = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#e2e8f0');
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return `<Frame name={ProfileCard} w={${w}} h={hug} bg={${bg}} flex={col} p={24} gap={16} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={${border}} items={center}>
  <Frame name={Avatar} w={64} h={64} flex={row} bg={${avatarBg}} rounded={32} justify={center} items={center}>
    <Text size={24} weight={bold} color={${roleColor}}>${initials}</Text>
  </Frame>
  <Text size={18} weight={semibold} color={${nameColor}} align={center} w={fill}>${name}</Text>
  <Text size={14} color={${roleColor}} align={center} w={fill}>${role}</Text>
  <Text size={13} color={${emailColor}} align={center} w={fill}>${email}</Text>
</Frame>`;
  },

  feature(opts = {}) {
    const { title = 'Feature', description = 'Feature description goes here.', iconSvg = '', w = 320, mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const descColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const border = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0');
    const iconBg = mode === 'Dark' ? '#1e3a5f' : resolveToken(tokens, 'semantic', 'color/primary-light', '#eff6ff');

    const iconBlock = iconSvg
      ? `  <Frame name={Icon_Wrap} w={48} h={48} flex={row} bg={${iconBg}} rounded={12} justify={center} items={center}>\n    <SVG content={${iconSvg}} w={24} h={24} />\n  </Frame>`
      : `  <Frame name={Icon_Wrap} w={48} h={48} flex={row} bg={${iconBg}} rounded={12} justify={center} items={center}>\n    <Text size={20} color={${resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6')}}>\u2605</Text>\n  </Frame>`;

    return `<Frame name={FeatureCard_${title.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={24} gap={16} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={${border}}>
${iconBlock}
  <Text size={18} weight={semibold} color={${titleColor}} w={fill}>${title}</Text>
  <Text size={14} color={${descColor}} w={fill}>${description}</Text>
</Frame>`;
  },
};

/**
 * Match a description to a card type.
 * @param {string} description
 * @returns {string} card type key
 */
export function matchCardType(description) {
  const lower = description.toLowerCase();
  if (lower.match(/\b(stat|metric|kpi|number|revenue|count|total)\b/)) return 'stat';
  if (lower.match(/\b(pricing|plan|tier|subscription|price)\b/)) return 'pricing';
  if (lower.match(/\b(image|photo|thumbnail|media|gallery)\b/)) return 'image';
  if (lower.match(/\b(profile|user|member|team|avatar)\b/)) return 'profile';
  if (lower.match(/\b(feature|benefit|advantage|service)\b/)) return 'feature';
  return 'basic';
}
