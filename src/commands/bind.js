import { Command } from '../cli/command.js';
import ora from 'ora';

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
    const spinner = ora(`Binding "${variableName}" to "${property}"...`).start();
    try {
      const code = `
        const prop = ${JSON.stringify(property)};
        const varName = ${JSON.stringify(variableName)};
        const nodeIds = ${JSON.stringify(options.node || [])};
        
        const variables = await figma.variables.getLocalVariablesAsync();
        const v = variables.find(v => v.name === varName || v.id === varName);
        if (!v) return { success: false, error: 'Variable not found.' };

        const nodes = nodeIds.length > 0 
          ? await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)))
          : figma.currentPage.selection;

        if (nodes.length === 0) return { success: false, error: 'No nodes selected or provided.' };

        const results = [];
        for (const node of nodes) {
          if (!node) continue;
          try {
            if (prop === 'fill' || prop === 'bg') {
              node.fills = [{
                type: 'SOLID',
                color: { r: 0, g: 0, b: 0 },
                boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
              }];
            } else if (prop === 'stroke' || prop === 'border') {
              node.strokes = [{
                type: 'SOLID',
                color: { r: 0, g: 0, b: 0 },
                boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
              }];
            } else if (prop === 'gap' || prop === 'spacing') {
              node.setBoundVariable('itemSpacing', v);
            } else if (prop === 'radius' || prop === 'rounded') {
              node.setBoundVariable('cornerRadius', v);
            } else if (prop === 'padding') {
              node.setBoundVariable('paddingTop', v);
              node.setBoundVariable('paddingBottom', v);
              node.setBoundVariable('paddingLeft', v);
              node.setBoundVariable('paddingRight', v);
            }
            results.push(node.id);
          } catch (e) {
            console.warn('Bind error for node ' + node.id + ': ' + e.message);
          }
        }
        return { success: true, count: results.length };
      `;
      
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess(`Bound "${variableName}" to ${result.count} nodes.`);
      else ctx.logError(result.error);
    } catch (err) {
      spinner.fail('Binding failed');
      ctx.logError(err.message);
    }
  }
}

export default new BindCommand();
