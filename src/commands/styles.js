import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class StyleListCommand extends Command {
  name = 'style list';
  description = 'List all local styles (Text, Paint, Effect, Grid)';
  needsConnection = true;

  async execute(ctx) {
    const spinner = ctx.isInteractive ? ora('Fetching styles...').start() : null;
    try {
      const { data } = await ctx.command('style.list');
      spinner?.stop();

      const stylesByType = {
        text: data?.text || [],
        paint: data?.paint || [],
        effect: data?.effect || [],
        grid: data?.grid || [],
      };

      const types = [
        { key: 'text', label: 'Text Styles', color: chalk.cyan },
        { key: 'paint', label: 'Paint Styles', color: chalk.green },
        { key: 'effect', label: 'Effect Styles', color: chalk.magenta },
        { key: 'grid', label: 'Grid Styles', color: chalk.yellow }
      ];

      const counts = Object.fromEntries(
        Object.entries(stylesByType).map(([key, styles]) => [key, styles.length])
      );
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      if (total === 0) {
        ctx.output(
          { styles: stylesByType, counts, total, message: 'No styles found.' },
          () => console.log(chalk.yellow('\n  No styles found.\n'))
        );
        return;
      }

      ctx.output({ styles: stylesByType, counts, total }, () => {
        types.forEach(({ key, label, color }) => {
          const styles = stylesByType[key];
          if (styles.length > 0) {
            console.log(color(`\n  ${label} (${styles.length}):\n`));
            styles.forEach(s => {
              console.log(chalk.white(`    • ${chalk.bold(s.name)}`));
              console.log(chalk.gray(`      ID: ${s.id}`));
            });
          }
        });
        console.log();
      });
    } catch (err) {
      spinner?.fail('Failed to list styles');
      ctx.logError(err.message);
    }
  }
}

class StyleUpdateCommand extends Command {
  name = 'style update <family> [pattern]';
  description = 'Bulk update local text styles to a new font family';
  needsConnection = true;

  async execute(ctx, options, family, pattern) {
    const spinner = ctx.startSpinner(`Updating styles to ${family}...`);
    try {
      const { data } = await ctx.command('style.update_typography', { family, pattern });
      const payload = {
        family,
        pattern: pattern || null,
        updated: data.updated,
        total: data.total,
        failed: data.failed,
        errors: data.errors || [],
      };

      if (data.updated > 0) {
        if (ctx.isJson) {
          ctx.logSuccess(`Successfully updated ${data.updated}/${data.total} styles.`, payload);
        } else {
          spinner.succeed(`Successfully updated ${data.updated}/${data.total} styles.`);
        }
      } else {
        if (ctx.isJson) {
          ctx.logWarning(`No styles were updated. (Total found: ${data.total})`, payload);
        } else {
          spinner.warn(`No styles were updated. (Total found: ${data.total})`);
        }
      }

      if (data.failed > 0) {
        process.exitCode = 1;
        ctx.logError(`${data.failed} styles failed to update.`, payload);
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Typography update failed', {
        family,
        pattern: pattern || null,
        error: err.message,
      });
    }
  }
}

class StyleCreateEffectCommand extends Command {
  name = 'style create-effect <name>';
  description = 'Create an effect (shadow/blur) style';
  needsConnection = true;
  options = [
    { flags: '--effects <json>', description: 'Effects array as JSON string' }
  ];

  async execute(ctx, options, name) {
    let effects;
    if (options.effects) {
      try {
        effects = JSON.parse(options.effects);
      } catch {
        ctx.logError('Invalid JSON for --effects flag');
        return;
      }
    } else {
      ctx.logError('Provide --effects as JSON array. Example: --effects \'[{"type":"DROP_SHADOW","color":{"r":0,"g":0,"b":0,"a":0.1},"offset":{"x":0,"y":4},"radius":6,"spread":-1,"visible":true,"blendMode":"NORMAL"}]\'');
      return;
    }

    const spinner = ctx.startSpinner(`Creating effect style "${name}"...`);
    try {
      const { data } = await ctx.command('style.create_effect', { name, effects });
      spinner?.stop();

      ctx.output(
        { success: true, id: data.id, name: data.name, created: data.created },
        () => console.log(chalk.green(`\n  ✓ Created effect style: ${chalk.bold(name)} (ID: ${data.id})\n`))
      );
    } catch (err) {
      spinner?.fail(`Failed to create effect style "${name}"`);
      ctx.logError(err.message);
    }
  }
}

class StyleMaterial3Command extends Command {
  name = 'style material3';
  description = 'Create Material 3 typography text styles from the shared token system';
  needsConnection = true;
  options = [
    { flags: '--prefix <name>', description: 'Style prefix', defaultValue: 'm3' },
    { flags: '--font-family <family>', description: 'Typography family', defaultValue: 'Roboto' }
  ];

  async execute(ctx, options) {
    const spinner = ctx.startSpinner('Creating Material 3 text styles...');
    const prefix = options.prefix || 'm3';
    const fontFamily = options.fontFamily || 'Roboto';

    try {
      const styles = buildMaterial3TypographyStyles({ prefix, fontFamily });
      const { data } = await ctx.command('style.create_text_styles', { styles });
      const payload = {
        preset: 'material3',
        prefix,
        fontFamily,
        total: data.total,
        created: data.created,
        updated: data.updated,
        names: data.names || [],
      };

      if (ctx.isJson) {
        ctx.logSuccess(`Created or updated ${data.total} Material 3 text styles.`, payload);
      } else {
        spinner.succeed(`Created or updated ${data.total} Material 3 text styles.`);
      }
    } catch (err) {
      process.exitCode = 1;
      const payload = {
        preset: 'material3',
        prefix,
        fontFamily,
        error: err.message,
      };

      if (ctx.isJson) {
        ctx.logError('Failed to create Material 3 text styles.', payload);
      } else {
        spinner.fail('Failed to create Material 3 text styles');
      }
    }
  }
}

export default [new StyleListCommand(), new StyleUpdateCommand(), new StyleMaterial3Command()];
