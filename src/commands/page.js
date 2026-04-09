import { Command } from '../cli/command.js';
import chalk from 'chalk';

class PageListCommand extends Command {
  name = 'page list';
  description = 'List all pages in the current document';
  needsConnection = true;

  async execute(ctx, options) {
    const spinner = ctx.startSpinner('Listing pages...');
    try {
      const result = await ctx.evalOp('page.list');
      if (result.error) throw new Error(result.error);

      const payload = {
        pages: result.pages,
        currentPage: result.currentPage,
      };

      if (ctx.isJson) {
        spinner.stop();
        ctx.logSuccess('Pages listed.', payload);
      } else {
        spinner.succeed(`Found ${result.pages.length} page(s).`);
        result.pages.forEach((p, i) => {
          const marker = p.id === result.currentPage.id ? chalk.green(' ← active') : '';
          console.log(chalk.gray(`    ${i + 1}. ${p.name} (${p.id})${marker}`));
        });
        console.log();
      }
    } catch (err) {
      spinner.fail(`Failed to list pages: ${err.message}`);
    }
  }
}

class PageCreateCommand extends Command {
  name = 'page create [name]';
  description = 'Create a new page in the current document';
  needsConnection = true;

  async execute(ctx, options, name) {
    const pageName = name || 'New Page';
    const spinner = ctx.startSpinner(`Creating page ${pageName}...`);
    try {
      const result = await ctx.evalOp('page.create', { name: pageName });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Created page: ${pageName} (ID: ${result.id})`);
    } catch (err) {
      spinner.fail(`Failed to create page: ${err.message}`);
    }
  }
}

class PageRenameCommand extends Command {
  name = 'page rename <id> <name>';
  description = 'Rename an existing page';
  needsConnection = true;

  async execute(ctx, options, id, name) {
    const spinner = ctx.startSpinner(`Renaming page ${id} to ${name}...`);
    try {
      const result = await ctx.evalOp('page.rename', { id, name });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Renamed page ${id} successfully.`);
    } catch (err) {
      spinner.fail(`Failed to rename page: ${err.message}`);
    }
  }
}

class PageDeleteCommand extends Command {
  name = 'page delete <id>';
  description = 'Delete a page from the document';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner(`Deleting page ${id}...`);
    try {
      const result = await ctx.evalOp('page.delete', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Deleted page ${id} successfully.`);
    } catch (err) {
      spinner.fail(`Failed to delete page: ${err.message}`);
    }
  }
}

class PageSwitchCommand extends Command {
  name = 'page switch <id>';
  description = 'Set focus to a specific page';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner(`Switching to page ${id}...`);
    try {
      const result = await ctx.evalOp('page.switch', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Switched to page ${id}.`);
    } catch (err) {
      spinner.fail(`Failed to switch page: ${err.message}`);
    }
  }
}

export default [
  new PageListCommand(),
  new PageCreateCommand(),
  new PageRenameCommand(),
  new PageDeleteCommand(),
  new PageSwitchCommand()
];
