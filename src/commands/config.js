import { Command } from '../cli/command.js';
import { loadConfig, saveConfig } from '../utils/config.js';
import chalk from 'chalk';

class ConfigSetCommand extends Command {
    name = 'config set <key> <value>';
    description = 'Set a config value (e.g., removebgApiKey)';
    needsConnection = false;

    async execute(ctx, opts, key, value) {
        const config = loadConfig();
        config[key] = value;
        saveConfig(config);
        console.log(chalk.green('✓ Config saved: ') + chalk.gray(key + ' = ' + value.substring(0, 10) + '...'));
    }
}

class ConfigGetCommand extends Command {
    name = 'config get <key>';
    description = 'Get a config value';
    needsConnection = false;

    async execute(ctx, opts, key) {
        const config = loadConfig();
        if (config[key]) {
            console.log(config[key]);
        } else {
            console.log(chalk.gray('Not set'));
        }
    }
}

export default [
    new ConfigSetCommand(),
    new ConfigGetCommand(),
];
