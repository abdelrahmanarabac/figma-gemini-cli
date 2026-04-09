import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ProtoLinkCommand extends Command {
  name = 'proto link <source> <target>';
  description = 'Create a prototype interaction from a source node to a target node';
  needsConnection = true;



  constructor() {
    super();
    this.options = [
      { flags: '--trigger <type>', description: 'ON_CLICK, ON_HOVER, ON_PRESS, ON_DRAG', defaultValue: 'ON_CLICK' },
      { flags: '--transition <type>', description: 'INSTANT, DISSOLVE, SMART_ANIMATE, MOVE_IN', defaultValue: 'SMART_ANIMATE' },
      { flags: '--duration <ms>', description: 'Animation duration in milliseconds', defaultValue: '300' }
    ];
  }

  async execute(ctx, options, source, target) {
    const spinner = ctx.startSpinner(`Linking "${source}" to "${target}"...`);
    
    try {
      const result = await ctx.evalOp('proto.link', { source, target, transition: options.transition, duration: options.duration, trigger: options.trigger });
      const payload = {
        success: Boolean(result?.success),
        source,
        target,
        trigger: options.trigger?.toUpperCase(),
        transition: result?.transition || options.transition?.toUpperCase(),
        duration: parseInt(options.duration, 10),
        sourceName: result?.sourceName || null,
        targetName: result?.targetName || null,
      };

      if (result && result.success) {
        if (ctx.isJson) {
          ctx.logSuccess('Prototype linked successfully!', payload);
        } else {
          spinner.succeed('Prototype linked successfully!');
          console.log(chalk.gray(`    Source:     ${result.sourceName}`));
          console.log(chalk.gray(`    Target:     ${result.targetName}`));
          console.log(chalk.gray(`    Trigger:    ${result.trigger}`));
          console.log(chalk.gray(`    Transition: ${result.transition} (${options.duration}ms)`));
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result ? result.error : 'Unknown error occurred.', {
          ...payload,
          success: false,
          error: result?.error || 'Unknown error occurred.',
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Prototype linking failed', {
        success: false,
        source,
        target,
        error: err.message,
      });
    }
  }
}

export default [new ProtoLinkCommand()];
