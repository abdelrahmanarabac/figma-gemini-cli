import { Command } from '../cli/command.js';
import chalk from 'chalk';

class StatusCommand extends Command {
  name = 'status';
  description = 'Check connection status';
  needsConnection = false;

  async execute(ctx) {
    try {
      const res = await fetch('http://127.0.0.1:3456/health');
      const data = await res.json();
      
      console.log(chalk.cyan('\n  Figma CLI Status:\n'));
      console.log(chalk.white(`    • Daemon:  ${chalk.green('Running')} (PID: ${data.pid})`));
      console.log(chalk.white(`    • Plugin:  ${data.plugin ? chalk.green('Connected') : chalk.yellow('Not Connected')}`));
      
      if (!data.plugin) {
        console.log(chalk.gray('\n  Tip: Open the FigCli plugin in Figma to enable canvas operations.\n'));
      } else {
        console.log();
      }
    } catch (err) {
      console.log(chalk.cyan('\n  Figma CLI Status:\n'));
      console.log(chalk.white(`    • Daemon:  ${chalk.red('Not Running')}`));
      console.log(chalk.gray('\n  Tip: Run "figma-gemini-cli connect" to start the daemon.\n'));
    }
  }
}

export default [new StatusCommand()];
