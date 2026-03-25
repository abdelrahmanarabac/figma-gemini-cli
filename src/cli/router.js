import { Command as Commander } from 'commander';
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { CommandContext } from './context.js';
import { Command } from './command.js';
import { detectAndDocumentError } from '../utils/error-memory.js';
import { checkHealth } from '../transport/bridge.js';

export class CliRouter {
  /**
   * @param {string} name 
   * @param {string} version 
   * @param {string} description 
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(name, version, description, dependencies = {}) {
    this.dependencies = dependencies;
    this.program = new Commander();
    this.program
      .name(name)
      .description(description)
      .version(version)
      .option('--json', 'Output strictly as JSON');
  }

  get legacyProgram() {
    return this.program;
  }

  /**
   * Auto-discover and register all commands from a directory.
   * Each .js file should export a default array of Command instances,
   * or a single Command instance.
   * @param {string} dir - Absolute path to commands directory
   */
  async discoverCommands(dir) {
    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      const files = readdirSync(dirPath);
      files.forEach((file) => {
        const fullPath = join(dirPath, file);
        if (readdirSync(dirPath, { withFileTypes: true }).find(f => f.name === file).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.js')) {
          arrayOfFiles.push(fullPath);
        }
      });
      return arrayOfFiles;
    };

    let files;
    try {
      files = getAllFiles(dir);
    } catch (err) {
      console.error(chalk.yellow(`⚠ Error reading commands directory: ${dir}`), err.message);
      return;
    }

    for (const filePath of files) {
      const fileUrl = pathToFileURL(filePath).href;
      try {
        const mod = await import(fileUrl);
        const exports = mod.default || mod;
        const commands = Array.isArray(exports) ? exports : [exports];

        for (const cmd of commands) {
          if (cmd instanceof Command) {
            this.register(cmd);
          }
        }
      } catch (err) {
        console.error(chalk.yellow(`⚠ Failed to load command file: ${filePath}`), err.message);
      }
    }
  }

  /**
   * Registers a command following the Command interface.
   * @param {Command} commandInstance 
   */
  register(commandInstance) {
    if (!(commandInstance instanceof Command)) {
      throw new Error(`Command "${commandInstance.constructor.name}" must extend Command.`);
    }

    let cmd;
    const parts = commandInstance.name.split(' ');
    const rootName = parts[0];
    const rest = parts.slice(1).join(' ');
    const isSubcommand = rest && !rest.startsWith('<') && !rest.startsWith('[');

    if (isSubcommand) {
      let rootCmd = this.program.commands.find(c => c.name() === rootName);
      if (!rootCmd) {
        rootCmd = this.program.command(rootName);
      }
      cmd = rootCmd.command(rest);
    } else {
      cmd = this.program.command(commandInstance.name);
    }

    if (commandInstance.description) {
      cmd.description(commandInstance.description);
    }

    if (commandInstance.alias) {
      cmd.alias(commandInstance.alias);
    }

    if (commandInstance.options) {
      commandInstance.options.forEach(opt => {
        if (opt.required) {
          cmd.requiredOption(opt.flags, opt.description, opt.defaultValue);
        } else {
          cmd.option(opt.flags, opt.description, opt.defaultValue);
        }
      });
    }

    cmd.action(async (...args) => {
      // Commander passes: [...commandArgs, options, commandObj]
      const options = args[args.length - 2];
      const commandArgs = args.slice(0, args.length - 2);

      const globalOptions = this.program.opts();
      const allOptions = { ...globalOptions, ...options };

      const ctx = new CommandContext(allOptions, this.dependencies);

      try {
        // Connection gating: check before execute if command requires it
        if (commandInstance.needsConnection) {
          const isConnected = await this._ensureConnection(ctx);
          if (!isConnected) {
            process.exitCode = 1;
            return;
          }
        }

        await commandInstance.execute(ctx, allOptions, ...commandArgs);
      } catch (err) {
        ctx.logError(err.message);
        detectAndDocumentError(err.message);
        process.exitCode = 1;
      } finally {
        await ctx.close();
      }
    });
  }

  /**
   * Verify Figma connection is available.
   * @param {CommandContext} ctx
   * @returns {Promise<boolean>}
   */
  async _ensureConnection(ctx) {
    const data = await checkHealth();
    if (data.status === 'ok' && data.plugin) {
      return true;
    }

    const payload = {
      connected: false,
      daemonRunning: data.status === 'ok',
      pluginConnected: Boolean(data.plugin),
      message: 'Not connected to Figma. Ensure the FigCli plugin is open and run "figma-gemini-cli connect".',
    };

    ctx.output(payload, () => {
      console.log(chalk.red('\n[X] Not connected to Figma\n'));
      console.log(chalk.white('  Ensure the FigCli plugin is open in Figma and run:'));
      console.log(chalk.cyan('  figma-gemini-cli connect\n'));
    });
    return false;
  }

  run(argv) {
    if (!argv.slice(2).length) {
      this.program.outputHelp();
      return;
    }
    this.program.parse(argv);
  }
}
