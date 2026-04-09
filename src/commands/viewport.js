import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ViewportCenterCommand extends Command {
  name = 'viewport center [id]';
  description = 'Center and zoom to a node or current selection';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Centering viewport...');
    try {
      const result = await ctx.evalOp('viewport.center', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Centered on: ${result.name} [${result.type}]`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class ViewportFindCommand extends Command {
  name = 'viewport find <name>';
  description = 'Find nodes by name, select and zoom to fit';
  needsConnection = true;

  async execute(ctx, options, name) {
    const spinner = ctx.startSpinner(`Finding "${name}"...`);
    try {
      const result = await ctx.evalOp('viewport.select-and-zoom', { query: name });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Found ${result.found} node(s): ${result.ids.join(', ')}`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

class ViewportGoToCommand extends Command {
  name = 'viewport goto <id>';
  description = 'Go directly to a node by ID';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner(`Navigating to ${id}...`);
    try {
      const result = await ctx.evalOp('viewport.center', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`At: ${result.name} (${result.type})`);
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  }
}

export default [new ViewportCenterCommand(), new ViewportFindCommand(), new ViewportGoToCommand()];
