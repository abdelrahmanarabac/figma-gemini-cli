/**
 * Data Display Primitives — badge, avatar, table-row, list-item.
 */

import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const dataDisplay = {

  badge(opts = {}) {
    const { text = 'Active', color = '#22c55e', mode = 'Light', tokens, typography } = opts;
    const resolvedColor = resolveToken(tokens, 'semantic', 'color/success', color);
    const bgAlpha = mode === 'Dark' ? '20' : '15';
    const labelText = textProps({ typography, role: 'label/small', size: 12, weight: 'semibold', color: resolvedColor });
    return `<Frame name={Badge_${text.replace(/\\s+/g, '_')}} h={24} flex={row} bg="${resolvedColor}${bgAlpha}" rounded={6} px={10} py={4} items={center}>
  <Text ${labelText}>${text}</Text>
</Frame>`;
  },

  avatar(opts = {}) {
    const { name = 'JD', size = 40, mode = 'Light', tokens, typography } = opts;
    const bg = mode === 'Dark' ? '#334155' : resolveToken(tokens, 'semantic', 'color/surface-elevated', '#e2e8f0');
    const color = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const initials = name.split(' ').map(part => part[0] || '').join('').toUpperCase().slice(0, 2);
    const fontSize = Math.round(size * 0.38);
    const initialsText = textProps({ typography, role: 'label/large', size: fontSize, weight: 'semibold', color });

    return `<Frame name={Avatar_${initials}} w={${size}} h={${size}} flex={row} bg={${bg}} rounded={${Math.round(size / 2)}} justify={center} items={center}>
  <Text ${initialsText}>${initials}</Text>
</Frame>`;
  },

  tableRow(opts = {}) {
    const { cells = ['Cell 1', 'Cell 2', 'Cell 3'], header = false, w = 'fill', mode = 'Light', tokens, typography } = opts;
    const bg = header
      ? (mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/surface-muted', '#f8fafc'))
      : (mode === 'Dark' ? '#0f172a' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff'));
    const color = header
      ? (mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280'))
      : (mode === 'Dark' ? '#e2e8f0' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827'));
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');
    const rowText = header
      ? textProps({ typography, role: 'label/medium', size: 12, weight: 'medium', color, w: 'fill' })
      : textProps({ typography, role: 'body/medium', size: 14, color, w: 'fill' });

    const cellsJsx = cells.map(cell =>
      `  <Text ${rowText}>${cell}</Text>`
    ).join('\n');

    return `<Frame name={TableRow} w={${w}} h={48} bg={${bg}} flex={row} px={20} items={center} gap={16} stroke={${border}}>
${cellsJsx}
</Frame>`;
  },

  listItem(opts = {}) {
    const { title = 'Item', subtitle = '', trailing = '', w = 'fill', mode = 'Light', tokens, typography } = opts;
    const bg = mode === 'Dark' ? '#0f172a' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
    const titleColor = mode === 'Dark' ? '#f1f5f9' : resolveToken(tokens, 'semantic', 'color/on-surface', '#111827');
    const subtitleColor = mode === 'Dark' ? '#64748b' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#6b7280');
    const trailingColor = mode === 'Dark' ? '#94a3b8' : resolveToken(tokens, 'semantic', 'color/on-surface-muted', '#9ca3af');
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');
    const titleText = textProps({ typography, role: 'title/small', size: 14, weight: 'medium', color: titleColor, w: 'fill' });
    const subtitleText = textProps({ typography, role: 'body/small', size: 13, color: subtitleColor, w: 'fill' });
    const trailingText = textProps({ typography, role: 'body/medium', size: 14, color: trailingColor });

    const subtitleBlock = subtitle
      ? `\n    <Text ${subtitleText}>${subtitle}</Text>`
      : '';
    const trailingBlock = trailing
      ? `\n  <Text ${trailingText}>${trailing}</Text>`
      : '';

    return `<Frame name={ListItem} w={${w}} h={hug} bg={${bg}} flex={row} px={16} py={12} items={center} gap={12} stroke={${border}}>
  <Frame flex={col} gap={2} w={fill} h={hug}>
    <Text ${titleText}>${title}</Text>${subtitleBlock}
  </Frame>${trailingBlock}
</Frame>`;
  },

  divider(opts = {}) {
    const { w = 'fill', mode = 'Light', tokens } = opts;
    const color = mode === 'Dark' ? '#1e293b' : resolveToken(tokens, 'semantic', 'color/border-light', '#f1f5f9');
    return `<Rectangle name={Divider} w={${w}} h={1} bg={${color}} />`;
  },
};

/**
 * Build a full table from headers and rows.
 */
export function table(headers = [], rows = [], opts = {}) {
  const { w = 'fill', mode = 'Light', tokens } = opts;
  const bg = mode === 'Dark' ? '#0f172a' : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
  const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');

  const headerJsx = dataDisplay.tableRow({ cells: headers, header: true, ...opts });
  const rowsJsx = rows.map(cells =>
    dataDisplay.tableRow({ cells, header: false, ...opts })
  );

  const allRows = [headerJsx, ...rowsJsx]
    .map(row => '  ' + row.replace(/\n/g, '\n  '))
    .join('\n');

  return `<Frame name={Table} w={${w}} h={hug} bg={${bg}} flex={col} gap={0} rounded={12} stroke={${border}} overflow={hidden}>
${allRows}
</Frame>`;
}
