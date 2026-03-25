import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';

class TokensW3CImportCommand extends Command {
  name = 'tokens w3c import <file>';
  description = 'Import W3C DTCG compliant tokens ($value, $type)';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '-c, --collection <name>', description: 'Target collection name', defaultValue: 'W3C Tokens' }
    ];
  }

  async execute(ctx, options, file) {
    const spinner = ctx.startSpinner(`Importing W3C tokens from ${file}...`);
    try {
      const tokens = JSON.parse(readFileSync(file, 'utf8'));
      
      const code = `
        const tokens = ${JSON.stringify(tokens)};
        const colName = ${JSON.stringify(options.collection)};
        
        const cols = await figma.variables.getLocalVariableCollectionsAsync();
        let col = cols.find(c => c.name === colName);
        if (!col) col = figma.variables.createVariableCollection(colName);
        const modeId = col.modes[0].modeId;

        let count = 0;
        async function processNode(node, path = '') {
          for (const [key, val] of Object.entries(node)) {
            if (key.startsWith('$')) continue;
            
            const currentPath = path ? path + '.' + key : key;
            
            if (val.$value !== undefined) {
              // This is a token
              const typeMap = {
                'color': 'COLOR',
                'dimension': 'FLOAT',
                'number': 'FLOAT',
                'boolean': 'BOOLEAN',
                'string': 'STRING'
              };
              const figmaType = typeMap[val.$type] || 'STRING';
              
              const v = figma.variables.createVariable(currentPath, col, figmaType);
              
              if (val.$description) v.description = val.$description;
              
              let figmaValue = val.$value;
              if (figmaType === 'COLOR' && typeof figmaValue === 'string') {
                 const hex = figmaValue.replace('#', '');
                 figmaValue = {
                   r: parseInt(hex.substring(0, 2), 16) / 255,
                   g: parseInt(hex.substring(2, 4), 16) / 255,
                   b: parseInt(hex.substring(4, 6), 16) / 255,
                   a: 1
                 };
              }
              
              v.setValueForMode(modeId, figmaValue);
              count++;
            } else if (typeof val === 'object') {
              await processNode(val, currentPath);
            }
          }
        }
        
        await processNode(tokens);
        return { created: count };
      `;

      const result = await ctx.eval(code);
      const payload = {
        success: true,
        file,
        collection: options.collection,
        created: result.created,
      };
      if (ctx.isJson) {
        ctx.logSuccess(`Successfully imported ${result.created} W3C tokens into "${options.collection}"`, payload);
      } else {
        spinner.succeed(`Successfully imported ${result.created} W3C tokens into "${options.collection}"`);
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('W3C Import failed', {
        success: false,
        file,
        collection: options.collection,
        error: err.message,
      });
    }
  }
}

export default [new TokensW3CImportCommand()];
