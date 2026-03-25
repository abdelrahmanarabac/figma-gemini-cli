/**
 * Navigation Primitives — sidebar, header, tab-bar.
 */

export const navigation = {

  sidebar(opts = {}) {
    const {
      items = ['Dashboard', 'Analytics', 'Users', 'Settings'],
      activeIndex = 0,
      title = 'AppName',
      w = 240,
      mode = 'Light'
    } = opts;

    const bg = mode === 'Dark' ? '#0f172a' : '#ffffff';
    const titleColor = mode === 'Dark' ? '#f1f5f9' : '#111827';
    const border = mode === 'Dark' ? '#1e293b' : '#f1f5f9';

    const navItems = items.map((item, i) => {
      const isActive = i === activeIndex;
      const itemBg = isActive ? (mode === 'Dark' ? 'bg={#1e3a5f}' : 'bg={#eff6ff}') : '';
      const color = isActive ? (mode === 'Dark' ? '#60a5fa' : '#1d4ed8') : (mode === 'Dark' ? '#94a3b8' : '#6b7280');
      const weight = isActive ? 'semibold' : 'regular';
      return `  <Frame name={NavItem_${item.replace(/\\s+/g, '_')}} w={fill} h={44} flex={row} ${itemBg} rounded={8} px={16} items={center}>
    <Text size={14} weight={${weight}} color={${color}} w={fill}>${item}</Text>
  </Frame>`;
    }).join('\n');

    return `<Frame name={Sidebar} w={${w}} h={fill} bg={${bg}} flex={col} p={16} gap={4} stroke={${border}}>
  <Frame name={Logo_Area} w={fill} h={48} flex={row} px={16} items={center}>
    <Text size={20} weight={bold} color={${titleColor}}>${title}</Text>
  </Frame>
  <Frame name={Nav_Items} w={fill} h={hug} flex={col} gap={4} pt={16}>
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
      mode = 'Light'
    } = opts;

    const bg = mode === 'Dark' ? '#0f172a' : '#ffffff';
    const titleColor = mode === 'Dark' ? '#f1f5f9' : '#111827';
    const border = mode === 'Dark' ? '#1e293b' : '#f1f5f9';
    const searchBg = mode === 'Dark' ? '#1e293b' : '#f8fafc';
    const searchBorder = mode === 'Dark' ? '#334155' : '#e2e8f0';
    const searchColor = mode === 'Dark' ? '#64748b' : '#9ca3af';
    const avatarBg = mode === 'Dark' ? '#334155' : '#e2e8f0';
    const avatarColor = mode === 'Dark' ? '#94a3b8' : '#6b7280';

    const searchBlock = showSearch ? `
    <Frame name={Search} w={280} h={40} flex={row} bg={${searchBg}} rounded={8} px={14} items={center} stroke={${searchBorder}}>
      <Text size={14} color={${searchColor}} w={fill}>Search...</Text>
    </Frame>` : '';

    const avatarBlock = showAvatar ? `
    <Frame name={Avatar} w={36} h={36} flex={row} bg={${avatarBg}} rounded={18} justify={center} items={center}>
      <Text size={14} weight={semibold} color={${avatarColor}}>JD</Text>
    </Frame>` : '';

    return `<Frame name={Header} w={${w}} h={64} bg={${bg}} flex={row} px={32} items={center} justify={between} stroke={${border}}>
  <Text size={20} weight={semibold} color={${titleColor}}>${title}</Text>
  <Frame flex={row} gap={16} items={center} h={hug}>${searchBlock}${avatarBlock}
  </Frame>
</Frame>`;
  },

  tabBar(opts = {}) {
    const {
      tabs = ['All', 'Active', 'Archived'],
      activeIndex = 0,
      w = 'fill',
      mode = 'Light'
    } = opts;

    const bg = mode === 'Dark' ? '#0f172a' : '#ffffff';
    const border = mode === 'Dark' ? '#1e293b' : '#e2e8f0';

    const tabItems = tabs.map((tab, i) => {
      const isActive = i === activeIndex;
      const color = isActive ? '#3b82f6' : (mode === 'Dark' ? '#94a3b8' : '#6b7280');
      const weight = isActive ? 'semibold' : 'regular';
      const underline = isActive ? `stroke={#3b82f6} strokeWidth={2}` : '';
      return `  <Frame name={Tab_${tab.replace(/\\s+/g, '_')}} h={44} flex={row} px={16} justify={center} items={center} ${underline}>
    <Text size={14} weight={${weight}} color={${color}}>${tab}</Text>
  </Frame>`;
    }).join('\n');

    return `<Frame name={TabBar} w={${w}} h={44} bg={${bg}} flex={row} gap={0} items={end} stroke={${border}}>
${tabItems}
</Frame>`;
  },
};
