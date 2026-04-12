import { Command } from '../cli/command.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { checkHealth } from '../transport/bridge.js';

// Tokens commands defer to AI and dynamic pipeline generation

const CREATE_PRESET_OPTIONS = [];

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

// ── Tokens Commands — fully file-driven, zero hardcoded values ─────────

class TokensPresetCommand extends Command {
  name = 'tokens preset <file>';
  description = 'Build a design system from a JSON config file (zero hardcoded values in code)';
  options = [
    { flags: '-n, --name <name>', description: 'Override preset name' }
  ];

  async execute(ctx, opts, file) {
    let config;
    try {
      config = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      ctx.logError(`Could not read preset file: ${file}`);
      return;
    }

    const presetName = opts.name || config.name || 'Design System';
    const spinner = ctx.startSpinner(`Building "${presetName}" from ${file}...`);

    if (!config.primitives && !config.semantic && !config.components) {
      finishError(ctx, spinner, 'Preset must have primitives, semantic, or components sections');
      return;
    }

    try {
      const results = { collections: 0, variables: 0 };

      // ── Phase 1: Primitives ──
      if (config.primitives) {
        const primCol = await ctx.command('collection.create', { name: config.primitives.collectionName || 'Primitives' });
        const primColId = primCol.data?.id;
        results.collections++;

        for (const [varName, varDef] of Object.entries(config.primitives.variables || {})) {
          const type = varDef.type || 'COLOR';
          const value = varDef.value;
          await ctx.command('variable.create', {
            name: varName, type, value, collectionId: primColId
          });
          results.variables++;
        }
      }

      // ── Phase 2: Semantic (aliases) ──
      if (config.semantic) {
        const semCol = await ctx.command('collection.create', { name: config.semantic.collectionName || 'Semantic' });
        const semColId = semCol.data?.id;
        results.collections++;

        for (const [varName, varDef] of Object.entries(config.semantic.variables || {})) {
          const type = varDef.type || 'COLOR';
          const value = varDef.value; // alias reference like "{blue/500}"
          await ctx.command('variable.create', {
            name: varName, type, value, collectionId: semColId, isAlias: true
          });
          results.variables++;
        }
      }

      // ── Phase 3: Components (aliases to Semantic) ──
      if (config.components) {
        const compCol = await ctx.command('collection.create', { name: config.components.collectionName || 'Components' });
        const compColId = compCol.data?.id;
        results.collections++;

        for (const [varName, varDef] of Object.entries(config.components.variables || {})) {
          const type = varDef.type || 'COLOR';
          const value = varDef.value;
          await ctx.command('variable.create', {
            name: varName, type, value, collectionId: compColId, isAlias: true
          });
          results.variables++;
        }
      }

      finishSuccess(ctx, spinner,
        `"${presetName}" created: ${results.collections} collections, ${results.variables} variables`,
        results
      );
    } catch (error) {
      finishError(ctx, spinner, `Failed to build preset "${presetName}"`, error);
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
  description = 'Preset token creation is handled directly by AI now';
  needsConnection = false;

  async execute(ctx, opts, preset) {
    console.log(chalk.cyan('\n  Note: Token palettes are no longer hardcoded. The AI agent generates custom design systems dynamically.\n'));
  }
}

export default [
  new TokensClearCommand(),
  new TokensImportCommand(),
  new TokensCreateCommand(),
];
