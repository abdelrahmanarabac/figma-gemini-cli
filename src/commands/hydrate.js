import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import path from 'path';

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
    const spinner = ctx.startSpinner(`Reading data from ${file}...`);
    
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
        process.exitCode = 1;
        spinner.fail(`Target component "${target}" not found.`, {
          success: false,
          file,
          target,
          error: 'Target component not found.',
        });
        return;
      }

      // 3. Send hydration command
      spinner.text = `Injecting data into ${target}...`;
      const result = await ctx.command('node.hydrate', {
        id: targetId,
        data: data,
        clone: options.clone,
        gap: parseInt(options.gap, 10)
      });
      const payload = {
        success: result?.data?.status === 'hydrated',
        file,
        filePath,
        target,
        targetId,
        clone: Boolean(options.clone),
        gap: parseInt(options.gap, 10),
        count: result?.data?.count || 0,
      };

      if (result && result.data && result.data.status === 'hydrated') {
        if (ctx.isJson) {
          ctx.logSuccess(`Successfully hydrated ${result.data.count} records into "${target}"`, payload);
        } else {
          spinner.succeed(`Successfully hydrated ${result.data.count} records into "${target}"`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(`Hydration failed: ${result.error || 'Unknown error'}`, {
          ...payload,
          success: false,
          error: result?.error || 'Unknown error',
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Hydration error', {
        success: false,
        file,
        target,
        error: err.message,
      });
    }
  }
}

export default [new HydrateCommand()];
