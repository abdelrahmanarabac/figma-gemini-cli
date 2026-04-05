/**
 * Input Primitives — 4 types with Dark/Light mode support.
 *
 * Types: text, textarea, select, checkbox
 */

import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const inputs = {

  text(opts = {}) {
    const { label = 'Label', placeholder = 'Enter text...', w = 'fill', mode = 'Light', required = false, tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/input/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const labelColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#e2e8f0' : '#374151');
    const placeholderColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#64748b' : '#9ca3af');
    const border = resolveTokenValue(tokens, [['component', 'color/input/border'], ['semantic', 'color/outline']], mode === 'Dark' ? '#475569' : '#d1d5db');
    const radius = resolveTokenValue(tokens, [['component', 'radius/input'], ['radius', 'radius/md']], 8);
    const px = resolveTokenValue(tokens, [['component', 'spacing/input/padding-inline'], ['spacing', 'spacing/md']], 14);
    const py = resolveTokenValue(tokens, [['component', 'spacing/input/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/medium', size: 13, weight: 'medium', color: labelColor, w: 'fill' });
    const placeholderText = textProps({ typography, role: 'body/large', size: 14, color: placeholderColor, w: 'fill' });
    const reqText = required ? ' *' : '';

    return `<Frame name={Input_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text ${labelText}>${label}${reqText}</Text>
  <Frame w={fill} h={44} flex={row} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} stroke={${border}} items={center}>
    <Text ${placeholderText}>${placeholder}</Text>
  </Frame>
</Frame>`;
  },

  textarea(opts = {}) {
    const { label = 'Description', placeholder = 'Enter description...', w = 'fill', rows = 4, mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/input/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const labelColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#e2e8f0' : '#374151');
    const placeholderColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#64748b' : '#9ca3af');
    const border = resolveTokenValue(tokens, [['component', 'color/input/border'], ['semantic', 'color/outline']], mode === 'Dark' ? '#475569' : '#d1d5db');
    const radius = resolveTokenValue(tokens, [['component', 'radius/input'], ['radius', 'radius/md']], 8);
    const px = resolveTokenValue(tokens, [['component', 'spacing/input/padding-inline'], ['spacing', 'spacing/md']], 14);
    const py = resolveTokenValue(tokens, [['component', 'spacing/input/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/medium', size: 13, weight: 'medium', color: labelColor, w: 'fill' });
    const placeholderText = textProps({ typography, role: 'body/large', size: 14, color: placeholderColor, w: 'fill' });
    const height = rows * 22 + 24;

    return `<Frame name={Textarea_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text ${labelText}>${label}</Text>
  <Frame w={fill} h={${height}} flex={col} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} stroke={${border}} items={start}>
    <Text ${placeholderText}>${placeholder}</Text>
  </Frame>
</Frame>`;
  },

  select(opts = {}) {
    const { label = 'Select', placeholder = 'Choose option...', w = 'fill', mode = 'Light', tokens, typography } = opts;
    const bg = resolveTokenValue(tokens, [['component', 'color/input/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const labelColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#e2e8f0' : '#374151');
    const placeholderColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#64748b' : '#9ca3af');
    const border = resolveTokenValue(tokens, [['component', 'color/input/border'], ['semantic', 'color/outline']], mode === 'Dark' ? '#475569' : '#d1d5db');
    const chevronColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const radius = resolveTokenValue(tokens, [['component', 'radius/input'], ['radius', 'radius/md']], 8);
    const px = resolveTokenValue(tokens, [['component', 'spacing/input/padding-inline'], ['spacing', 'spacing/md']], 14);
    const py = resolveTokenValue(tokens, [['component', 'spacing/input/padding-block'], ['spacing', 'spacing/sm']], 12);
    const labelText = textProps({ typography, role: 'label/medium', size: 13, weight: 'medium', color: labelColor, w: 'fill' });
    const placeholderText = textProps({ typography, role: 'body/large', size: 14, color: placeholderColor, w: 'fill' });
    const chevronText = textProps({ typography, role: 'label/small', size: 12, color: chevronColor });

    return `<Frame name={Select_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text ${labelText}>${label}</Text>
  <Frame w={fill} h={44} bg={${bg}} rounded={${radius}} px={${px}} py={${py}} stroke={${border}} items={center} flex={row} justify={between}>
    <Text ${placeholderText}>${placeholder}</Text>
    <Text ${chevronText}>\\u25BC</Text>
  </Frame>
</Frame>`;
  },

  checkbox(opts = {}) {
    const { label = 'Option', checked = false, w = 'fill', mode = 'Light', tokens, typography } = opts;
    const labelColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#e2e8f0' : '#374151');
    const boxBg = checked
      ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6')
      : resolveTokenValue(tokens, [['component', 'color/input/bg'], ['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const border = checked
      ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6')
      : resolveTokenValue(tokens, [['component', 'color/input/border'], ['semantic', 'color/outline']], mode === 'Dark' ? '#475569' : '#d1d5db');
    const checkColor = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');
    const labelText = textProps({ typography, role: 'body/medium', size: 14, color: labelColor, w: 'fill' });
    const checkText = textProps({ typography, role: 'label/medium', size: 12, weight: 'bold', color: checkColor });
    const checkMark = checked ? '\\u2713' : '';

    return `<Frame name={Checkbox_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={row} gap={10} items={center}>
  <Frame w={20} h={20} flex={row} bg={${boxBg}} rounded={4} stroke={${border}} justify={center} items={center}>
    <Text ${checkText}>${checkMark}</Text>
  </Frame>
  <Text ${labelText}>${label}</Text>
</Frame>`;
  },
};

/**
 * Generate a complete form from a list of field definitions.
 * @param {Array<{type: string, label: string, placeholder?: string}>} fields
 * @param {Object} opts
 * @returns {string} JSX
 */
export function form(fields = [], opts = {}) {
  const { title = 'Form', submitLabel = 'Submit', w = 400, mode = 'Light', tokens, typography } = opts;
  const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#ffffff');
  const titleColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#f1f5f9') : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
  const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#334155' : '#f1f5f9');
  const submitBg = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
  const submitTextColor = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');
  const padding = resolveTokenValue(tokens, [['component', 'spacing/card/padding'], ['spacing', 'spacing/2xl']], 32);
  const gap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 20);
  const radius = resolveTokenValue(tokens, [['component', 'radius/card'], ['radius', 'radius/lg']], 16);
  const submitRadius = resolveTokenValue(tokens, [['component', 'radius/button'], ['radius', 'radius/full']], 12);
  const titleText = textProps({ typography, role: 'headline/small', size: 24, weight: 'bold', color: titleColor, w: 'fill' });
  const submitText = textProps({ typography, role: 'label/large', size: 16, weight: 'semibold', color: submitTextColor });

  const fieldJsx = fields.map(field => {
    const type = field.type || 'text';
    const renderer = inputs[type];
    if (!renderer) return inputs.text({ ...field, mode, tokens, typography });
    return renderer({ ...field, mode, tokens, typography });
  }).map(jsx => '  ' + jsx.replace(/\n/g, '\n  ')).join('\n');

  return `<Frame name={Form_${title.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={${padding}} gap={${gap}} rounded={${radius}} shadow="0 4 16 rgba(0,0,0,0.06)" stroke={${border}}>
  <Text ${titleText}>${title}</Text>
${fieldJsx}
  <Frame name={Submit} w={fill} h={48} flex={row} bg={${submitBg}} rounded={${submitRadius}} justify={center} items={center}>
    <Text ${submitText}>${submitLabel}</Text>
  </Frame>
</Frame>`;
}

export function matchInputType(description) {
  const lower = description.toLowerCase();
  if (lower.match(/\b(textarea|description|message|comment|bio|notes)\b/)) return 'textarea';
  if (lower.match(/\b(select|dropdown|choose|option|picker)\b/)) return 'select';
  if (lower.match(/\b(checkbox|check|toggle|switch)\b/)) return 'checkbox';
  return 'text';
}
