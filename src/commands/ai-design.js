import { Command } from '../cli/command.js';
import { parseJSX } from '../parser/jsx.js';
import { sendBatch, checkHealth } from '../transport/bridge.js';
import { generateDesign } from '../core/aiClient.js';
import { sanitizeGeminiPayload } from '../utils/sanitizer.js';
import { validateCommand } from '../protocol/commands.js';
import chalk from 'chalk';

class AiDesignCommand extends Command {
  name = 'ai <prompt...>';
  description = 'AI-powered design generation: figma-gemini-cli ai "prompt"';
  needsConnection = false;
  options = [
    { flags: '--plan', description: 'Preview JSX without executing' },
    { flags: '--skip-confirm', description: 'Skip confirmation, execute immediately' },
  ];

  async execute(ctx, options, ...promptParts) {
    const prompt = promptParts.join(' ');

    if (!prompt) {
      ctx.logError('Usage: figma-gemini-cli ai "create a product card"');
      return;
    }

    // Step 1: Check daemon (unless --plan)
    if (!options.plan) {
      const health = await checkHealth();
      if (health.status === 'unreachable') {
        ctx.logError('Daemon not running. Start with: figma-gemini-cli connect');
        return;
      }
      if (!health.plugin && !health.cdp) {
        ctx.logError('Plugin not connected. Open FigCli plugin in Figma.');
        return;
      }
    }

    // Step 2: AI generates raw JSX
    console.log(chalk.blue('  [OK] Generating design...'));
    let rawOutput;
    try {
      rawOutput = await generateDesign(prompt);
    } catch (err) {
      ctx.logError(`AI generation failed: ${err.message}`);
      return;
    }

    // Step 3: Sanitize — strip markdown, validate shape
    let jsxCode;
    try {
      jsxCode = sanitizeGeminiPayload(rawOutput);
    } catch (err) {
      ctx.logError(`Sanitization failed: ${err.message}`);
      console.log(chalk.gray('\n  Raw AI output (first 500 chars):'));
      console.log(chalk.gray('  ' + (rawOutput || '').slice(0, 500)));
      return;
    }

    // Step 4: Parse JSX → structured commands
    const { commands, errors } = parseJSX(jsxCode);

    if (commands.length === 0) {
      ctx.logError('AI generated invalid JSX that could not be parsed.');
      if (errors.length > 0) {
        console.log(chalk.yellow('  Parse errors:'));
        errors.forEach(e => console.log(chalk.gray(`    - ${e}`)));
      }
      console.log(chalk.gray('\n  Sanitized JSX:'));
      console.log(chalk.gray('  ' + jsxCode.split('\n').slice(0, 10).join('\n  ')));
      return;
    }

    // Step 5: Validate commands
    const invalid = [];
    for (const cmd of commands) {
      const v = validateCommand(cmd);
      if (!v.valid) invalid.push(v.error);
    }

    if (invalid.length > 0) {
      ctx.logError('Generated commands failed validation:');
      invalid.forEach(e => console.log(chalk.yellow(`  - ${e}`)));
      return;
    }

    // Warnings (non-fatal)
    if (errors.length > 0) {
      errors.forEach(e => console.log(chalk.yellow(`  (!) ${e}`)));
    }

    // Step 6: Preview
    console.log(chalk.green(`\n  [OK] Parsed ${commands.length} nodes from AI\n`));

    console.log(chalk.gray('  -- JSX --------------------------'));
    jsxCode.split('\n').slice(0, 20).forEach(line => {
      console.log(chalk.cyan('  ' + line));
    });
    if (jsxCode.split('\n').length > 20) {
      console.log(chalk.gray(`  ... (${jsxCode.split('\n').length - 20} more lines)`));
    }
    console.log(chalk.gray('  ---------------------------------\n'));

    const typeCounts = {};
    for (const cmd of commands) {
      const t = cmd.params?.type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    console.log(chalk.white('  Nodes to create:'));
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(chalk.gray(`    ${type}: ${count}`));
    }
    console.log();

    // --plan: stop here
    if (options.plan) {
      if (ctx.isJson) {
        console.log(JSON.stringify({ jsx: jsxCode, commands, errors }, null, 2));
      }
      return;
    }

    // --skip-confirm: skip confirmation
    if (!options.skipConfirm) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => {
        rl.question(chalk.white('  Execute? [Y/n] '), resolve);
      });
      rl.close();

      if (answer && answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(chalk.gray('  Cancelled.'));
        return;
      }
    }

    // Step 7: Execute — send batch to daemon → plugin
    console.log(chalk.blue('  [OK] Sending to Figma...'));
    try {
      const result = await sendBatch(commands);
      ctx.logSuccess(`Created ${commands.length} nodes in Figma`, result);
    } catch (err) {
      ctx.logError(`Execution failed: ${err.message}`);
    }
  }
}

export default [new AiDesignCommand()];
