/**
 * Card Primitives — 6 types with Dark/Light mode support.
 *
 * Types: basic, stat, pricing, image, profile, feature
 * Every function returns render-ready JSX for the Figma pipeline.
 */

import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const cards = {

  basic(opts = {}) {
    const { title = 'Card Title', description = 'Description text goes here.', w = 360, mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/card/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
    const titleColor = resolveTokenValue(tokens, [['component', 'color/card/text'], ['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const descColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const border = resolveTokenValue(tokens, [['component', 'color/card/border'], ['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/xl']], 24);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
    const radius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const titleText = textProps({ typography, role: 'title/medium', size: 18, weight: 'semibold', color: titleColor, w: 'fill' });
    const bodyText = textProps({ typography, role: 'body/medium', size: 14, color: descColor, w: 'fill' });

    return `<Frame name={Card} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${radius}} shadow="0 4 16 rgba(0,0,0,0.06)" stroke={${border}}>
  <Text ${titleText}>${title}</Text>
  <Text ${bodyText}>${description}</Text>
</Frame>`;
  },

  stat(opts = {}) {
    const { label = 'Total Revenue', value = '12,500', trend = '+12%', w = 280, mode = 'Light', iconSvg = '', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/card/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
    const border = resolveTokenValue(tokens, [['component', 'color/card/border'], ['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const labelColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const valueColor = resolveTokenValue(tokens, [['component', 'color/card/text'], ['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const positive = typeof trend === 'string' && trend.startsWith('+');
    const trendBg = positive
      ? resolveTokenValue(tokens, [['semantic', 'color/success-container']], mode === 'Dark' ? '#064e3b' : '#ecfdf5')
      : resolveTokenValue(tokens, [['semantic', 'color/error-container'], ['semantic', 'color/destructive-light']], mode === 'Dark' ? '#7f1d1d' : '#fef2f2');
    const trendColor = positive ? resolveToken(tokens, 'semantic', 'color/success', '#059669') : resolveToken(tokens, 'semantic', 'color/destructive', '#dc2626');
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/xl']], 24);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/md']], 12);
    const chipRadius = resolveTokenValue(tokens, [['radius', 'radius/sm']], 6);
    const chipPx = resolveTokenValue(tokens, [['spacing', 'spacing/sm']], 8);
    const chipPy = resolveTokenValue(tokens, [['spacing', 'spacing/xs']], 4);
    const cardRadius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const labelText = textProps({ typography, role: 'label/medium', size: 13, weight: 'medium', color: labelColor, w: 'fill' });
    const valueText = textProps({ typography, role: ['headline/small', 'title/large'], size: 28, weight: 'bold', color: valueColor });
    const trendText = textProps({ typography, role: 'label/medium', size: 12, weight: 'semibold', color: trendColor });

    const iconBlock = iconSvg
      ? `  <SVG content={${iconSvg}} w={24} h={24} />\n`
      : '';

    return `<Frame name={StatCard_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${cardRadius}} shadow="0 2 8 rgba(0,0,0,0.04)" stroke={${border}}>
${iconBlock}  <Text ${labelText}>${label}</Text>
  <Frame flex={row} items={center} gap={8} w={fill} h={hug}>
    <Text ${valueText}>${value}</Text>
    <Frame flex={row} bg={${trendBg}} rounded={${chipRadius}} px={${chipPx}} py={${chipPy}} items={center}>
      <Text ${trendText}>${trend}</Text>
    </Frame>
  </Frame>
</Frame>`;
  },

  pricing(opts = {}) {
    const {
      name = 'Basic', price = '\\`$9', period = '/mo',
      features = ['Feature 1', 'Feature 2', 'Feature 3'],
      ctaLabel = 'Get Started', primary = false,
      w = 320, mode = 'Light', tokens, typography
    } = opts;
    const bg = primary
      ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff'));
    const textColor = primary
      ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#f1f5f9') : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827'));
    const subColor = primary
      ? resolveToken(tokens, 'semantic', 'color/primary-light', '#dbeafe')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#94a3b8') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280'));
    const featureColor = primary
      ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-variant', '#cbd5e1') : resolveToken(tokens, 'semantic', 'color/on-surface-variant', '#374151'));
    const btnBg = primary
      ? resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-elevated', '#334155') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9'));
    const btnColor = primary
      ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6')
      : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#1e293b'));
    const shadow = primary ? 'shadow="0 8 24 rgba(59,130,246,0.3)"' : 'shadow="0 2 8 rgba(0,0,0,0.04)"';
    const border = primary ? '' : `stroke={${mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/border', '#e2e8f0')}}`;
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/2xl']], 32);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 20);
    const featureGap = resolveTokenValue(tokens, [['spacing', 'spacing/md']], 12);
    const cardRadius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const ctaRadius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
    const planText = textProps({ typography, role: 'label/large', size: 14, weight: 'semibold', color: subColor, w: 'fill' });
    const priceText = textProps({ typography, role: ['display/small', 'headline/large'], size: 40, weight: 'bold', color: textColor });
    const periodText = textProps({ typography, role: 'body/large', size: 16, color: subColor });
    const ctaText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color: btnColor });

    const featsJsx = features.map(feature =>
      `    <Text ${textProps({ typography, role: 'body/medium', size: 14, color: featureColor, w: 'fill' })}>\\u2713 ${feature}</Text>`
    ).join('\n');

    return `<Frame name={Plan_${name}} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${cardRadius}} ${shadow} ${border}>
  <Text ${planText}>${name.toUpperCase()}</Text>
  <Frame flex={row} items={end} gap={4} w={fill} h={hug}>
    <Text ${priceText}>${price}</Text>
    <Text ${periodText}>${period}</Text>
  </Frame>
  <Frame name={Features} w={fill} h={hug} flex={col} gap={${featureGap}}>
${featsJsx}
  </Frame>
  <Frame name={CTA_${name}} w={fill} h={48} flex={row} bg={${btnBg}} rounded={${ctaRadius}} justify={center} items={center}>
    <Text ${ctaText}>${ctaLabel}</Text>
  </Frame>
</Frame>`;
  },

  image(opts = {}) {
    const { title = 'Title', description = 'Description', w = 360, imageH = 200, mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/card/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
    const titleColor = resolveTokenValue(tokens, [['component', 'color/card/text'], ['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const descColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const border = resolveTokenValue(tokens, [['component', 'color/card/border'], ['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const placeholder = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#e2e8f0');
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/lg']], 20);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/md']], 12);
    const radius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const titleText = textProps({ typography, role: 'title/medium', size: 18, weight: 'semibold', color: titleColor, w: 'fill' });
    const bodyText = textProps({ typography, role: 'body/medium', size: 14, color: descColor, w: 'fill' });

    return `<Frame name={ImageCard} w={${w}} h={hug} bg={${bg}} flex={col} rounded={${radius}} shadow="0 4 16 rgba(0,0,0,0.06)" stroke={${border}} overflow={hidden}>
  <Rectangle name={Image_Placeholder} w={fill} h={${imageH}} bg={${placeholder}} />
  <Frame w={fill} h={hug} flex={col} p={${padding}} gap={${gap}}>
    <Text ${titleText}>${title}</Text>
    <Text ${bodyText}>${description}</Text>
  </Frame>
</Frame>`;
  },

  profile(opts = {}) {
    const { name = 'John Doe', role = 'Software Engineer', email = 'john@example.com', w = 320, mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/card/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
    const nameColor = resolveTokenValue(tokens, [['component', 'color/card/text'], ['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const roleColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const emailColor = mode === 'Dark' ? '#60a5fa' : resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const border = resolveTokenValue(tokens, [['component', 'color/card/border'], ['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const avatarBg = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#e2e8f0');
    const initials = name.split(' ').map(part => part[0]).join('').toUpperCase();
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/xl']], 24);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
    const radius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const initialsText = textProps({ typography, role: 'title/large', size: 24, weight: 'bold', color: roleColor });
    const nameText = textProps({ typography, role: 'title/medium', size: 18, weight: 'semibold', color: nameColor, align: 'center', w: 'fill' });
    const roleText = textProps({ typography, role: 'body/medium', size: 14, color: roleColor, align: 'center', w: 'fill' });
    const emailText = textProps({ typography, role: 'body/small', size: 13, color: emailColor, align: 'center', w: 'fill' });

    return `<Frame name={ProfileCard} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${radius}} shadow="0 4 16 rgba(0,0,0,0.06)" stroke={${border}} items={center}>
  <Frame name={Avatar} w={64} h={64} flex={row} bg={${avatarBg}} rounded={32} justify={center} items={center}>
    <Text ${initialsText}>${initials}</Text>
  </Frame>
  <Text ${nameText}>${name}</Text>
  <Text ${roleText}>${role}</Text>
  <Text ${emailText}>${email}</Text>
</Frame>`;
  },

  feature(opts = {}) {
    const { title = 'Feature', description = 'Feature description goes here.', iconSvg = '', w = 320, mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/card/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
    const titleColor = resolveTokenValue(tokens, [['component', 'color/card/text'], ['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const descColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const border = resolveTokenValue(tokens, [['component', 'color/card/border'], ['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const iconBg = mode === 'Dark' ? '#1e3a5f' : resolveToken(tokens, 'semantic', 'color/primary-light', '#eff6ff');
    const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/xl']], 24);
    const gap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
    const radius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
    const iconRadius = resolveTokenValue(tokens, [['radius', 'radius/md']], 12);
    const titleText = textProps({ typography, role: 'title/medium', size: 18, weight: 'semibold', color: titleColor, w: 'fill' });
    const bodyText = textProps({ typography, role: 'body/medium', size: 14, color: descColor, w: 'fill' });

    const iconBlock = iconSvg
      ? `  <Frame name={Icon_Wrap} w={48} h={48} flex={row} bg={${iconBg}} rounded={${iconRadius}} justify={center} items={center}>\n    <SVG content={${iconSvg}} w={24} h={24} />\n  </Frame>`
      : `  <Frame name={Icon_Wrap} w={48} h={48} flex={row} bg={${iconBg}} rounded={${iconRadius}} justify={center} items={center}>\n    <Text ${textProps({ typography, role: 'title/large', size: 20, color: resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6') })}>\\u2605</Text>\n  </Frame>`;

    return `<Frame name={FeatureCard_${title.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${radius}} shadow="0 4 16 rgba(0,0,0,0.06)" stroke={${border}}>
${iconBlock}
  <Text ${titleText}>${title}</Text>
  <Text ${bodyText}>${description}</Text>
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
