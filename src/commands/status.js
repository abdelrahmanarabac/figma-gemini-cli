import { Command } from '../cli/command.js';
import chalk from 'chalk';
import { checkHealth } from '../transport/bridge.js';

class StatusCommand extends Command {
  name = 'status';
  description = 'Check connection status';
  needsConnection = false;

  async execute(ctx) {
    const data = await checkHealth();
    const daemonRunning = data.status === 'ok';
    const payload = {
      daemonRunning,
      pid: data.pid ?? null,
      pluginConnected: Boolean(data.plugin),
      message: daemonRunning
        ? (data.plugin
          ? 'Daemon is running and the plugin is connected.'
          : 'Daemon is running but the FigCli plugin is not connected.')
        : 'Daemon is not running.',
    };

    ctx.output(payload, () => {
      console.log(chalk.cyan('\n  Figma CLI Status:\n'));
      if (daemonRunning) {
        console.log(chalk.white(`    • Daemon:  ${chalk.green('Running')} (PID: ${data.pid})`));
        console.log(chalk.white(`    • Plugin:  ${data.plugin ? chalk.green('Connected') : chalk.yellow('Not Connected')}`));
        if (!data.plugin) {
          console.log(chalk.gray('\n  Tip: Open the FigCli plugin in Figma to enable canvas operations.\n'));
        } else {
          console.log();
        }
        return;
      }

      console.log(chalk.white(`    • Daemon:  ${chalk.red('Not Running')}`));
      console.log(chalk.gray('\n  Tip: Run "figma-gemini-cli connect" to start the daemon.\n'));
    });
  }
}

export default [new StatusCommand()];
