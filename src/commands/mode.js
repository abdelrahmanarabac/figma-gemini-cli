import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ModeAddCommand extends Command {
  name = 'mode add <collectionName> <modeName>';
  description = 'Add a new mode to a variable collection';
  needsConnection = true;

  async execute(ctx, options, collectionName, modeName) {
    const spinner = ctx.startSpinner(`Adding mode "${modeName}" to "${collectionName}"...`);
    try {
      const code = `
        const colName = ${JSON.stringify(collectionName)};
        const newModeName = ${JSON.stringify(modeName)};
        
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.name === colName || c.id === colName);
        
        if (!col) return { success: false, error: 'Collection not found: ' + colName };
        
        try {
          const modeId = col.addMode(newModeName);
          return { success: true, modeId, colName: col.name };
        } catch (e) {
          return { success: false, error: e.message };
        }
      `;
      
      const result = await ctx.eval(code);
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          modeName,
          modeId: result.modeId,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Added mode "${modeName}" to "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Added mode "${modeName}" to "${result.colName}"`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          modeName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Failed to add mode', {
        success: false,
        collection: collectionName,
        modeName,
        error: err.message,
      });
    }
  }
}

class ModeEditCommand extends Command {
  name = 'mode edit <collectionName> <oldName> <newName>';
  description = 'Rename an existing mode in a collection';
  needsConnection = true;

  async execute(ctx, options, collectionName, oldName, newName) {
    const spinner = ctx.startSpinner(`Renaming mode "${oldName}" to "${newName}"...`);
    try {
      const code = `
        const colName = ${JSON.stringify(collectionName)};
        const oldMName = ${JSON.stringify(oldName)};
        const newMName = ${JSON.stringify(newName)};
        
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.name === colName || c.id === colName);
        
        if (!col) return { success: false, error: 'Collection not found.' };
        
        const mode = col.modes.find(m => m.name === oldMName || m.modeId === oldMName);
        if (!mode) return { success: false, error: 'Mode not found.' };
        
        col.renameMode(mode.modeId, newMName);
        return { success: true, colName: col.name };
      `;
      
      const result = await ctx.eval(code);
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          oldName,
          newName,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Renamed mode "${oldName}" to "${newName}" in "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Renamed mode "${oldName}" to "${newName}" in "${result.colName}"`);
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          oldName,
          newName,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Failed to edit mode', {
        success: false,
        collection: collectionName,
        oldName,
        newName,
        error: err.message,
      });
    }
  }
}

class ModeMultiCommand extends Command {
  name = 'mode multi <collectionName>';
  description = 'Batch generate modes (e.g., auto-create Dark mode from Light, or Compact from Spacious)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--from <name>', description: 'Source mode name', defaultValue: 'Light' },
      { flags: '--to <name>', description: 'Target mode name', defaultValue: 'Dark' },
      { flags: '--strategy <type>', description: 'Transformation strategy (invert, copy, scale)', defaultValue: 'invert' },
      { flags: '--factor <number>', description: 'Scaling factor (for strategy=scale)', defaultValue: '1' },
      { flags: '--filter <prefix>', description: 'Only process variables starting with this prefix' }
    ];
  }

  async execute(ctx, options, collectionName) {
    const spinner = ctx.startSpinner(`Running multi-mode generation: ${options.from} -> ${options.to} (${options.strategy})...`);
    try {
      const code = `
        const colName = ${JSON.stringify(collectionName)};
        const fromName = ${JSON.stringify(options.from)};
        const toName = ${JSON.stringify(options.to)};
        const strategy = ${JSON.stringify(options.strategy)};
        const factor = parseFloat(${JSON.stringify(options.factor)});
        const filterPrefix = ${JSON.stringify(options.filter)};
        
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const col = collections.find(c => c.name === colName || c.id === colName);
        if (!col) return { success: false, error: 'Collection not found: ' + colName };
        
        const sourceMode = col.modes.find(m => m.name.toLowerCase() === fromName.toLowerCase());
        if (!sourceMode) return { success: false, error: 'Source mode "' + fromName + '" not found.' };
        
        let targetMode = col.modes.find(m => m.name.toLowerCase() === toName.toLowerCase());
        if (!targetMode) {
          try {
            const newId = col.addMode(toName);
            targetMode = { modeId: newId, name: toName };
          } catch (e) {
            return { success: false, error: 'Could not create target mode: ' + e.message };
          }
        }
        
        const variables = await figma.variables.getLocalVariablesAsync();
        const colVars = variables.filter(v => v.variableCollectionId === col.id);
        
        // --- Expert Utility: Perceptual Color Math ---
        function rgbToHsl(r, g, b) {
          let max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          if (max === min) { h = s = 0; }
          else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }
          return [h, s, l];
        }

        function hslToRgb(h, s, l) {
          let r, g, b;
          if (s === 0) { r = g = b = l; }
          else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            const hue2rgb = (p, q, t) => {
              if (t < 0) t += 1; if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
          }
          return { r, g, b };
        }

        function transformValue(v, sourceVal) {
          if (filterPrefix && !v.name.startsWith(filterPrefix)) return sourceVal;

          if (strategy === 'invert' && v.resolvedType === 'COLOR') {
            const { r, g, b, a } = sourceVal;
            const [h, s, l] = rgbToHsl(r, g, b);
            // Perceptual Lightness Inversion: Pivot around 0.5
            const newL = 1 - l;
            const rgb = hslToRgb(h, s, newL);
            return { ...rgb, a };
          }

          if (strategy === 'scale' && v.resolvedType === 'FLOAT') {
            return sourceVal * factor;
          }

          if (strategy === 'copy') return sourceVal;
          
          return sourceVal;
        }
        
        let count = 0;
        for (const v of colVars) {
          const sourceValue = v.valuesByMode[sourceMode.modeId];
          if (sourceValue === undefined) continue;
          
          try {
            const newValue = transformValue(v, sourceValue);
            v.setValueForMode(targetMode.modeId, newValue);
            count++;
          } catch (err) {
            // Skip problematic variables
          }
        }
        
        return { success: true, count, colName: col.name, targetModeName: targetMode.name };
      `;
      
      const result = await ctx.eval(code);
      
      if (result.success) {
        const payload = {
          success: true,
          collection: result.colName,
          from: options.from,
          to: result.targetModeName,
          strategy: options.strategy,
          factor: parseFloat(options.factor),
          filter: options.filter || null,
          count: result.count,
        };
        if (ctx.isJson) {
          ctx.logSuccess(`Successfully generated "${result.targetModeName}" using strategy "${options.strategy}" in "${result.colName}"`, payload);
        } else {
          spinner.succeed(`Successfully generated "${result.targetModeName}" using strategy "${options.strategy}" in "${result.colName}"`);
          console.log(chalk.gray(`    Variables updated: ${result.count}`));
        }
      } else {
        process.exitCode = 1;
        spinner.fail(result.error, {
          success: false,
          collection: collectionName,
          from: options.from,
          to: options.to,
          strategy: options.strategy,
          error: result.error,
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Multi-mode generation failed', {
        success: false,
        collection: collectionName,
        from: options.from,
        to: options.to,
        strategy: options.strategy,
        error: err.message,
      });
    }
  }
}

export default [
  new ModeAddCommand(),
  new ModeEditCommand(),
  new ModeMultiCommand()
];
