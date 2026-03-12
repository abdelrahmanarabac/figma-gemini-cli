import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

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
    const spinner = ora(`Linking "${source}" to "${target}"...`).start();
    
    try {
      const code = `
        const sourceQuery = ${JSON.stringify(source)};
        const targetQuery = ${JSON.stringify(target)};
        const options = ${JSON.stringify(options)};
        
        async function findNode(query) {
          // Check if it's a direct ID
          if (query.includes(':')) {
            const n = await figma.getNodeByIdAsync(query);
            if (n) return n;
          }
          // Search by name in current page
          const nodes = figma.currentPage.findAll(n => n.name === query);
          return nodes[0];
        }

        const sourceNode = await findNode(sourceQuery);
        const targetNode = await findNode(targetQuery);

        if (!sourceNode) return { success: false, error: "Source node '" + sourceQuery + "' not found." };
        if (!targetNode) return { success: false, error: "Target node '" + targetQuery + "' not found." };
        if (!('reactions' in sourceNode)) return { success: false, error: "Source node does not support interactions." };

        // Ensure the target is a top-level frame (Figma requirement for NAVIGATE)
        let destinationNode = targetNode;
        while (destinationNode.parent && destinationNode.parent.type !== 'PAGE') {
          destinationNode = destinationNode.parent;
        }

        // Build the reaction action
        const actionObj = {
          type: 'NODE',
          destinationId: destinationNode.id,
          navigation: 'NAVIGATE',
          transition: {
            type: options.transition.toUpperCase(),
            easing: { type: 'EASE_IN_AND_OUT' },
            duration: parseInt(options.duration, 10)
          }
        };

        // For INSTANT, we remove transition details
        if (options.transition.toUpperCase() === 'INSTANT') {
           actionObj.transition = null;
        }

        const newReaction = {
          trigger: { type: options.trigger.toUpperCase() },
          actions: [actionObj]
        };

        // Clone existing reactions, add the new one
        const currentReactions = sourceNode.reactions || [];
        // Remove existing reactions with the same trigger to avoid conflicts
        const filteredReactions = currentReactions.filter(r => r.trigger.type !== newReaction.trigger.type);
        
        await sourceNode.setReactionsAsync([...filteredReactions, newReaction]);

        return { 
          success: true, 
          sourceName: sourceNode.name, 
          targetName: destinationNode.name,
          trigger: newReaction.trigger.type,
          transition: newReaction.actions[0].transition ? newReaction.actions[0].transition.type : 'INSTANT'
        };
      `;

      const result = await ctx.eval(code);
      spinner.stop();

      if (result && result.success) {
        ctx.logSuccess(`Prototype linked successfully!`);
        console.log(chalk.gray(`    Source:     ${result.sourceName}`));
        console.log(chalk.gray(`    Target:     ${result.targetName}`));
        console.log(chalk.gray(`    Trigger:    ${result.trigger}`));
        console.log(chalk.gray(`    Transition: ${result.transition} (${options.duration}ms)`));
      } else {
        ctx.logError(result ? result.error : "Unknown error occurred.");
      }
    } catch (err) {
      spinner.fail('Prototype linking failed');
      ctx.logError(err.message);
    }
  }
}

export default [new ProtoLinkCommand()];
