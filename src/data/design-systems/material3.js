const MATERIAL3_COLOR_REFERENCES = {
  primary: {
    '10': '#4a1500',  // Very deep orange
    '20': '#7a2800',  // Dark orange
    '30': '#a93d00',  // Orange
    '40': '#d05100',  // Rich orange
    '80': '#ffb594',  // Light orange
    '90': '#ffdbcb',  // Very light orange
    '100': '#ffffff', // White
  },
  secondary: {
    '10': '#1d192b',
    '20': '#332d41',
    '30': '#4a4458',
    '40': '#625b71',
    '80': '#ccc2dc',
    '90': '#e8def8',
    '100': '#ffffff',
  },
  neutral: {
    '10': '#1d1b20',
    '20': '#313033',
    '30': '#484649',
    '40': '#605d62',
    '80': '#cac4d0',
    '90': '#e6e0e9',
    '95': '#f4eff4',
    '99': '#fffbfe',
    '100': '#ffffff',
  },
  'neutral-variant': {
    '30': '#49454f',
    '50': '#79747e',
    '60': '#938f99',
    '80': '#cac4d0',
    '90': '#e7e0ec',
  },
  error: {
    '10': '#410e0b',
    '20': '#601410',
    '30': '#8c1d18',
    '40': '#b3261e',
    '80': '#f2b8b5',
    '90': '#f9dedc',
    '100': '#ffffff',
  },
  success: {
    '10': '#0f2419',
    '20': '#193625',
    '30': '#245031',
    '40': '#2e7d32',
    '80': '#a5d6a7',
    '90': '#c8e6c9',
    '100': '#ffffff',
  },
};

const TYPOGRAPHY_ROLES = {
  'display/large': { fontSize: 57, lineHeight: 64, letterSpacing: -0.25, fontWeight: 400 },
  'display/medium': { fontSize: 45, lineHeight: 52, letterSpacing: 0, fontWeight: 400 },
  'display/small': { fontSize: 36, lineHeight: 44, letterSpacing: 0, fontWeight: 400 },
  'headline/large': { fontSize: 32, lineHeight: 40, letterSpacing: 0, fontWeight: 400 },
  'headline/medium': { fontSize: 28, lineHeight: 36, letterSpacing: 0, fontWeight: 400 },
  'headline/small': { fontSize: 24, lineHeight: 32, letterSpacing: 0, fontWeight: 400 },
  'title/large': { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: 400 },
  'title/medium': { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: 500 },
  'title/small': { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: 500 },
  'body/large': { fontSize: 16, lineHeight: 24, letterSpacing: 0.5, fontWeight: 400 },
  'body/medium': { fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: 400 },
  'body/small': { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: 400 },
  'label/large': { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: 500 },
  'label/medium': { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: 500 },
  'label/small': { fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: 500 },
};

const SPACING_SCALE = {
  '0': 0,
  'xs': 4,
  'sm': 8,
  'md': 12,
  'lg': 16,
  'xl': 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

const RADIUS_SCALE = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 9999,
};

const COMPONENT_SPACING_MAP = {
  'spacing/button/padding-inline': 'spacing/lg',
  'spacing/button/padding-block': 'spacing/sm',
  'spacing/input/padding-inline': 'spacing/md',
  'spacing/input/padding-block': 'spacing/sm',
  'spacing/card/padding': 'spacing/xl',
  'spacing/nav/item-inline': 'spacing/md',
  'spacing/nav/item-block': 'spacing/sm',
};

const COMPONENT_RADIUS_MAP = {
  'radius/button': 'radius/full',
  'radius/input': 'radius/md',
  'radius/card': 'radius/lg',
};

const COMPONENT_TYPOGRAPHY_MAP = {
  'typography/button/label': 'label/large',
  'typography/input/value': 'body/large',
  'typography/card/title': 'title/medium',
  'typography/card/body': 'body/medium',
  'typography/nav/item': 'label/large',
};

function collectionName(prefix, layer) {
  return `${prefix}.${layer}`;
}

