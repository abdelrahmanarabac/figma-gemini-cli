import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

// ── LIST ──────────────────────────────────────────────────

class StyleListCommand extends Command {
  name = 'style list';
  description = 'List all local styles (Text, Paint, Effect, Grid)';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.isInteractive ? ora('Fetching styles...').start() : null;
    try {
      const result = await ctx.evalOp('style.list');
      spinner?.stop();

      const stylesByType = {
        text: result?.text || [],
        paint: result?.paint || [],
        effect: result?.effect || [],
        grid: result?.grid || [],
      };

      const types = [
        { key: 'text', label: 'Text Styles', color: chalk.cyan },
        { key: 'paint', label: 'Paint Styles', color: chalk.green },
        { key: 'effect', label: 'Effect Styles', color: chalk.magenta },
        { key: 'grid', label: 'Grid Styles', color: chalk.yellow }
      ];

      const counts = Object.fromEntries(
        Object.entries(stylesByType).map(([key, styles]) => [key, styles.length])
      );
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      if (total === 0) {
        ctx.output(
          { styles: stylesByType, counts, total, message: 'No styles found.' },
          () => console.log(chalk.yellow('\n  No styles found.\n'))
        );
        return;
      }

      ctx.output({ styles: stylesByType, counts, total }, () => {
        types.forEach(({ key, label, color }) => {
          const styles = stylesByType[key];
          if (styles.length > 0) {
            console.log(color(`\n  ${label} (${styles.length}):\n`));
            styles.forEach(s => {
              console.log(chalk.white(`    • ${chalk.bold(s.name)}`));
              console.log(chalk.gray(`      ID: ${s.id}`));
            });
          }
        });
        console.log();
      });
    } catch (err) {
      spinner?.fail('Failed to list styles');
      ctx.logError(err.message);
    }
  }
}

// ── TEXT ──────────────────────────────────────────────────

