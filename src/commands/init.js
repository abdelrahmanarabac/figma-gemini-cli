import { Command } from '../cli/command.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

class InitCommand extends Command {
  name = 'init';
  description = 'Scaffold figma-gemini-cli workspace and configuration';
  needsConnection = false;

  constructor() {
    super();
    this.options = [];
  }

  async execute(ctx) {
    ctx.logSuccess('Initializing figma-gemini-cli...');

    // 1. Ensure config dir exists
    const configDir = join(homedir(), '.figma-cli');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      ctx.log('Created global config directory: ' + configDir);
    } else {
      ctx.log('Global config directory already exists: ' + configDir);
    }

    // 2. Scaffold local .figma-cli.yml if not exists
    const localConfigPath = join(process.cwd(), '.figma-cli.yml');
    if (!existsSync(localConfigPath)) {
      const projectConfig = ctx.config.buildProject();
      ctx.config.saveProject(projectConfig, { file: localConfigPath });
      ctx.logSuccess('Created local configuration file: .figma-cli.yml');
    } else {
      ctx.log('Local configuration file already exists (.figma-cli.yml).');
    }

    ctx.log('');
    ctx.log(chalk.bold('Installation Complete! 🎉'));
    ctx.log('To get started:');
    ctx.log(`  1. Open Figma and launch the ${chalk.cyan('FigCli')} plugin.`);
    ctx.log(`  2. Run ${chalk.green('node src/index.js connect')} in a separate terminal to start the daemon.`);
    ctx.log(`  3. Try rendering UI: ${chalk.green('node src/index.js render --code "<Frame w={320} h={180} bg={color/surface} flex={col} p={spacing/lg} rounded={radius/lg}><Text>Hello</Text></Frame>"')}`);
  }
}

export default new InitCommand();
