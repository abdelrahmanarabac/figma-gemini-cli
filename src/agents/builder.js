/**
 * Builder Expert — Composable template engine.
 *
 * Phase: BUILD
 * Consumes pre-processor context (tokens, icons, copy) and produces
 * render-ready JSX by matching components from descriptions and
 * composing them via layout primitives.
 */

import { Expert } from './expert.js';
import { findBestReusableComponent } from './workflow-planner.js';
import {
  buttons, matchButtonVariant,
  cards, matchCardType,
  inputs, form, matchInputType,
  navigation,
  dataDisplay, table,
  feedback,
  grid, stack, split, centered, dashboard, inferLayout,
} from './primitives/index.js';

// ── Component Pattern Matching ───────────────────────

const COMPONENT_PATTERNS = [
  { type: 'sidebar',     match: /\b(sidebar|side\s*nav|drawer|left\s*panel)s?\b/i, category: 'navigation' },
  { type: 'header',      match: /\b(header|topbar|app\s*bar|toolbar|banner|top\s*bar)s?\b/i, category: 'navigation' },
  { type: 'tab-bar',     match: /\b(tab\s*bar|tabs|tab\s*nav)s?\b/i, category: 'navigation' },
  { type: 'button',      match: /\b(button|btn|cta|submit|action)s?\b/i, category: 'button' },
  { type: 'stat_card',   match: /\b(stat\s*card|metric\s*card|kpi|statistic)s?\b/i, category: 'card' },
  { type: 'pricing',     match: /\b(pricing|plan|tier|subscription|price)s?\b/i, category: 'card' },
  { type: 'card',        match: /\b(card|tile|panel)s?\b/i, category: 'card' },
  { type: 'input',       match: /\b(input|field|text\s*field|search\s*bar)\b/i, category: 'input' },
  { type: 'form',        match: /\b(form|login|signup|register|sign\s*in|sign\s*up|contact)\b/i, category: 'form' },
  { type: 'badge',       match: /\b(badge|tag|label|chip|status)\b/i, category: 'data' },
  { type: 'avatar',      match: /\b(avatar|profile\s*(pic|image|photo)|user\s*icon)\b/i, category: 'data' },
  { type: 'table',       match: /\b(table|data\s*table|grid\s*view|spreadsheet)\b/i, category: 'data' },
  { type: 'list',        match: /\b(list|list\s*items?|menu\s*items?)\b/i, category: 'data' },
  { type: 'modal',       match: /\b(modal|dialog|popup|overlay|confirm)\b/i, category: 'feedback' },
  { type: 'alert',       match: /\b(alert|notice|banner\s*message|warning\s*box)\b/i, category: 'feedback' },
  { type: 'toast',       match: /\b(toast|snackbar|notification)\b/i, category: 'feedback' },
  { type: 'divider',     match: /\b(divider|separator|hr|line)\b/i, category: 'data' },
];

export class BuilderExpert extends Expert {
  name = 'builder';
  description = 'Composable template engine. Matches components from descriptions and composes them via layout primitives.';
  capabilities = ['component', 'layout', 'generation'];
  priority = 30;
  phase = 'build';

  relevance(intent) {
    if (['generate', 'render'].includes(intent.action)) return 0.95;
    if (intent.tags.includes('component')) return 0.85;
    if (intent.tags.includes('layout')) return 0.7;
    return 0.1;
  }

  /**
   * Get all available template names.
   * @returns {string[]}
   */
  listTemplates() {
    return [
      ...Object.keys(buttons).map(k => `button/${k}`),
      ...Object.keys(cards).map(k => `card/${k}`),
      ...Object.keys(inputs).map(k => `input/${k}`),
      ...Object.keys(navigation).map(k => `nav/${k}`),
      ...Object.keys(dataDisplay).map(k => `data/${k}`),
      ...Object.keys(feedback).map(k => `feedback/${k}`),
    ];
  }

