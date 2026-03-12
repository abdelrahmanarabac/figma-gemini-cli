import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tailwindPath = join(__dirname, '..', 'data', 'palettes', 'tailwind.json');

class TokensPickCommand extends Command {
  name = 'tokens pick <colors...>';
  description = 'Surgically import specific Tailwind shades (e.g., zinc/100 blue/500)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-c, --collection <name>', description: 'Target collection', defaultValue: 'W3C Primitives' }
    ];
  }

  async execute(ctx, options, ...colors) {
    const spinner = ora('Surgically picking tokens...').start();
    try {
      const palette = JSON.parse(readFileSync(tailwindPath, 'utf8'));
      const toCreate = {};

      const targetColors = Array.isArray(colors[0]) ? colors[0] : colors;

      for (const selection of targetColors) {
        if (typeof selection !== 'string') continue;
        const [family, shade] = selection.split('/');
        if (palette[family] && palette[family][shade]) {
          if (!toCreate[family]) toCreate[family] = {};
          toCreate[family][shade] = palette[family][shade];
        } else {
          ctx.logWarning(`Token ${selection} not found in Tailwind palette.`);
        }
      }

      if (Object.keys(toCreate).length === 0) {
        spinner.fail('No valid tokens selected.');
        return;
      }

      const { data } = await ctx.command('tokens.create_palette', {
        colors: toCreate,
        collectionName: options.collection
      });

      spinner.succeed(`Surgically created ${data.created} primitives in "${options.collection}"`);
    } catch (err) {
      spinner.fail('Pick failed');
      ctx.logError(err.message);
    }
  }
}

export default [new TokensPickCommand()];
