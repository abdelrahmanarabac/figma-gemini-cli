import { Expert } from './expert.js';

const TEST_KEYWORDS = ['test', 'smoke', 'regression', 'snapshot', 'qa'];
const AUDIT_KEYWORDS = ['audit', 'a11y', 'accessibility', 'contrast', 'validate', 'lint', 'check'];
const TOKEN_KEYWORDS = ['token', 'tokens', 'tokenize', 'palette', 'variables', 'design system'];

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

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

export function buildTokenCatalogFromInventory(inventory = {}) {
  const variables = Array.isArray(inventory.variables) ? inventory.variables : [];
  const collections = Array.isArray(inventory.variableCollections) ? inventory.variableCollections : [];
  const collectionTypeByName = new Map(
    collections.map(collection => [collection.name, classifyCollection(collection.name)])
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

function buildComponentKeywords(match) {
  const keywords = new Set([
    match.type,
    match.category,
    match.variant,
  ].filter(Boolean));

  const aliases = {
    button: ['button', 'btn', 'cta'],
    card: ['card', 'tile', 'panel'],
    pricing: ['pricing', 'tier', 'plan'],
    input: ['input', 'field', 'text field', 'textfield'],
    form: ['form', 'login', 'signup', 'register'],
    sidebar: ['sidebar', 'side nav', 'drawer', 'navigation'],
    header: ['header', 'topbar', 'toolbar', 'app bar'],
    'tab-bar': ['tabs', 'tab bar'],
    badge: ['badge', 'chip', 'tag'],
    avatar: ['avatar', 'profile'],
    table: ['table', 'data table'],
    list: ['list', 'menu'],
    modal: ['modal', 'dialog'],
    alert: ['alert', 'banner'],
    toast: ['toast', 'snackbar'],
    stat_card: ['stat', 'metric', 'kpi'],
  };

  for (const keyword of aliases[match.type] || []) {
    keywords.add(keyword);
  }

  return [...keywords].map(normalize).filter(Boolean);
}

export function findBestReusableComponent(match, components = []) {
  const keywords = buildComponentKeywords(match);
  let best = null;

  for (const component of components) {
    const haystack = normalize(component.name);
    let score = 0;

    for (const keyword of keywords) {
      if (!keyword) continue;
      if (haystack === keyword) score += 6;
      else if (haystack.includes(keyword)) score += 3;
    }

    if (match.variant && haystack.includes(normalize(match.variant))) {
      score += 2;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { ...component, score };
    }
  }

  return best;
}

export class WorkflowPlannerExpert extends Expert {
  name = 'workflow-planner';
  description = 'Plans the right workflow, inspects existing system inventory, and prepares generation preferences.';
  capabilities = ['routing', 'planning', 'inventory', 'token', 'component'];
  priority = 1;
  phase = 'pre';

  relevance(intent) {
    if (['generate', 'render', 'update', 'inspect', 'audit', 'find', 'get', 'tokens', 'test'].includes(intent.action)) {
      return 0.98;
    }
    return 0.6;
  }

  classifyWorkflow(intent) {
    const raw = normalize(intent.raw);

    if (TEST_KEYWORDS.some(keyword => raw.includes(keyword))) {
      return {
        route: 'test',
        reason: 'The request looks like verification or QA work, not UI generation.',
        recommendedCommand: 'npm test',
      };
    }

    if (AUDIT_KEYWORDS.some(keyword => raw.includes(keyword))) {
      return {
        route: 'audit',
        reason: 'The request looks like an audit or validation task.',
        recommendedCommand: 'figma-gemini-cli audit a11y --page',
      };
    }

    if (intent.action === 'tokens' || TOKEN_KEYWORDS.some(keyword => raw.includes(keyword))) {
      return {
        route: 'tokens',
        reason: 'The request is token-focused and should prefer the token workflow.',
        recommendedCommand: 'figma-gemini-cli tokens material3',
      };
    }

    return {
      route: 'generate',
      reason: 'The request is generation-oriented.',
      recommendedCommand: 'figma-gemini-cli generate "<description>"',
    };
  }

  async inspectInventory(ctx) {
    try {
      const inventory = await ctx.eval(`
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const variables = await figma.variables.getLocalVariablesAsync();
        const textStyles = await figma.getLocalTextStylesAsync();
        const components = figma.root.findAll(node => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET');
        return {
          pageName: figma.currentPage.name,
          selection: figma.currentPage.selection.map(node => ({ id: node.id, name: node.name, type: node.type })),
          variableCollections: collections.map(collection => ({
            id: collection.id,
            name: collection.name,
            modes: collection.modes.map(mode => mode.name),
          })),
          variables: variables.map(variable => {
            const collection = collections.find(item => item.id === variable.variableCollectionId);
            return {
              id: variable.id,
              name: variable.name,
              type: variable.resolvedType,
              collectionName: collection ? collection.name : '',
            };
          }),
          textStyles: textStyles.map(style => ({ id: style.id, name: style.name })),
          components: components.slice(0, 300).map(component => ({
            id: component.id,
            name: component.name,
            type: component.type,
          })),
        };
      `);

      const tokenCatalog = buildTokenCatalogFromInventory(inventory);
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
          sampleNames: components.slice(0, 12).map(component => component.name),
        },
        styleSummary: {
          count: textStyles.length,
          sampleNames: textStyles.slice(0, 12).map(style => style.name),
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
        tokenCatalog: {
          semantic: {},
          spacing: {},
          radius: {},
          typography: {},
          component: {},
          primitives: {},
        },
        tokenSummary: {
          collectionCount: 0,
          variableCount: 0,
          hasReusableCatalog: false,
          semanticCount: 0,
          spacingCount: 0,
          radiusCount: 0,
          typographyCount: 0,
        },
        componentSummary: {
          count: 0,
          sampleNames: [],
        },
        styleSummary: {
          count: 0,
          sampleNames: [],
        },
      };
    }
  }

  buildPreflight(intent, inventory) {
    const workflow = this.classifyWorkflow(intent);
    const recommendations = [];
    const questions = [];

    if (inventory.tokenSummary.collectionCount > 0) {
      recommendations.push(`Found ${inventory.tokenSummary.collectionCount} token collections and ${inventory.tokenSummary.variableCount} variables.`);
      questions.push({
        type: 'confirm',
        name: 'useExistingTokens',
        message: `Found ${inventory.tokenSummary.collectionCount} token collections. Reuse them during generation?`,
        default: true,
      });
    } else {
      recommendations.push('No existing token collections were found.');
      questions.push({
        type: 'confirm',
        name: 'createMissingTokens',
        message: 'No reusable tokens were found. Create missing token scaffolds when needed?',
        default: false,
      });
    }

    if (inventory.componentSummary.count > 0) {
      recommendations.push(`Found ${inventory.componentSummary.count} local components/component sets in the file.`);
      questions.push({
        type: 'confirm',
        name: 'useExistingComponents',
        message: `Found ${inventory.componentSummary.count} local components. Prefer reusing matching components?`,
        default: true,
      });
    } else {
      recommendations.push('No local components were detected for reuse.');
    }

    if (inventory.styleSummary.count > 0) {
      recommendations.push(`Found ${inventory.styleSummary.count} existing text styles.`);
    }

    return {
      workflow,
      recommendations,
      questions,
      needsConfirmation: workflow.route === 'generate' && questions.length > 0,
    };
  }

  async execute(ctx, task, pipelineData = {}) {
    const intent = pipelineData.intent || task.input?.intent || {
      raw: task.description || '',
      action: task.type || 'generate',
      tags: [],
      params: {},
    };

    const inventory = pipelineData.inventory || await this.inspectInventory(ctx);
    const preflight = this.buildPreflight(intent, inventory);

    return {
      success: true,
      data: {
        inventory,
        workflow: preflight.workflow,
        preflight,
      },
      metadata: {
        tokenCollections: inventory.tokenSummary.collectionCount,
        componentCount: inventory.componentSummary.count,
        styleCount: inventory.styleSummary.count,
      },
      warnings: preflight.recommendations,
      errors: [],
    };
  }
}
