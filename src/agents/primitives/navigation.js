/**
 * Navigation Primitives — sidebar, header, tab-bar.
 */

import { resolveToken, resolveTokenValue, textProps } from './index.js';

export const navigation = {

  sidebar(opts = {}) {
    const {
      items = ['Dashboard', 'Analytics', 'Users', 'Settings'],
      activeIndex = 0,
      title = 'AppName',
      w = 240,
      mode = 'Light',
      tokens,
      typography,
    } = opts;

    const bg = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const titleColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');
    const panelPadding = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
    const navGap = resolveTokenValue(tokens, [['spacing', 'spacing/xs']], 4);
    const itemRadius = resolveTokenValue(tokens, [['radius', 'radius/md']], 8);
    const itemPx = resolveTokenValue(tokens, [['component', 'spacing/nav/item-inline'], ['spacing', 'spacing/md']], 16);
    const itemPy = resolveTokenValue(tokens, [['component', 'spacing/nav/item-block'], ['spacing', 'spacing/sm']], 8);
    const logoText = textProps({ typography, role: 'title/medium', size: 20, weight: 'bold', color: titleColor });

    const navItems = items.map((item, index) => {
      const isActive = index === activeIndex;
      const itemBg = isActive
        ? resolveTokenValue(tokens, [['component', 'color/nav/item/active/bg'], ['semantic', 'color/secondary-container']], mode === 'Dark' ? '#1e3a5f' : '#eff6ff')
        : null;
      const color = isActive
        ? resolveTokenValue(tokens, [['component', 'color/nav/item/active/text'], ['semantic', 'color/on-secondary-container']], mode === 'Dark' ? '#60a5fa' : '#1d4ed8')
        : resolveTokenValue(tokens, [['component', 'color/nav/item/inactive/text'], ['semantic', 'color/on-surface-variant']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
      const itemText = textProps({ typography, role: 'label/large', size: 14, weight: isActive ? 'semibold' : 'regular', color, w: 'fill' });
      const activeProp = itemBg ? ` bg={${itemBg}}` : '';

      return `  <Frame name={NavItem_${item.replace(/\\s+/g, '_')}} w={fill} h={44} flex={row}${activeProp} rounded={${itemRadius}} px={${itemPx}} py={${itemPy}} items={center}>
    <Text ${itemText}>${item}</Text>
  </Frame>`;
    }).join('\n');

    return `<Frame name={Sidebar} w={${w}} h={fill} bg={${bg}} flex={col} p={${panelPadding}} gap={${navGap}} stroke={${border}}>
  <Frame name={Logo_Area} w={fill} h={48} flex={row} px={${itemPx}} items={center}>
    <Text ${logoText}>${title}</Text>
  </Frame>
  <Frame name={Nav_Items} w={fill} h={hug} flex={col} gap={${navGap}} pt={${panelPadding}}>
${navItems}
  </Frame>
</Frame>`;
  },

  header(opts = {}) {
    const {
      title = 'Dashboard',
      showSearch = true,
      showAvatar = true,
      w = 'fill',
      mode = 'Light',
      tokens,
      typography,
    } = opts;

    const bg = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const titleColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#f1f5f9' : '#111827');
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border-light']], mode === 'Dark' ? '#1e293b' : '#f1f5f9');
    const searchBg = resolveTokenValue(tokens, [['component', 'color/input/bg'], ['semantic', 'color/surface-container']], mode === 'Dark' ? '#1e293b' : '#f8fafc');
    const searchBorder = resolveTokenValue(tokens, [['component', 'color/input/border'], ['semantic', 'color/outline']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const searchColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#64748b' : '#9ca3af');
    const avatarBg = resolveTokenValue(tokens, [['semantic', 'color/surface-container-high'], ['semantic', 'color/surface-container']], mode === 'Dark' ? '#334155' : '#e2e8f0');
    const avatarColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
    const horizontalPadding = resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
    const headerGap = resolveTokenValue(tokens, [['spacing', 'spacing/lg']], 16);
    const searchRadius = resolveTokenValue(tokens, [['component', 'radius/input'], ['radius', 'radius/md']], 8);
    const searchPx = resolveTokenValue(tokens, [['component', 'spacing/input/padding-inline'], ['spacing', 'spacing/md']], 14);
    const titleText = textProps({ typography, role: 'title/large', size: 20, weight: 'semibold', color: titleColor });
    const searchText = textProps({ typography, role: 'body/large', size: 14, color: searchColor, w: 'fill' });
    const avatarText = textProps({ typography, role: 'label/large', size: 14, weight: 'semibold', color: avatarColor });

    const searchBlock = showSearch ? `
    <Frame name={Search} w={280} h={40} flex={row} bg={${searchBg}} rounded={${searchRadius}} px={${searchPx}} items={center} stroke={${searchBorder}}>
      <Text ${searchText}>Search...</Text>
    </Frame>` : '';

    const avatarBlock = showAvatar ? `
    <Frame name={Avatar} w={36} h={36} flex={row} bg={${avatarBg}} rounded={18} justify={center} items={center}>
      <Text ${avatarText}>JD</Text>
    </Frame>` : '';

    return `<Frame name={Header} w={${w}} h={64} bg={${bg}} flex={row} px={${horizontalPadding}} items={center} justify={between} stroke={${border}}>
  <Text ${titleText}>${title}</Text>
  <Frame flex={row} gap={${headerGap}} items={center} h={hug}>${searchBlock}${avatarBlock}
  </Frame>
</Frame>`;
  },

  tabBar(opts = {}) {
    const {
      tabs = ['All', 'Active', 'Archived'],
      activeIndex = 0,
      w = 'fill',
      mode = 'Light',
      tokens,
      typography,
    } = opts;

    const bg = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#0f172a' : '#ffffff');
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#1e293b' : '#e2e8f0');
    const activeColor = resolveToken(tokens, 'semantic', 'color/primary', '#3b82f6');

    const tabItems = tabs.map((tab, index) => {
      const isActive = index === activeIndex;
      const color = isActive
        ? activeColor
        : resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#94a3b8' : '#6b7280');
      const underline = isActive ? `stroke={${activeColor}} strokeWidth={2}` : '';
      const tabText = textProps({ typography, role: 'label/large', size: 14, weight: isActive ? 'semibold' : 'regular', color });

      return `  <Frame name={Tab_${tab.replace(/\\s+/g, '_')}} h={44} flex={row} px={16} justify={center} items={center} ${underline}>
    <Text ${tabText}>${tab}</Text>
  </Frame>`;
    }).join('\n');

    return `<Frame name={TabBar} w={${w}} h={44} bg={${bg}} flex={row} gap={0} items={end} stroke={${border}}>
${tabItems}
</Frame>`;
  },
};
