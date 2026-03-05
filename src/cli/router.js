import { Command as Commander } from 'commander';
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { CommandContext } from './context.js';
import { Command } from './command.js';

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
    let files;
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.js'));
    } catch {
      return; // No commands directory yet — fine during migration
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const fileUrl = pathToFileURL(filePath).href;

      try {
        const mod = await import(fileUrl);
        const exports = mod.default || mod;

        // Support: default export is array of Commands, or a single Command
        const commands = Array.isArray(exports) ? exports : [exports];

        for (const cmd of commands) {
          if (cmd instanceof Command) {
            this.register(cmd);
          }
        }
      } catch (err) {
        // Log but don't crash — one broken command file shouldn't kill the CLI
        console.error(chalk.yellow(`⚠ Failed to load command file: ${file}`), err.message);
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
          await this._ensureConnection(ctx);
        }

        await commandInstance.execute(ctx, allOptions, ...commandArgs);
      } catch (err) {
        ctx.logError(err.message);
        process.exitCode = 1;
      } finally {
        await ctx.close();
      }
    });
  }

  /**
   * Verify Figma connection is available. Exits if not.
   * @param {CommandContext} ctx
   */
  async _ensureConnection(ctx) {
    // Try daemon health check first (works for both CDP and Plugin modes)
    try {
      const { execSync } = await import('child_process');
      const health = execSync(`curl -s http://127.0.0.1:3456/health`, { encoding: 'utf8', timeout: 2000 });
      const data = JSON.parse(health);
      if (data.status === 'ok' && (data.plugin || data.cdp)) {
        return;
      }
    } catch { }

    // Fallback: check CDP directly via getActivePage
    try {
      const page = await ctx.getActivePage();
      if (page) return;
    } catch { }

    // Not connected — show helpful message and exit
    console.log(chalk.red('\n✗ Not connected to Figma\n'));
    console.log(chalk.white('  Make sure Figma is running:'));
    console.log(chalk.cyan('  figma-ds-cli connect') + chalk.gray(' (Yolo Mode)'));
    console.log(chalk.cyan('  figma-ds-cli connect --safe') + chalk.gray(' (Safe Mode)\n'));
    process.exit(1);
  }

  run(argv) {
    if (!argv.slice(2).length) {
      this.program.outputHelp();
      return;
    }
    this.program.parse(argv);
  }
}
