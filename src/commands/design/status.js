import { Command } from '../../cli/command.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const CONFIG_DIR = join(homedir(), '.figma-cli');
const WORKFLOW_PATH = join(CONFIG_DIR, 'current_workflow.json');

function loadWorkflow() {
  if (!existsSync(WORKFLOW_PATH)) return null;
  return JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
}

class DesignStatusCommand extends Command {
  name = 'design status';
  description = 'Check the status of the current design workflow';

  async execute(ctx) {
    const workflow = loadWorkflow();
    if (!workflow) {
      ctx.logWarning('No active workflow. Start one with `design start`.');
      return;
    }

    console.log(chalk.cyan('\n  Current Design Workflow Status:'));
    console.log(chalk.white(`    Stage:     ${chalk.bold(workflow.stage)}`));
    console.log(chalk.white(`    Product:   ${workflow.discovery?.productType || 'Unknown'}`));
    if (workflow.architecture) {
      console.log(chalk.white(`    Screens:   ${workflow.architecture.screens.join(', ')}`));
    }
    console.log(chalk.gray(`    Last updated: ${new Date(workflow.timestamp).toLocaleString()}\n`));
  }
}

export default new DesignStatusCommand();