function tokenAlias(collection, variable) {
  return { alias: { collection, variable } };
}

function sharedAliasModes(collection, variable) {
  return {
    Light: tokenAlias(collection, variable),
    Dark: tokenAlias(collection, variable),
  };
}

function buildPrimitiveColorVariables() {
  const variables = [];
  for (const [group, scale] of Object.entries(MATERIAL3_COLOR_REFERENCES)) {
    for (const [step, value] of Object.entries(scale)) {
      variables.push({
        name: `color/${group}/${step}`,
        type: 'COLOR',
        values: { Base: value },
      });
    }
  }
  return variables;
}

function buildPrimitiveSpacingVariables() {
  return Object.entries(SPACING_SCALE).map(([name, value]) => ({
    name: `spacing/${name}`,
    type: 'FLOAT',
    values: { Base: value },
  }));
}

function buildPrimitiveRadiusVariables() {
  return Object.entries(RADIUS_SCALE).map(([name, value]) => ({
    name: `radius/${name}`,
    type: 'FLOAT',
    values: { Base: value },
  }));
}

function buildPrimitiveTypographyVariables() {
  const variables = [];
  for (const [role, def] of Object.entries(TYPOGRAPHY_ROLES)) {
    variables.push(
      { name: `typography/${role}/font-size`, type: 'FLOAT', values: { Base: def.fontSize } },
      { name: `typography/${role}/line-height`, type: 'FLOAT', values: { Base: def.lineHeight } },
      { name: `typography/${role}/tracking`, type: 'FLOAT', values: { Base: def.letterSpacing } },
      { name: `typography/${role}/font-weight`, type: 'FLOAT', values: { Base: def.fontWeight } },
    );
  }
  return variables;
}

