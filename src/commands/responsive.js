import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ResponsiveCommand extends Command {
  name = 'responsive <target>';
  description = 'Test layout responsiveness by generating clones at different breakpoints';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-b, --breakpoints <list>', description: 'Comma-separated list of widths', defaultValue: '375,768,1440' },
      { flags: '-g, --gap <number>', description: 'Spacing between clones', defaultValue: '100' }
    ];
  }

  async execute(ctx, options, target) {
    const spinner = ctx.startSpinner(`Locating target "${target}"...`);
    
    try {
      // 1. Resolve target ID
      let targetId = target;
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
        spinner.fail(`Target component "${target}" not found.`, {
          success: false,
          target,
          error: 'Target component not found.',
        });
        return;
      }

      // 2. Parse breakpoints
      const breakpoints = options.breakpoints.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      if (breakpoints.length === 0) {
        process.exitCode = 1;
        spinner.fail('No valid breakpoints were provided.', {
          success: false,
          target,
          error: 'No valid breakpoints were provided.',
        });
        return;
      }
      
      spinner.text = `Generating ${breakpoints.length} responsive clones...`;

      // 3. Send responsive command
      const result = await ctx.command('node.responsive', {
        id: targetId,
        breakpoints: breakpoints,
        gap: parseInt(options.gap, 10)
      });
      const payload = {
        success: result?.data?.status === 'responsive_complete',
        target,
        targetId,
        breakpoints,
        gap: parseInt(options.gap, 10),
        count: result?.data?.count || 0,
        nodes: result?.data?.nodes || [],
      };

      if (result && result.data && result.data.status === 'responsive_complete') {
        if (ctx.isJson) {
          ctx.logSuccess(`Successfully generated ${result.data.count} responsive variants for "${target}"`, payload);
        } else {
          spinner.succeed(`Successfully generated ${result.data.count} responsive variants for "${target}"`);
          result.data.nodes.forEach(n => {
            console.log(chalk.gray(`   Created: ${n.name} (ID: ${n.id})`));
          });
        }
      } else {
        process.exitCode = 1;
        spinner.fail(`Responsive generation failed: ${result.error || 'Unknown error'}`, {
          ...payload,
          success: false,
          error: result?.error || 'Unknown error',
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Responsive error', {
        success: false,
        target,
        error: err.message,
      });
    }
  }
}

export default [new ResponsiveCommand()];
