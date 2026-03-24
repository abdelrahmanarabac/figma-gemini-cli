/**
 * Layout Composers — grid, stack, split, centered, dashboard.
 *
 * Each function takes an array of JSX children strings and
 * wraps them in a layout container with proper auto-layout.
 */

import { resolveToken } from './index.js';

/**
 * Grid layout — children placed in a row with wrapping.
 */
export function grid(children, columns = 3, opts = {}) {
  const { gap = 24, p = 32, w = null, mode = 'Light', tokens } = opts;
  const computedW = w || (columns * 340 + (columns - 1) * gap + p * 2);
  const bgColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface-muted', '#f8fafc');
  const indented = children.map(c => '  ' + c.replace(/\n/g, '\n  ')).join('\n');
  return `<Frame name={Grid_Layout} w={${computedW}} h={hug} flex={row} gap={${gap}} p={${p}} items={start} bg={${bgColor}} rounded={16} wrap={true}>
${indented}
</Frame>`;
}

/**
 * Stack layout — children in a column or row.
 */
export function stack(children, direction = 'col', opts = {}) {
  const { gap = 16, p = 24, w = 400, mode = 'Light', tokens } = opts;
  const bgColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse-dark', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
  const indented = children.map(c => '  ' + c.replace(/\n/g, '\n  ')).join('\n');
  return `<Frame name={Stack_${direction === 'col' ? 'V' : 'H'}} w={${w}} h={hug} flex={${direction}} gap={${gap}} p={${p}} bg={${bgColor}} rounded={12}>
${indented}
</Frame>`;
}

/**
 * Split layout — left panel + right content area.
 */
export function split(leftJsx, rightJsx, opts = {}) {
  const { w = 1200, h = 800, leftW = 260, mode = 'Light', tokens } = opts;
  const bgColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface-muted', '#f8fafc');
  const leftBg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
  const leftBorder = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse-dark', '#1e293b') : resolveToken(tokens, 'semantic', 'color/border-light', '#f1f5f9');
  const leftBlock = typeof leftJsx === 'string' ? leftJsx : (Array.isArray(leftJsx) ? leftJsx.join('\n') : '');
  const rightBlock = typeof rightJsx === 'string' ? rightJsx : (Array.isArray(rightJsx) ? rightJsx.join('\n') : '');
  return `<Frame name={Split_Layout} w={${w}} h={${h}} flex={row} gap={0} bg={${bgColor}}>
  <Frame name={Left_Panel} w={${leftW}} h={fill} flex={col} bg={${leftBg}} stroke={${leftBorder}}>
    ${leftBlock.replace(/\n/g, '\n    ')}
  </Frame>
  <Frame name={Right_Panel} w={fill} h={fill} flex={col} p={32} gap={24}>
    ${rightBlock.replace(/\n/g, '\n    ')}
  </Frame>
</Frame>`;
}

/**
 * Centered layout — content centered on screen.
 */
export function centered(child, opts = {}) {
  const { w = 480, mode = 'Light', tokens } = opts;
  const bgColor = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-inverse-dark', '#1e293b') : resolveToken(tokens, 'semantic', 'color/surface', '#ffffff');
  const content = typeof child === 'string' ? child : (Array.isArray(child) ? child.join('\n') : '');
  return `<Frame name={Centered_Layout} w={${w}} h={hug} flex={col} items={center} justify={center} p={48} gap={32} bg={${bgColor}} rounded={24}>
  ${content.replace(/\n/g, '\n  ')}
</Frame>`;
}

/**
 * Dashboard layout — sidebar + header + content area.
 * This is the highest-level composition.
 */
export function dashboard(sidebarJsx, headerJsx, contentJsx, opts = {}) {
  const { w = 1440, h = 900, mode = 'Light', tokens } = opts;
  const bg = mode === 'Dark' ? resolveToken(tokens, 'semantic', 'color/surface-dark', '#0f172a') : resolveToken(tokens, 'semantic', 'color/surface-muted', '#f8fafc');
  const sidebar = typeof sidebarJsx === 'string' ? sidebarJsx : '';
  const header = typeof headerJsx === 'string' ? headerJsx : '';
  const content = typeof contentJsx === 'string' ? contentJsx
    : (Array.isArray(contentJsx) ? contentJsx.join('\n') : '');

  return `<Frame name={Dashboard} w={${w}} h={${h}} flex={row} gap={0} bg={${bg}}>
  ${sidebar.replace(/\n/g, '\n  ')}
  <Frame name={Main_Area} w={fill} h={fill} flex={col} gap={0}>
    ${header.replace(/\n/g, '\n    ')}
    <Frame name={Content} w={fill} h={fill} flex={col} p={32} gap={24}>
      ${content.replace(/\n/g, '\n      ')}
    </Frame>
  </Frame>
</Frame>`;
}

/**
 * Infer layout type from a natural language description.
 * @param {string} description
 * @param {number} componentCount
 * @returns {{ type: string, columns?: number }}
 */
export function inferLayout(description, componentCount = 1) {
  const lower = description.toLowerCase();

  // Dashboard pattern
  if (lower.match(/\bdashboard\b/)) return { type: 'dashboard' };

  // Split pattern
  if (lower.match(/\b(sidebar\s*(and|with|\+)|split|two.col|left.+right)\b/)) return { type: 'split' };

  // Grid pattern — "3 cards", "4 items in a row"
  const gridMatch = lower.match(/(\d+)\s*(cards?|items?|tiles?|columns?|cols?|stat|metrics?|plans?|tiers?)/);
  if (gridMatch) return { type: 'grid', columns: parseInt(gridMatch[1]) };
  if (componentCount >= 3) return { type: 'grid', columns: Math.min(componentCount, 4) };

  // Horizontal pattern
  if (lower.match(/\b(row|horizontal|inline|side.by.side|next\s*to)\b/)) return { type: 'stack-h' };

  // Centered pattern
  if (lower.match(/\b(center|centered|middle|hero|login|signup|sign\s*in|register)\b/)) return { type: 'centered' };

  // Default to vertical stack
  if (componentCount === 1) return { type: 'single' };
  if (componentCount === 2) return { type: 'stack-h' };
  return { type: 'stack-v' };
}
