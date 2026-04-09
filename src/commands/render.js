import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { checkHealth } from '../transport/bridge.js';
import { validateGuardian } from '../pipeline/validate.js';

async function readStdin() {
  if (process.stdin.isTTY) return null;
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim();
}

async function ensurePluginConnection(ctx, wait = false) {
  const check = async () => {
    try {
      const health = await checkHealth();
      return health.status === 'ok' && health.plugin;
    } catch {
      return false;
    }
  };

  if (wait) {
    let spinner;
    if (!ctx.isJson) spinner = ctx.startSpinner('Waiting for Figma plugin connection...');
    for (let i = 0; i < 30; i++) {
      if (await check()) {
        if (spinner) spinner.succeed('Connected to Figma plugin.');
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (spinner) spinner.fail('Connection timeout.');
    ctx.logError('Timed out waiting for Figma plugin to connect.');
    return false;
  }

  if (await check()) {
    return true;
  }

  ctx.logError('Not connected to Figma. Open the FigCli plugin and run "figma-gemini-cli connect".');
  return false;
}

function buildGuardianSummary(report) {
  if (!report) return null;
  return { pass: report.pass, stats: report.stats, violations: report.violations };
}

class RenderCommand extends Command {
  name = 'render [jsx]';
  description = 'Render JSX in Figma via file, string, or stdin';
  needsConnection = false;

  constructor() {
    super();
    this.options = [
      { flags: '-f, --file <path>', description: 'Read JSX from file' },
      { flags: '-c, --code <code>', description: 'Pass JSX as a raw string' },
      { flags: '-d, --dry-run', description: 'Output generated commands without rendering' },
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

    if (options.dryRun) {
      const { compileJSX } = await import('../parser/jsx.js');
      const compileResult = compileJSX(inputJsx);
      const { commands, ast, diagnostics, metadata } = compileResult;
      let guardianSummary = null;

      // Guardian validation (direct function call)
      try {
        const report = validateGuardian(commands);
        guardianSummary = buildGuardianSummary(report);
        if (report.violations.length > 0) {
          if (!ctx.isJson) {
            console.log(`\n  Guardian: ${report.stats.errors} errors, ${report.stats.warnings} warnings, ${report.stats.info} info`);
            report.violations.forEach(v => {
              const icon = v.severity === 'error' ? '[X]' : v.severity === 'warning' ? '[!]' : '[i]';
              console.log(`    ${icon} [${v.ruleId}] ${v.nodeName}: ${v.message}`);
            });
            console.log('');
          }
        } else {
          if (!ctx.isJson) {
            console.log('  Guardian: All rules passed ✓\n');
          }
        }
      } catch { /* Guardian is optional, don't block dry-run */ }

      const payload = {
        status: 'success',
        dryRun: true,
        compiler: { ok: compileResult.ok, diagnostics, metadata, ast },
        commands,
        guardian: guardianSummary,
      };

      const blockingDiagnostics = diagnostics.filter(d => d.severity === 'error');
      if (blockingDiagnostics.length > 0) {
        process.exitCode = 1;
        ctx.logError('JSX compilation failed during dry-run.', { ...payload, status: 'error', blockingDiagnostics });
        return;
      }

      if (ctx.isJson) {
        ctx.logSuccess('Dry-run complete. Commands:', payload);
      } else {
        ctx.logSuccess('Dry-run complete. Commands:');
        console.log(JSON.stringify(commands, null, 2));
      }
      return;
    }

    try {
      // Guardian pre-render validation (direct function call)
      let preCompiledCommands = null;
      if (options.validate !== false) {
        try {
          const { compileJSX } = await import('../parser/jsx.js');
          const compileResult = compileJSX(inputJsx);
          const { commands, diagnostics, metadata, ast } = compileResult;
          preCompiledCommands = commands;
          const blockingDiagnostics = diagnostics.filter(d => d.severity === 'error');

          if (blockingDiagnostics.length > 0) {
            process.exitCode = 1;
            ctx.logError('JSX compilation failed.', {
              status: 'error',
              compiler: { ok: compileResult.ok, diagnostics, metadata, ast },
              blockingDiagnostics,
            });
            return;
          }

          if (commands.length > 0) {
            const report = validateGuardian(commands);
            if (report.stats.errors > 0) {
              process.exitCode = 1;
              ctx.logError(`Guardian blocked render with ${report.stats.errors} error(s).`);
              report.violations
                .filter(v => v.severity === 'error')
                .forEach(v => ctx.logError(`  [${v.ruleId}] ${v.nodeName}: ${v.message}`));
              return;
            }
            if (options.verbose && report.stats.warnings > 0) {
              report.violations
                .filter(v => v.severity === 'warning')
                .forEach(v => ctx.logWarning(`  [${v.ruleId}] ${v.nodeName}: ${v.message}`));
            }
          }
        } catch { /* Guardian errors don't block rendering */ }
      }

      const connected = await ensurePluginConnection(ctx);
      if (!connected) {
        process.exitCode = 1;
        return;
      }

      let result;
      if (options.validate !== false && preCompiledCommands) {
        result = await ctx.renderCompiled(preCompiledCommands);
      } else {
        result = await ctx.render(inputJsx);
      }

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
      ctx.logError('Usage: render-batch \'["<Frame ...>", "<Frame ...>"]\'  or -f <file>');
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
      const payload = { rendered: items.length, results: results || null };

      if (ctx.isJson) {
        ctx.logSuccess(`Rendered ${items.length} frames`, payload);
      } else {
        ctx.logSuccess(`Rendered ${items.length} frames`);
        if (options.verbose && results) {
          console.log(results);
        }
      }
    } catch (err) {
      ctx.logError(`Batch render error: ${err.message}`);
    }
  }
}

class EvalCommand extends Command {
  name = 'eval [code]';
  description = 'Execute JavaScript in Figma (supports --op for safe operations)';
  needsConnection = true;
  options = [
    { flags: '--op <operation>', description: 'Use a safe eval operation instead of raw code' },
    { flags: '--args <json>', description: 'JSON arguments for the operation' }
  ];

  async execute(ctx, options, code) {
    // Operation-based eval (safe, CSP-compliant)
    if (options.op) {
      let args = {};
      if (options.args) {
        try {
          const cleanArgs = String(options.args).trim();
          args = JSON.parse(cleanArgs);
        } catch (e) {
          // Attempt simple fix for PowerShell's quote-stripping: {key: val} -> {"key": "val"}
          try {
            const fixed = String(options.args)
              .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Quote keys
              .replace(/:\s*([^"{\[\d][^,}]+)\s*([,}])/g, ':"$1"$2'); // Quote values if not number/object
            args = JSON.parse(fixed);
          } catch (inner) {
            ctx.logError(`Invalid JSON for --args: ${e.message}`, { raw: options.args });
            return;
          }
        }
      }
      try {
        const result = await ctx.evalOp(options.op, args);
        ctx.logSuccess(`Operation '${options.op}' executed`, result);
      } catch (err) {
        ctx.logError(`Operation failed: ${err.message}`);
      }
      return;
    }

    // Legacy code-based eval — routed through script.run operation
    let inputCode = code;
    if (!inputCode) {
      inputCode = await readStdin();
    }

    if (!inputCode) {
      ctx.logError('Usage: eval "code" or eval --op <operation> [--args <json>]');
      return;
    }
    try {
      const result = await ctx.evalOp('script.run', { code: inputCode });
      if (result && result.error) {
        ctx.logError(`Eval error: ${result.error}`);
      } else {
        ctx.logSuccess('Executed', result);
      }
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
      const result = await ctx.evalOp('node.find', { query });
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
  name = 'get [id]';
  description = 'Get node properties (defaults to selection)';
  needsConnection = true;

  async execute(ctx, options, id) {
    try {
      let result;
      if (id && id !== "undefined") {
        result = await ctx.evalOp('node.find.byId', { id });
      } else {
        const sel = await ctx.evalOp('node.selection');
        result = sel && sel.length > 0 ? sel[0] : null;
      }
      if (result && !result.error) {
        ctx.logSuccess('Node info:', result);
      } else {
        ctx.logError(id ? `Node ${id} not found.` : 'No node selected.');
      }
    } catch (err) {
      ctx.logError(`Get error: ${err.message}`);
    }
  }
}

class InspectCommand extends Command {
  name = 'inspect [id]';
  description = 'Deep inspect a node and return JSX (defaults to selection)';
  needsConnection = true;

  async execute(ctx, options, id) {
    try {
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.inspect', { id });

      if (result && result.data) {
        function toJSX(node, indent = '') {
          const typeMap = {
            FRAME: 'Frame',
            RECTANGLE: 'Rectangle',
            ELLIPSE: 'Ellipse',
            TEXT: 'Text',
            LINE: 'Line',
            SVG: 'SVG'
          };
          const tag = typeMap[node.type] || 'Frame';

          let propEntries = Object.entries(node.props).filter(([k, v]) => v !== undefined && k !== 'text');

          if (node.type === 'SVG' && node.props.content) {
            propEntries = propEntries.filter(([k]) => k !== 'content');
          }

          propEntries.sort(([ak], [bk]) => {
            if (ak === 'id') return -1;
            if (bk === 'id') return 1;
            return 0;
          });

          let props = propEntries
            .map(([k, v]) => {
              if (typeof v === 'string') return `${k}={${JSON.stringify(v)}}`;
              return `${k}={${JSON.stringify(v)}}`;
            })
            .join(' ');

          if (node.type === 'TEXT' && node.props.text) {
             const text = node.props.text;
             return `${indent}<${tag}${props ? ' ' + props : ''}>${text}</${tag}>`;
          }

          if (node.type === 'SVG' && node.props.content) {
             return `${indent}<${tag}${props ? ' ' + props : ''} content={${node.props.content}} />`;
          }

          if (node.children && node.children.length > 0) {
            const childJSX = node.children.map(c => toJSX(c, indent + '  ')).join('\n');
            return `${indent}<${tag}${props ? ' ' + props : ''}>\n${childJSX}\n${indent}</${tag}>`;
          }
          return `${indent}<${tag}${props ? ' ' + props : ''} />`;
        }

        const jsxString = toJSX(result.data);
        if (ctx.isJson) {
          ctx.logSuccess(`JSX Representation (${result.data.props.name}) — Analysis complete:`, {
            id: id || null,
            name: result.data.props.name,
            jsx: jsxString,
            node: result.data,
          });
        } else {
          ctx.logSuccess(`JSX Representation (${result.data.props.name}) — Analysis complete:`);
          console.log('\n' + jsxString);
        }
      } else {
        ctx.logError(id ? `Node ${id} not found.` : 'No node selected.');
      }
    } catch (err) {
      ctx.logError(`Inspect error: ${err.message}`);
    }
  }
}

class UpdateCommand extends Command {
  name = 'update [id] [jsx]';
  description = 'Update an existing node and its children using JSX (defaults to selection)';
  needsConnection = true;

  async execute(ctx, options, id, jsx) {
    let targetId = id;
    let inputJsx = jsx;

    if (id && !jsx && id.includes('<')) {
       inputJsx = id;
       targetId = 'selected';
    }

    if (!targetId || targetId === 'selected') {
       const sel = await ctx.evalOp('node.selection');
       targetId = sel && sel.length > 0 ? sel[0].id : null;
    }

    if (!targetId || !inputJsx) {
      ctx.logError('Usage: update [id] "<Frame prop={val} />"');
      return;
    }

    try {
      const { compileJSX } = await import('../parser/jsx.js');
      const compileResult = compileJSX(inputJsx);
      const { commands, diagnostics } = compileResult;

      if (commands.length === 0) {
         ctx.logError('Invalid JSX.');
         return;
      }

      const blockingDiagnostics = diagnostics.filter(d => d.severity === 'error');
      if (blockingDiagnostics.length > 0) {
        process.exitCode = 1;
        ctx.logError('JSX compilation failed.', {
          status: 'error',
          compiler: { ok: compileResult.ok, diagnostics },
          blockingDiagnostics,
        });
        return;
      }

      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.update', {
        id: targetId,
        props: commands[0].params.props,
        batch: commands
      });

      if (result && result.data && result.data.status === 'updated') {
         ctx.logSuccess(`Node ${targetId} updated successfully`);
      } else {
         ctx.logError(`Update failed for node ${targetId}`);
      }
    } catch (err) {
      ctx.logError(`Update error: ${err.message}`);
    }
  }
}

class NodeCommand extends Command {
  name = 'node <action> [ids...]';
  description = 'Node operations: to-component, delete (defaults to selection)';
  needsConnection = true;

  async execute(ctx, options, action, ...ids) {
    let targetIds = ids;
    if (action !== 'autolayout' && (!targetIds || targetIds.length === 0)) {
      const sel = await ctx.evalOp('node.selection');
      if (sel) targetIds = sel.map(n => n.id);
    }

    if (!targetIds || targetIds.length === 0) {
      ctx.logError('Usage: node <action> [id1] [id2...] (or select nodes in Figma)');
      return;
    }

    try {
      if (action === 'to-component') {
        const results = [];
        for (const id of targetIds) {
          const res = await ctx.evalOp('node.to_component', { id });
          results.push(res);
        }
        ctx.logSuccess(`Executed ${action}`, results);
      } else if (action === 'delete') {
        const results = [];
        for (const id of targetIds) {
          const res = await ctx.evalOp('node.delete', { id });
          results.push(res);
        }
        ctx.logSuccess(`Executed ${action}`, results);
      } else if (action === 'autolayout') {
        const mode = targetIds.pop();
        if (!mode || !['row', 'col', 'none'].includes(mode)) {
          ctx.logError('Usage: node autolayout <id> <row|col|none>');
          return;
        }
        
        let applyIds = targetIds;
        if (applyIds.length === 0) {
          const sel = await ctx.evalOp('node.selection');
          if (sel) applyIds = sel.map(n => n.id);
        }

        const results = [];
        for (const id of applyIds) {
          const res = await ctx.evalOp('node.setAutoLayout', { id, mode });
          results.push(res);
        }
        ctx.logSuccess(`Executed autolayout config`, results);
      } else {
        ctx.logError(`Unknown action: ${action}`);
        return;
      }
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
  new InspectCommand(),
  new UpdateCommand(),
  new NodeCommand()
];
