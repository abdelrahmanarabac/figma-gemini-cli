import { Command } from '../cli/command.js';
import chalk from 'chalk';

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
    const spinner = ctx.startSpinner(`Locating target "${target}"...`);
    
    try {
      // 1. Resolve target ID
      let targetId = target;
      if (!target.includes(':')) {
        const findCode = `return figma.currentPage.findOne(n => n.name === ${JSON.stringify(target)})?.id`;
        targetId = await ctx.eval(findCode);
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

      spinner.text = `Generating skeleton for ${target}...`;

      // 2. Send skeleton command
      const result = await ctx.command('node.skeleton', {
        id: targetId,
        color: options.color,
        rounded: parseInt(options.rounded, 10)
      });
      const payload = {
        success: result?.data?.status === 'skeletonized',
        target,
        targetId,
        color: options.color,
        rounded: parseInt(options.rounded, 10),
        skeletonId: result?.data?.id || null,
        skeletonName: result?.data?.name || null,
      };

      if (result && result.data && result.data.status === 'skeletonized') {
        if (ctx.isJson) {
          ctx.logSuccess(`Skeleton state created: "${result.data.name}"`, payload);
        } else {
          spinner.succeed(`Skeleton state created: "${result.data.name}"`);
          console.log(chalk.gray(`   ID: ${result.data.id}`));
        }
      } else {
        process.exitCode = 1;
        spinner.fail(`Skeleton generation failed: ${result.error || 'Unknown error'}`, {
          ...payload,
          success: false,
          error: result?.error || 'Unknown error',
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

export default [new SkeletonCommand()];
