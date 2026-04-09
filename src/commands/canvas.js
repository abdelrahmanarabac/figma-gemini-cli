import { Command } from '../cli/command.js';
import chalk from 'chalk';

class CanvasInfoCommand extends Command {
  name = 'canvas info';
  description = 'View current selection and canvas details';
  needsConnection = true;

  async execute(ctx) {
    try {
      const result = await ctx.evalOp('canvas.info');
      const selection = result?.selection || [];
      const frames = result?.frames || [];
      const payload = {
        page: result?.page || null,
        selection,
        selectionCount: selection.length,
        frames,
        frameCount: frames.length,
      };

      if (selection.length === 0 && frames.length === 0) {
        ctx.output(
          { ...payload, message: 'No nodes selected and no frames found on this page.' },
          () => ctx.logWarning('No nodes are currently selected in Figma.')
        );
        return;
      }

      ctx.output(payload, () => {
        if (frames.length > 0) {
          console.log(chalk.cyan('\n  Page Frames:\n'));
          frames.forEach((f, i) => {
            console.log(chalk.white(`    ${i + 1}. [${f.type}] ${chalk.bold(f.name)}`));
            console.log(chalk.gray(`       ID: ${f.id}`));
            console.log(chalk.gray(`       Size: ${f.width}x${f.height} | Pos: ${f.x}, ${f.y}\n`));
          });
        }

        if (selection.length > 0) {
          console.log(chalk.cyan('\n  Current Selection:\n'));
          selection.forEach((node, i) => {
            console.log(chalk.white(`    ${i + 1}. [${node.type}] ${chalk.bold(node.name)}`));
            console.log(chalk.gray(`       ID: ${node.id}`));
            console.log(chalk.gray(`       Size: ${node.width}x${node.height} | Pos: ${node.x}, ${node.y}\n`));
          });
        }

        console.log(chalk.gray(`  Page: ${result.page.name} (${result.page.id})\n`));
      });
    } catch (err) {
      ctx.logError(`Failed to read canvas info: ${err.message}`);
    }
  }
}

class CanvasSelectCommand extends Command {
  name = 'select <queries...>';
  description = 'Select one or more nodes in Figma by ID or Name';
  needsConnection = true;

  async execute(ctx, options, queries) {
    // queries will be an array since we used <queries...>
    if (!queries || queries.length === 0) {
      ctx.logError('No IDs or Names provided.');
      return;
    }

    const spinner = ctx.startSpinner(`Selecting nodes: ${queries.join(', ')}...`);
    try {
      const targetIds = [];
      for (const query of queries) {
        // Handle comma-separated lists if they passed it as one string "id1, id2"
        const subQueries = query.includes(',') ? query.split(',').map(s => s.trim()) : [query];
        
        for (const q of subQueries) {
          // 1. Try resolving as ID directly first
          const nodeInfo = await ctx.evalOp('node.find.byId', { id: q });
          if (nodeInfo && nodeInfo.id && !nodeInfo.error) {
            targetIds.push(nodeInfo.id);
          } else {
            // 2. Try finding by name
            const search = await ctx.evalOp('node.find', { query: q });
            if (search && search.length > 0) {
              targetIds.push(search[0].id);
            } else {
              ctx.logWarning(`Could not find node matching: ${q}`);
            }
          }
        }
      }

      if (targetIds.length === 0) {
        throw new Error('No valid nodes found to select.');
      }

      const result = await ctx.evalOp('node.setSelection', { ids: targetIds });
      if (result.error) throw new Error(result.error);

      spinner.succeed(`Selected ${result.count} node(s).`);
    } catch (err) {
      spinner.fail(`Failed to select nodes: ${err.message}`);
    }
  }
}

class SelectionDetailsCommand extends Command {
  name = 'selection info';
  description = 'Show detailed info for selected nodes including page context';
  needsConnection = true;

  async execute(ctx) {
    try {
      const result = await ctx.evalOp('selection.details');
      const sel = result?.selection || [];

      ctx.output({ selection: sel, currentPage: result?.currentPage }, () => {
        if (sel.length === 0) {
          console.log(chalk.yellow('\n  [!] No nodes selected.\n'));
          return;
        }
        console.log(chalk.cyan('\n  Selection Details:\n'));
        sel.forEach((n, i) => {
          console.log(chalk.white(`    ${i + 1}. [${n.type}] ${chalk.bold(n.name)}`));
          console.log(chalk.gray(`       ID: ${n.id}`));
          if (n.page) console.log(chalk.gray(`       Page: ${n.page.name} (${n.page.id})`));
          console.log('');
        });
        console.log(chalk.gray(`  Current Page: ${result.currentPage.name} (${result.currentPage.id})\n`));
      });
    } catch (err) {
      ctx.logError(`Failed to read selection details: ${err.message}`);
    }
  }
}

export default [new CanvasInfoCommand(), new CanvasSelectCommand(), new SelectionDetailsCommand()];
