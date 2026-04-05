/**
 * Layout Composers — grid, stack, split, centered, dashboard.
 *
 * Each function takes an array of JSX children strings and
 * wraps them in a layout container with proper auto-layout.
 */

import { resolveTokenValue } from './index.js';

/**
 * Grid layout — children placed in a row with wrapping.
 */
export function grid(children, columns = 3, opts = {}) {
  const { gap, p, w = null, mode = 'Light', tokens } = opts;
  const resolvedGap = gap ?? resolveTokenValue(tokens, [['spacing', 'spacing/xl']], 24);
  const resolvedPadding = p ?? resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
  const numericGap = typeof resolvedGap === 'number' ? resolvedGap : 24;
  const numericPadding = typeof resolvedPadding === 'number' ? resolvedPadding : 32;
  const computedW = w || (columns * 340 + (columns - 1) * numericGap + numericPadding * 2);
  const bgColor = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
  const radius = resolveTokenValue(tokens, [['radius', 'radius/lg']], 16);
  const indented = children.map(child => '  ' + child.replace(/\n/g, '\n  ')).join('\n');

  return `<Frame name={Grid_Layout} w={${computedW}} h={hug} flex={row} gap={${resolvedGap}} p={${resolvedPadding}} items={start} bg={${bgColor}} rounded={${radius}} wrap={true}>
${indented}
</Frame>`;
}

/**
 * Stack layout — children in a column or row.
 */
export function stack(children, direction = 'col', opts = {}) {
  const { gap, p, w = 400, mode = 'Light', tokens } = opts;
  const resolvedGap = gap ?? resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
  const resolvedPadding = p ?? resolveTokenValue(tokens, [['spacing', 'spacing/xl']], 24);
  const bgColor = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
  const radius = resolveTokenValue(tokens, [['radius', 'radius/md']], 12);
  const indented = children.map(child => '  ' + child.replace(/\n/g, '\n  ')).join('\n');

  return `<Frame name={Stack_${direction === 'col' ? 'V' : 'H'}} w={${w}} h={hug} flex={${direction}} gap={${resolvedGap}} p={${resolvedPadding}} bg={${bgColor}} rounded={${radius}}>
${indented}
</Frame>`;
}

/**
 * Split layout — left panel + right content area.
 */
export function split(leftJsx, rightJsx, opts = {}) {
  const { w = 1200, h = 800, leftW = 260, mode = 'Light', tokens } = opts;
  const bgColor = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
  const leftBg = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
  const leftBorder = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');
  const panelPadding = resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
  const panelGap = resolveTokenValue(tokens, [['spacing', 'spacing/xl']], 24);
  const leftBlock = typeof leftJsx === 'string' ? leftJsx : (Array.isArray(leftJsx) ? leftJsx.join('\n') : '');
  const rightBlock = typeof rightJsx === 'string' ? rightJsx : (Array.isArray(rightJsx) ? rightJsx.join('\n') : '');

  return `<Frame name={Split_Layout} w={${w}} h={${h}} flex={row} gap={0} bg={${bgColor}}>
  <Frame name={Left_Panel} w={${leftW}} h={fill} flex={col} bg={${leftBg}} stroke={${leftBorder}}>
    ${leftBlock.replace(/\n/g, '\n    ')}
  </Frame>
  <Frame name={Right_Panel} w={fill} h={fill} flex={col} p={${panelPadding}} gap={${panelGap}}>
    ${rightBlock.replace(/\n/g, '\n    ')}
  </Frame>
</Frame>`;
}

/**
 * Centered layout — content centered on screen.
 */
export function centered(child, opts = {}) {
  const { w = 480, mode = 'Light', tokens } = opts;
  const bgColor = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#1e293b' : '#ffffff');
  const padding = resolveTokenValue(tokens, [['spacing', 'spacing/3xl']], 48);
  const gap = resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
  const radius = resolveTokenValue(tokens, [['radius', 'radius/xl']], 24);
  const content = typeof child === 'string' ? child : (Array.isArray(child) ? child.join('\n') : '');

  return `<Frame name={Centered_Layout} w={${w}} h={hug} flex={col} items={center} justify={center} p={${padding}} gap={${gap}} bg={${bgColor}} rounded={${radius}}>
  ${content.replace(/\n/g, '\n  ')}
</Frame>`;
}

/**
 * Dashboard layout — sidebar + header + content area.
 * This is the highest-level composition.
 */
export function dashboard(sidebarJsx, headerJsx, contentJsx, opts = {}) {
  const { w = 1440, h = 900, mode = 'Light', tokens } = opts;
  const bg = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
  const contentPadding = resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
  const contentGap = resolveTokenValue(tokens, [['spacing', 'spacing/xl']], 24);
  const sidebar = typeof sidebarJsx === 'string' ? sidebarJsx : '';
  const header = typeof headerJsx === 'string' ? headerJsx : '';
  const content = typeof contentJsx === 'string' ? contentJsx
    : (Array.isArray(contentJsx) ? contentJsx.join('\n') : '');

  return `<Frame name={Dashboard} w={${w}} h={${h}} flex={row} gap={0} bg={${bg}}>
  ${sidebar.replace(/\n/g, '\n  ')}
  <Frame name={Main_Area} w={fill} h={fill} flex={col} gap={0}>
    ${header.replace(/\n/g, '\n    ')}
    <Frame name={Content} w={fill} h={fill} flex={col} p={${contentPadding}} gap={${contentGap}}>
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

  if (lower.match(/\bdashboard\b/)) return { type: 'dashboard' };
  if (lower.match(/\b(sidebar\s*(and|with|\+)|split|two.col|left.+right)\b/)) return { type: 'split' };

  const gridMatch = lower.match(/(\d+)\s*(cards?|items?|tiles?|columns?|cols?|stat|metrics?|plans?|tiers?)/);
  if (gridMatch) return { type: 'grid', columns: parseInt(gridMatch[1], 10) };
  if (componentCount >= 3) return { type: 'grid', columns: Math.min(componentCount, 4) };

  if (lower.match(/\b(row|horizontal|inline|side.by.side|next\s*to)\b/)) return { type: 'stack-h' };
  if (lower.match(/\b(center|centered|middle|hero|login|signup|sign\s*in|register)\b/)) return { type: 'centered' };

  if (componentCount === 1) return { type: 'single' };
  if (componentCount === 2) return { type: 'stack-h' };
  return { type: 'stack-v' };
}
