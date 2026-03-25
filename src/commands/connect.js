import { Command } from '../cli/command.js';
import { startDaemon, startFigma } from '../utils/figma.js';
import chalk from 'chalk';
import { getDaemonUrl } from '../utils/daemon-config.js';

class ConnectCommand extends Command {
  name = 'connect';
  description = 'Connect to Figma via FigCli Plugin';
  needsConnection = false;
  options = [
    { flags: '--safe', description: 'Force plugin-only mode (Safe Mode)', defaultValue: false }
  ];

  async execute(ctx, opts) {
    const mode = opts.safe ? 'plugin' : 'auto';
    const spinner = ctx.startSpinner('Starting Figma CLI Daemon...');
    const instructions = [
      'Open Figma Desktop and any design file',
      'Run FigCli plugin (Plugins -> Development -> FigCli)',
      'The CLI will connect automatically',
    ];

    try {
      await startDaemon(false, mode);
      if (!ctx.isJson) {
        spinner.succeed('Daemon running');
      }

      if (mode === 'auto') {
        if (!ctx.isJson) {
          ctx.startSpinner('Ensuring Figma is running with remote debugging...').succeed('Ensured Figma launch attempt.');
        }
        startFigma();
      }

      if (!ctx.isJson) {
        console.log(chalk.cyan('\n  INSTRUCTIONS:\n'));
        instructions.forEach((line, index) => {
          console.log(chalk.white(`  ${index + 1}. ${line}`));
        });
        console.log();
      }

      const pluginSpinner = ctx.startSpinner('Waiting for plugin connection...');
      
      // Poll for plugin connection
      let pluginConnected = false;
      let daemonRunning = true;
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch(`${getDaemonUrl()}/health`);
          const data = await res.json();
          daemonRunning = data.status === 'ok';
          if (data.plugin) {
            pluginConnected = true;
            break;
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
      }

      const payload = {
        mode,
        daemonRunning,
        pluginConnected,
        instructions,
      };

      if (pluginConnected) {
        if (ctx.isJson) {
          ctx.logSuccess('Connected to Figma.', payload);
        } else {
          pluginSpinner.succeed('Plugin connected!');
          console.log(chalk.green('\n  [OK] Ready!\n'));
        }
      } else {
        process.exitCode = 1;
        if (ctx.isJson) {
          ctx.logError('Plugin connection timeout.', {
            ...payload,
            error: 'Plugin connection timeout.',
          });
        } else {
          pluginSpinner.warn('Plugin connection timeout.');
          console.log(chalk.yellow('\n  Ensure FigCli plugin is open in Figma.'));
        }
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Connection failed: ${err.message}`, {
        mode,
        daemonRunning: false,
        pluginConnected: false,
        error: err.message,
      });
    }
  }
}

export default [new ConnectCommand()];