function buildSemanticColorVariables(prefix) {
  const primitives = collectionName(prefix, 'primitives');
  return [
    { name: 'color/primary', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/primary/40'), Dark: tokenAlias(primitives, 'color/primary/80') } },
    { name: 'color/on-primary', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/primary/100'), Dark: tokenAlias(primitives, 'color/primary/20') } },
    { name: 'color/primary-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/primary/90'), Dark: tokenAlias(primitives, 'color/primary/30') } },
    { name: 'color/on-primary-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/primary/10'), Dark: tokenAlias(primitives, 'color/primary/90') } },
    { name: 'color/secondary', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/secondary/40'), Dark: tokenAlias(primitives, 'color/secondary/80') } },
    { name: 'color/on-secondary', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/secondary/100'), Dark: tokenAlias(primitives, 'color/secondary/20') } },
    { name: 'color/secondary-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/secondary/90'), Dark: tokenAlias(primitives, 'color/secondary/30') } },
    { name: 'color/on-secondary-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/secondary/10'), Dark: tokenAlias(primitives, 'color/secondary/90') } },
    { name: 'color/surface', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral/99'), Dark: tokenAlias(primitives, 'color/neutral/10') } },
    { name: 'color/surface-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral/95'), Dark: tokenAlias(primitives, 'color/neutral/20') } },
    { name: 'color/surface-container-high', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral/90'), Dark: tokenAlias(primitives, 'color/neutral/30') } },
    { name: 'color/on-surface', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral/10'), Dark: tokenAlias(primitives, 'color/neutral/90') } },
    { name: 'color/surface-variant', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral-variant/90'), Dark: tokenAlias(primitives, 'color/neutral-variant/30') } },
    { name: 'color/on-surface-variant', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral-variant/30'), Dark: tokenAlias(primitives, 'color/neutral-variant/80') } },
    { name: 'color/outline', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral-variant/50'), Dark: tokenAlias(primitives, 'color/neutral-variant/60') } },
    { name: 'color/outline-variant', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/neutral-variant/80'), Dark: tokenAlias(primitives, 'color/neutral-variant/30') } },
    { name: 'color/error', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/error/40'), Dark: tokenAlias(primitives, 'color/error/80') } },
    { name: 'color/on-error', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/error/100'), Dark: tokenAlias(primitives, 'color/error/20') } },
    { name: 'color/error-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/error/90'), Dark: tokenAlias(primitives, 'color/error/30') } },
    { name: 'color/on-error-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/error/10'), Dark: tokenAlias(primitives, 'color/error/90') } },
    { name: 'color/success', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/success/40'), Dark: tokenAlias(primitives, 'color/success/80') } },
    { name: 'color/on-success', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/success/100'), Dark: tokenAlias(primitives, 'color/success/20') } },
    { name: 'color/success-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/success/90'), Dark: tokenAlias(primitives, 'color/success/30') } },
    { name: 'color/on-success-container', type: 'COLOR', values: { Light: tokenAlias(primitives, 'color/success/10'), Dark: tokenAlias(primitives, 'color/success/90') } },
  ];
}

function buildSemanticSpacingVariables(prefix) {
  const primitives = collectionName(prefix, 'primitives');
  return Object.keys(SPACING_SCALE).map(name => ({
    name: `spacing/${name}`,
    type: 'FLOAT',
    values: sharedAliasModes(primitives, `spacing/${name}`),
  }));
}

function buildSemanticRadiusVariables(prefix) {
  const primitives = collectionName(prefix, 'primitives');
  return Object.keys(RADIUS_SCALE).map(name => ({
    name: `radius/${name}`,
    type: 'FLOAT',
    values: sharedAliasModes(primitives, `radius/${name}`),
  }));
}

function buildSemanticTypographyVariables(prefix) {
  const primitives = collectionName(prefix, 'primitives');
  const variables = [];

  for (const role of Object.keys(TYPOGRAPHY_ROLES)) {
    variables.push(
      { name: `typography/${role}/font-size`, type: 'FLOAT', values: sharedAliasModes(primitives, `typography/${role}/font-size`) },
      { name: `typography/${role}/line-height`, type: 'FLOAT', values: sharedAliasModes(primitives, `typography/${role}/line-height`) },
      { name: `typography/${role}/tracking`, type: 'FLOAT', values: sharedAliasModes(primitives, `typography/${role}/tracking`) },
      { name: `typography/${role}/font-weight`, type: 'FLOAT', values: sharedAliasModes(primitives, `typography/${role}/font-weight`) },
    );
  }

  return variables;
}

function buildComponentColorVariables(prefix) {
  const semantic = collectionName(prefix, 'semantic');
  return [
    { name: 'color/button/primary/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/primary'), Dark: tokenAlias(semantic, 'color/primary') } },
    { name: 'color/button/primary/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-primary'), Dark: tokenAlias(semantic, 'color/on-primary') } },
    { name: 'color/button/secondary/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/secondary-container'), Dark: tokenAlias(semantic, 'color/secondary-container') } },
    { name: 'color/button/secondary/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-secondary-container'), Dark: tokenAlias(semantic, 'color/on-secondary-container') } },
    { name: 'color/button/destructive/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/error'), Dark: tokenAlias(semantic, 'color/error') } },
    { name: 'color/button/destructive/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-error'), Dark: tokenAlias(semantic, 'color/on-error') } },
    { name: 'color/input/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/surface-container'), Dark: tokenAlias(semantic, 'color/surface-container') } },
    { name: 'color/input/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-surface'), Dark: tokenAlias(semantic, 'color/on-surface') } },
    { name: 'color/input/border', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/outline'), Dark: tokenAlias(semantic, 'color/outline') } },
    { name: 'color/card/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/surface'), Dark: tokenAlias(semantic, 'color/surface') } },
    { name: 'color/card/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-surface'), Dark: tokenAlias(semantic, 'color/on-surface') } },
    { name: 'color/card/border', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/outline-variant'), Dark: tokenAlias(semantic, 'color/outline-variant') } },
    { name: 'color/nav/item/active/bg', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/secondary-container'), Dark: tokenAlias(semantic, 'color/secondary-container') } },
    { name: 'color/nav/item/active/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-secondary-container'), Dark: tokenAlias(semantic, 'color/on-secondary-container') } },
    { name: 'color/nav/item/inactive/text', type: 'COLOR', values: { Light: tokenAlias(semantic, 'color/on-surface-variant'), Dark: tokenAlias(semantic, 'color/on-surface-variant') } },
  ];
}

