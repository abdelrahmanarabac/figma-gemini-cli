/**
 * Analyzer Expert — Design analysis and pattern extraction.
 *
 * Inspects existing canvas, extracts patterns,
 * detects inconsistencies, generates audit reports.
 */

import { Expert } from './expert.js';

export class AnalyzerExpert extends Expert {
  name = 'analyzer';
  description = 'Canvas inspection, design pattern extraction, and inconsistency detection.';
  capabilities = ['validation', 'analysis', 'audit'];
  priority = 5; // Runs very early — context gathering

  relevance(intent) {
    if (intent.action === 'audit') return 0.95;
    if (intent.tags.includes('validation')) return 0.8;
    // Moderate relevance for generate — gathers context first
    if (intent.action === 'generate') return 0.4;
    return 0.1;
  }

  /**
   * Analyze a set of commands for design pattern consistency.
   * @param {Object[]} commands
   * @returns {AnalysisReport}
   */
  analyzeCommands(commands) {
    const report = {
      nodeCount: commands.length,
      typeDistribution: {},
      colorUsage: {},
      spacingValues: new Set(),
      radiusValues: new Set(),
      fontSizes: new Set(),
      fontWeights: new Set(),
      issues: [],
    };

    for (const cmd of commands) {
      const props = cmd.params?.props || {};
      const type = cmd.params?.type || 'UNKNOWN';

      // Type distribution
      report.typeDistribution[type] = (report.typeDistribution[type] || 0) + 1;

      // Color tracking
      if (props.fill && typeof props.fill === 'string') {
        report.colorUsage[props.fill] = (report.colorUsage[props.fill] || 0) + 1;
      }

      // Spacing tracking
      for (const key of ['itemSpacing', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
        if (typeof props[key] === 'number') {
          report.spacingValues.add(props[key]);
        }
      }

      // Radius tracking
      if (typeof props.cornerRadius === 'number') {
        report.radiusValues.add(props.cornerRadius);
      }

      // Typography tracking
      if (typeof props.fontSize === 'number') report.fontSizes.add(props.fontSize);
      if (props.fontWeight) report.fontWeights.add(props.fontWeight);
    }

    // Detect inconsistencies
    const uniqueColors = Object.keys(report.colorUsage).length;
    if (uniqueColors > 8) {
      report.issues.push({
        type: 'excessive-colors',
        message: `${uniqueColors} unique colors detected. Consider consolidating to a token palette.`,
        severity: 'warning',
      });
    }

    const spacingArr = [...report.spacingValues];
    const offScaleSpacing = spacingArr.filter(v => v % 4 !== 0);
    if (offScaleSpacing.length > 0) {
      report.issues.push({
        type: 'off-scale-spacing',
        message: `Spacing values not on 4px grid: [${offScaleSpacing.join(', ')}]`,
        severity: 'info',
      });
    }

    // Convert Sets to arrays for serialization
    report.spacingValues = [...report.spacingValues].sort((a, b) => a - b);
    report.radiusValues = [...report.radiusValues].sort((a, b) => a - b);
    report.fontSizes = [...report.fontSizes].sort((a, b) => a - b);
    report.fontWeights = [...report.fontWeights];

    return report;
  }

  async execute(ctx, task, pipelineData = {}) {
    const commands = pipelineData.commands || [];
    const report = this.analyzeCommands(commands);

    return {
      success: true,
      data: { analysis: report },
      metadata: { analyzedCommands: commands.length, issueCount: report.issues.length },
      warnings: report.issues.filter(i => i.severity === 'warning').map(i => i.message),
      errors: report.issues.filter(i => i.severity === 'error').map(i => i.message),
    };
  }
}

/**
 * @typedef {Object} AnalysisReport
 * @property {number} nodeCount
 * @property {Object<string, number>} typeDistribution
 * @property {Object<string, number>} colorUsage
 * @property {number[]} spacingValues
 * @property {number[]} radiusValues
 * @property {number[]} fontSizes
 * @property {Array} fontWeights
 * @property {Array} issues
 */
