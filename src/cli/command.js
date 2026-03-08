/**
 * @typedef {Object} CommandOption
 * @property {string} flags - Commander flags, e.g., '-p, --port <number>'
 * @property {string} description - Option description
 * @property {any} [defaultValue] - Default value if not provided
 * @property {boolean} [required] - Whether this option is strictly required
 */

export class Command {
  /**
   * The command name. Supports subcommands via space: 'var list', 'tokens tailwind'.
   * @type {string}
   */
  name = '';

  /**
   * The description shown in the CLI help menu.
   * @type {string}
   */
   description = '';

   /**
   * Optional alias for the command.
   * @type {string|undefined}
   */
   alias = undefined;

   /**
   * List of arguments and flags this command accepts.   * @type {CommandOption[]}
   */
  options = [];

  /**
   * Whether this command requires a live Figma connection.
   * When true, the router verifies connection before calling execute().
   * Set to false for commands like connect, init, daemon, status.
   * @type {boolean}
   */
  needsConnection = true;

  /**
   * The core execution logic of the command.
   * @param {import('./context.js').CommandContext} ctx - Injected context/DI
   * @param {Object} options - Parsed CLI options
   * @param {...any} args - Additional positional arguments
   * @returns {Promise<void>}
   */
  async execute(ctx, options, ...args) {
    throw new Error(`Command "${this.name}" has not implemented the execute() method.`);
  }
}

// Backward compat alias
export const BaseCommand = Command;
