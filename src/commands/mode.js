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

export default [
  new ModeAddCommand(),
  new ModeEditCommand(),
  new ModeMultiCommand()
];
