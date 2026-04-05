import { Command } from '../../cli/command.js';
import chalk from 'chalk';
import { loadWorkflow } from '../../utils/design-workflow.js';

class DesignStatusCommand extends Command {
  name = 'design status';
  description = 'Check the status of the current design workflow';
  needsConnection = false;

  async execute(ctx) {
    const workflow = loadWorkflow();
    if (!workflow) {
      ctx.logWarning('No active workflow. Start one with `design start`.', {
        active: false,
        message: 'No active workflow. Start one with `design start`.',
      });
      return;
    }

    const payload = {
      active: true,
      stage: workflow.stage,
      product: workflow.discovery?.productType || 'Unknown',
      screens: workflow.architecture?.screens || [],
      timestamp: workflow.timestamp,
    };

    ctx.output(payload, () => {
      console.log(chalk.cyan('\n  Current Design Workflow Status:'));
      console.log(chalk.white(`    Stage:     ${chalk.bold(workflow.stage)}`));
      console.log(chalk.white(`    Product:   ${workflow.discovery?.productType || 'Unknown'}`));
      if (workflow.architecture) {
        console.log(chalk.white(`    Screens:   ${workflow.architecture.screens.join(', ')}`));
      }
      console.log(chalk.gray(`    Last updated: ${new Date(workflow.timestamp).toLocaleString()}\n`));
    });
  }
}

export default new DesignStatusCommand();
