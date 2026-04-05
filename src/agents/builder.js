/**
 * Builder Expert — Adaptive pattern composer.
 *
 * Phase: BUILD
 * Consumes pre-processor context (tokens, icons, copy) and produces
 * render-ready JSX by studying intent, pattern signals, and component
 * needs before composing layouts from the primitive library.
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
  grid, stack, split, centered, dashboard, inferLayout, createTypographyContext, resolveTokenValue, textProps,
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

const PAGE_ARCHETYPES = [
  { type: 'landing', match: /\b(landing|homepage|home page|marketing|website|web design|hero|product site|saas)\b/i },
  { type: 'dashboard', match: /\b(dashboard|analytics|admin|crm|portal|control panel|workspace)\b/i },
  { type: 'auth', match: /\b(login|sign in|signup|sign up|register|authentication|auth|onboarding)\b/i },
  { type: 'pricing', match: /\b(pricing|plans?|tiers?|subscriptions?)\b/i },
  { type: 'settings', match: /\b(settings|preferences|account|profile|billing)\b/i },
  { type: 'docs', match: /\b(docs|documentation|help center|knowledge base)\b/i },
  { type: 'showcase', match: /\b(portfolio|gallery|showcase|case study)\b/i },
];

const FLEX_PAGE_SIGNALS = /\b(page|screen|website|site|landing|homepage|dashboard|admin|portal|auth|onboarding|pricing|settings|docs|showcase|workspace)\b/i;

function indentBlock(jsx, spaces = 2) {
  const prefix = ' '.repeat(spaces);
  return String(jsx || '')
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}

export class BuilderExpert extends Expert {
  name = 'builder';
  description = 'Adaptive pattern composer. Learns from primitive/template patterns and composes flexible layouts.';
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

  analyzePattern(description, matched = []) {
    const lower = String(description || '').toLowerCase();
    const detected = PAGE_ARCHETYPES.find(item => item.match.test(lower))?.type;
    let archetype = detected;

    if (!archetype) {
      if (matched.some(item => item.type === 'pricing')) archetype = 'pricing';
      else if (matched.some(item => item.type === 'form')) archetype = 'auth';
      else if (matched.some(item => item.type === 'sidebar') || matched.some(item => item.type === 'table') || matched.some(item => item.type === 'stat_card')) archetype = 'dashboard';
      else if (matched.some(item => item.type === 'card' || item.type === 'badge')) archetype = 'landing';
      else archetype = 'custom';
    }

    const sections = this._inferSections(archetype, lower, matched);
    const density = /\b(dense|data-heavy|analytics|metrics|admin|table)\b/i.test(lower)
      ? 'dense'
      : /\b(minimal|clean|airy|editorial|spacious)\b/i.test(lower)
        ? 'airy'
        : 'balanced';
    const emphasis = /\b(editorial|brand|marketing|hero|story|showcase)\b/i.test(lower)
      ? 'brand'
      : /\b(data|analytics|metrics|table|kpi|chart)\b/i.test(lower)
        ? 'data'
        : 'utility';

    return {
      flexible: FLEX_PAGE_SIGNALS.test(lower) || sections.length >= 3 || this._totalCount(matched) >= 4,
      archetype,
      sections,
      density,
      emphasis,
      patternUsed: `adaptive/${archetype}`,
    };
  }

  /**
   * Render a single primitive component.
   * @param {{ type: string, category: string, variant?: string }} match
   * @param {Object} context - Pipeline context (tokens, icons, copy, mode)
   * @param {number} index - Index for multi-instance generation
   * @returns {string} JSX
   */
  renderPrimitive(match, context = {}, index = 0) {
    const { mode = 'Light', copy = {}, icons = {}, tokens, typography } = context;
    const opts = { mode, tokens, typography };
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
    const pattern = this.analyzePattern(description, matched);
    const layoutInfo = inferLayout(description, this._totalCount(matched));
    context.reuseLog = [];

    if (pattern.flexible && pattern.archetype !== 'custom') {
      const jsx = this._composeAdaptivePattern(pattern, matched, { ...context, description });
      return {
        jsx,
        templateUsed: pattern.patternUsed,
        patternUsed: pattern.patternUsed,
        reusedComponents: context.reuseLog || [],
        composition: pattern,
      };
    }

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
    return {
      jsx,
      templateUsed: layoutInfo.type,
      patternUsed: null,
      reusedComponents: context.reuseLog || [],
      composition: {
        flexible: false,
        archetype: layoutInfo.type,
        sections: matched.map(item => item.type),
        density: 'balanced',
        emphasis: 'utility',
        patternUsed: null,
      },
    };
  }

  _composeAdaptivePattern(pattern, matched, context) {
    switch (pattern.archetype) {
      case 'landing':
      case 'showcase':
        return this._composeLandingPage(pattern, matched, context);
      case 'dashboard':
        return this._composeDashboardPage(pattern, matched, context);
      case 'auth':
        return this._composeAuthPage(pattern, matched, context);
      case 'pricing':
        return this._composePricingPage(pattern, matched, context);
      case 'settings':
      case 'docs':
        return this._composeWorkspacePage(pattern, matched, context);
      default:
        return this._applyLayout(inferLayout(context.description || '', this._totalCount(matched)), matched, [], context);
    }
  }

  _composeLandingPage(pattern, matched, context) {
    const { mode = 'Light', tokens, typography, copy = {}, description = '' } = context;
    const opts = { mode, tokens, typography };
    const pageBg = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
    const sectionGap = resolveTokenValue(tokens, [['spacing', 'spacing/3xl']], 48);
    const sectionPadding = resolveTokenValue(tokens, [['spacing', 'spacing/3xl']], 48);
    const heroGap = resolveTokenValue(tokens, [['spacing', 'spacing/2xl']], 32);
    const titleColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#f8fafc' : '#0f172a');
    const bodyColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#cbd5e1' : '#475569');
    const surface = resolveTokenValue(tokens, [['semantic', 'color/surface']], mode === 'Dark' ? '#111827' : '#ffffff');
    const border = resolveTokenValue(tokens, [['semantic', 'color/outline-variant'], ['semantic', 'color/border']], mode === 'Dark' ? '#1f2937' : '#e2e8f0');
    const brand = copy.appName || copy.brand || this._inferBrandName(description);
    const heroTitle = copy.title || this._inferHeroTitle(description, pattern.archetype);
    const heroDescription = copy.description || 'A flexible page system that composes sections from patterns instead of replaying a fixed template.';
    const actionPrimary = buttons.primary({ label: copy.cta || 'Start now', ...opts });
    const actionSecondary = buttons.secondary({ label: 'View details', ...opts });
    const proofCards = [
      cards.stat({ label: 'Conversion lift', value: '18.4%', trend: '+6%', w: 250, ...opts }),
      cards.stat({ label: 'Team adoption', value: '82%', trend: '+11%', w: 250, ...opts }),
      cards.stat({ label: 'Build speed', value: '2.1x', trend: '+9%', w: 250, ...opts }),
    ];
    const featureCards = [
      cards.feature({ title: 'Flexible composition', description: 'Sections are assembled from layout signals, page archetypes, and requested content blocks.', w: 400, ...opts }),
      cards.feature({ title: 'Template-aware, not template-locked', description: 'Primitive patterns still teach spacing, hierarchy, and rhythm without dictating the final layout.', w: 400, ...opts }),
      cards.feature({ title: 'Ready for different brands', description: 'The same flow can shape landing, product, showcase, and editorial surfaces without one rigid output.', w: 400, ...opts }),
    ];
    const includePricing = matched.some(item => item.type === 'pricing') || /pricing|plan|tier/i.test(description);
    const pricingCards = includePricing ? [
      cards.pricing({ name: 'Starter', price: '`$12', ctaLabel: 'Try Starter', features: ['3 projects', 'Basic analytics', 'Email support'], w: 300, ...opts }),
      cards.pricing({ name: 'Growth', price: '`$39', ctaLabel: 'Choose Growth', primary: true, features: ['Unlimited projects', 'Advanced analytics', 'Priority support'], w: 300, ...opts }),
      cards.pricing({ name: 'Scale', price: 'Custom', ctaLabel: 'Talk to sales', features: ['Custom workflows', 'Enterprise controls', 'Shared governance'], w: 300, ...opts }),
    ] : [];

    const header = navigation.header({ title: brand, showSearch: false, showAvatar: false, ...opts });
    const heroVisual = cards.image({
      title: 'Adaptive surface preview',
      description: 'A visual block that can become analytics, editorial media, or product storytelling depending on the request.',
      w: 460,
      imageH: pattern.emphasis === 'brand' ? 300 : 240,
      ...opts,
    });

    const hero = `<Frame name={Hero_Section} w={fill} h={hug} flex={row} gap={${heroGap}} p={${sectionPadding}} items={center}>
  <Frame name={Hero_Copy} w={680} h={hug} flex={col} gap={24}>
    <Text ${textProps({ typography, role: 'display/large', size: 54, weight: 'bold', color: titleColor, w: 'fill' })}>${heroTitle}</Text>
    <Text ${textProps({ typography, role: 'body/large', size: 18, color: bodyColor, w: 'fill' })}>${heroDescription}</Text>
    <Frame name={Hero_Actions} w={hug} h={hug} flex={row} gap={16}>
${indentBlock(actionPrimary, 6)}
${indentBlock(actionSecondary, 6)}
    </Frame>
  </Frame>
${indentBlock(heroVisual, 2)}
</Frame>`;

    const proofRow = `<Frame name={Proof_Row} w={fill} h={hug} flex={row} gap={24} px={${sectionPadding}}>
${proofCards.map(card => indentBlock(card, 2)).join('\n')}
</Frame>`;

    const featureSection = `<Frame name={Feature_Section} w={fill} h={hug} flex={col} gap={24} px={${sectionPadding}} pb={${sectionPadding}}>
  <Frame name={Section_Heading} w={fill} h={hug} flex={col} gap={8}>
    <Text ${textProps({ typography, role: 'title/large', size: 32, weight: 'bold', color: titleColor, w: 'fill' })}>Built from patterns, not rigid outputs</Text>
    <Text ${textProps({ typography, role: 'body/large', size: 16, color: bodyColor, w: 'fill' })}>The system reads section intent first, then composes a fresh page structure from reusable UI ingredients.</Text>
  </Frame>
${indentBlock(grid(featureCards, 3, { ...opts, w: 1344, p: 0, gap: 24 }), 2)}
</Frame>`;

    const pricingSection = includePricing
      ? `\n  <Frame name={Pricing_Section} w={fill} h={hug} flex={col} gap={24} px={${sectionPadding}} pb={${sectionPadding}}>
    <Text ${textProps({ typography, role: 'title/large', size: 32, weight: 'bold', color: titleColor, w: 'fill' })}>Pricing adapts to the page story</Text>
${indentBlock(grid(pricingCards, 3, { ...opts, w: 1344, p: 0, gap: 24 }), 4)}
  </Frame>` : '';

    const ctaSection = `<Frame name={CTA_Section} w={fill} h={hug} px={${sectionPadding}} pb={${sectionPadding}} flex={col}>
  <Frame name={CTA_Banner} w={fill} h={hug} flex={row} justify={between} items={center} p={32} bg={${surface}} rounded={24} stroke={${border}}>
    <Frame name={CTA_Copy} w={780} h={hug} flex={col} gap={8}>
      <Text ${textProps({ typography, role: 'headline/small', size: 28, weight: 'bold', color: titleColor, w: 'fill' })}>Use templates as reference material, not the final answer.</Text>
      <Text ${textProps({ typography, role: 'body/large', size: 16, color: bodyColor, w: 'fill' })}>This page type is now composed from section patterns and can flex into different product stories without replaying one canned layout.</Text>
    </Frame>
${indentBlock(buttons.primary({ label: 'Continue building', ...opts }), 4)}
  </Frame>
</Frame>`;

    return `<Frame name={Adaptive_Landing_Page} w={1440} h={hug} flex={col} gap={${sectionGap}} bg={${pageBg}}>
${indentBlock(header, 2)}
${indentBlock(hero, 2)}
${indentBlock(proofRow, 2)}
${indentBlock(featureSection, 2)}${pricingSection}
${indentBlock(ctaSection, 2)}
</Frame>`;
  }

  _composeDashboardPage(pattern, matched, context) {
    const { mode = 'Light', tokens, typography, copy = {}, description = '' } = context;
    const opts = { mode, tokens, typography };
    const appName = copy.appName || this._inferBrandName(description);
    const pageTitle = copy.pageTitle || copy.title || 'Operations overview';
    const statCount = matched.find(item => item.type === 'stat_card')?.count || 4;
    const statLabels = ['Revenue', 'Conversion', 'Retention', 'Pipeline'];
    const statValues = ['`$128k', '6.8%', '91%', '43 deals'];
    const statTrends = ['+12%', '+4%', '+2%', '+9%'];
    const statCards = Array.from({ length: statCount }).map((_, index) => cards.stat({
      label: statLabels[index] || `Metric ${index + 1}`,
      value: statValues[index] || `${(index + 1) * 10}`,
      trend: statTrends[index] || '+3%',
      w: 240,
      ...opts,
    }));
    const headers = ['Account', 'Status', 'Owner'];
    const rows = [
      ['Northwind', 'Healthy', 'Amina'],
      ['Bluewave', 'Needs review', 'Mina'],
      ['Orbit Labs', 'Growing', 'Samir'],
    ];
    const tableBlock = table(copy.headers || headers, copy.rows || rows, { ...opts, w: 720 });
    const activityList = [
      dataDisplay.listItem({ title: 'Homepage refresh approved', subtitle: 'Marketing team', trailing: '2m', ...opts }),
      dataDisplay.listItem({ title: 'Billing token updated', subtitle: 'Finance sync', trailing: '18m', ...opts }),
      dataDisplay.listItem({ title: 'Design review scheduled', subtitle: 'Product team', trailing: '1h', ...opts }),
    ].join('\n');
    const activityCard = `<Frame name={Activity_Panel} w={360} h={hug} flex={col} gap={12}>
${indentBlock(cards.basic({ title: 'Recent activity', description: 'A compact feed that changes with the requested dashboard context.', w: 360, ...opts }), 2)}
  <Frame name={Activity_List} w={fill} h={hug} flex={col} gap={0}>
${activityList.split('\n').map(line => `    ${line}`).join('\n')}
  </Frame>
</Frame>`;
    const statsRow = `<Frame name={Stats_Row} w={fill} h={hug} flex={row} gap={24}>
${statCards.map(card => indentBlock(card, 2)).join('\n')}
</Frame>`;
    const content = `${statsRow}\n<Frame name={Insight_Row} w={fill} h={hug} flex={row} gap={24}>\n${indentBlock(tableBlock, 2)}\n${indentBlock(activityCard, 2)}\n</Frame>`;
    return dashboard(
      navigation.sidebar({ title: appName, items: copy.navItems || ['Overview', 'Sales', 'Customers', 'Forecast'], ...opts }),
      navigation.header({ title: pageTitle, showSearch: true, showAvatar: true, ...opts }),
      content,
      opts,
    );
  }

  _composeAuthPage(pattern, matched, context) {
    const { mode = 'Light', tokens, typography, copy = {}, description = '' } = context;
    const opts = { mode, tokens, typography };
    const formTitle = copy.title || this._inferFormTitle(description);
    const pageBg = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
    const bodyColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#cbd5e1' : '#475569');
    const centeredForm = centered(form(copy.fields || [
      { label: 'Email', placeholder: 'name@company.com' },
      { label: 'Password', placeholder: 'Enter password' },
    ], {
      title: formTitle,
      submitLabel: copy.cta || 'Continue',
      w: 420,
      ...opts,
    }), { ...opts, w: 520 });
    const benefits = stack([
      cards.feature({ title: 'Clear entry point', description: 'Auth surfaces should feel focused, not crowded by unrelated modules.', w: 360, ...opts }),
      cards.feature({ title: 'Reusable structure', description: 'The same composer can switch between sign in, sign up, invite, or onboarding pages.', w: 360, ...opts }),
    ], 'col', { ...opts, w: 400, p: 0, gap: 24 });
    return `<Frame name={Adaptive_Auth_Page} w={1200} h={hug} flex={row} gap={48} p={48} bg={${pageBg}} items={center}>
${indentBlock(centeredForm, 2)}
${indentBlock(benefits, 2)}
</Frame>`;
  }

  _composePricingPage(pattern, matched, context) {
    const { mode = 'Light', tokens, typography, copy = {}, description = '' } = context;
    const opts = { mode, tokens, typography };
    const pageBg = resolveTokenValue(tokens, [['semantic', 'color/surface-container']], mode === 'Dark' ? '#0f172a' : '#f8fafc');
    const titleColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface']], mode === 'Dark' ? '#f8fafc' : '#0f172a');
    const bodyColor = resolveTokenValue(tokens, [['semantic', 'color/on-surface-variant'], ['semantic', 'color/on-surface-muted']], mode === 'Dark' ? '#cbd5e1' : '#475569');
    const header = navigation.header({ title: copy.appName || this._inferBrandName(description), showSearch: false, showAvatar: false, ...opts });
    const plans = [
      cards.pricing({ name: 'Starter', price: '`$12', ctaLabel: 'Get Starter', features: ['Core workflow', 'Email support', 'Single workspace'], w: 320, ...opts }),
      cards.pricing({ name: 'Growth', price: '`$39', ctaLabel: 'Choose Growth', features: ['Advanced analytics', 'Unlimited workspaces', 'Priority support'], primary: true, w: 320, ...opts }),
      cards.pricing({ name: 'Enterprise', price: 'Custom', ctaLabel: 'Contact sales', features: ['Custom governance', 'SSO', 'Dedicated support'], w: 320, ...opts }),
    ];
    return `<Frame name={Adaptive_Pricing_Page} w={1440} h={hug} flex={col} gap={32} bg={${pageBg}}>
${indentBlock(header, 2)}
  <Frame name={Pricing_Hero} w={fill} h={hug} flex={col} gap={12} p={48} items={center}>
    <Text ${textProps({ typography, role: 'display/medium', size: 48, weight: 'bold', color: titleColor, align: 'center', w: 920 })}>Pricing that adapts to the product story</Text>
    <Text ${textProps({ typography, role: 'body/large', size: 18, color: bodyColor, align: 'center', w: 760 })}>Instead of replaying a single pricing template, the page composer chooses plan density, proof sections, and CTA weight based on the request.</Text>
  </Frame>
  <Frame name={Pricing_Row} w={fill} h={hug} flex={row} gap={24} px={48} pb={48} justify={center}>
${plans.map(plan => indentBlock(plan, 2)).join('\n')}
  </Frame>
</Frame>`;
  }

  _composeWorkspacePage(pattern, matched, context) {
    const { mode = 'Light', tokens, typography, copy = {}, description = '' } = context;
    const opts = { mode, tokens, typography };
    const sidebarItems = pattern.archetype === 'docs'
      ? ['Getting Started', 'Components', 'Tokens', 'API']
      : ['Profile', 'Billing', 'Notifications', 'Team'];
    const mainContent = stack([
      navigation.tabBar({ tabs: pattern.archetype === 'docs' ? ['Overview', 'Guides', 'Reference'] : ['General', 'Security', 'Members'], ...opts }),
      cards.basic({
        title: pattern.archetype === 'docs' ? 'Structured knowledge layout' : 'Flexible workspace settings',
        description: 'This layout is composed from sidebar, tabs, and focused content blocks instead of a fixed page template.',
        w: 720,
        ...opts,
      }),
      pattern.archetype === 'docs'
        ? table(['Section', 'Purpose', 'Status'], [['Tokens', 'Reference', 'Ready'], ['Components', 'Examples', 'In progress'], ['Patterns', 'Guidance', 'Ready']], { ...opts, w: 720 })
        : form([
          { label: 'Workspace name', placeholder: 'Acme Studio' },
          { label: 'Billing email', placeholder: 'finance@acme.com' },
          { label: 'Region', placeholder: 'Europe' },
        ], {
          title: copy.title || 'Workspace settings',
          submitLabel: 'Save changes',
          w: 720,
          ...opts,
        }),
    ], 'col', { ...opts, w: 760, p: 0, gap: 24 });

    return split(
      navigation.sidebar({ title: copy.appName || this._inferBrandName(description), items: sidebarItems, ...opts }),
      mainContent,
      { ...opts, w: 1280, h: 900 },
    );
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

  _inferSections(archetype, lower, matched) {
    switch (archetype) {
      case 'landing':
      case 'showcase':
        return ['hero', 'proof', 'features', /(pricing|plan|tier)/i.test(lower) ? 'pricing' : null, 'cta'].filter(Boolean);
      case 'dashboard':
        return ['sidebar', 'header', 'stats', matched.some(item => item.type === 'table') ? 'table' : 'insights', 'activity'];
      case 'auth':
        return ['entry', 'form', 'supporting-benefits'];
      case 'pricing':
        return ['hero', 'plans', 'comparison', 'cta'];
      case 'settings':
      case 'docs':
        return ['sidebar', 'tabs', 'content'];
      default:
        return matched.map(item => item.type);
    }
  }

  _inferBrandName(description) {
    const words = String(description || '')
      .split(/\s+/)
      .filter(word => /^[a-zA-Z]/.test(word))
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    return words.length > 0 ? words.join(' ') : 'Studio Core';
  }

  _inferHeroTitle(description, archetype = 'landing') {
    const lower = String(description || '').toLowerCase();
    if (archetype === 'pricing') return 'Pricing designed to fit different product motions.';
    if (lower.includes('dashboard') || lower.includes('analytics')) return 'See the business clearly with a layout that adapts to real signals.';
    if (lower.includes('landing') || lower.includes('website')) return 'Design a flexible web surface without locking into one template.';
    return 'Compose the right layout for each design direction.';
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
      typography: createTypographyContext(pipelineData.runtimeConfig, pipelineData.inventory || {}),
    };

    context.components = pipelineData.inventory?.components || [];
    context.preferences = pipelineData.preferences || {};

    const { jsx, templateUsed, patternUsed, reusedComponents, composition } = this.buildFromDescription(description, context);

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
        metadata: { templateUsed, patternUsed },
        warnings: [],
        errors: [`JSX parse failed: ${err.message}`],
      };
    }

    const blockingDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error');

    return {
      success: commands.length > 0 && blockingDiagnostics.length === 0,
      data: { jsx, commands, templateUsed, patternUsed, diagnostics, reusedComponents, composition },
      metadata: { templateUsed, patternUsed, commandCount: commands.length, diagnosticCount: diagnostics.length, reusedComponents: reusedComponents.length },
      warnings: parseErrors.length > 0 ? [`Parser warnings: ${parseErrors.join('; ')}`] : [],
      errors: [
        ...(commands.length === 0 ? ['No commands generated from JSX'] : []),
        ...blockingDiagnostics.map(diagnostic => `[${diagnostic.code}] ${diagnostic.message}`),
      ],
    };
  }
}
