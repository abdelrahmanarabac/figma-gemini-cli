import { Command } from '../cli/command.js';

class VarSetValueCommand extends Command {
  name = 'var value <variableName> <modeName> <value>';
  description = 'Set the value of a variable for a specific mode';
  needsConnection = true;

  async execute(ctx, options, variableName, modeName, value) {
    const spinner = ctx.startSpinner(`Setting value for "${variableName}" in "${modeName}"...`);
    try {
      const result = await ctx.evalOp('variable.set_value', {
        variableName,
        modeName,
        value,
      });
      if (result.success) {
        const payload = {
          success: true,
          variableName,
          modeName,
          value,
        };
        if (ctx.isJson) {
          ctx.logSuccess('Value set successfully.', payload);
        } else {
          spinner.succeed('Value set successfully.');
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          variableName,
          modeName,
          value,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Operation failed', {
        success: false,
        variableName,
        modeName,
        value,
        error: err.message,
      });
    }
  }
}

export default new VarSetValueCommand();
