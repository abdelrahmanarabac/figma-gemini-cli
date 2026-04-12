import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ModeAddCommand extends Command {
  name = 'mode add <collectionName> <modeName>';
  description = 'Add a new mode to a variable collection';
  needsConnection = true;

  async execute(ctx, options, collectionName, modeName) {
    const spinner = ctx.startSpinner(`Adding mode "${modeName}" to "${collectionName}"...`);
    try {
      const result = await ctx.evalOp('mode.add', {
        collectionRef: collectionName,
        modeName,
      });
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          modeName,
          modeId: result.modeId,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Added mode "${modeName}" to "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Added mode "${modeName}" to "${result.colName}"`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          modeName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Failed to add mode', {
        success: false,
        collection: collectionName,
        modeName,
        error: err.message,
      });
    }
  }
}

class ModeEditCommand extends Command {
  name = 'mode edit <collectionName> <oldName> <newName>';
  description = 'Rename an existing mode in a collection';
  needsConnection = true;

  async execute(ctx, options, collectionName, oldName, newName) {
    const spinner = ctx.startSpinner(`Renaming mode "${oldName}" to "${newName}"...`);
    try {
      const result = await ctx.evalOp('mode.edit', {
        collectionName,
        oldName,
        newName,
      });
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          oldName,
          newName,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Renamed mode "${oldName}" to "${newName}" in "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Renamed mode "${oldName}" to "${newName}" in "${result.colName}"`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          oldName,
          newName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Failed to edit mode', {
        success: false,
        collection: collectionName,
        oldName,
        newName,
        error: err.message,
      });
    }
  }
}

class ModeMultiCommand extends Command {
  name = 'mode multi <collectionName>';
  description = 'Batch generate modes (e.g., auto-create Dark mode from Light, or Compact from Spacious)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--from <name>', description: 'Source mode name', defaultValue: 'Light' },
      { flags: '--to <name>', description: 'Target mode name', defaultValue: 'Dark' },
      { flags: '--strategy <type>', description: 'Transformation strategy (invert, copy, scale)', defaultValue: 'invert' },
      { flags: '--factor <number>', description: 'Scaling factor (for strategy=scale)', defaultValue: '1' },
      { flags: '--filter <prefix>', description: 'Only process variables starting with this prefix' }
    ];
  }

  async execute(ctx, options, collectionName) {
    const spinner = ctx.startSpinner(`Running multi-mode generation: ${options.from} -> ${options.to} (${options.strategy})...`);
    try {
      const result = await ctx.evalOp('mode.multi', {
        collectionName,
        fromName: options.from,
        toName: options.to,
        strategy: options.strategy,
        factor: parseFloat(options.factor),
        filterPrefix: options.filter,
      });
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          from: options.from,
          to: result.targetModeName,
          strategy: options.strategy,
          factor: parseFloat(options.factor),
          filter: options.filter || null,
          count: result.count,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Successfully generated "${result.targetModeName}" using strategy "${options.strategy}" in "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Successfully generated "${result.targetModeName}" using strategy "${options.strategy}" in "${result.colName}"`);
          console.log(chalk.gray(`    Variables updated: ${result.count}`));
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          from: options.from,
          to: options.to,
          strategy: options.strategy,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Multi-mode generation failed', {
        success: false,
        collection: collectionName,
        from: options.from,
        to: options.to,
        strategy: options.strategy,
        error: err.message,
      });
    }
  }
}

class ModeDeleteCommand extends Command {
  name = 'mode delete <collectionName> <modeName>';
  description = 'Delete a mode from a collection';
  needsConnection = true;

  async execute(ctx, options, collectionName, modeName) {
    const spinner = ctx.startSpinner(`Deleting mode "${modeName}" from "${collectionName}"...`);
    try {
      const result = await ctx.evalOp('mode.delete', {
        collectionRef: collectionName,
        modeRef: modeName,
      });
      if (!result.success) throw new Error(result.error);
      spinner.succeed(`Deleted mode "${modeName}" from "${collectionName}"`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class ThemeToggleCommand extends Command {
  name = 'theme toggle <mode>';
  description = 'Switch all collections to a specific mode (e.g., Light, Dark)';
  needsConnection = true;

  async execute(ctx, options, mode) {
    const spinner = ctx.startSpinner(`Switching all collections to "${mode}"...`);
    try {
      const result = await ctx.evalOp('theme.toggle', { targetMode: mode });
      if (result.error) throw new Error(result.error);

      if (ctx.isJson) {
        spinner.stop();
        ctx.logSuccess(`Switched ${result.count}/${result.total} collections to "${mode}"`, result);
        return;
      }

      spinner.succeed(`Switched ${result.count}/${result.total} collections to "${mode}"`);
      result.results.forEach(function(r) {
        var icon = r.success ? chalk.green('✓') : chalk.red('✗');
        var msg = r.success
          ? r.collection + ' → ' + r.mode
          : r.collection + ': ' + r.error;
        console.log(chalk.gray('   ' + icon + ' ' + msg));
      });
      console.log();
    } catch (err) {
      spinner.fail('Failed: ' + err.message);
    }
  }
}

class ThemeListCommand extends Command {
  name = 'theme list';
  description = 'List all collections and their available modes';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.startSpinner('Listing themes...');
    try {
      const result = await ctx.evalOp('theme.list');
      if (result.error) throw new Error(result.error);

      if (ctx.isJson) {
        spinner.stop();
        ctx.logSuccess('Theme list', result);
        return;
      }

      spinner.succeed('Found ' + result.themes.length + ' collection(s)');
      result.themes.forEach(function(t) {
        console.log(chalk.cyan('\n  ' + t.collection));
        t.modes.forEach(function(m) {
          var active = m.name === t.currentMode ? chalk.green(' ← active') : '';
          console.log(chalk.gray('    • ' + m.name + active));
        });
      });
      console.log();
    } catch (err) {
      spinner.fail('Failed: ' + err.message);
    }
  }
}

export default [
  new ModeAddCommand(),
  new ModeEditCommand(),
  new ModeDeleteCommand(),
  new ModeMultiCommand(),
  new ThemeListCommand(),
  new ThemeToggleCommand()
];
