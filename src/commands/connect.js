import { Command } from '../cli/command.js';
import { startDaemon, startFigma, isDaemonRunning } from '../utils/figma.js';
import chalk from 'chalk';
import ora from 'ora';

class ConnectCommand extends Command {
  name = 'connect';
  description = 'Connect to Figma via FigCli Plugin';
  needsConnection = false;
  options = [
    { flags: '--safe', description: 'Force plugin-only mode (Safe Mode)', defaultValue: false }
  ];

  async execute(ctx, opts) {
    const mode = opts.safe ? 'plugin' : 'auto';
    const spinner = ora('Starting Figma CLI Daemon...').start();

    try {
      await startDaemon(false, mode);
      spinner.succeed('Daemon running');

      if (mode === 'auto') {
        ora('Ensuring Figma is running with remote debugging...').start().succeed();
        startFigma();
      }

      console.log(chalk.cyan('\n  INSTRUCTIONS:\n'));
      console.log(chalk.white('  1. Open Figma Desktop and any design file'));
      console.log(chalk.white('  2. Run FigCli plugin (Plugins -> Development -> FigCli)'));
      console.log(chalk.white('  3. The CLI will connect automatically\n'));

      const pluginSpinner = ora('Waiting for plugin connection...').start();
      
      // Poll for plugin connection
      let pluginConnected = false;
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch('http://127.0.0.1:3456/health');
          const data = await res.json();
          if (data.plugin) {
            pluginConnected = true;
            break;
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
      }

      if (pluginConnected) {
        pluginSpinner.succeed('Plugin connected!');
        console.log(chalk.green('\n  [OK] Ready!\n'));
      } else {
        pluginSpinner.warn('Plugin connection timeout.');
        console.log(chalk.yellow('\n  Ensure FigCli plugin is open in Figma.'));
      }
    } catch (err) {
      spinner.fail('Connection failed: ' + err.message);
    }
  }
}

export default [new ConnectCommand()];
