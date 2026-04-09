import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class AuditA11yCommand extends Command {
  name = 'audit a11y';
  description = 'Perform a contrast accessibility audit for the current page or entire document';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--page', description: 'Audit all nodes in the current page' },
      { flags: '--all', description: 'Audit all nodes in the document' }
    ];
  }

  async execute(ctx, options) {
    const spinner = ctx.isInteractive ? ora('Analyzing canvas for A11y failures...').start() : null;
    
    try {
      const scope = options.all ? 'all' : 'page';
      const audit = await ctx.evalOp('audit.a11y', { scope });
      spinner?.stop();

      const failures = audit?.failures || [];
      const scanned = audit?.scanned || 0;
      const scopeLabel = (audit?.scope || scope) === 'all' ? 'document' : 'current page';
      const payload = {
        scope: audit?.scope || scope,
        scopeLabel,
        scanned,
        failureCount: failures.length,
        failures,
        pass: failures.length === 0,
      };

      if (failures.length > 0) {
        process.exitCode = 1;
        ctx.output(payload, () => {
          ctx.logError(`Found ${failures.length} accessibility failure(s) in the ${scopeLabel}.`);
          console.log('');
          failures.forEach(f => {
            console.log(chalk.red(`  [FAILED] ${chalk.bold(f.name)}`));
            console.log(chalk.gray(`    Page: ${f.page}`));
            console.log(chalk.gray(`    Text: "${f.text.substring(0, 30)}${f.text.length > 30 ? '...' : ''}"`));
            console.log(chalk.gray(`    Ratio: ${f.ratio}:1 (WCAG Target: ${f.threshold}:1)`));
            console.log(chalk.gray(`    Colors: ${f.textColor} on ${f.bgHex}`));
            console.log('');
          });
        });
      } else {
        ctx.output(payload, () => {
          ctx.logSuccess(`Accessibility audit complete for the ${scopeLabel}: scanned ${scanned} text node(s), no contrast failures found.`);
        });
      }
    } catch (err) {
      spinner?.fail('Audit failed');
      ctx.logError(err.message);
    }
  }
}

export default [new AuditA11yCommand()];