function buildComponentSpacingVariables(prefix) {
  const semantic = collectionName(prefix, 'semantic');
  return Object.entries(COMPONENT_SPACING_MAP).map(([name, target]) => ({
    name,
    type: 'FLOAT',
    values: sharedAliasModes(semantic, target),
  }));
}

function buildComponentRadiusVariables(prefix) {
  const semantic = collectionName(prefix, 'semantic');
  return Object.entries(COMPONENT_RADIUS_MAP).map(([name, target]) => ({
    name,
    type: 'FLOAT',
    values: sharedAliasModes(semantic, target),
  }));
}

function buildComponentTypographyVariables(prefix) {
  const semantic = collectionName(prefix, 'semantic');
  const variables = [];

  for (const [componentRole, typeRole] of Object.entries(COMPONENT_TYPOGRAPHY_MAP)) {
    variables.push(
      { name: `${componentRole}/font-size`, type: 'FLOAT', values: sharedAliasModes(semantic, `typography/${typeRole}/font-size`) },
      { name: `${componentRole}/line-height`, type: 'FLOAT', values: sharedAliasModes(semantic, `typography/${typeRole}/line-height`) },
      { name: `${componentRole}/tracking`, type: 'FLOAT', values: sharedAliasModes(semantic, `typography/${typeRole}/tracking`) },
      { name: `${componentRole}/font-weight`, type: 'FLOAT', values: sharedAliasModes(semantic, `typography/${typeRole}/font-weight`) },
    );
  }

  return variables;
}

function buildTextStyles(prefix, fontFamily) {
  const semantic = collectionName(prefix, 'semantic');
  return Object.entries(TYPOGRAPHY_ROLES).map(([role, def]) => ({
    name: `${prefix}/typography/${role}`,
    fontFamily,
    fontWeight: def.fontWeight,
    fontSize: def.fontSize,
    lineHeight: def.lineHeight,
    letterSpacing: def.letterSpacing,
    tokens: {
      fontSize: `${semantic}/typography/${role}/font-size`,
      lineHeight: `${semantic}/typography/${role}/line-height`,
      letterSpacing: `${semantic}/typography/${role}/tracking`,
      fontWeight: `${semantic}/typography/${role}/font-weight`,
    },
  }));
}

export function buildMaterial3TypographyStyles(options = {}) {
  const prefix = options.prefix || 'm3';
  const fontFamily = options.fontFamily || 'Roboto';
  return buildTextStyles(prefix, fontFamily);
}

export function buildMaterial3System(options = {}) {
  const prefix = options.prefix || 'm3';
  const fontFamily = options.fontFamily || 'Roboto';
  const includeTextStyles = options.includeTextStyles !== false;

  return {
    name: 'material3',
    prefix,
    collections: [
      {
        name: collectionName(prefix, 'primitives'),
        modes: ['Base'],
        variables: [
          ...buildPrimitiveColorVariables(),
          ...buildPrimitiveSpacingVariables(),
          ...buildPrimitiveRadiusVariables(),
          ...buildPrimitiveTypographyVariables(),
        ],
      },
      {
        name: collectionName(prefix, 'semantic'),
        modes: ['Light', 'Dark'],
        variables: [
          ...buildSemanticColorVariables(prefix),
          ...buildSemanticSpacingVariables(prefix),
          ...buildSemanticRadiusVariables(prefix),
          ...buildSemanticTypographyVariables(prefix),
        ],
      },
      {
        name: collectionName(prefix, 'component'),
        modes: ['Light', 'Dark'],
        variables: [
          ...buildComponentColorVariables(prefix),
          ...buildComponentSpacingVariables(prefix),
          ...buildComponentRadiusVariables(prefix),
          ...buildComponentTypographyVariables(prefix),
        ],
      },
    ],
    textStyles: includeTextStyles ? buildTextStyles(prefix, fontFamily) : [],
  };
}
