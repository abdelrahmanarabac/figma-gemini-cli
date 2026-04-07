import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class VarListCommand extends Command {
  name = 'var list';
  description = 'List all local variables and collections';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.isInteractive ? ora('Fetching variables...').start() : null;
    try {
      const result = await ctx.evalOp('variables.list');
      spinner?.stop();
      const collections = result?.collections || [];
      const variables = result?.variables || [];
      const payload = {
        collections,
        variables,
        collectionCount: collections.length,
        variableCount: variables.length,
      };

      if (collections.length === 0) {
        ctx.output(
          { ...payload, message: 'No variable collections found.' },
          () => console.log(chalk.yellow('\n  No variable collections found.\n'))
        );
        return;
      }

      ctx.output(payload, () => {
        console.log(chalk.cyan(`\n  Variable Collections (${collections.length}):\n`));

        collections.forEach(col => {
          const colVars = variables.filter(v => v.collectionId === col.id);
          console.log(chalk.white(`  • ${chalk.bold(col.name)} (${col.id}) [${colVars.length} variables]`));
          console.log(chalk.gray(`    Modes: ${col.modes.map(m => m.name).join(', ')}`));

          if (colVars.length > 0) {
            colVars.forEach(v => {
              console.log(chalk.gray(`    - ${v.name} (${v.type}) [${v.id}]`));
            });
          }
          console.log();
        });
      });
    } catch (err) {
      spinner?.fail('Failed to list variables');
      ctx.logError(err.message);
    }
  }
}

class VarCreateCommand extends Command {
  name = 'var create <name> <type> <value>';
  description = 'Create a new variable (type: COLOR, FLOAT, STRING, BOOLEAN)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-c, --collection <id|name>', description: 'Target collection name or ID', required: true },
      { flags: '-a, --alias', description: 'Treat value as a reference to another variable' }
    ];
  }

  async execute(ctx, options, name, type, value) {
    const spinner = ctx.startSpinner(`Creating variable "${name}"...`);
    try {
      const result = await ctx.evalOp('variables.create', {
        name,
        type: type.toUpperCase(),
        value,
        collectionRef: options.collection,
        isAlias: Boolean(options.alias),
      });
      if (result.success) {
        const payload = {
          success: true,
          id: result.id,
          name,
          type: type.toUpperCase(),
          value,
          collection: options.collection,
          alias: Boolean(options.alias),
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Created variable ${name} (${result.id})`, payload);
        } else {
          spinner.succeed(`Created variable ${name} (${result.id})`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          name,
          type: type.toUpperCase(),
          value,
          collection: options.collection,
          alias: Boolean(options.alias),
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Creation failed', {
        success: false,
        name,
        type: type.toUpperCase(),
        value,
        collection: options.collection,
        alias: Boolean(options.alias),
        error: err.message,
      });
    }
  }
}

class VarRenameCommand extends Command {
  name = 'var rename <idOrName> <newName>';
  description = 'Rename an existing variable';
  needsConnection = true;

  async execute(ctx, options, idOrName, newName) {
    const spinner = ctx.startSpinner(`Renaming variable to "${newName}"...`);
    try {
      const result = await ctx.evalOp('variables.rename', {
        ref: idOrName,
        newName,
      });
      if (result.success) {
        const payload = {
          success: true,
          idOrName,
          newName,
        };
        if (ctx.isJson) {
          ctx.logSuccess('Variable renamed successfully.', payload);
        } else {
          spinner.succeed('Variable renamed successfully.');
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          idOrName,
          newName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Variable rename failed', {
        success: false,
        idOrName,
        newName,
        error: err.message,
      });
    }
  }
}

class VarDeleteCommand extends Command {
  name = 'var delete <idOrName>';
  description = 'Delete a variable';
  needsConnection = true;

  async execute(ctx, options, idOrName) {
    const spinner = ctx.startSpinner('Deleting variable...');
    try {
      const result = await ctx.evalOp('variables.delete', { ref: idOrName });
      if (result.success) {
        const payload = {
          success: true,
          idOrName,
        };
        if (ctx.isJson) {
          ctx.logSuccess('Variable deleted.', payload);
        } else {
          spinner.succeed('Variable deleted.');
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          idOrName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Variable deletion failed', {
        success: false,
        idOrName,
        error: err.message,
      });
    }
  }
}

class ColCreateCommand extends Command {
  name = 'col create <name>';
  description = 'Create a new variable collection';
  needsConnection = true;

  async execute(ctx, options, name) {
    const spinner = ctx.startSpinner(`Creating collection "${name}"...`);
    try {
      const result = await ctx.evalOp('collection.create', { name });
      if (result.success) {
        const payload = {
          success: true,
          id: result.id,
          name,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Created collection ${name} (${result.id})`, payload);
        } else {
          spinner.succeed(`Created collection ${name} (${result.id})`);
        }
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Collection creation failed', {
        success: false,
        name,
        error: err.message,
      });
    }
  }
}

class ColRenameCommand extends Command {
  name = 'col rename <idOrName> <newName>';
  description = 'Rename a variable collection';
  needsConnection = true;

  async execute(ctx, options, idOrName, newName) {
    const spinner = ctx.startSpinner(`Renaming collection to "${newName}"...`);
    try {
      const result = await ctx.evalOp('collection.rename', {
        ref: idOrName,
        newName,
      });
      if (result.success) {
        const payload = {
          success: true,
          idOrName,
          newName,
        };
        if (ctx.isJson) {
          ctx.logSuccess('Collection renamed.', payload);
        } else {
          spinner.succeed('Collection renamed.');
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          idOrName,
          newName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Collection rename failed', {
        success: false,
        idOrName,
        newName,
        error: err.message,
      });
    }
  }
}

class ColDeleteCommand extends Command {
  name = 'col delete <idOrName>';
  description = 'Delete a variable collection';
  needsConnection = true;

  async execute(ctx, options, idOrName) {
    const spinner = ctx.startSpinner('Deleting collection...');
    try {
      const result = await ctx.evalOp('collection.delete', { ref: idOrName });
      if (result.success) {
        const payload = {
          success: true,
          idOrName,
        };
        if (ctx.isJson) {
          ctx.logSuccess('Collection deleted.', payload);
        } else {
          spinner.succeed('Collection deleted.');
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          idOrName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Collection deletion failed', {
        success: false,
        idOrName,
        error: err.message,
      });
    }
  }
}

export default [
  new VarListCommand(),
  new VarCreateCommand(),
  new VarRenameCommand(),
  new VarDeleteCommand(),
  new ColCreateCommand(),
  new ColRenameCommand(),
  new ColDeleteCommand()
];