class StyleTextCreateCommand extends Command {
  name = 'style text <name>';
  description = 'Create a text style';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--size <number>', description: 'Font size', defaultValue: '16' },
      { flags: '--weight <weight>', description: 'Font weight', defaultValue: '400' },
      { flags: '--family <family>', description: 'Font family', defaultValue: 'Inter' },
      { flags: '--line-height <value>', description: 'Line height' },
      { flags: '--letter-spacing <value>', description: 'Letter spacing' },
    ];
  }

  async execute(ctx, options, name) {
    const spinner = ctx.startSpinner(`Creating text style "${name}"...`);
    try {
      const result = await ctx.evalOp('style.create_text', {
        name,
        fontSize: parseFloat(options.size),
        fontWeight: parseInt(options.weight, 10),
        fontFamily: options.family,
        lineHeight: options.lineHeight ? parseFloat(options.lineHeight) : undefined,
        letterSpacing: options.letterSpacing ? parseFloat(options.letterSpacing) : undefined,
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Created text style: ${name}`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class StyleTextBulkCommand extends Command {
  name = 'style text-bulk';
  description = 'Create standard text style scale (display, heading, body, caption)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--family <family>', description: 'Font family', defaultValue: 'Inter' },
      { flags: '--prefix <prefix>', description: 'Style name prefix', defaultValue: 'text' },
    ];
  }

  async execute(ctx, options) {
    const spinner = ctx.startSpinner('Creating text style scale...');
    const { family, prefix } = options;

    const styles = [
      { name: `${prefix}/display`, fontSize: 57, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/headline-lg`, fontSize: 32, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/headline-md`, fontSize: 28, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/headline-sm`, fontSize: 24, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/title-lg`, fontSize: 22, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/title-md`, fontSize: 16, fontWeight: 500, fontFamily: family },
      { name: `${prefix}/title-sm`, fontSize: 14, fontWeight: 500, fontFamily: family },
      { name: `${prefix}/body-lg`, fontSize: 16, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/body-md`, fontSize: 14, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/body-sm`, fontSize: 12, fontWeight: 400, fontFamily: family },
      { name: `${prefix}/label-lg`, fontSize: 14, fontWeight: 500, fontFamily: family },
      { name: `${prefix}/label-md`, fontSize: 12, fontWeight: 500, fontFamily: family },
      { name: `${prefix}/label-sm`, fontSize: 11, fontWeight: 500, fontFamily: family },
    ];

    try {
      const results = [];
      for (const spec of styles) {
        const result = await ctx.evalOp('style.create_text', spec);
        if (!result.error) results.push(spec.name);
      }
      spinner.succeed(`Created ${results.length} text styles`);
      if (!ctx.isJson) {
        results.forEach(n => console.log(chalk.gray(`   ${n}`)));
      }
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class StyleUpdateCommand extends Command {
  name = 'style update <family> [pattern]';
  description = 'Bulk update local text styles to a new font family';
  needsConnection = true;

  async execute(ctx, options, family, pattern) {
    const spinner = ctx.startSpinner(`Updating styles to ${family}...`);
    try {
      const result = await ctx.evalOp('style.update_typography', { family, pattern });
      const payload = {
        family,
        pattern: pattern || null,
        updated: result.updated,
        total: result.total,
        failed: result.failed,
        errors: result.errors || [],
      };

      if (result.updated > 0) {
        spinner.succeed(`Successfully updated ${result.updated}/${result.total} styles.`);
      } else {
        spinner.warn(`No styles were updated. (Total found: ${result.total})`);
      }

      if (result.failed > 0) {
        process.exitCode = 1;
        ctx.logError(`${result.failed} styles failed to update.`, payload);
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Typography update failed');
    }
  }
}

// ── COLOR ─────────────────────────────────────────────────

class StyleColorCreateCommand extends Command {
  name = 'style color <name>';
  description = 'Create a paint (color) style';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--hex <color>', description: 'Hex color value', defaultValue: '#000000' },
    ];
  }

  async execute(ctx, options, name) {
    const spinner = ctx.startSpinner(`Creating color style "${name}"...`);
    try {
      const result = await ctx.evalOp('style.create_paint', {
        name,
        color: options.hex,
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Created color style: ${name}`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class StyleColorBulkCommand extends Command {
  name = 'style color-bulk';
  description = 'Create standard color palette styles (primary, secondary, surface, etc.)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--prefix <prefix>', description: 'Style name prefix', defaultValue: 'color' },
    ];
  }

  async execute(ctx, options) {
    const spinner = ctx.startSpinner('Creating color palette...');
    const { prefix } = options;

    const colors = [
      { name: `${prefix}/primary`, hex: '#3b82f6' },
      { name: `${prefix}/primary-hover`, hex: '#2563eb' },
      { name: `${prefix}/primary-subtle`, hex: '#dbeafe' },
      { name: `${prefix}/secondary`, hex: '#8b5cf6' },
      { name: `${prefix}/secondary-hover`, hex: '#7c3aed' },
      { name: `${prefix}/surface`, hex: '#ffffff' },
      { name: `${prefix}/surface-alt`, hex: '#f8fafc' },
      { name: `${prefix}/text`, hex: '#0f172a' },
      { name: `${prefix}/text-secondary`, hex: '#64748b' },
      { name: `${prefix}/text-muted`, hex: '#94a3b8' },
      { name: `${prefix}/border`, hex: '#e2e8f0' },
      { name: `${prefix}/border-strong`, hex: '#cbd5e1' },
      { name: `${prefix}/bg-page`, hex: '#f1f5f9' },
      { name: `${prefix}/success`, hex: '#22c55e' },
      { name: `${prefix}/warning`, hex: '#f59e0b' },
      { name: `${prefix}/error`, hex: '#ef4444' },
      { name: `${prefix}/info`, hex: '#0ea5e9' },
    ];

    try {
      const results = [];
      for (const c of colors) {
        const result = await ctx.evalOp('style.create_paint', {
          name: c.name,
          color: c.hex,
        });
        if (!result.error) results.push(c.name);
      }
      spinner.succeed(`Created ${results.length} color styles`);
      if (!ctx.isJson) {
        results.forEach(n => console.log(chalk.gray(`   ${n}`)));
      }
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

// ── GRID ──────────────────────────────────────────────────

class StyleGridCreateCommand extends Command {
  name = 'style grid <name>';
  description = 'Create a grid style';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--type <type>', description: 'Grid type: columns, rows, grid', defaultValue: 'columns' },
      { flags: '--count <number>', description: 'Number of columns/rows', defaultValue: '12' },
      { flags: '--gutter <number>', description: 'Gutter spacing', defaultValue: '16' },
      { flags: '--section-size <number>', description: 'Column/row width or grid cell size', defaultValue: '72' },
      { flags: '--offset <number>', description: 'Offset from start edge', defaultValue: '0' },
      { flags: '--alignment <align>', description: 'COLUMNS: MIN/CENTER/MAX/STRETCH/BASELINE. ROWS: MIN/MAX/STRETCH', defaultValue: 'CENTER' },
      { flags: '--color <hex>', description: 'Grid line color', defaultValue: '#ff0000' },
      { flags: '--opacity <number>', description: 'Grid opacity', defaultValue: '0.15' },
    ];
  }

  async execute(ctx, options, name) {
    const spinner = ctx.startSpinner(`Creating grid style "${name}"...`);
    try {
      const gridType = options.type;
      const opacity = parseFloat(options.opacity);
      const colorHex = options.color;
      const clean = colorHex.replace('#', '');
      const color = {
        r: parseInt(clean.substring(0, 2), 16) / 255,
        g: parseInt(clean.substring(2, 4), 16) / 255,
        b: parseInt(clean.substring(4, 6), 16) / 255,
        a: opacity,
      };

      const count = parseInt(options.count, 10);
      const gutterSize = parseFloat(options.gutter);
      const sectionSize = parseFloat(options.sectionSize);
      const offset = parseFloat(options.offset);
      let alignment = options.alignment.toUpperCase();

      let layoutGrid;
      if (gridType === 'columns') {
        if (alignment !== 'MIN' && alignment !== 'CENTER' && alignment !== 'MAX' && alignment !== 'STRETCH' && alignment !== 'BASELINE') {
          alignment = 'CENTER';
        }
        layoutGrid = {
          pattern: 'COLUMNS',
          count: count,
          gutterSize: gutterSize,
          sectionSize: sectionSize,
          alignment: alignment,
          offset: offset,
          color: color,
        };
      } else if (gridType === 'rows') {
        if (alignment !== 'MIN' && alignment !== 'MAX' && alignment !== 'STRETCH') {
          alignment = 'MIN';
        }
        layoutGrid = {
          pattern: 'ROWS',
          count: count,
          gutterSize: gutterSize,
          sectionSize: sectionSize,
          alignment: alignment,
          offset: offset,
          color: color,
        };
      } else {
        layoutGrid = {
          pattern: 'GRID',
          sectionSize: parseFloat(options.sectionSize),
          color: { r: color.r, g: color.g, b: color.b, a: opacity },
        };
      }

      const result = await ctx.evalOp('style.create_grid', {
        name,
        grid: { pattern: layoutGrid },
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Created grid style: ${name}`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

// ── EFFECT (Shadow, Blur, Glass) ──────────────────────────

class EffectDropShadowCommand extends Command {
  name = 'style dropshadow [ids...]';
  description = 'Apply drop shadow effect to nodes';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--color <hex>', description: 'Shadow color', defaultValue: '#000000' },
      { flags: '--opacity <number>', description: 'Shadow opacity (0-1)', defaultValue: '0.15' },
      { flags: '--x <number>', description: 'Horizontal offset', defaultValue: '0' },
      { flags: '--y <number>', description: 'Vertical offset', defaultValue: '4' },
      { flags: '--blur <number>', description: 'Blur radius', defaultValue: '8' },
      { flags: '--spread <number>', description: 'Spread radius', defaultValue: '0' },
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to apply effect' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) nodeIds.push(...sel.map(n => n.id));
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Applying drop shadow...');
    try {
      const result = await ctx.evalOp('effect.drop_shadow', {
        nodeIds,
        color: options.color,
        opacity: parseFloat(options.opacity),
        x: parseFloat(options.x),
        y: parseFloat(options.y),
        blur: parseFloat(options.blur),
        spread: parseFloat(options.spread),
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Drop shadow applied to ${result.count} node(s)`);
      if (!ctx.isJson) result.nodes.forEach(n => console.log(chalk.gray(`   ${n.name} (${n.id})`)));
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class EffectInnerShadowCommand extends Command {
  name = 'style innershadow [ids...]';
  description = 'Apply inner shadow effect to nodes';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--color <hex>', description: 'Shadow color', defaultValue: '#000000' },
      { flags: '--opacity <number>', description: 'Shadow opacity (0-1)', defaultValue: '0.1' },
      { flags: '--x <number>', description: 'Horizontal offset', defaultValue: '0' },
      { flags: '--y <number>', description: 'Vertical offset', defaultValue: '2' },
      { flags: '--blur <number>', description: 'Blur radius', defaultValue: '4' },
      { flags: '--spread <number>', description: 'Spread radius', defaultValue: '0' },
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to apply effect' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) nodeIds.push(...sel.map(n => n.id));
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Applying inner shadow...');
    try {
      const result = await ctx.evalOp('effect.inner_shadow', {
        nodeIds,
        color: options.color,
        opacity: parseFloat(options.opacity),
        x: parseFloat(options.x),
        y: parseFloat(options.y),
        blur: parseFloat(options.blur),
        spread: parseFloat(options.spread),
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Inner shadow applied to ${result.count} node(s)`);
      if (!ctx.isJson) result.nodes.forEach(n => console.log(chalk.gray(`   ${n.name} (${n.id})`)));
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class EffectBlurCommand extends Command {
  name = 'style blur [ids...]';
  description = 'Apply layer blur effect to nodes';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--radius <number>', description: 'Blur radius', defaultValue: '10' },
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to apply effect' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) nodeIds.push(...sel.map(n => n.id));
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Applying blur...');
    try {
      const result = await ctx.evalOp('effect.layer_blur', {
        nodeIds,
        blur: parseFloat(options.radius),
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Blur applied to ${result.count} node(s)`);
      if (!ctx.isJson) result.nodes.forEach(n => console.log(chalk.gray(`   ${n.name} (${n.id})`)));
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class EffectGlassCommand extends Command {
  name = 'style glass [ids...]';
  description = 'Apply frosted glass effect (iOS style) to nodes';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--color <hex>', description: 'Glass fill color', defaultValue: '#ffffff' },
      { flags: '--opacity <number>', description: 'Glass opacity (0-1)', defaultValue: '0.1' },
      { flags: '--blur <number>', description: 'Background blur radius', defaultValue: '30' },
      { flags: '--border-color <hex>', description: 'Border color', defaultValue: '#ffffff' },
      { flags: '--border-opacity <number>', description: 'Border opacity (0-1)', defaultValue: '0.2' },
      { flags: '--border-width <number>', description: 'Border width', defaultValue: '1' },
      { flags: '--radius <number>', description: 'Corner radius', defaultValue: '16' },
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to apply effect' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) nodeIds.push(...sel.map(n => n.id));
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Applying glass effect...');
    try {
      const result = await ctx.evalOp('effect.glass', {
        nodeIds,
        color: options.color,
        opacity: parseFloat(options.opacity),
        blur: parseFloat(options.blur),
        borderColor: options.borderColor,
        borderOpacity: parseFloat(options.borderOpacity),
        borderWidth: parseFloat(options.borderWidth),
        cornerRadius: parseFloat(options.radius),
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Glass effect applied to ${result.count} node(s)`);
      if (!ctx.isJson) result.nodes.forEach(n => console.log(chalk.gray(`   ${n.name} (${n.id})`)));
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class EffectClearCommand extends Command {
  name = 'style clear-effects [ids...]';
  description = 'Remove all effects from nodes';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to clear' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) nodeIds.push(...sel.map(n => n.id));
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Clearing effects...');
    try {
      const result = await ctx.evalOp('effect.clear', { nodeIds });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Effects cleared from ${result.count} node(s)`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

// ── DELETE ALL ────────────────────────────────────────────

class StyleDeleteAllCommand extends Command {
  name = 'style delete-all';
  description = 'Delete all local styles (Text, Paint, Effect, Grid)';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.startSpinner('Deleting all styles...');
    try {
      const result = await ctx.evalOp('style.delete_all');
      spinner.succeed(`Deleted ${result.deleted} style(s)`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

// ── EXPORT ────────────────────────────────────────────────

class StyleExportCommand extends Command {
  name = 'style export [format]';
  description = 'Export styles to CSS/Tailwind/W3C-DTCG';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-o, --output <dir>', description: 'Output directory', defaultValue: 'styles' },
    ];
  }

  async execute(ctx, options, format) {
    const outFormat = format || 'css';
    const outDir = options.output || 'styles';
    const spinner = ctx.startSpinner(`Exporting styles to ${outFormat}...`);
    try {
      const result = await ctx.evalOp('style.export', { format: outFormat, outputDir: outDir });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Exported ${result.count} styles to ${outDir}`);
      if (!ctx.isJson && result.files) {
        result.files.forEach(f => console.log(chalk.gray(`   ${f}`)));
      }
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

export default [
  new StyleListCommand(),
  new StyleDeleteAllCommand(),
  new StyleTextCreateCommand(),
  new StyleTextBulkCommand(),
  new StyleUpdateCommand(),
  new StyleColorCreateCommand(),
  new StyleColorBulkCommand(),
  new StyleGridCreateCommand(),
  new EffectDropShadowCommand(),
  new EffectInnerShadowCommand(),
  new EffectBlurCommand(),
  new EffectGlassCommand(),
  new EffectClearCommand(),
  new StyleExportCommand(),
];