  /**
   * Match components from a natural language description.
   * Returns an array of matched component specs.
   * @param {string} description
   * @returns {Array<{ type: string, category: string, count: number, variant?: string }>}
   */
  matchComponents(description) {
    let lower = description.toLowerCase();
    const matched = [];

    for (const pattern of COMPONENT_PATTERNS) {
      if (pattern.type === 'card' && matched.some(m => m.category === 'card' && m.type !== 'card')) {
        continue;
      }

      const matchRegex = new RegExp(`(?:\\b(\\d+)\\s+)?${pattern.match.source}`, 'i');
      const m = lower.match(matchRegex);
      
      if (m) {
        const count = this._resolveMatchCount(pattern.type, description, m);

        // Detect variant
        let variant = null;
        if (pattern.category === 'button') variant = matchButtonVariant(description);
        if (pattern.category === 'card' && pattern.type === 'card') variant = matchCardType(description);
        if (pattern.category === 'input') variant = matchInputType(description);

        matched.push({ type: pattern.type, category: pattern.category, count, variant });
        
        // Remove the matched portion to prevent greedy double-matches
        // e.g., 'stat card' -> don't match 'card' again later
        lower = lower.replace(m[0], '');
      }
    }

    // If nothing matched, default to a basic card
    if (matched.length === 0) {
      matched.push({ type: 'card', category: 'card', count: 1, variant: 'basic' });
    }

    return matched;
  }

  /**
   * Render a single primitive component.
   * @param {{ type: string, category: string, variant?: string }} match
   * @param {Object} context - Pipeline context (tokens, icons, copy, mode)
   * @param {number} index - Index for multi-instance generation
   * @returns {string} JSX
   */
  renderPrimitive(match, context = {}, index = 0) {
    const { mode = 'Light', copy = {}, icons = {}, tokens } = context;
    const opts = { mode, tokens };
    const reusableComponent = context.preferences?.useExistingComponents
      ? findBestReusableComponent(match, context.components || [])
      : null;

    if (reusableComponent) {
      context.reuseLog = context.reuseLog || [];
      context.reuseLog.push({
        matchType: match.type,
        matchVariant: match.variant || null,
        componentId: reusableComponent.id,
        componentName: reusableComponent.name,
      });
      return `<Instance name="${reusableComponent.name.replace(/"/g, '\\"')}" componentId="${reusableComponent.id}" />`;
    }

    switch (match.type) {
      case 'button':
        return buttons[match.variant || 'primary']({
          label: copy.cta || copy.labels?.[index] || 'Button',
          ...opts,
        });

      case 'card':
        return cards[match.variant || 'basic']({
          title: copy.title || copy.labels?.[index] || 'Card Title',
          description: copy.description || 'Description text goes here.',
          ...opts,
        });

      case 'pricing': {
        const tierNames = copy.tierNames || ['Basic', 'Pro', 'Enterprise'];
        const prices = copy.prices || ['\\`$9', '\\`$29', 'Custom'];
        const ctaLabels = copy.ctaLabels || ['Start free', 'Upgrade to Pro', 'Contact sales'];
        const name = tierNames[index] || `Tier ${index + 1}`;
        const price = prices[index] || '\\`$0';
        return cards.pricing({
          name,
          price,
          primary: index === 1,
          features: copy.features?.[index] || ['Feature 1', 'Feature 2', 'Feature 3'],
          ctaLabel: ctaLabels[index] || 'Get Started',
          ...opts,
        });
      }

      case 'input':
        return inputs[match.variant || 'text']({
          label: copy.labels?.[index] || 'Field',
          ...opts,
        });

      case 'form': {
        const formFields = copy.fields || [
          { label: 'Email', placeholder: 'Enter email...' },
          { label: 'Password', placeholder: 'Enter password...' },
        ];
        return form(formFields, {
          title: copy.title || this._inferFormTitle(context.description || ''),
          submitLabel: copy.cta || 'Submit',
          ...opts,
        });
      }

      case 'sidebar':
        return navigation.sidebar({
          items: copy.navItems || ['Dashboard', 'Analytics', 'Users', 'Settings'],
          title: copy.appName || 'AppName',
          ...opts,
        });

      case 'header':
        return navigation.header({
          title: copy.title || copy.pageTitle || 'Dashboard',
          ...opts,
        });

      case 'tab-bar':
        return navigation.tabBar({
          tabs: copy.tabs || ['All', 'Active', 'Archived'],
          ...opts,
        });

      case 'badge':
        return dataDisplay.badge({
          text: copy.labels?.[index] || 'Active',
          ...opts,
        });

      case 'avatar':
        return dataDisplay.avatar({
          name: copy.labels?.[index] || 'JD',
          ...opts,
        });

      case 'table':
        return table(
          copy.headers || ['Name', 'Status', 'Date'],
          copy.rows || [['John Doe', 'Active', '2024-01-15'], ['Jane Smith', 'Pending', '2024-01-16']],
          opts,
        );

      case 'list': {
        const items = copy.labels || ['Item 1', 'Item 2', 'Item 3'];
        return items.map(item =>
          dataDisplay.listItem({ title: item, ...opts })
        ).join('\n');
      }

      case 'modal':
        return feedback.modal({
          title: copy.title || 'Confirm Action',
          description: copy.description || 'Are you sure?',
          ...opts,
        });

      case 'alert':
        return feedback.alert({
          title: copy.title || 'Alert',
          message: copy.description || 'Something happened.',
          type: copy.severity || 'info',
          ...opts,
        });

      case 'toast':
        return feedback.toast({
          message: copy.description || 'Changes saved.',
          ...opts,
        });

      case 'divider':
        return dataDisplay.divider(opts);

      case 'stat_card':
        return cards.stat({
          title: copy.title || 'Stat Title',
          value: '100',
          trend: '+5%',
          ...opts,
        });

      default:
        return cards.basic({
          title: copy.title || match.type,
          description: copy.description || `Auto-generated ${match.type}`,
          ...opts,
        });
    }
  }

