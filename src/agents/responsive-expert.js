/**
 * Responsive Expert — Responsive layout intelligence.
 *
 * Analyzes layouts for responsive behavior, recommends
 * breakpoint adaptations, and recalculates spacing/sizing.
 */

import { Expert } from './expert.js';

const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
};

const RESPONSIVE_RULES = {
  // Layout direction switches
  stackBelowTablet: {
    description: 'Horizontal layouts stack vertically below tablet',
    check(cmd, breakpoint) {
      const props = cmd.params?.props || {};
      if (props.layoutMode === 'HORIZONTAL' && breakpoint <= BREAKPOINTS.tablet) {
        return { suggestion: 'Switch to VERTICAL layout', prop: 'layoutMode', value: 'VERTICAL' };
      }
      return null;
    },
  },

  // Width constraints
  fillOnMobile: {
    description: 'Fixed-width elements become fill on mobile',
    check(cmd, breakpoint) {
      const props = cmd.params?.props || {};
      if (typeof props.width === 'number' && props.width > breakpoint * 0.9 && breakpoint <= BREAKPOINTS.tablet) {
        return { suggestion: 'Use fill width on mobile', prop: 'width', value: 'fill' };
      }
      return null;
    },
  },

  // Spacing reduction
  reduceSpacing: {
    description: 'Reduce spacing on smaller screens',
    check(cmd, breakpoint) {
      const props = cmd.params?.props || {};
      const suggestions = [];
      if (breakpoint <= BREAKPOINTS.mobile) {
        if (typeof props.padding === 'number' && props.padding > 24) {
          suggestions.push({ prop: 'padding', current: props.padding, recommended: Math.max(16, props.padding * 0.66) });
        }
        if (typeof props.itemSpacing === 'number' && props.itemSpacing > 16) {
          suggestions.push({ prop: 'itemSpacing', current: props.itemSpacing, recommended: Math.max(8, props.itemSpacing * 0.75) });
        }
      }
      return suggestions.length > 0 ? suggestions : null;
    },
  },

  // Font size scaling
  scaleFonts: {
    description: 'Scale down large fonts on mobile',
    check(cmd, breakpoint) {
      const props = cmd.params?.props || {};
      if (breakpoint <= BREAKPOINTS.mobile && typeof props.fontSize === 'number' && props.fontSize > 24) {
        const scaled = Math.max(18, Math.round(props.fontSize * 0.75));
        return { prop: 'fontSize', current: props.fontSize, recommended: scaled };
      }
      return null;
    },
  },
};

export class ResponsiveExpert extends Expert {
  name = 'responsive';
  description = 'Responsive layout intelligence — breakpoint analysis and adaptive recommendations.';
  capabilities = ['layout', 'responsive'];
  priority = 70; // After building, before final validation
  phase = 'post';

  relevance(intent) {
    if (intent.action === 'responsive') return 0.95;
    if (intent.tags.includes('layout')) return 0.6;
    // Lower relevance for general generate — optional enhancement
    if (intent.action === 'generate') return 0.4;
    return 0.1;
  }

  /**
   * Analyze a command set for responsive issues at a specific breakpoint.
   * @param {Object[]} commands
   * @param {number} breakpoint
   * @returns {ResponsiveAnalysis}
   */
  analyzeForBreakpoint(commands, breakpoint) {
    const suggestions = [];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      if (cmd.command !== 'node.create') continue;

      for (const rule of Object.values(RESPONSIVE_RULES)) {
        const result = rule.check(cmd, breakpoint);
        if (result) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) {
            suggestions.push({
              commandIndex: i,
              nodeName: cmd.params?.props?.name || 'unnamed',
              rule: rule.description,
              ...item,
            });
          }
        }
      }
    }

    return {
      breakpoint,
      breakpointName: breakpoint <= 375 ? 'mobile' : breakpoint <= 768 ? 'tablet' : 'desktop',
      suggestions,
      issueCount: suggestions.length,
    };
  }

  /**
   * Full responsive analysis across all standard breakpoints.
   * @param {Object[]} commands
   * @returns {Object<number, ResponsiveAnalysis>}
   */
  fullAnalysis(commands) {
    const results = {};
    for (const [name, bp] of Object.entries(BREAKPOINTS)) {
      results[name] = this.analyzeForBreakpoint(commands, bp);
    }
    return results;
  }

  async execute(ctx, task, pipelineData = {}) {
    const commands = pipelineData.commands || [];
    const analysis = this.fullAnalysis(commands);

    const totalIssues = Object.values(analysis).reduce((sum, a) => sum + a.issueCount, 0);

    return {
      success: true,
      data: { responsive: analysis, breakpoints: BREAKPOINTS },
      metadata: { analyzedCommands: commands.length, totalIssues },
      warnings: totalIssues > 0
        ? [`${totalIssues} responsive suggestions across ${Object.keys(BREAKPOINTS).length} breakpoints`]
        : [],
      errors: [],
    };
  }
}

/**
 * @typedef {Object} ResponsiveAnalysis
 * @property {number} breakpoint
 * @property {string} breakpointName
 * @property {Array} suggestions
 * @property {number} issueCount
 */
