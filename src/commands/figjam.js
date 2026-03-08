import { Command } from '../cli/command.js';
import { FigJamClient } from '../figjam-client.js';
import chalk from 'chalk';

async function getFigJamClient(pageTitle) {
  const client = new FigJamClient();
  try {
    const pages = await FigJamClient.listPages();
    if (pages.length === 0) {
      throw new Error('No FigJam pages open');
    }
    const targetPage = pageTitle || pages[0].title;
    await client.connect(targetPage);
    return client;
  } catch (error) {
    throw error;
  }
}

class FigJamPagesCommand extends Command {
  name = 'figjam pages';
  alias = 'fj';
  description = 'List all FigJam pages';
  async execute(ctx) {
    try {
      const pages = await FigJamClient.listPages();
      console.log(chalk.cyan('\n  Available FigJam Pages:\n'));
      pages.forEach(p => {
        console.log(chalk.white(`    • ${p.title}`));
      });
      console.log();
    } catch (error) {
      ctx.logError('Failed to list pages: ' + error.message);
    }
  }
}

class FigJamStickyCommand extends Command {
  name = 'figjam sticky <text>';
  description = 'Create a sticky note';
  options = [
    { flags: '-p, --page <title>', description: 'Page title' },
    { flags: '-x <n>', description: 'X position', defaultValue: '0' },
    { flags: '-y <n>', description: 'Y position', defaultValue: '0' },
    { flags: '-c, --color <hex>', description: 'Background color' }
  ];

  async execute(ctx, opts, text) {
    const client = await getFigJamClient(opts.page);
    try {
      await client.createSticky(text, parseFloat(opts.x), parseFloat(opts.y), opts.color);
      ctx.logSuccess('Sticky created');
    } catch (error) {
        ctx.logError(error.message);
    } finally {
      client.close();
    }
  }
}

export default [
  new FigJamPagesCommand(),
  new FigJamStickyCommand()
];
