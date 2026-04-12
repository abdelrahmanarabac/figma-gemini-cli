import { Command } from '../cli/command.js';
import chalk from 'chalk';

class WireframeApplyCommand extends Command {
  name = 'wireframe apply [ids...]';
  description = 'Convert UI to grayscale wireframe (strips colors, hides images, simplifies elements)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--bg <hex>', description: 'Wireframe background color', defaultValue: '#ffffff' },
      { flags: '--fill <hex>', description: 'Fill color for shapes', defaultValue: '#e2e8f0' },
      { flags: '--stroke <hex>', description: 'Stroke color', defaultValue: '#94a3b8' },
      { flags: '--text-fill <hex>', description: 'Text fill color', defaultValue: '#64748b' },
      { flags: '--stroke-width <number>', description: 'Stroke width', defaultValue: '2' },
      { flags: '--hide-images', description: 'Replace image fills with gray boxes', defaultValue: false },
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to wireframe' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) {
        nodeIds.push(...sel.map(function(n) { return n.id; }));
      } else {
        const frames = await ctx.evalOp('canvas.info');
        if (frames && frames.frames && frames.frames.length > 0) {
          nodeIds.push(...frames.frames.slice(0, 20).map(function(f) { return f.id; }));
        }
      }
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Applying wireframe mode...');
    try {
      const result = await ctx.evalOp('wireframe.apply', {
        nodeIds,
        bg: options.bg,
        fill: options.fill,
        stroke: options.stroke,
        textFill: options.textFill,
        strokeWidth: parseFloat(options.strokeWidth),
        hideImages: Boolean(options.hideImages),
      });
      if (result.error) throw new Error(result.error);
      spinner.succeed('Wireframe applied to ' + result.count + ' node(s)');
      if (!ctx.isJson && result.nodes) {
        result.nodes.forEach(function(n) {
          console.log(chalk.gray('   ' + n.name + ' (' + n.id + ')'));
        });
      }
    } catch (err) {
      spinner.fail('Failed: ' + err.message);
    }
  }
}

class WireframeResetCommand extends Command {
  name = 'wireframe reset [ids...]';
  description = 'Reset wireframe styling (restore original colors)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-n, --nodes <ids...>', description: 'Node IDs to reset' },
    ];
  }

  async execute(ctx, options, ...ids) {
    const nodeIds = options.nodes || ids;
    if (nodeIds.length === 0) {
      const sel = await ctx.evalOp('node.selection');
      if (sel && sel.length > 0) {
        nodeIds.push(...sel.map(function(n) { return n.id; }));
      }
    }
    if (nodeIds.length === 0) {
      ctx.logError('No nodes provided and nothing selected.');
      return;
    }

    const spinner = ctx.startSpinner('Resetting wireframe...');
    try {
      const result = await ctx.evalOp('wireframe.reset', { nodeIds });
      if (result.error) throw new Error(result.error);
      spinner.succeed('Wireframe reset on ' + result.count + ' node(s)');
    } catch (err) {
      spinner.fail('Failed: ' + err.message);
    }
  }
}

class WireframeListCommand extends Command {
  name = 'wireframe list';
  description = 'List nodes with wireframe metadata saved';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.startSpinner('Listing wireframe nodes...');
    try {
      const result = await ctx.evalOp('wireframe.list');
      if (result.error) throw new Error(result.error);

      if (ctx.isJson) {
        spinner.stop();
        ctx.logSuccess('Wireframe list', result);
        return;
      }

      spinner.succeed('Found ' + result.nodes.length + ' wireframe node(s)');
      result.nodes.forEach(function(n) {
        console.log(chalk.gray('   ' + n.name + ' (' + n.id + ') — ' + (n.saved ? 'original saved' : 'live')));
      });
      console.log();
    } catch (err) {
      spinner.fail('Failed: ' + err.message);
    }
  }
}

class SkeletonCommand extends Command {
  name = 'skeleton <target>';
  description = 'Convert a UI component into a skeleton loading state';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--color <hex>', description: 'Color for skeleton bars', defaultValue: '#e2e8f0' },
      { flags: '--rounded <number>', description: 'Corner radius for bars', defaultValue: '4' }
    ];
  }

  async execute(ctx, options, target) {
    const spinner = ctx.startSpinner('Locating target "' + target + '"...');

    try {
      var targetId = target;
      if (!target.includes(':')) {
        const found = await ctx.evalOp('node.find.byName', { name: target });
        if (found.error) {
          targetId = null;
        } else {
          targetId = found.id;
        }
      }

      if (!targetId) {
        process.exitCode = 1;
        spinner.fail('Target component "' + target + '" not found.', {
          success: false,
          target,
          error: 'Target component not found.',
        });
        return;
      }

      spinner.text = 'Generating skeleton for ' + target + '...';

      const result = await ctx.command('node.skeleton', {
        id: targetId,
        color: options.color,
        rounded: parseInt(options.rounded, 10)
      });
      const payload = {
        success: result && result.data && result.data.status === 'skeletonized',
        target,
        targetId,
        color: options.color,
        rounded: parseInt(options.rounded, 10),
        skeletonId: (result && result.data && result.data.id) || null,
        skeletonName: (result && result.data && result.data.name) || null,
      };

      if (result && result.data && result.data.status === 'skeletonized') {
        if (ctx.isJson) {
          ctx.logSuccess('Skeleton state created: "' + result.data.name + '"', payload);
        } else {
          spinner.succeed('Skeleton state created: "' + result.data.name + '"');
          console.log(chalk.gray('   ID: ' + result.data.id));
        }
      } else {
        process.exitCode = 1;
        spinner.fail('Skeleton generation failed: ' + (result.error || 'Unknown error'), {
          success: false,
          error: result ? result.error : 'Unknown error',
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Skeleton error', {
        success: false,
        target,
        error: err.message,
      });
    }
  }
}

export default [new WireframeApplyCommand(), new WireframeResetCommand(), new WireframeListCommand(), new SkeletonCommand()];
