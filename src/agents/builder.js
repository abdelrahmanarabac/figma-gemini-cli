/**
 * Builder Expert — Component generation engine.
 *
 * Takes high-level descriptions and produces render-ready JSX
 * using component templates from the pattern library.
 */

import { Expert } from './expert.js';

// ── Component Template Library ───────────────────────

const TEMPLATES = {

  'button/primary': (label = 'Button', opts = {}) => {
    const w = opts.w || 'hug';
    return `<Frame name={Button_Primary} w={${w}} h={48} bg={#3b82f6} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={#ffffff}>${label}</Text>
</Frame>`;
  },

  'button/secondary': (label = 'Button', opts = {}) => {
    const w = opts.w || 'hug';
    return `<Frame name={Button_Secondary} w={${w}} h={48} bg={#f1f5f9} rounded={12} px={24} py={12} justify={center} items={center} stroke={#e2e8f0}>
  <Text size={16} weight={semibold} color={#1e293b}>${label}</Text>
</Frame>`;
  },

  'button/ghost': (label = 'Button', opts = {}) => {
    const w = opts.w || 'hug';
    return `<Frame name={Button_Ghost} w={${w}} h={48} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={#3b82f6}>${label}</Text>
</Frame>`;
  },

  'button/destructive': (label = 'Delete', opts = {}) => {
    const w = opts.w || 'hug';
    return `<Frame name={Button_Destructive} w={${w}} h={48} bg={#ef4444} rounded={12} px={24} py={12} justify={center} items={center}>
  <Text size={16} weight={semibold} color={#ffffff}>${label}</Text>
</Frame>`;
  },

  'input/text': (placeholder = 'Enter text...', opts = {}) => {
    const label = opts.label || 'Label';
    return `<Frame name={Input_Text} w={fill} h={hug} flex={col} gap={6}>
  <Text size={13} weight={medium} color={#374151}>${label}</Text>
  <Frame w={fill} h={44} bg={#ffffff} rounded={8} px={14} py={12} stroke={#d1d5db} items={center}>
    <Text size={14} color={#9ca3af} w={fill}>${placeholder}</Text>
  </Frame>
</Frame>`;
  },

  'card/basic': (title = 'Card Title', description = 'Description text goes here.', opts = {}) => {
    const w = opts.w || 360;
    return `<Frame name={Card} w={${w}} h={hug} bg={#ffffff} flex={col} p={24} gap={16} rounded={16} shadow={0 4 16 rgba(0,0,0,0.06)} stroke={#f1f5f9}>
  <Text size={18} weight={semibold} color={#111827} w={fill}>${title}</Text>
  <Text size={14} color={#6b7280} w={fill}>${description}</Text>
</Frame>`;
  },

  'card/stat': (label = 'Total Revenue', value = '12,500', trend = '+12%', opts = {}) => {
    const w = opts.w || 280;
    return `<Frame name={StatCard} w={${w}} h={hug} bg={#ffffff} flex={col} p={24} gap={12} rounded={16} shadow={0 2 8 rgba(0,0,0,0.04)} stroke={#f1f5f9}>
  <Text size={13} weight={medium} color={#6b7280} w={fill}>${label}</Text>
  <Frame flex={row} items={center} gap={8} w={fill} h={hug}>
    <Text size={28} weight={bold} color={#111827}>${value}</Text>
    <Frame bg={#ecfdf5} rounded={6} px={8} py={4}>
      <Text size={12} weight={semibold} color={#059669}>${trend}</Text>
    </Frame>
  </Frame>
</Frame>`;
  },

  'badge/status': (text = 'Active', color = '#22c55e', opts = {}) => {
    return `<Frame name={Badge_${text}} h={24} bg={${color}15} rounded={6} px={10} py={4} items={center}>
  <Text size={12} weight={semibold} color={${color}}>${text}</Text>
</Frame>`;
  },

  'nav/sidebar': (items = ['Dashboard', 'Analytics', 'Users', 'Settings'], opts = {}) => {
    const w = opts.w || 240;
    const navItems = items.map((item, i) => {
      const isActive = i === 0;
      const bg = isActive ? 'bg={#eff6ff}' : '';
      const color = isActive ? '#1d4ed8' : '#6b7280';
      const weight = isActive ? 'semibold' : 'regular';
      return `  <Frame name={NavItem_${item}} w={fill} h={44} ${bg} rounded={8} px={16} items={center}>
    <Text size={14} weight={${weight}} color={${color}} w={fill}>${item}</Text>
  </Frame>`;
    }).join('\n');

    return `<Frame name={Sidebar} w={${w}} h={fill} bg={#ffffff} flex={col} p={16} gap={4} stroke={#f1f5f9}>
  <Frame name={Logo_Area} w={fill} h={48} px={16} items={center}>
    <Text size={20} weight={bold} color={#111827}>AppName</Text>
  </Frame>
  <Frame name={Nav_Items} w={fill} h={hug} flex={col} gap={4}>
${navItems}
  </Frame>
</Frame>`;
  },
};

