import { Command } from '../cli/command.js';
import ora from 'ora';

class VarSetValueCommand extends Command {
  name = 'var value <variableName> <modeName> <value>';
  description = 'Set the value of a variable for a specific mode';
  needsConnection = true;

  async execute(ctx, options, variableName, modeName, value) {
    const spinner = ora(`Setting value for "${variableName}" in "${modeName}"...`).start();
    try {
      const code = `
        const varRef = ${JSON.stringify(variableName)};
        const modeRef = ${JSON.stringify(modeName)};
        const rawValue = ${JSON.stringify(value)};
        
        const variables = await figma.variables.getLocalVariablesAsync();
        const v = variables.find(v => v.name === varRef || v.id === varRef);
        if (!v) return { success: false, error: 'Variable not found.' };

        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.id === v.variableCollectionId);
        if (!col) return { success: false, error: 'Collection not found.' };

        const mode = col.modes.find(m => m.name === modeRef || m.modeId === modeRef);
        if (!mode) return { success: false, error: 'Mode not found.' };

        async function parseValue(val, type) {
          // Check for variable alias first
          const target = variables.find(v => v.name === val || v.id === val);
          if (target) {
            return { type: 'VARIABLE_ALIAS', id: target.id };
          }

          if (type === 'COLOR') {
             const hex = val.replace('#', '');
             return {
               r: parseInt(hex.substring(0, 2), 16) / 255,
               g: parseInt(hex.substring(2, 4), 16) / 255,
               b: parseInt(hex.substring(4, 6), 16) / 255,
               a: 1
             };
          }
          if (type === 'FLOAT') return parseFloat(val);
          if (type === 'BOOLEAN') return val === 'true';
          return val;
        }

        try {
          const parsed = await parseValue(rawValue, v.resolvedType);
          v.setValueForMode(mode.modeId, parsed);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      `;
      
      const result = await ctx.eval(code);
      spinner.stop();
      if (result.success) ctx.logSuccess('Value set successfully.');
      else ctx.logError(result.error);
    } catch (err) {
      spinner.fail('Operation failed');
      ctx.logError(err.message);
    }
  }
}

export default new VarSetValueCommand();
