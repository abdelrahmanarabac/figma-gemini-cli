/**
 * Visual Expert — SVG icon, illustration, and chart generation.
 *
 * Produces SVG content strings for icons, data visualizations,
 * and placeholder graphics.
 */

import { Expert } from './expert.js';

// ── Icon Library (Inline SVG) ────────────────────────

const ICONS = {
  'arrow-up': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5m0 0l-7 7m7-7l7 7" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'arrow-down': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14m0 0l7-7m-7 7l-7-7" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'chevron-right': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'search': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="${color}" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`,

  'user': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4" stroke="${color}" stroke-width="2"/><path d="M4 21c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`,

  'home': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12l9-9 9 9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'settings': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="${color}" stroke-width="2"/><path d="M12 1v2m0 18v2m-9-11H1m22 0h-2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`,

  'chart': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="12" width="4" height="8" rx="1" fill="${color}" opacity="0.3"/><rect x="10" y="8" width="4" height="12" rx="1" fill="${color}" opacity="0.6"/><rect x="17" y="4" width="4" height="16" rx="1" fill="${color}"/></svg>`,

  'bell': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'check': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12l5 5L20 7" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'x': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'plus': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14m-7-7h14" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'dollar': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'trending-up': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 6 23 6 23 12" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'trending-down': (size = 24, color = '#000') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 18 23 18 23 12" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export class VisualExpert extends Expert {
  name = 'visual';
  description = 'SVG icon/illustration/chart generation.';
  capabilities = ['icon', 'visual', 'chart'];
  priority = 20; // After tokens, before builder finalizes
  phase = 'pre';

  relevance(intent) {
    if (intent.tags.includes('icon')) return 0.9;
    // Moderate relevance for generate — may need icons
    if (['generate', 'render'].includes(intent.action)) return 0.4;
    return 0.1;
  }

  /**
   * Get an icon SVG by name.
   * @param {string} name
   * @param {{ size?: number, color?: string }} opts
   * @returns {string|null}
   */
  getIcon(name, opts = {}) {
    const generator = ICONS[name];
    if (!generator) return null;
    return generator(opts.size || 24, opts.color || '#000');
  }

  /**
   * List available icon names.
   * @returns {string[]}
   */
  listIcons() {
    return Object.keys(ICONS);
  }

  /**
   * Find the best matching icon for a description.
   * @param {string} description
   * @returns {{ name: string, svg: string } | null}
   */
  findIcon(description) {
    const lower = description.toLowerCase();
    const iconKeywords = {
      'arrow-up': ['up', 'increase', 'rise', 'grow'],
      'arrow-down': ['down', 'decrease', 'drop', 'fall'],
      'trending-up': ['trending', 'growth', 'positive', 'revenue up'],
      'trending-down': ['trending down', 'decline', 'negative'],
      'search': ['search', 'find', 'look'],
      'user': ['user', 'person', 'profile', 'account', 'avatar'],
      'home': ['home', 'house', 'dashboard', 'main'],
      'settings': ['settings', 'gear', 'config', 'preferences'],
      'chart': ['chart', 'graph', 'analytics', 'stats'],
      'bell': ['bell', 'notification', 'alert'],
      'check': ['check', 'success', 'done', 'complete', 'verified'],
      'x': ['close', 'remove', 'cancel', 'delete', 'dismiss'],
      'plus': ['add', 'create', 'new', 'plus'],
      'dollar': ['dollar', 'money', 'price', 'cost', 'revenue', 'payment'],
    };

    for (const [iconName, keywords] of Object.entries(iconKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return { name: iconName, svg: this.getIcon(iconName) };
      }
    }
    return null;
  }

  async execute(ctx, task, pipelineData = {}) {
    const description = task.description || task.input?.intent?.raw || '';
    const foundIcon = this.findIcon(description);

    return {
      success: true,
      data: {
        icon: foundIcon,
        availableIcons: this.listIcons(),
      },
      metadata: { matchedIcon: foundIcon?.name || 'none' },
      warnings: [],
      errors: [],
    };
  }
}
