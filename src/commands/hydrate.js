import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

class HydrateCommand extends Command {
  name = 'hydrate <file> <target>';
  description = 'Inject JSON data into a Figma component matching layer names starting with #';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--clone', description: 'Create clones for each record in the data array' },
      { flags: '--gap <number>', description: 'Spacing between clones', defaultValue: '40' }
    ];
  }

  async execute(ctx, options, file, target) {
    const spinner = ora(`Reading data from ${file}...`).start();
    
    try {
      // 1. Load and parse data
      const filePath = path.resolve(process.cwd(), file);
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      
      // 2. Resolve target ID
      spinner.text = `Locating target "${target}"...`;
      let targetId = target;
      if (!target.includes(':')) {
        const findCode = `return figma.currentPage.findOne(n => n.name === ${JSON.stringify(target)})?.id`;
        targetId = await ctx.eval(findCode);
      }

      if (!targetId) {
        spinner.fail(`Target component "${target}" not found.`);
        return;
      }

      // 3. Send hydration command
      spinner.text = `Injecting data into ${target}...`;
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.hydrate', {
        id: targetId,
        data: data,
        clone: options.clone,
        gap: parseInt(options.gap, 10)
      });

      spinner.stop();

      if (result && result.data && result.data.status === 'hydrated') {
        ctx.logSuccess(`Successfully hydrated ${result.data.count} records into "${target}"`);
      } else {
        ctx.logError(`Hydration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      spinner.fail('Hydration error');
      ctx.logError(err.message);
    }
  }
}

export default [new HydrateCommand()];
