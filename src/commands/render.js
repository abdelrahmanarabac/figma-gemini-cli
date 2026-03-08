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
  name = 'render-batch [jsxArray]';
  description = 'Render multiple JSX frames sequentially';

  constructor() {
    super();
    this.options = [
      { flags: '-f, --file <path>', description: 'Read batch from JSON file' },
      { flags: '-v, --verbose', description: 'Show detailed logs' }
    ];
  }

  async execute(ctx, options, jsxArray) {
    let rawInput = jsxArray;

    if (options.file) {
      try {
        rawInput = readFileSync(options.file, 'utf8');
      } catch (err) {
        ctx.logError(`Failed to read file: ${err.message}`);
        return;
      }
    }

    if (!rawInput) {
      ctx.logError('Usage: render-batch \'["<Frame ...>", "<Frame ...>"]\' or -f <file>');
      return;
    }

    let items;
    try {
      items = JSON.parse(rawInput);
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

class EvalCommand extends Command {
  name = 'eval [code]';
  description = 'Execute JavaScript in Figma';
  needsConnection = true;

  async execute(ctx, options, code) {
    if (!code) {
      ctx.logError('Usage: eval "figma.root.name"');
      return;
    }
    try {
      const result = await ctx.eval(code);
      ctx.logSuccess('Executed', result);
    } catch (err) {
      ctx.logError(`Eval error: ${err.message}`);
    }
  }
}

class FindCommand extends Command {
  name = 'find <query>';
  description = 'Find nodes by name';
  needsConnection = true;

  async execute(ctx, options, query) {
    try {
      const code = `
        const nodes = figma.currentPage.findAll(n => n.name.includes("${query}"));
        return nodes.map(n => ({ id: n.id, name: n.name, type: n.type }));
      `;
      const result = await ctx.eval(code);
      if (result && result.length > 0) {
        ctx.logSuccess(`Found ${result.length} nodes:`, result);
      } else {
        ctx.logWarning('No nodes found.');
      }
    } catch (err) {
      ctx.logError(`Find error: ${err.message}`);
    }
  }
}

class GetCommand extends Command {
  name = 'get <id>';
  description = 'Get node properties';
  needsConnection = true;

  async execute(ctx, options, id) {
    try {
      const code = `
        const n = await figma.getNodeByIdAsync("${id}");
        if (!n) return null;
        return { 
          id: n.id, 
          name: n.name, 
          type: n.type, 
          x: n.x, y: n.y, 
          width: n.width, height: n.height 
        };
      `;
      const result = await ctx.eval(code);
      if (result) {
        ctx.logSuccess('Node info:', result);
      } else {
        ctx.logError(`Node ${id} not found.`);
      }
    } catch (err) {
      ctx.logError(`Get error: ${err.message}`);
    }
  }
}

class NodeCommand extends Command {
  name = 'node <action> [ids...]';
  description = 'Node operations: to-component, delete';
  needsConnection = true;

  async execute(ctx, options, action, ...ids) {
    if (!ids || ids.length === 0) {
      ctx.logError('Usage: node <action> <id1> [id2...]');
      return;
    }

    try {
      let code = '';
      if (action === 'to-component') {
        code = `
          const ids = "${ids.join(',')}".split(',');
          const results = [];
          for (const id of ids) {
            const n = await figma.getNodeByIdAsync(id);
            if (!n) { results.push({ id, error: 'Not found' }); continue; }
            try {
              const comp = figma.createComponent();
              comp.name = n.name;
              comp.resize(n.width, n.height);
              comp.x = n.x; comp.y = n.y;
              if (n.parent) n.parent.appendChild(comp);
              comp.appendChild(n);
              n.x = 0; n.y = 0;
              results.push({ id, componentId: comp.id });
            } catch(e) { results.push({ id, error: e.message }); }
          }
          return results;
        `;
      } else if (action === 'delete') {
        code = `
          const ids = "${ids.join(',')}".split(',');
          const results = [];
          for (const id of ids) {
            const n = await figma.getNodeByIdAsync(id);
            if (n) { n.remove(); results.push({ id, deleted: true }); }
            else { results.push({ id, deleted: false }); }
          }
          return results;
        `;
      } else {
        ctx.logError(`Unknown action: ${action}`);
        return;
      }

      const result = await ctx.eval(code);
      ctx.logSuccess(`Executed ${action}`, result);
    } catch (err) {
      ctx.logError(`Node error: ${err.message}`);
    }
  }
}

export default [
  new RenderCommand(), 
  new RenderBatchCommand(), 
  new EvalCommand(), 
  new FindCommand(), 
  new GetCommand(), 
  new NodeCommand()
];