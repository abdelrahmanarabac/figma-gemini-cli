import { Command } from '../cli/command.js';
import { parseJSX } from '../parser/jsx.js';
import { sendBatch } from '../transport/bridge.js';
import { readFileSync } from 'fs';

class RenderCommand extends Command {
  name = 'render [jsx]';
  description = 'Render JSX in Figma: figma-ds-cli render "<Frame ...>"';

  constructor() {
    super();
    this.options = [
      { flags: '-f, --file <path>', description: 'Read JSX from file' }
    ];
  }

  async execute(ctx, options, jsx) {
    let inputJsx = jsx;

    if (options.file) {
      try {
        inputJsx = readFileSync(options.file, 'utf8');
      } catch (err) {
        ctx.logError(`Failed to read file: ${err.message}`);
        return;
      }
    }

    if (!inputJsx) {
      ctx.logError('Usage: figma-ds-cli render "<Frame ...>" or use -f <file>');
      return;
    }

    const { commands, errors } = parseJSX(inputJsx);

    if (commands.length === 0) {
      ctx.logError('Invalid JSX');
      if (errors.length > 0) {
        console.log('Parse errors:', errors);
      }
      return;
    }

    try {
      const result = await sendBatch(commands);
      if (result && Array.isArray(result.data)) {
        const errors = result.data.filter(r => r.status === 'error');
        if (errors.length > 0) {
          ctx.logError(`Render partially failed with ${errors.length} error(s):`);
          errors.forEach(e => console.error('  -', e.error));
          return;
        }
      }
      ctx.logSuccess('Rendered successfully');
    } catch (err) {
      ctx.logError(`Render failed: ${err.message}`);
    }
  }
}

class RenderBatchCommand extends Command {
  name = 'render batch <jsxArray>';
  description = 'Render multiple JSX frames: render batch \'["<Frame ...>"]\'';

  async execute(ctx, options, jsxArray) {
    if (!jsxArray) {
      ctx.logError('Usage: render batch \'["<Frame ...>", "<Frame ...>"]\'');
      return;
    }

    let items;
    try {
      items = JSON.parse(jsxArray);
    } catch {
      ctx.logError('Invalid JSON array. Wrap JSX strings in a JSON array.');
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      ctx.logError('Provide a non-empty JSON array of JSX strings.');
      return;
    }

    const allCommands = [];
    let treeIndex = 0;
    for (const jsx of items) {
      const { commands, errors } = parseJSX(jsx, `tree_${treeIndex++}_`);
      if (commands.length === 0) {
        ctx.logError(`Invalid JSX: ${jsx.slice(0, 60)}...`);
        if (errors.length > 0) console.log('Parse errors:', errors);
        return;
      }
      allCommands.push(...commands);
    }

    try {
      const result = await sendBatch(allCommands);
      if (result && Array.isArray(result.data)) {
        const errors = result.data.filter(r => r.status === 'error');
        if (errors.length > 0) {
          ctx.logError(`Render batch partially failed with ${errors.length} error(s):`);
          errors.forEach(e => console.error('  -', e.error));
          return;
        }
      }
      ctx.logSuccess(`Rendered ${items.length} frames`);
    } catch (err) {
      ctx.logError(`Render failed: ${err.message}`);
    }
  }
}

export default [new RenderCommand(), new RenderBatchCommand()];