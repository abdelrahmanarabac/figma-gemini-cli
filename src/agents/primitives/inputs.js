/**
 * Input Primitives — 4 types with Dark/Light mode support.
 *
 * Types: text, textarea, select, checkbox
 */

import { resolveToken } from './index.js';

export const inputs = {

  text(opts = {}) {
    const { label = 'Label', placeholder = 'Enter text...', w = 'fill', mode = 'Light', required = false, tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const labelColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const placeholderColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#64748b') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#9ca3af');
    const border = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/border-dark', '#475569') : resolveToken(tokens, 'semantic', 'color/border-strong', '#d1d5db');
    const reqText = required ? ' *' : '';
    return `<Frame name={Input_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text size={13} weight={medium} color={${labelColor}} w={fill}>${label}${reqText}</Text>
  <Frame w={fill} h={44} bg={${bg}} rounded={8} px={14} py={12} stroke={${border}} items={center}>
    <Text size={14} color={${placeholderColor}} w={fill}>${placeholder}</Text>
  </Frame>
</Frame>`;
  },

  textarea(opts = {}) {
    const { label = 'Description', placeholder = 'Enter description...', w = 'fill', rows = 4, mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const labelColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const placeholderColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#64748b') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#9ca3af');
    const border = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/border-dark', '#475569') : resolveToken(tokens, 'semantic', 'color/border-strong', '#d1d5db');
    const h = rows * 22 + 24;
    return `<Frame name={Textarea_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text size={13} weight={medium} color={${labelColor}} w={fill}>${label}</Text>
  <Frame w={fill} h={${h}} bg={${bg}} rounded={8} px={14} py={12} stroke={${border}} items={start}>
    <Text size={14} color={${placeholderColor}} w={fill}>${placeholder}</Text>
  </Frame>
</Frame>`;
  },

  select(opts = {}) {
    const { label = 'Select', placeholder = 'Choose option...', w = 'fill', mode = 'Light', tokens } = opts;
    const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const labelColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const placeholderColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#64748b') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#9ca3af');
    const border = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/border-dark', '#475569') : resolveToken(tokens, 'semantic', 'color/border-strong', '#d1d5db');
    const chevronColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#94a3b8') : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    return `<Frame name={Select_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={col} gap={6}>
  <Text size={13} weight={medium} color={${labelColor}} w={fill}>${label}</Text>
  <Frame w={fill} h={44} bg={${bg}} rounded={8} px={14} py={12} stroke={${border}} items={center} flex={row} justify={between}>
    <Text size={14} color={${placeholderColor}} w={fill}>${placeholder}</Text>
    <Text size={12} color={${chevronColor}}>\u25BC</Text>
  </Frame>
</Frame>`;
  },

  checkbox(opts = {}) {
    const { label = 'Option', checked = false, w = 'fill', mode = 'Light', tokens } = opts;
    const labelColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface', '#e2e8f0') : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const boxBg = checked ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff'));
    const border = checked ? resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6') : (mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/border-dark', '#475569') : resolveToken(tokens, 'semantic', 'color/border-strong', '#d1d5db'));
    const checkColor = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');
    const checkMark = checked ? '\u2713' : '';
    return `<Frame name={Checkbox_${label.replace(/\\s+/g, '_')}} w={${w}} h={hug} flex={row} gap={10} items={center}>
  <Frame w={20} h={20} bg={${boxBg}} rounded={4} stroke={${border}} justify={center} items={center}>
    <Text size={12} weight={bold} color={${checkColor}}>${checkMark}</Text>
  </Frame>
  <Text size={14} color={${labelColor}} w={fill}>${label}</Text>
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
  const { title = 'Form', submitLabel = 'Submit', w = 400, mode = 'Light', tokens } = opts;
  const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#ffffff');
  const titleColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#f1f5f9') : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
  const border = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-elevated', '#334155') : resolveToken(tokens, 'semantic', 'color/border', '#f1f5f9');
  const submitBg = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
  const submitText = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');

  const fieldJsx = fields.map(f => {
    const type = f.type || 'text';
    const fn = inputs[type];
    if (!fn) return inputs.text({ ...f, mode, tokens });
    return fn({ ...f, mode, tokens });
  }).map(jsx => '  ' + jsx.replace(/\n/g, '\n  ')).join('\n');

  return `<Frame name={Form_${title.replace(/\\s+/g, '_')}} w={${w}} h={hug} bg={${bg}} flex={col} p={32} gap={20} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={${border}}>
  <Text size={24} weight={bold} color={${titleColor}} w={fill}>${title}</Text>
${fieldJsx}
  <Frame name={Submit} w={fill} h={48} bg={${submitBg}} rounded={12} justify={center} items={center}>
    <Text size={16} weight={semibold} color={${submitText}}>${submitLabel}</Text>
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
