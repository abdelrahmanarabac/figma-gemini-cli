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
      const payload = {
        page: result?.page || null,
        selection,
        selectionCount: selection.length,
      };

      if (selection.length === 0) {
        ctx.output(
          { ...payload, message: 'No nodes are currently selected in Figma.' },
          () => ctx.logWarning('No nodes are currently selected in Figma.')
        );
        return;
      }

      ctx.output(payload, () => {
        console.log(chalk.cyan('\n  Current Selection:\n'));
        selection.forEach((node, i) => {
          console.log(chalk.white(`    ${i + 1}. [${node.type}] ${chalk.bold(node.name)}`));
          console.log(chalk.gray(`       ID: ${node.id}`));
          console.log(chalk.gray(`       Size: ${node.width}x${node.height} | Pos: ${node.x}, ${node.y}\n`));
        });

        console.log(chalk.gray(`  Page: ${result.page.name} (${result.page.id})\n`));
      });
    } catch (err) {
      ctx.logError(`Failed to read canvas info: ${err.message}`);
    }
  }
}

export default [new CanvasInfoCommand()];