  buildFromDescription(description, context = {}) {
    const matched = this.matchComponents(description);
    const layoutInfo = inferLayout(description, this._totalCount(matched));
    context.reuseLog = [];

    // Expand matched components into individual JSX elements.
    // However, if the layout naturally provides certain scaffolds (like dashboard provides sidebar/header),
    // we don't need to treat them as independent elements in the main content flow.
    const elements = [];
    for (const m of matched) {
      const isLayoutScaffold = ['dashboard', 'split'].includes(layoutInfo.type) && ['sidebar', 'header'].includes(m.type);
      
      if (!isLayoutScaffold) {
        for (let i = 0; i < m.count; i++) {
          elements.push(this.renderPrimitive(m, { ...context, description }, i));
        }
      }
    }

    // Apply layout
    const jsx = this._applyLayout(layoutInfo, matched, elements, context);
    return { jsx, templateUsed: layoutInfo.type, reusedComponents: context.reuseLog || [] };
  }

  /** @private */
  _applyLayout(layoutInfo, matched, elements, context) {
    const { mode = 'Light', tokens } = context;
    const opts = { mode, tokens };

    switch (layoutInfo.type) {
      case 'dashboard': {
        // Dashboard: sidebar + header + content
        const sidebarMatch = matched.find(m => m.type === 'sidebar');
        const headerMatch = matched.find(m => m.type === 'header');

        const sidebarJsx = sidebarMatch
          ? this.renderPrimitive(sidebarMatch, context)
          : navigation.sidebar(opts);
        const headerJsx = headerMatch
          ? this.renderPrimitive(headerMatch, context)
          : navigation.header(opts);
          
        let contentJsx = cards.stat(opts);
        if (elements.length > 0) {
          contentJsx = elements.length > 1 
            ? grid(elements, Math.min(elements.length, 4), { ...opts, bg: 'transparent', p: 0 }) 
            : elements[0];
        }

        return dashboard(sidebarJsx, headerJsx, contentJsx, opts);
      }

      case 'split': {
        const sidebarMatch = matched.find(m => m.type === 'sidebar');
        const sidebarJsx = sidebarMatch
          ? this.renderPrimitive(sidebarMatch, context)
          : navigation.sidebar(opts);

        let rightJsx = cards.basic(opts);
        if (elements.length > 0) {
          rightJsx = elements.length > 1 
            ? grid(elements, Math.min(elements.length, 3), { ...opts, bg: 'transparent', p: 0 }) 
            : elements[0];
        }

        return split(sidebarJsx, rightJsx, opts);
      }

      case 'grid':
        return grid(elements, layoutInfo.columns || 3, opts);

      case 'stack-h':
        return stack(elements, 'row', opts);

      case 'stack-v':
        return stack(elements, 'col', opts);

      case 'centered':
        return centered(elements.join('\n'), opts);

      case 'single':
      default:
        return elements.length === 1 ? elements[0] : stack(elements, 'col', opts);
    }
  }

