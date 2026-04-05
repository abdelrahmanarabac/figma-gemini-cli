import { Command } from '../../cli/command.js';
import { runGenerate } from '../generate.js';
import { buildWorkflowGenerationBrief, loadWorkflow, pickWorkflowScreen, saveWorkflow } from '../../utils/design-workflow.js';

class DesignGenerateCommand extends Command {
  name = 'design generate [description]';
  description = 'Generate the primary workflow screen from the design brief';
  needsConnection = false;

  constructor() {
    super();
    this.options = [
      { flags: '--screen <name>', description: 'Focus generation on a specific workflow screen' },
      { flags: '-v, --verbose', description: 'Show full MoE pipeline trace' },
      { flags: '--mode <mode>', description: 'Theme mode: Light or Dark', defaultValue: 'Light' },
      { flags: '--dry-run', description: 'Show pipeline results without rendering' },
      { flags: '-i, --interactive', description: 'Prompt for preflight decisions' },
      { flags: '--use-existing-tokens', description: 'Prefer reusing tokens already found in the file' },
      { flags: '--no-use-existing-tokens', description: 'Do not reuse existing tokens from the file' },
      { flags: '--use-existing-components', description: 'Prefer reusing matching local components' },
      { flags: '--no-use-existing-components', description: 'Do not reuse existing local components' },
      { flags: '--create-missing-tokens', description: 'Generate missing token scaffolds when reusable tokens are not enough' },
      { flags: '--no-create-missing-tokens', description: 'Do not generate missing token scaffolds' },
      { flags: '-w, --wait', description: 'Wait up to 30s for the Figma plugin to connect' },
    ];
  }

  async execute(ctx, options, description) {
    const workflow = loadWorkflow();
    if (!workflow || workflow.stage !== 'UI Generation') {
      ctx.logError('Please complete `design start`, `design architecture`, and `design tokens` first.');
      return;
    }

    const targetScreen = pickWorkflowScreen(workflow, options.screen);
    const generatedDescription = buildWorkflowGenerationBrief(workflow, {
      screen: options.screen,
      description,
    });

    if (!description && !targetScreen) {
      ctx.logError('The active workflow has no screens yet. Run `design architecture` first.');
      return;
    }

    workflow.lastGeneratedAt = new Date().toISOString();
    workflow.lastGeneratedScreen = targetScreen;
    workflow.lastGenerationPrompt = generatedDescription;
    saveWorkflow(workflow);

    const generateOptions = { ...options, forceGenerate: true };
    if (
      generateOptions.mode === 'Light' &&
      workflow.tokens?.darkMode &&
      /dark/i.test(workflow.discovery?.aesthetic || '')
    ) {
      generateOptions.mode = 'Dark';
    }

    await runGenerate(ctx, generateOptions, generatedDescription);
  }
}

export default new DesignGenerateCommand();
