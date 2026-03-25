import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { checkHealth } from '../transport/bridge.js';
import { buildMaterial3System } from '../data/design-systems/material3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const palettesDir = join(__dirname, '..', 'data', 'palettes');

// Load palette from JSON file
function loadPalette(name) {
  return JSON.parse(readFileSync(join(palettesDir, name + '.json'), 'utf8'));
}

const CREATE_PRESET_OPTIONS = [
  { name: 'material3', description: 'Layered tokens + text styles' },
  { name: 'tailwind', description: 'Full color palette' },
  { name: 'shadcn', description: 'UI primitives' },
  { name: 'spacing', description: '4px base scale' },
  { name: 'radii', description: 'Border corner scale' },
];

function finishSuccess(ctx, spinner, message, payload) {
  if (ctx.isJson) {
    ctx.logSuccess(message, payload);
  } else {
    spinner.succeed(message);
  }
}

function finishError(ctx, spinner, message, error = null, payload = null) {
  process.exitCode = 1;
  const jsonPayload = payload || { error: error?.message || message };

  if (ctx.isJson) {
    ctx.logError(message, jsonPayload);
  } else {
    spinner.fail(message);
    if (error?.message) {
      console.log(chalk.red(error.message));
    }
  }
}

// ── Tokens Commands ─────────────────────────────────

class TokensClearCommand extends Command {
  name = 'tokens clear';
  description = 'Delete all local variables and collections';

