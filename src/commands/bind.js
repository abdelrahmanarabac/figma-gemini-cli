import { Command } from '../cli/command.js';

class BindCommand extends Command {
  name = 'bind <property> <variableName>';
  description = 'Bind a variable to a node property (fill, stroke, gap, radius, padding)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-n, --node <id...>', description: 'Target node ID(s). Defaults to selection.' }
    ];
  }

  async execute(ctx, options, property, variableName) {
    const spinner = ctx.startSpinner(`Binding "${variableName}" to "${property}"...`);
    try {
      const result = await ctx.evalOp('node.bind', { property, variableName, nodeIds: options.node || [] });
      if (result.success) {
        const payload = {
          success: true,
          property,
          variableName,
          count: result.count,
          nodeIds: options.node || [],
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Bound "${variableName}" to ${result.count} nodes.`, payload);
        } else {
          spinner.succeed(`Bound "${variableName}" to ${result.count} nodes.`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          property,
          variableName,
          nodeIds: options.node || [],
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Binding failed', {
        success: false,
        property,
        variableName,
        nodeIds: options.node || [],
        error: err.message,
      });
    }
  }
}

export default new BindCommand();
