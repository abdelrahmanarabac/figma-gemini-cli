import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { ensurePluginConnection } from '../utils/connection.js';

async function readStdin() {
  if (process.stdin.isTTY) return null;
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim();
}

function buildGuardianSummary(report) {
  if (!report) return null;
  return {
    pass: report.pass,
    stats: report.stats,
    violations: report.violations,
  };
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

      // ── Guardian Pre-Validation ──
      try {
        const { orchestrator } = await ctx.getAgents();
        const guardian = orchestrator.experts.find(e => e.name === 'guardian');
        if (guardian) {
          const report = guardian.validate(commands);
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
        }
      } catch { /* Guardian is optional, don't block dry-run */ }

      const payload = {
        status: 'success',
        dryRun: true,
        compiler: {
          ok: compileResult.ok,
          diagnostics,
          metadata,
          ast,
        },
        commands,
        guardian: guardianSummary,
      };

      const blockingDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
      if (blockingDiagnostics.length > 0) {
        process.exitCode = 1;
        ctx.logError('JSX compilation failed during dry-run.', {
          ...payload,
          status: 'error',
          blockingDiagnostics,
        });
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
      // ── Guardian Middleware (pre-render validation) ──
      if (options.validate !== false) {
        try {
          const { compileJSX } = await import('../parser/jsx.js');
          const compileResult = compileJSX(inputJsx);
          const { commands, diagnostics, metadata, ast } = compileResult;
          const blockingDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error');

          if (blockingDiagnostics.length > 0) {
            process.exitCode = 1;
            ctx.logError('JSX compilation failed.', {
              status: 'error',
              compiler: {
                ok: compileResult.ok,
                diagnostics,
                metadata,
                ast,
              },
              blockingDiagnostics,
            });
            return;
          }

          const { orchestrator } = await ctx.getAgents();
          const guardian = orchestrator.experts.find(e => e.name === 'guardian');
          if (guardian && commands.length > 0) {
            const report = guardian.validate(commands);
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
      const payload = {
        rendered: items.length,
        results: results || null,
      };

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
  description = 'Execute JavaScript in Figma';
  needsConnection = true;

  async execute(ctx, options, code) {
    let inputCode = code;
    if (!inputCode) {
      inputCode = await readStdin();
    }

    if (!inputCode) {
      ctx.logError('Usage: eval "figma.root.name" or pipe into stdin');
      return;
    }
    try {
      const result = await ctx.eval(inputCode);
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
        const query = ${JSON.stringify(query)};
        const nodes = figma.currentPage.findAll(n => n.name.includes(query));
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
  name = 'get [id]';
  description = 'Get node properties (defaults to selection)';
  needsConnection = true;

  async execute(ctx, options, id) {
    try {
      // ── MoE Pipeline ──────────────────────────────
      const { orchestrator } = await ctx.getAgents();
      const pipelineResult = await orchestrator.execute(ctx, `get ${id || 'selected'}`);
      
      const analyzerResult = pipelineResult.results?.analyzer;
      if (analyzerResult && analyzerResult.success) {
        ctx.logSuccess('Node info (MoE):', analyzerResult.data.analysis);
        return;
      }

      // ── Legacy Fallback ───────────────────────────
      const code = `
        let n;
        const id = ${JSON.stringify(id)};
        if (id && id !== "undefined") {
          n = await figma.getNodeByIdAsync(id);
        } else {
          n = figma.currentPage.selection[0];
        }
        
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
      // ── MoE Pipeline ──────────────────────────────
      const { orchestrator } = await ctx.getAgents();
      const pipelineResult = await orchestrator.execute(ctx, `inspect ${id || 'selected'}`);

      // If MoE pipeline produced a result, use it. 
      // Note: Current agents might need more logic to return full JSX.
      // For now, we use MoE for intent, but keep the robust logic here.

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
          
          // For SVG, we handle content specially
          if (node.type === 'SVG' && node.props.content) {
            propEntries = propEntries.filter(([k]) => k !== 'content');
          }

          // Prioritize ID
          propEntries.sort(([ak], [bk]) => {
            if (ak === 'id') return -1;
            if (bk === 'id') return 1;
            return 0;
          });

          let props = propEntries
            .map(([k, v]) => {
              // Wrap ALL values in curly braces as per GEMINI.md mandate
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

    // Handle shift if only one arg provided
    if (id && !jsx && id.includes('<')) {
       inputJsx = id;
       targetId = 'selected';
    }

    if (!targetId || targetId === 'selected') {
       const selCode = `return figma.currentPage.selection[0]?.id`;
       targetId = await ctx.eval(selCode);
    }

    if (!targetId || !inputJsx) {
      ctx.logError('Usage: update [id] "<Frame prop={val} />"');
      return;
    }

    try {
      // ── MoE Pipeline ──────────────────────────────
      const { orchestrator } = await ctx.getAgents();
      const pipelineResult = await orchestrator.execute(ctx, `update ${targetId} with ${inputJsx}`);

      const { compileJSX } = await import('../parser/jsx.js');
      const compileResult = compileJSX(inputJsx);
      const { commands, diagnostics, metadata, ast } = compileResult;
      
      if (commands.length === 0) {
         ctx.logError('Invalid JSX.');
         return;
      }

      const blockingDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
      if (blockingDiagnostics.length > 0) {
        process.exitCode = 1;
        ctx.logError('JSX compilation failed.', {
          status: 'error',
          compiler: {
            ok: compileResult.ok,
            diagnostics,
            metadata,
            ast,
          },
          blockingDiagnostics,
        });
        return;
      }

      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.update', { 
        id: targetId, 
        props: commands[0].params.props,
        batch: commands // Send the whole command list for recursive updates
      });
      
      if (result && result.data && result.data.status === 'updated') {
         ctx.logSuccess(`Node ${targetId} and children updated successfully (MoE validated)`);
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
    if (!targetIds || targetIds.length === 0) {
      const selCode = `return figma.currentPage.selection.map(n => n.id)`;
      targetIds = await ctx.eval(selCode);
    }

    if (!targetIds || targetIds.length === 0) {
      ctx.logError('Usage: node <action> [id1] [id2...] (or select nodes in Figma)');
      return;
    }

    try {
      let code = '';
      if (action === 'to-component') {
        code = `
          const ids = "${targetIds.join(',')}".split(',');
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
          const ids = "${targetIds.join(',')}".split(',');
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
  new InspectCommand(),
  new UpdateCommand(),
  new NodeCommand()
];
