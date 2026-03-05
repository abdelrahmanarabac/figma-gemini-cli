import { Command } from '../cli/command.js';
import { parseJSX } from '../parser/jsx.js';
import { sendBatch } from '../transport/bridge.js';

class RenderCommand extends Command {
  name = 'render <jsx>';
  description = 'Render JSX in Figma: figma-ds-cli render "<Frame ...>"';

  async execute(ctx, options, jsx) {
    if (!jsx) {
      ctx.logError('Usage: figma-ds-cli render "<Frame ...>"');
      return;
    }

    const { commands, errors } = parseJSX(jsx);

    if (commands.length === 0) {
      ctx.logError('Invalid JSX');
      if (errors.length > 0) {
        console.log('Parse errors:', errors);
      }
      return;
    }

    try {
      const result = await sendBatch(commands);
      ctx.logSuccess('Rendered successfully');
    } catch (err) {
      ctx.logError(`Render failed: ${err.message}`);
    }
  }
}

export default [new RenderCommand()];