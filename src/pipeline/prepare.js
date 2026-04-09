/**
 * Pipeline: Prepare
 *
 * Scans the connected Figma file for existing tokens, components,
 * and text styles. Returns a structured inventory so the AI agent
 * (and downstream validate step) can make informed decisions.
 */

// ── Helpers ──────────────────────────────────────────

function classifyCollection(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('semantic')) return 'semantic';
  if (lower.includes('component')) return 'component';
  if (lower.includes('primitive')) return 'primitives';
  return 'other';
}

function hasCatalogEntries(catalog = {}) {
  return Object.values(catalog).some(group => Object.keys(group || {}).length > 0);
}

// ── Token Catalog ────────────────────────────────────

export function buildTokenCatalog(inventory = {}) {
  const variables = Array.isArray(inventory.variables) ? inventory.variables : [];
  const collections = Array.isArray(inventory.variableCollections) ? inventory.variableCollections : [];
  const collectionTypeByName = new Map(
    collections.map(c => [c.name, classifyCollection(c.name)])
  );

  const catalog = {
    semantic: {},
    spacing: {},
    radius: {},
    typography: {},
    component: {},
    primitives: {},
  };

  for (const variable of variables) {
    const collectionType = collectionTypeByName.get(variable.collectionName) || 'other';
    const name = variable.name;

    if (collectionType === 'semantic') {
      if (name.startsWith('color/')) catalog.semantic[name] = { value: name, source: variable.collectionName };
      if (name.startsWith('spacing/')) catalog.spacing[name] = { value: name, source: variable.collectionName };
      if (name.startsWith('radius/')) catalog.radius[name] = { value: name, source: variable.collectionName };
      if (name.startsWith('typography/')) catalog.typography[name] = { value: name, source: variable.collectionName };
    } else if (collectionType === 'component') {
      catalog.component[name] = { value: name, source: variable.collectionName };
    } else if (collectionType === 'primitives') {
      catalog.primitives[name] = { value: name, source: variable.collectionName };
    }
  }

  return catalog;
}

// ── Inventory Scanner ────────────────────────────────

export async function inspectInventory(ctx) {
  try {
    const inventory = await ctx.evalOp('inventory.scan');

    const tokenCatalog = buildTokenCatalog(inventory);
    const tokenCollections = Array.isArray(inventory.variableCollections) ? inventory.variableCollections : [];
    const components = Array.isArray(inventory.components) ? inventory.components : [];
    const textStyles = Array.isArray(inventory.textStyles) ? inventory.textStyles : [];

    return {
      ...inventory,
      tokenCatalog,
      tokenSummary: {
        collectionCount: tokenCollections.length,
        variableCount: Array.isArray(inventory.variables) ? inventory.variables.length : 0,
        hasReusableCatalog: hasCatalogEntries(tokenCatalog),
        semanticCount: Object.keys(tokenCatalog.semantic).length,
        spacingCount: Object.keys(tokenCatalog.spacing).length,
        radiusCount: Object.keys(tokenCatalog.radius).length,
        typographyCount: Object.keys(tokenCatalog.typography).length,
      },
      componentSummary: {
        count: components.length,
        sampleNames: components.slice(0, 12).map(c => c.name),
      },
      styleSummary: {
        count: textStyles.length,
        sampleNames: textStyles.slice(0, 12).map(s => s.name),
      },
    };
  } catch {
    return {
      pageName: null,
      selection: [],
      variableCollections: [],
      variables: [],
      textStyles: [],
      components: [],
      tokenCatalog: { semantic: {}, spacing: {}, radius: {}, typography: {}, component: {}, primitives: {} },
      tokenSummary: { collectionCount: 0, variableCount: 0, hasReusableCatalog: false, semanticCount: 0, spacingCount: 0, radiusCount: 0, typographyCount: 0 },
      componentSummary: { count: 0, sampleNames: [] },
      styleSummary: { count: 0, sampleNames: [] },
    };
  }
}

// ── Main Entry ───────────────────────────────────────

export async function prepare(ctx) {
  const inventory = await inspectInventory(ctx);
  return { inventory, tokens: inventory.tokenCatalog || {} };
}
