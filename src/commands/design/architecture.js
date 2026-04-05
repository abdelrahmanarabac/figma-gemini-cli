import { Command } from '../../cli/command.js';
import inquirer from 'inquirer';
import { loadWorkflow, saveWorkflow } from '../../utils/design-workflow.js';

class DesignArchitectureCommand extends Command {
  name = 'design architecture';
  description = 'Define the product architecture and user flow';
  needsConnection = false;

  async execute(ctx) {
    const workflow = loadWorkflow();
    if (!workflow || (workflow.stage !== 'Architecture' && workflow.stage !== 'Design System')) {
      ctx.logError('Please complete `design start` first.');
      return;
    }

    ctx.log(`Architecture Stage for project: ${workflow.discovery?.productType || 'Unknown'}`);

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'screens',
        message: 'Which core screens/pages are needed?',
        choices: [
          'Onboarding/Login',
          'Dashboard/Overview',
          'User Profile',
          'Settings',
          'Analytics/Reports',
          'Inventory/Data List',
          'Detail View',
          'Support/Help'
        ],
        validate: val => val.length > 0 || 'Select at least one screen.'
      },
      {
        type: 'list',
        name: 'navigation',
        message: 'Choose a navigation pattern:',
        choices: ['Sidebar (Left)', 'Top Navigation', 'Bottom Tabs (Mobile)', 'Hybrid']
      }
    ]);

    workflow.architecture = answers;
    workflow.stage = 'Design System';
    workflow.timestamp = new Date().toISOString();
    saveWorkflow(workflow);

    const payload = {
      success: true,
      stage: workflow.stage,
      architecture: answers,
      timestamp: workflow.timestamp,
      nextStep: 'Run `design tokens` to setup the design system.',
    };

    ctx.logSuccess('Architecture Defined.', payload);
    if (!ctx.isJson) {
      ctx.log('Next: Run `design tokens` to setup the design system.');
    }
  }
}

export default new DesignArchitectureCommand();
