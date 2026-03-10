import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class StyleListCommand extends Command {
  name = 'style list';
  description = 'List all local styles (Text, Paint, Effect, Grid)';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ora('Fetching styles...').start();
    try {
      const { data } = await ctx.command('style.list');
      spinner.stop();

      if (!data) {
        console.log(chalk.yellow('\n  No styles found.\n'));
        return;
      }

      const types = [
        { key: 'text', label: 'Text Styles', color: chalk.cyan },
        { key: 'paint', label: 'Paint Styles', color: chalk.green },
        { key: 'effect', label: 'Effect Styles', color: chalk.magenta },
        { key: 'grid', label: 'Grid Styles', color: chalk.yellow }
      ];

      types.forEach(({ key, label, color }) => {
        const styles = data[key];
        if (styles && styles.length > 0) {
          console.log(color(`\n  ${label} (${styles.length}):\n`));
          styles.forEach(s => {
            console.log(chalk.white(`    • ${chalk.bold(s.name)}`));
            console.log(chalk.gray(`      ID: ${s.id}`));
          });
        }
      });
      console.log();
    } catch (err) {
      spinner.fail('Failed to list styles');
      ctx.logError(err.message);
    }
  }
}

class StyleUpdateCommand extends Command {
  name = 'style update <family> [pattern]';
  description = 'Bulk update local text styles to a new font family';
  needsConnection = true;

  async execute(ctx, options, family, pattern) {
    const spinner = ora(`Updating styles to ${family}...`).start();
    try {
      const { data } = await ctx.command('style.update_typography', { family, pattern });
      spinner.stop();

      if (data.updated > 0) {
        ctx.logSuccess(`Successfully updated ${data.updated}/${data.total} styles.`);
      } else {
        ctx.logWarning(`No styles were updated. (Total found: ${data.total})`);
      }

      if (data.failed > 0) {
        ctx.logError(`${data.failed} styles failed to update:`, data.errors);
      }
    } catch (err) {
      spinner.fail('Typography update failed');
      ctx.logError(err.message);
    }
  }
}

export default [new StyleListCommand(), new StyleUpdateCommand()];