export class BuilderExpert extends Expert {
  name = 'builder';
  description = 'Component generation engine. Produces render-ready JSX from descriptions and templates.';
  capabilities = ['component', 'layout', 'generation'];
  priority = 30; // After token-expert, before guardian

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
    return Object.keys(TEMPLATES);
  }

  /**
   * Get a specific template.
   * @param {string} name
   * @returns {Function|null}
   */
  getTemplate(name) {
    return TEMPLATES[name] || null;
  }

  /**
   * Build JSX from a component description using template matching.
   * @param {string} description
   * @param {Object} context
   * @returns {{ jsx: string, templateUsed: string|null }}
   */
  buildFromDescription(description, context = {}) {
    const lower = description.toLowerCase();

    // Match description to template
    if (lower.includes('button')) {
      const variant = lower.includes('secondary') ? 'secondary'
        : lower.includes('ghost') ? 'ghost'
        : lower.includes('destructive') || lower.includes('delete') ? 'destructive'
        : 'primary';
      // Extract label if quoted
      const labelMatch = description.match(/["']([^"']+)["']/);
      const label = labelMatch ? labelMatch[1] : this._extractLabel(description);
      return { jsx: TEMPLATES[`button/${variant}`](label, context), templateUsed: `button/${variant}` };
    }

    if (lower.includes('stat') && lower.includes('card')) {
      const valueMatch = description.match(/[\$]?([\d,]+)/);
      const value = valueMatch ? valueMatch[1] : '0';
      const trendMatch = description.match(/([+-]?\d+%)/);
      const trend = trendMatch ? trendMatch[1] : '+0%';
      const label = this._extractStatLabel(description);
      return { jsx: TEMPLATES['card/stat'](label, value, trend, context), templateUsed: 'card/stat' };
    }

    if (lower.includes('card')) {
      const title = this._extractLabel(description);
      return { jsx: TEMPLATES['card/basic'](title, 'Description text goes here.', context), templateUsed: 'card/basic' };
    }

    if (lower.includes('input') || lower.includes('field') || lower.includes('text field')) {
      const label = this._extractLabel(description);
      return { jsx: TEMPLATES['input/text']('Enter text...', { label, ...context }), templateUsed: 'input/text' };
    }

    if (lower.includes('sidebar') || lower.includes('navigation')) {
      return { jsx: TEMPLATES['nav/sidebar'](['Dashboard', 'Analytics', 'Users', 'Settings'], context), templateUsed: 'nav/sidebar' };
    }

    if (lower.includes('badge')) {
      const label = this._extractLabel(description) || 'Active';
      return { jsx: TEMPLATES['badge/status'](label, '#22c55e', context), templateUsed: 'badge/status' };
    }

    // Fallback — generic frame with title
    const fallbackJsx = `<Frame name={Generated_Component} w={400} h={hug} bg={#ffffff} flex={col} p={24} gap={16} rounded={16} shadow={0 4 12 rgba(0,0,0,0.05)} stroke={#f1f5f9}>
  <Text size={20} weight={bold} color={#111827} w={fill}>${description}</Text>
  <Text size={14} color={#6b7280} w={fill}>Auto-generated component</Text>
</Frame>`;

    return { jsx: fallbackJsx, templateUsed: null };
  }

  /** @private */
  _extractLabel(description) {
    const quoted = description.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1];
    // Use first 2-3 significant words
    const words = description.split(/\s+/)
      .filter(w => !['a', 'an', 'the', 'with', 'for', 'and', 'or', 'create', 'make', 'add', 'build', 'generate'].includes(w.toLowerCase()));
    return words.slice(0, 3).join(' ') || 'Component';
  }

  /** @private */
  _extractStatLabel(description) {
    const labelPatterns = [
      /showing\s+(.+?)(?:\s+with|\s+at|$)/i,
      /for\s+(.+?)(?:\s+with|\s+at|$)/i,
    ];
    for (const pattern of labelPatterns) {
      const match = description.match(pattern);
      if (match) return match[1].replace(/[\$\d,]+/g, '').trim();
    }
    return 'Metric';
  }

  async execute(ctx, task, pipelineData = {}) {
    const description = task.description || task.input?.intent?.raw || '';
    const { jsx, templateUsed } = this.buildFromDescription(description);

    // Parse JSX to commands
    let commands = [];
    let parseErrors = [];
    try {
      const { parseJSX } = await import('../parser/jsx.js');
      const result = parseJSX(jsx);
      commands = result.commands;
      parseErrors = result.errors;
    } catch (err) {
      return {
        success: false,
        data: { jsx, commands: [] },
        metadata: { templateUsed },
        warnings: [],
        errors: [`JSX parse failed: ${err.message}`],
      };
    }

    return {
      success: commands.length > 0,
      data: { jsx, commands, templateUsed },
      metadata: { templateUsed, commandCount: commands.length },
      warnings: parseErrors.length > 0 ? [`Parser warnings: ${parseErrors.join('; ')}`] : [],
      errors: commands.length === 0 ? ['No commands generated from JSX'] : [],
    };
  }
}