  async execute(ctx) {
    const spinner = ctx.startSpinner('Clearing all tokens...');
    try {
      const { data } = await ctx.command('tokens.delete_all');
      const payload = {
        deletedCollections: data?.deletedCollections || 0,
        deletedVariables: data?.deletedVariables || 0,
      };
      finishSuccess(
        ctx,
        spinner,
        data
          ? `Deleted ${payload.deletedCollections} collections and ${payload.deletedVariables} variables`
          : 'Cleared all tokens',
        payload
      );
    } catch (error) {
      finishError(ctx, spinner, 'Failed to clear tokens', error);
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
    const spinner = ctx.startSpinner('Creating Tailwind color palette...');
    const colors = loadPalette('tailwind');
    try {
      const { data } = await ctx.command('tokens.create_palette', {
        colors,
        collectionName: opts.collection
      });
      finishSuccess(ctx, spinner, `Created ${data.created} color variables in ${data.collection}`, {
        preset: 'tailwind',
        created: data.created,
        collection: data.collection,
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to create palette', error, {
        preset: 'tailwind',
        collection: opts.collection,
        error: error.message,
      });
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
    const spinner = ctx.startSpinner('Creating shadcn token layers...');
    const shadcnData = loadPalette('shadcn');
    try {
      const { data } = await ctx.command('tokens.create_shadcn', {
        primitives: shadcnData.primitives,
        semanticTokens: shadcnData.semantic
      });
      finishSuccess(ctx, spinner, `Created ${data.primCount} shadcn primitives and ${data.semCount} semantic tokens`, {
        preset: 'shadcn',
        primitiveCount: data.primCount,
        semanticCount: data.semCount,
        collection: opts.collection,
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to create shadcn colors', error, {
        preset: 'shadcn',
        error: error.message,
      });
    }
  }
}

class TokensMaterial3Command extends Command {
  name = 'tokens material3';
  description = 'Create a layered Material 3 token system with typography styles';
  options = [
    { flags: '--prefix <name>', description: 'Collection and style prefix', defaultValue: 'm3' },
    { flags: '--font-family <family>', description: 'Typography family', defaultValue: 'Roboto' },
    { flags: '--no-styles', description: 'Create tokens without text styles' }
  ];

  async execute(ctx, opts) {
    const spinner = ctx.startSpinner('Creating Material 3 token system...');
    try {
      const system = buildMaterial3System({
        prefix: opts.prefix,
        fontFamily: opts.fontFamily,
        includeTextStyles: opts.styles !== false,
      });
      const { data } = await ctx.command('tokens.create_system', { system });
      finishSuccess(ctx, spinner, `Created Material 3 system: ${data.variables} variables across ${data.collections} collections${opts.styles !== false ? ` + ${data.textStyles} text styles` : ''}`, {
        preset: 'material3',
        prefix: opts.prefix,
        fontFamily: opts.fontFamily,
        includeTextStyles: opts.styles !== false,
        collections: data.collections,
        variables: data.variables,
        textStyles: data.textStyles,
        createdCollections: data.createdCollections,
        collectionNames: data.collectionNames,
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to create Material 3 system', error, {
        preset: 'material3',
        prefix: opts.prefix,
        fontFamily: opts.fontFamily,
        includeTextStyles: opts.styles !== false,
        error: error.message,
      });
    }
  }
}

class TokensPresetCommand extends Command {
  name = 'tokens preset <name>';
  description = 'Add color presets: shadcn, radix';

  async execute(ctx, opts, preset) {
    const presetLower = preset.toLowerCase();

    if (presetLower === 'shadcn') {
      const spinner = ctx.startSpinner('Adding shadcn colors...');
      const shadcnData = loadPalette('shadcn');
      try {
        const { data } = await ctx.command('tokens.create_shadcn', {
          primitives: shadcnData.primitives,
          semanticTokens: shadcnData.semantic
        });
        finishSuccess(ctx, spinner, `Added shadcn colors: ${data.primCount} primitives + ${data.semCount} semantic tokens`, {
          preset: 'shadcn',
          primitiveCount: data.primCount,
          semanticCount: data.semCount,
        });
      } catch (error) {
        finishError(ctx, spinner, 'Failed to add shadcn', error, {
          preset: 'shadcn',
          error: error.message,
        });
      }
    } else if (presetLower === 'radix') {
      const spinner = ctx.startSpinner('Adding Radix UI colors...');
      const radixColors = loadPalette('radix');
      try {
        const { data } = await ctx.command('tokens.create_palette', {
          colors: radixColors,
          collectionName: 'radix/colors'
        });
        finishSuccess(ctx, spinner, `Added Radix UI colors: ${data.created} colors`, {
          preset: 'radix',
          created: data.created,
          collection: data.collection,
        });
      } catch (error) {
        finishError(ctx, spinner, 'Failed to add Radix colors', error, {
          preset: 'radix',
          error: error.message,
        });
      }
    } else {
      ctx.logError(`Unknown preset: ${preset}`, {
        preset,
        availablePresets: ['shadcn', 'radix'],
      });
      process.exitCode = 1;
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
    const spinner = ctx.startSpinner('Creating spacing scale...');
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
      finishSuccess(ctx, spinner, `Created ${data.created} spacing variables`, {
        preset: 'spacing',
        created: data.created,
        collection: opts.collection,
        prefix: 'spacing',
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to create spacing scale', error, {
        preset: 'spacing',
        collection: opts.collection,
        error: error.message,
      });
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
    const spinner = ctx.startSpinner('Creating border radii...');
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
      finishSuccess(ctx, spinner, `Created ${data.created} radius variables`, {
        preset: 'radii',
        created: data.created,
        collection: opts.collection,
        prefix: 'radius',
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to create radii', error, {
        preset: 'radii',
        collection: opts.collection,
        error: error.message,
      });
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

    const spinner = ctx.startSpinner('Importing tokens...');
    const collectionName = opts.collection || 'Imported Tokens';

    try {
      const { data } = await ctx.command('tokens.create_palette', {
        colors: tokensData,
        collectionName
      });
      finishSuccess(ctx, spinner, `Imported ${data.created} tokens into ${data.collection}`, {
        imported: data.created,
        collection: data.collection,
        file,
      });
    } catch (error) {
      finishError(ctx, spinner, 'Failed to import tokens', error, {
        file,
        collection: collectionName,
        error: error.message,
      });
    }
  }
}

class TokensCreateCommand extends Command {
  name = 'tokens create [preset]';
  description = 'Interactive or preset-based token creation';
  needsConnection = false;

  async execute(ctx, opts, preset) {
    if (!preset) {
      ctx.output(
        { availablePresets: CREATE_PRESET_OPTIONS },
        () => {
          console.log(chalk.cyan('\n  Please specify a preset to create:\n'));
          console.log(chalk.white('    • material3 (Layered tokens + text styles)'));
          console.log(chalk.white('    • tailwind  (Full color palette)'));
          console.log(chalk.white('    • shadcn    (UI primitives)'));
          console.log(chalk.white('    • spacing   (4px base scale)'));
          console.log(chalk.white('    • radii     (Border corner scale)'));
          console.log(chalk.gray('\n  Example: figma-gemini-cli tokens create material3\n'));
        }
      );
      return;
    }

    const presetLower = preset.toLowerCase();
    const health = await checkHealth();
    if (health.status !== 'ok' || !health.plugin) {
      process.exitCode = 1;
      ctx.logError('Not connected to Figma. Connect first to create token presets.', {
        connected: false,
        daemonRunning: health.status === 'ok',
        pluginConnected: Boolean(health.plugin),
        preset,
      });
      return;
    }

    if (presetLower === 'material3') {
      await new TokensMaterial3Command().execute(ctx, {
        prefix: 'm3',
        fontFamily: 'Roboto',
        styles: true,
      });
      return;
    }
    if (presetLower === 'tailwind') {
      await new TokensTailwindCommand().execute(ctx, { collection: 'Color - Primitive' });
      return;
    }
    if (presetLower === 'shadcn') {
      await new TokensShadcnCommand().execute(ctx, { collection: 'shadcn/primitives' });
      return;
    }
    if (presetLower === 'spacing') {
      await new TokensSpacingCommand().execute(ctx, { collection: 'Spacing' });
      return;
    }
    if (presetLower === 'radii') {
      await new TokensRadiiCommand().execute(ctx, { collection: 'Radii' });
      return;
    }

    process.exitCode = 1;
    ctx.logError(`Unknown token preset: ${preset}`, {
      preset,
      availablePresets: CREATE_PRESET_OPTIONS,
    });
  }
}

export default [
  new TokensClearCommand(),
  new TokensTailwindCommand(),
  new TokensShadcnCommand(),
  new TokensMaterial3Command(),
  new TokensPresetCommand(),
  new TokensSpacingCommand(),
  new TokensRadiiCommand(),
  new TokensImportCommand(),
  new TokensCreateCommand(),
];