  /** @private */
  _totalCount(matched) {
    return matched.reduce((sum, m) => sum + m.count, 0);
  }

  /** @private — find which match object corresponds to the flat element index */
  _findMatchForIndex(matched, flatIndex) {
    let idx = 0;
    for (const m of matched) {
      if (flatIndex < idx + m.count) return m;
      idx += m.count;
    }
    return null;
  }

  /** @private */
  _inferFormTitle(description) {
    const lower = description.toLowerCase();
    if (lower.includes('login') || lower.includes('sign in')) return 'Sign In';
    if (lower.includes('signup') || lower.includes('sign up') || lower.includes('register')) return 'Create Account';
    if (lower.includes('contact')) return 'Contact Us';
    if (lower.includes('feedback')) return 'Feedback';
    return 'Form';
  }

  /** @private */
  _resolveMatchCount(type, description, match) {
    if (match[1]) {
      return parseInt(match[1], 10);
    }

    const countPatterns = {
      pricing: /(\d+)\s*(tiers?|plans?|subscriptions?)/i,
      stat_card: /(\d+)\s*(stats?|metrics?|kpis?|cards?)/i,
      card: /(\d+)\s*(cards?|tiles?|panels?)/i,
      button: /(\d+)\s*(buttons?|ctas?)/i,
      input: /(\d+)\s*(inputs?|fields?)/i,
    };

    const countMatch = countPatterns[type]?.exec(description);
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }

    return 1;
  }

  async execute(ctx, task, pipelineData = {}) {
    const description = task.description || task.input?.intent?.raw || '';

    // ── Consume pre-processor context ──
    const context = {
      mode: pipelineData.intent?.params?.mode || 'Light',
      tokens: pipelineData.tokens || {},
      icons: pipelineData.icons || {},
      copy: pipelineData.copy || {},
      description,
    };

    context.components = pipelineData.inventory?.components || [];
    context.preferences = pipelineData.preferences || {};

    const { jsx, templateUsed, reusedComponents } = this.buildFromDescription(description, context);

    // Parse JSX to commands
    let commands = [];
    let parseErrors = [];
    let diagnostics = [];
    try {
      const { compileJSX } = await import('../parser/jsx.js');
      const result = compileJSX(jsx);
      commands = result.commands;
      parseErrors = result.errors;
      diagnostics = result.diagnostics || [];
    } catch (err) {
      return {
        success: false,
        data: { jsx, commands: [] },
        metadata: { templateUsed },
        warnings: [],
        errors: [`JSX parse failed: ${err.message}`],
      };
    }

    const blockingDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error');

    return {
      success: commands.length > 0 && blockingDiagnostics.length === 0,
      data: { jsx, commands, templateUsed, diagnostics, reusedComponents },
      metadata: { templateUsed, commandCount: commands.length, diagnosticCount: diagnostics.length, reusedComponents: reusedComponents.length },
      warnings: parseErrors.length > 0 ? [`Parser warnings: ${parseErrors.join('; ')}`] : [],
      errors: [
        ...(commands.length === 0 ? ['No commands generated from JSX'] : []),
        ...blockingDiagnostics.map(diagnostic => `[${diagnostic.code}] ${diagnostic.message}`),
      ],
    };
  }
}
