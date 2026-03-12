import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class VarListCommand extends Command {
  name = 'var list';
  description = 'List all local variables and collections';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ora('Fetching variables...').start();
    try {
      const code = `
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const variables = await figma.variables.getLocalVariablesAsync();
        
        return {
          collections: collections.map(c => ({
            id: c.id,
            name: c.name,
            modes: c.modes.map(m => ({ id: m.modeId, name: m.name })),
            variableIds: c.variableIds // Include IDs to count correctly
          })),
          variables: variables.map(v => ({
            id: v.id,
            name: v.name,
            type: v.resolvedType,
            collectionId: v.variableCollectionId
          }))
        };
      `;
      
      const result = await ctx.eval(code);
      spinner.stop();

      if (!result || result.collections.length === 0) {
        console.log(chalk.yellow('\n  No variable collections found.\n'));
        return;
      }

      console.log(chalk.cyan(`\n  Variable Collections (${result.collections.length}):\n`));
      
      result.collections.forEach(col => {
        const colVars = result.variables.filter(v => v.collectionId === col.id);
        console.log(chalk.white(`  • ${chalk.bold(col.name)} (${col.id}) [${colVars.length} variables]`));
        console.log(chalk.gray(`    Modes: ${col.modes.map(m => m.name).join(', ')}`));
        
        if (colVars.length > 0) {
          colVars.forEach(v => {
            console.log(chalk.gray(`    - ${v.name} (${v.type}) [${v.id}]`));
          });
        }
        console.log();
      });
    } catch (err) {
      spinner.fail('Failed to list variables');
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
    const spinner = ora(`Creating variable "${name}"...`).start();
    try {
      const code = `
        const colRef = ${JSON.stringify(options.collection)};
        const varName = ${JSON.stringify(name)};
        const varType = ${JSON.stringify(type.toUpperCase())};
        const rawValue = ${JSON.stringify(value)};
        const isAlias = ${JSON.stringify(!!options.alias)};
        
        const variables = await figma.variables.getLocalVariablesAsync();
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.name === colRef || c.id === colRef);
        if (!col) return { success: false, error: 'Collection not found.' };

        async function parseValue(val, type, alias) {
          if (alias) {
            const target = variables.find(v => v.name === val || v.id === val);
            if (!target) throw new Error('Alias target variable not found: ' + val);
            return { type: 'VARIABLE_ALIAS', id: target.id };
          }
          if (type === 'COLOR') {
             const hex = val.replace('#', '');
             return {
               r: parseInt(hex.substring(0, 2), 16) / 255,
               g: parseInt(hex.substring(2, 4), 16) / 255,
               b: parseInt(hex.substring(4, 6), 16) / 255,
               a: 1
             };
          }
          if (type === 'FLOAT') return parseFloat(val);
          if (type === 'BOOLEAN') return val === 'true';
          return val;
        }

        try {
          const v = figma.variables.createVariable(varName, col, varType);
          const parsed = await parseValue(rawValue, varType, isAlias);
          v.setValueForMode(col.modes[0].modeId, parsed);
          return { success: true, id: v.id };
        } catch (e) {
          return { success: false, error: e.message };
        }
      `;
      
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess(`Created variable ${name} (${result.id})`);
      else ctx.logError(result.error);
    } catch (err) {
      spinner.fail('Creation failed');
      ctx.logError(err.message);
    }
  }
}

class VarRenameCommand extends Command {
  name = 'var rename <idOrName> <newName>';
  description = 'Rename an existing variable';
  needsConnection = true;

  async execute(ctx, options, idOrName, newName) {
    const spinner = ora(`Renaming variable to "${newName}"...`).start();
    try {
      const code = `
        const ref = ${JSON.stringify(idOrName)};
        const name = ${JSON.stringify(newName)};
        const variables = await figma.variables.getLocalVariablesAsync();
        const v = variables.find(v => v.id === ref || v.name === ref);
        if (!v) return { success: false, error: 'Variable not found.' };
        v.name = name;
        return { success: true };
      `;
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess('Variable renamed successfully.');
      else ctx.logError(result.error);
    } catch (err) { ctx.logError(err.message); }
  }
}

class VarDeleteCommand extends Command {
  name = 'var delete <idOrName>';
  description = 'Delete a variable';
  needsConnection = true;

  async execute(ctx, options, idOrName) {
    const spinner = ora('Deleting variable...').start();
    try {
      const code = `
        const ref = ${JSON.stringify(idOrName)};
        const variables = await figma.variables.getLocalVariablesAsync();
        const v = variables.find(v => v.id === ref || v.name === ref);
        if (!v) return { success: false, error: 'Variable not found.' };
        v.remove();
        return { success: true };
      `;
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess('Variable deleted.');
      else ctx.logError(result.error);
    } catch (err) { ctx.logError(err.message); }
  }
}

class ColCreateCommand extends Command {
  name = 'col create <name>';
  description = 'Create a new variable collection';
  needsConnection = true;

  async execute(ctx, options, name) {
    const spinner = ora(`Creating collection "${name}"...`).start();
    try {
      const code = `
        const n = ${JSON.stringify(name)};
        const col = figma.variables.createVariableCollection(n);
        return { success: true, id: col.id };
      `;
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess(`Created collection ${name} (${result.id})`);
    } catch (err) { ctx.logError(err.message); }
  }
}

class ColRenameCommand extends Command {
  name = 'col rename <idOrName> <newName>';
  description = 'Rename a variable collection';
  needsConnection = true;

  async execute(ctx, options, idOrName, newName) {
    const spinner = ora(`Renaming collection to "${newName}"...`).start();
    try {
      const code = `
        const ref = ${JSON.stringify(idOrName)};
        const name = ${JSON.stringify(newName)};
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.id === ref || c.name === ref);
        if (!col) return { success: false, error: 'Collection not found.' };
        col.name = name;
        return { success: true };
      `;
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess('Collection renamed.');
      else ctx.logError(result.error);
    } catch (err) { ctx.logError(err.message); }
  }
}

class ColDeleteCommand extends Command {
  name = 'col delete <idOrName>';
  description = 'Delete a variable collection';
  needsConnection = true;

  async execute(ctx, options, idOrName) {
    const spinner = ora('Deleting collection...').start();
    try {
      const code = `
        const ref = ${JSON.stringify(idOrName)};
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.id === ref || c.name === ref);
        if (!col) return { success: false, error: 'Collection not found.' };
        col.remove();
        return { success: true };
      `;
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess('Collection deleted.');
      else ctx.logError(result.error);
    } catch (err) { ctx.logError(err.message); }
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
