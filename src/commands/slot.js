import { Command } from '../cli/command.js';

class SlotSwapCommand extends Command {
  name = 'slot swap <instanceId> <componentId>';
  description = 'Swap a component instance for a different component';
  needsConnection = true;

  async execute(ctx, options, instanceId, componentId) {
    const spinner = ctx.startSpinner(`Swapping instance ${instanceId}...`);
    try {
      const result = await ctx.evalOp('instance.swap', { instanceId, componentId });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Instance ${instanceId} swapped to component ${componentId}.`);
    } catch (err) {
      spinner.fail(`Failed to swap instance: ${err.message}`);
    }
  }
}

class SlotOverrideCommand extends Command {
  name = 'slot override <instanceId> <propName> <value>';
  description = 'Override instance-level props (text, fills, visibility)';
  needsConnection = true;

  async execute(ctx, options, instanceId, propName, value) {
    const spinner = ctx.startSpinner(`Setting override ${propName} on ${instanceId}...`);
    try {
      const result = await ctx.evalOp('instance.set_overrides', { instanceId, propName, value });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Override applied to ${instanceId}.`);
    } catch (err) {
      spinner.fail(`Failed to apply override: ${err.message}`);
    }
  }
}

export default [new SlotSwapCommand(), new SlotOverrideCommand()];
