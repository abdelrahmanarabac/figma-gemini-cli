import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

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

      // 2. Parse breakpoints
      const breakpoints = options.breakpoints.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      
      spinner.text = `Generating ${breakpoints.length} responsive clones...`;

      // 3. Send responsive command
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.responsive', {
        id: targetId,
        breakpoints: breakpoints,
        gap: parseInt(options.gap, 10)
      });

      spinner.stop();

      if (result && result.data && result.data.status === 'responsive_complete') {
        ctx.logSuccess(`Successfully generated ${result.data.count} responsive variants for "${target}"`);
        result.data.nodes.forEach(n => {
          console.log(chalk.gray(`   ˘ Created: ${n.name} (ID: ${n.id})`));
        });
      } else {
        ctx.logError(`Responsive generation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      spinner.fail('Responsive error');
      ctx.logError(err.message);
    }
  }
}

export default [new ResponsiveCommand()];
