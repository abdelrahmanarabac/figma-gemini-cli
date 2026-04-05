import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const feedback = {

  modal(opts = {}) {
    const {
      title = 'Modal Title',
      description = 'Are you sure you want to continue?',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      w = 480, mode = 'Light', tokens, typography
    } = opts;

    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const overlayColor = 'rgba(0,0,0,0.5)';
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const descColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const cancelBg = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#f1f5f9');
    const cancelColor = mode === 'Dark' ? '#e2e8f0' : resolveToken(tokens, 'semantic', 'color/on-surface', '#374151');
    const confirmBg = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');
    const confirmColor = resolveToken(tokens, 'semantic', 'color/on-primary', '#ffffff');
    const titleText = textProps({ typography, role: 'title/large', size: 20, weight: 'semibold', color: titleColor, w: 'fill' });
    const bodyText = textProps({ typography, role: 'body/medium', size: 14, color: descColor, w: 'fill' });
    const cancelText = textProps({ typography, role: 'label/large', size: 14, weight: 'semibold', color: cancelColor });
    const confirmText = textProps({ typography, role: 'label/large', size: 14, weight: 'semibold', color: confirmColor });

    return `<Frame name={Modal_Overlay} w={800} h={600} flex={row} bg="${overlayColor}" justify={center} items={center}>
  <Frame name={Modal} w={${w}} h={hug} bg={${bg}} flex={col} p={32} gap={24} rounded={16} shadow="0 24 48 rgba(0,0,0,0.12)">
    <Frame flex={col} gap={8} w={fill} h={hug}>
      <Text ${titleText}>${title}</Text>
      <Text ${bodyText}>${description}</Text>
    </Frame>
    <Frame flex={row} gap={12} w={fill} h={hug} justify={end}>
      <Frame name={Cancel} w={hug} h={44} flex={row} bg={${cancelBg}} rounded={10} px={20} py={12} justify={center} items={center}>
        <Text ${cancelText}>${cancelLabel}</Text>
      </Frame>
      <Frame name={Confirm} w={hug} h={44} flex={row} bg={${confirmBg}} rounded={10} px={20} py={12} justify={center} items={center}>
        <Text ${confirmText}>${confirmLabel}</Text>
      </Frame>
    </Frame>
  </Frame>
</Frame>`;
  },

  alert(opts = {}) {
    const {
      title = 'Alert',
      message = 'Something happened.',
      type = 'info',
      w = 'fill', mode = 'Light', tokens, typography
    } = opts;

    const colors = {
      info: { bg: mode === 'Dark' ? '#1e3a5f' : resolveToken(tokens, 'semantic', 'color/info-light', '#eff6ff'), border: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6'), icon: '\\u2139', text: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6') },
      success: { bg: mode === 'Dark' ? '#064e3b' : resolveToken(tokens, 'semantic', 'color/success-light', '#ecfdf5'), border: resolveToken(tokens, 'semantic', 'color/success', '#10b981'), icon: '\\u2713', text: resolveToken(tokens, 'semantic', 'color/success', '#059669') },
      warning: { bg: mode === 'Dark' ? '#78350f' : resolveToken(tokens, 'semantic', 'color/warning-light', '#fffbeb'), border: resolveToken(tokens, 'semantic', 'color/warning', '#f59e0b'), icon: '\\u26A0', text: resolveToken(tokens, 'semantic', 'color/warning', '#d97706') },
      error: { bg: mode === 'Dark' ? '#7f1d1d' : resolveToken(tokens, 'semantic', 'color/destructive-light', '#fef2f2'), border: resolveToken(tokens, 'semantic', 'color/destructive', '#ef4444'), icon: '\\u2717', text: resolveToken(tokens, 'semantic', 'color/destructive', '#dc2626') },
    };
    const selected = colors[type] || colors.info;
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const messageColor = mode === 'Dark' ? '#cbd5e1' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#374151');
    const iconText = textProps({ typography, role: 'title/large', size: 18, color: selected.text });
    const titleText = textProps({ typography, role: 'title/small', size: 14, weight: 'semibold', color: titleColor, w: 'fill' });
    const bodyText = textProps({ typography, role: 'body/small', size: 13, color: messageColor, w: 'fill' });

    return `<Frame name={Alert_${type}} w={${w}} h={hug} bg={${selected.bg}} flex={row} p={16} gap={12} rounded={12} stroke={${selected.border}} items={start}>
  <Text ${iconText}>${selected.icon}</Text>
  <Frame flex={col} gap={4} w={fill} h={hug}>
    <Text ${titleText}>${title}</Text>
    <Text ${bodyText}>${message}</Text>
  </Frame>
</Frame>`;
  },

  toast(opts = {}) {
    const {
      message = 'Changes saved successfully.',
      type = 'success',
      w = 360, mode = 'Light', tokens, typography
    } = opts;

    const bg = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface-inverse', '#111827');
    const textColor = resolveToken(tokens, 'semantic', 'color/on-surface-inverse', '#ffffff');
    const icons = { success: '\\u2713', error: '\\u2717', info: '\\u2139' };
    const iconColors = {
      success: resolveToken(tokens, 'semantic', 'color/success', '#22c55e'),
      error: resolveToken(tokens, 'semantic', 'color/destructive', '#ef4444'),
      info: resolveToken(tokens, 'semantic', 'color/info', '#3b82f6')
    };
    const iconText = textProps({ typography, role: 'title/medium', size: 16, weight: 'bold', color: iconColors[type] || resolveToken(tokens, 'semantic', 'color/info', '#3b82f6') });
    const bodyText = textProps({ typography, role: 'body/medium', size: 14, color: textColor, w: 'fill' });

    return `<Frame name={Toast_${type}} w={${w}} h={48} bg={${bg}} flex={row} px={16} gap={10} items={center} rounded={12} shadow="0 8 24 rgba(0,0,0,0.16)">
  <Text ${iconText}>${icons[type] || '\\u2139'}</Text>
  <Text ${bodyText}>${message}</Text>
</Frame>`;
  },
};
