import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

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
    const spinner = ora(`Locating target "${target}"...`).start();
    
    try {
      // 1. Resolve target ID
      let targetId = target;
      if (!target.includes(':')) {
        const findCode = `return figma.currentPage.findOne(n => n.name === ${JSON.stringify(target)})?.id`;
        targetId = await ctx.eval(findCode);
      }

      if (!targetId) {
        spinner.fail(`Target component "${target}" not found.`);
        return;
      }

      spinner.text = `Generating skeleton for ${target}...`;

      // 2. Send skeleton command
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.skeleton', {
        id: targetId,
        color: options.color,
        rounded: parseInt(options.rounded, 10)
      });

      spinner.stop();

      if (result && result.data && result.data.status === 'skeletonized') {
        ctx.logSuccess(`Skeleton state created: "${result.data.name}"`);
        console.log(chalk.gray(`   ˘ ID: ${result.data.id}`));
      } else {
        ctx.logError(`Skeleton generation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      spinner.fail('Skeleton error');
      ctx.logError(err.message);
    }
  }
}

export default [new SkeletonCommand()];
