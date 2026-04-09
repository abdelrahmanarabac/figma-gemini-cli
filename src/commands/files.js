import { Command } from '../cli/command.js';
import chalk from 'chalk';
import { checkHealth, sendCommand } from '../transport/bridge.js';

class FileListCommand extends Command {
  name = 'files';
  description = 'List connected Figma files';
  needsConnection = false;

  async execute(ctx) {
    const data = await checkHealth();
    const files = data.connectedFiles || [];

    if (files.length === 0) {
      console.log(chalk.yellow('\n  No files connected.\n'));
      return;
    }

    console.log(chalk.cyan('\n  Connected Files:\n'));
    files.forEach(f => {
      const isActive = f.id === data.activeFile;
      const indicator = isActive ? chalk.green('▶') : ' ';
      console.log(chalk.white(`    ${indicator} ${f.name}${isActive ? chalk.green(' ← active') : ''}`));
    });
    console.log();
  }
}

class FileSwitchCommand extends Command {
  name = 'switch <name>';
  description = 'Switch active file by name';
  needsConnection = false;

  async execute(ctx, options, name) {
    const data = await checkHealth();
    const files = data.connectedFiles || [];
    const target = files.find(f => f.name.toLowerCase() === name.toLowerCase());

    if (!target) {
      console.log(chalk.red(`\n  File "${name}" not found. Use "files" to list connected files.\n`));
      return;
    }

    // Send a ping with the fileId to switch
    await sendCommand('_switch', { fileId: target.id });
    console.log(chalk.green(`\n  Switched to: ${target.name}\n`));
  }
}

export default [new FileListCommand(), new FileSwitchCommand()];
