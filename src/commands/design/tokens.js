import { Command } from '../../cli/command.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';

const CONFIG_DIR = join(homedir(), '.figma-cli');
const WORKFLOW_PATH = join(CONFIG_DIR, 'current_workflow.json');

function loadWorkflow() {
  if (!existsSync(WORKFLOW_PATH)) return null;
  return JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
}

function saveWorkflow(data) {
  writeFileSync(WORKFLOW_PATH, JSON.stringify(data, null, 2));
}

class DesignTokensCommand extends Command {
  name = 'design tokens';
  description = 'Configure design system tokens (Colors, Spacing, Radii)';
  needsConnection = false;

  async execute(ctx) {
    const workflow = loadWorkflow();
    if (!workflow || workflow.stage !== 'Design System') {
      ctx.logError('Please complete `design architecture` first.');
      return;
    }

    ctx.log('Configuring Design System Tokens...');

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'palette',
        message: 'Select a base color palette:',
        choices: ['Tailwind Default', 'Shadcn/UI', 'Radix UI', 'Custom Hex Codes']
      },
      {
        type: 'list',
        name: 'roundness',
        message: 'Standard corner radius (rounding):',
        choices: [
          { name: 'Sharp (0px)', value: 0 },
          { name: 'Subtle (4px)', value: 4 },
          { name: 'Standard (8px)', value: 8 },
          { name: 'Modern (12px)', value: 12 },
          { name: 'Extra Rounded (24px)', value: 24 }
        ]
      },
      {
        type: 'confirm',
        name: 'darkMode',
        message: 'Include Dark Mode tokens?',
        default: true
      }
    ]);

    workflow.tokens = answers;
    workflow.stage = 'UI Generation';
    workflow.timestamp = new Date().toISOString();
    saveWorkflow(workflow);

    const payload = {
      success: true,
      stage: workflow.stage,
      tokens: answers,
      timestamp: workflow.timestamp,
      nextStep: 'Run `design generate` to build the UI in Figma.',
    };

    ctx.logSuccess('Design System Configured.', payload);
    if (!ctx.isJson) {
      ctx.log('Workflow Ready: Run `design generate` to build the UI in Figma.');
    }
  }
}

export default new DesignTokensCommand();
