import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __dirname = dirname(fileURLToPath(import.meta.url));
const palettesDir = join(__dirname, '..', 'data', 'palettes');

// Load palette from JSON file
function loadPalette(name) {
  return JSON.parse(readFileSync(join(palettesDir, name + '.json'), 'utf8'));
}

// ── Tokens Commands ─────────────────────────────────

class TokensClearCommand extends Command {
  name = 'tokens clear';
  description = 'Delete all local variables and collections';

  async execute(ctx) {
    const spinner = ora('Clearing all tokens...').start();
    try {
      const { data } = await ctx.command('tokens.delete_all');
      if (data) {
        spinner.succeed(`Deleted ${data.deletedCollections || 0} collections and ${data.deletedVariables || 0} variables`);
      } else {
        spinner.succeed('Cleared all tokens');
      }
    } catch (error) {
      spinner.fail('Failed to clear tokens');
      console.error(error.message);
    }
  }
}

class TokensTailwindCommand extends Command {
  name = 'tokens tailwind';
  description = 'Create Tailwind CSS color palette';
  options = [
    { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Color - Primitive' }
  ];

  async execute(ctx, opts) {
    const spinner = ora('Creating Tailwind color palette...').start();
    const colors = loadPalette('tailwind');
    try {
      const { data } = await ctx.command('tokens.create_palette', {
        colors,
        collectionName: opts.collection
      });
      spinner.succeed(`Created ${data.created} color variables in ${data.collection}`);
    } catch (error) {
      spinner.fail('Failed to create palette');
      console.error(error.message);
    }
  }
}

class TokensShadcnCommand extends Command {
  name = 'tokens shadcn';
  description = 'Create shadcn/ui color primitives (from v3.shadcn.com/colors)';
  options = [
    { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'shadcn/primitives' }
  ];

  async execute(ctx, opts) {
    const spinner = ora('Creating shadcn color primitives...').start();
    const colors = loadPalette('tailwind');
    try {
      const { data } = await ctx.command('tokens.create_palette', {
        colors,
        collectionName: opts.collection
      });
      spinner.succeed(`Created ${data.created} shadcn primitives`);
    } catch (error) {
      spinner.fail('Failed to create shadcn colors');
      console.error(error.message);
    }
  }
}

class TokensPresetCommand extends Command {
  name = 'tokens preset <name>';
  description = 'Add color presets: shadcn, radix';

  async execute(ctx, opts, preset) {
    const presetLower = preset.toLowerCase();

    if (presetLower === 'shadcn') {
      const spinner = ora('Adding shadcn colors...').start();
      const shadcnData = loadPalette('shadcn');
      try {
        const { data } = await ctx.command('tokens.create_shadcn', {
          primitives: shadcnData.primitives,
          semanticTokens: shadcnData.semantic
        });
        spinner.succeed(`Added shadcn colors: ${data.primCount} primitives + ${data.semCount} semantic tokens`);
      } catch (error) {
        spinner.fail('Failed to add shadcn');
        console.error(chalk.red(error.message));
      }
    } else if (presetLower === 'radix') {
      const spinner = ora('Adding Radix UI colors...').start();
      const radixColors = loadPalette('radix');
      try {
        const { data } = await ctx.command('tokens.create_palette', {
          colors: radixColors,
          collectionName: 'radix/colors'
        });
        spinner.succeed(`Added Radix UI colors: ${data.created} colors`);
      } catch (error) {
        spinner.fail('Failed to add Radix colors');
        console.error(chalk.red(error.message));
      }
    } else {
      console.log(chalk.red(`Unknown preset: ${preset}`));
    }
  }
}

class TokensSpacingCommand extends Command {
  name = 'tokens spacing';
  description = 'Create spacing scale (4px base)';
  options = [
    { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Spacing' }
  ];

  async execute(ctx, opts) {
    const spinner = ora('Creating spacing scale...').start();
    const spacings = {
      '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
      '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28,
      '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
      '14': 56, '16': 64, '20': 80, '24': 96, '28': 112,
      '32': 128, '36': 144, '40': 160, '44': 176, '48': 192
    };

    try {
      const { data } = await ctx.command('tokens.create_scale', {
        values: spacings,
        collectionName: opts.collection,
        prefix: 'spacing'
      });
      spinner.succeed(`Created ${data.created} spacing variables`);
    } catch (error) {
      spinner.fail('Failed to create spacing scale');
    }
  }
}

class TokensRadiiCommand extends Command {
  name = 'tokens radii';
  description = 'Create border radius scale';
  options = [
    { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Radii' }
  ];

  async execute(ctx, opts) {
    const spinner = ora('Creating border radii...').start();
    const radii = {
      'none': 0, 'sm': 2, 'default': 4, 'md': 6, 'lg': 8,
      'xl': 12, '2xl': 16, '3xl': 24, 'full': 9999
    };

    try {
      const { data } = await ctx.command('tokens.create_scale', {
        values: radii,
        collectionName: opts.collection,
        prefix: 'radius'
      });
      spinner.succeed(`Created ${data.created} radius variables`);
    } catch (error) {
      spinner.fail('Failed to create radii');
    }
  }
}

class TokensImportCommand extends Command {
  name = 'tokens import <file>';
  description = 'Import tokens from JSON file';
  options = [
    { flags: '-c, --collection <name>', description: 'Collection name' }
  ];

  async execute(ctx, opts, file) {
    let tokensData;
    try {
      tokensData = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      ctx.logError(`Could not read file: ${file}`);
      return;
    }

    const spinner = ora('Importing tokens...').start();
    const collectionName = opts.collection || 'Imported Tokens';

    try {
      const { data } = await ctx.command('tokens.create_palette', {
        colors: tokensData,
        collectionName
      });
      spinner.succeed(`Imported ${data.created} tokens into ${data.collection}`);
    } catch (error) {
      spinner.fail('Failed to import tokens');
      console.error(error.message);
    }
  }
}

class TokensCreateCommand extends Command {
  name = 'tokens create [preset]';
  description = 'Interactive or preset-based token creation';

  async execute(ctx, opts, preset) {
    if (!preset) {
      console.log(chalk.cyan('\n  Please specify a preset to create:\n'));
      console.log(chalk.white('    • tailwind  (Full color palette)'));
      console.log(chalk.white('    • shadcn    (UI primitives)'));
      console.log(chalk.white('    • spacing   (4px base scale)'));
      console.log(chalk.white('    • radii     (Border corner scale)'));
      console.log(chalk.gray('\n  Example: figma-gemini-cli tokens create tailwind\n'));
      return;
    }
  }
}

export default [
  new TokensClearCommand(),
  new TokensTailwindCommand(),
  new TokensShadcnCommand(),
  new TokensPresetCommand(),
  new TokensSpacingCommand(),
  new TokensRadiiCommand(),
  new TokensImportCommand(),
  new TokensCreateCommand(),
];
