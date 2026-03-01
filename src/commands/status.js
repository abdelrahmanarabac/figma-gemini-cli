import { Command } from '../cli/command.js';

export class StatusCommand extends Command {
  name = 'status';
  description = 'Check connection to Figma';
  needsConnection = false;

  async execute(ctx, options) {
    const config = ctx.config.load();
    if (!config.patched) {
      ctx.logWarning('\nFirst time? Run the setup wizard:\n');
      ctx.log('  figma-ds-cli init\n');
      return;
    }

    try {
      const figmaPage = await ctx.getActivePage();

      if (figmaPage) {
        const title = figmaPage.title.replace(' – Figma', '');
        const payload = {
          status: 'connected',
          file: title,
          url: figmaPage.url
        };
        ctx.logSuccess(`Connected to Figma\n  File: ${title}`, payload);
      } else {
        ctx.logError('Not connected', { status: 'disconnected' });
      }
    } catch (e) {
      ctx.logError('Not connected', { status: 'disconnected', details: e.message });
    }
  }
}

export default [new StatusCommand()];
