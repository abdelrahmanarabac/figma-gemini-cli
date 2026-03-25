import { resolveToken } from './index.js';

export const feedback = {

  modal(opts = {}) {
    const {
      title = 'Modal Title',
      description = 'Are you sure you want to continue?',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      w = 480, mode = 'Light', tokens
    } = opts;

    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const overlayColor = 'rgba(0,0,0,0.5)';
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const descColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const cancelBg = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9');
    const cancelColor = mode === 'Dark' ? '#e2e8f0' : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const confirmBg = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const confirmColor = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');

    return `<Frame name={Modal_Overlay} w={800} h={600} flex={row} bg={${overlayColor}} justify={center} items={center}>
  <Frame name={Modal} w={${w}} h={hug} bg={${bg}} flex={col} p={32} gap={24} rounded={16} shadow={0 24 48 rgba(0,0,0,0.12)}>
    <Frame flex={col} gap={8} w={fill} h={hug}>
      <Text size={20} weight={semibold} color={${titleColor}} w={fill}>${title}</Text>
      <Text size={14} color={${descColor}} w={fill}>${description}</Text>
    </Frame>
    <Frame flex={row} gap={12} w={fill} h={hug} justify={end}>
      <Frame name={Cancel} w={hug} h={44} flex={row} bg={${cancelBg}} rounded={10} px={20} py={12} justify={center} items={center}>
        <Text size={14} weight={semibold} color={${cancelColor}}>${cancelLabel}</Text>
      </Frame>
      <Frame name={Confirm} w={hug} h={44} flex={row} bg={${confirmBg}} rounded={10} px={20} py={12} justify={center} items={center}>
        <Text size={14} weight={semibold} color={${confirmColor}}>${confirmLabel}</Text>
      </Frame>
    </Frame>
  </Frame>
</Frame>`;
  },

  alert(opts = {}) {
    const {
      title = 'Alert',
      message = 'Something happened.',
      type = 'info', // info, success, warning, error
      w = 'fill', mode = 'Light', tokens
    } = opts;

    const colors = {
      info:    { bg: mode === 'Dark' ? '#1e3a5f' : resolveToken(tokens, 'semantic', 'color/info-light', '#eff6ff'), border: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6'), icon: '\u2139', text: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6') },
      success: { bg: mode === 'Dark' ? '#064e3b' : resolveToken(tokens, 'semantic', 'color/success-light', '#ecfdf5'), border: resolveToken(tokens, 'semantic', 'color/success', '#10b981'), icon: '\u2713', text: resolveToken(tokens, 'semantic', 'color/success', '#059669') },
      warning: { bg: mode === 'Dark' ? '#78350f' : resolveToken(tokens, 'semantic', 'color/warning-light', '#fffbeb'), border: resolveToken(tokens, 'semantic', 'color/warning', '#f59e0b'), icon: '\u26A0', text: resolveToken(tokens, 'semantic', 'color/warning', '#d97706') },
      error:   { bg: mode === 'Dark' ? '#7f1d1d' : resolveToken(tokens, 'semantic', 'color/destructive-light', '#fef2f2'), border: resolveToken(tokens, 'semantic', 'color/destructive', '#ef4444'), icon: '\u2717', text: resolveToken(tokens, 'semantic', 'color/destructive', '#dc2626') },
    };
    const c = colors[type] || colors.info;
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const msgColor = mode === 'Dark' ? '#cbd5e1' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#374151');

    return `<Frame name={Alert_${type}} w={${w}} h={hug} bg={${c.bg}} flex={row} p={16} gap={12} rounded={12} stroke={${c.border}} items={start}>
  <Text size={18} color={${c.text}}>${c.icon}</Text>
  <Frame flex={col} gap={4} w={fill} h={hug}>
    <Text size={14} weight={semibold} color={${titleColor}} w={fill}>${title}</Text>
    <Text size={13} color={${msgColor}} w={fill}>${message}</Text>
  </Frame>
</Frame>`;
  },

  toast(opts = {}) {
    const {
      message = 'Changes saved successfully.',
      type = 'success', // success, error, info
      w = 360, mode = 'Light', tokens
    } = opts;

    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface-inverse', '#111827');
    const textColor = resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#ffffff');
    const icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
    const iconColors = {
      success: resolveToken(tokens, 'semantic', 'color/success', '#22c55e'),
      error: resolveToken(tokens, 'semantic', 'color/destructive', '#ef4444'),
      info: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6')
    };

    return `<Frame name={Toast_${type}} w={${w}} h={48} bg={${bg}} flex={row} px={16} gap={10} items={center} rounded={12} shadow={0 8 24 rgba(0,0,0,0.16)}>
  <Text size={16} weight={bold} color={${iconColors[type] || resolveToken(tokens, 'semantic', 'color/info', '#3b82f6')}}>${icons[type] || '\u2139'}</Text>
  <Text size={14} color={${textColor}} w={fill}>${message}</Text>
</Frame>`;
  },
};
