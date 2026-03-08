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
            modes: c.modes.map(m => ({ id: m.modeId, name: m.name }))
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
        console.log(chalk.yellow('\n  No variable collections found in this file.\n'));
        return;
      }

      console.log(chalk.cyan(`\n  Variable Collections (${result.collections.length}):\n`));
      
      result.collections.forEach(col => {
        console.log(chalk.white(`  • ${chalk.bold(col.name)}`));
        console.log(chalk.gray(`    ID: ${col.id}`));
        console.log(chalk.gray(`    Modes: ${col.modes.map(m => m.name).join(', ')}`));
        
        const colVars = result.variables.filter(v => v.collectionId === col.id);
        if (colVars.length > 0) {
          colVars.forEach(v => {
            console.log(chalk.gray(`    - ${v.name} (${v.type})`));
          });
        } else {
          console.log(chalk.gray(`    (No variables in this collection)`));
        }
        console.log();
      });
    } catch (err) {
      spinner.fail('Failed to list variables');
      ctx.logError(err.message);
    }
  }
}

export default [new VarListCommand()];
