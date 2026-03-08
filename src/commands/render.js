import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';

async function readStdin() {
  if (process.stdin.isTTY) return null;
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim();
}

class RenderCommand extends Command {
  name = 'render [jsx]';
  description = 'Render JSX in Figma via file, string, or stdin';

  constructor() {
    super();
    this.options = [
      { flags: '-f, --file <path>', description: 'Read JSX from file' },
      { flags: '-c, --code <code>', description: 'Pass JSX as a raw string' },
      { flags: '-v, --verbose', description: 'Show detailed logs' }
    ];
  }

  async execute(ctx, options, jsx) {
    let inputJsx = jsx;

    if (options.code) {
      inputJsx = options.code;
    } else if (options.file) {
      try {
        inputJsx = readFileSync(options.file, 'utf8');
      } catch (err) {
        ctx.logError(`Failed to read file: ${err.message}`);
        return;
      }
    } else if (!inputJsx) {
      inputJsx = await readStdin();
    }

    if (!inputJsx) {
      ctx.logError('No JSX provided. Use -f <file>, -c "<code>", or pipe into stdin.');
      return;
    }

    try {
      const result = await ctx.render(inputJsx);
      if (result && result.error) {
         ctx.logError(`Render failed: ${result.error}`);
      } else {
         ctx.logSuccess('Rendered successfully');
      }
    } catch (err) {
      ctx.logError(`Render error: ${err.message}`);
    }
  }
}

class RenderBatchCommand extends Command {
  name = 'render-batch <jsxArray>';
  description = 'Render multiple JSX frames sequentially';

  constructor() {
    super();
    this.options = [
      { flags: '-v, --verbose', description: 'Show detailed logs' }
    ];
  }

  async execute(ctx, options, jsxArray) {
    if (!jsxArray) {
      ctx.logError('Usage: render-batch \'["<Frame ...>", "<Frame ...>"]\'');
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

    try {
      const { parseJSX } = await import('../parser/jsx.js');
      const allCommands = [];
      for (const jsx of items) {
        const { commands } = parseJSX(jsx);
        allCommands.push(...commands);
      }
      
      const { sendBatch } = await import('../transport/bridge.js');
      const results = await sendBatch(allCommands);
      
      ctx.logSuccess(`Rendered ${items.length} frames`);
      if (options.verbose && results) {
          console.log(results);
      }
    } catch (err) {
      ctx.logError(`Batch render error: ${err.message}`);
    }
  }
}

export default [new RenderCommand(), new RenderBatchCommand()];