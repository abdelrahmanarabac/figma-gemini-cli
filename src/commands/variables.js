import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fastEval } from '../utils/figma.js';

export function variableCommands(program) {
  const variables = program
    .command('variables')
    .alias('var')
    .description('Manage design tokens/variables');

  variables
    .command('list')
    .description('List all variables')
    .action(async () => {
      const result = await fastEval(`
        (function() {
          const vars = figma.variables.getLocalVariables();
          const cols = figma.variables.getLocalVariableCollections();
          return cols.map(c => ({
            name: c.name,
            id: c.id,
            variables: vars.filter(v => v.variableCollectionId === c.id).map(v => ({
              name: v.name,
              id: v.id,
              type: v.resolvedType
            }))
          }));
        })()
      `);

      if (!result || result.length === 0) {
        console.log(chalk.yellow('No variables found.'));
        return;
      }

      result.forEach(col => {
        console.log(chalk.bold.cyan(`
${col.name} (${col.id})`));
        col.variables.forEach(v => {
          console.log(chalk.gray(`  ${v.name} `) + chalk.blue(v.type));
        });
      });
      console.log();
    });

  variables
    .command('create <name>')
    .description('Create a variable')
    .requiredOption('-c, --collection <id>', 'Collection ID or name')
    .requiredOption('-t, --type <type>', 'Type: COLOR, FLOAT, STRING, BOOLEAN')
    .option('-v, --value <value>', 'Initial value')
    .action(async (name, options) => {
      const type = options.type.toUpperCase();
      const code = `(async () => {
        const cols = await figma.variables.getLocalVariableCollectionsAsync();
        let col = cols.find(c => c.id === '${options.collection}' || c.name === '${options.collection}');
        if (!col) return 'Collection not found: ${options.collection}';
        const modeId = col.modes[0].modeId;

        function hexToRgb(hex) {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
          } : null;
        }

        const v = figma.variables.createVariable('${name}', col, '${type}');
        ${options.value ? `
        let figmaValue = '${options.value}';
        if ('${type}' === 'COLOR') figmaValue = hexToRgb('${options.value}');
        else if ('${type}' === 'FLOAT') figmaValue = parseFloat('${options.value}');
        else if ('${type}' === 'BOOLEAN') figmaValue = '${options.value}' === 'true';
        v.setValueForMode(modeId, figmaValue);
        ` : ''}
        return 'Created ${type.toLowerCase()} variable: ${name}';
      })()`;
      
      const result = await fastEval(code);
      console.log(chalk.green('✓ ' + result));
    });

  variables
    .command('visualize [collection]')
    .description('Create color swatches on canvas (shadcn-style layout)')
    .action(async (collection) => {
      const spinner = ora('Creating color palette...').start();
      const code = `(async () => {
        await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');

        const targetCols = ${collection ? `collections.filter(c => c.name.toLowerCase().includes('${collection}'.toLowerCase()))` : 'collections'};
        if (targetCols.length === 0) return 'No collections found';

        const filteredCols = targetCols.filter(c => !c.name.toLowerCase().includes('semantic'));
        if (filteredCols.length === 0) return 'No color collections found (only semantic)';

        let startX = 0;
        figma.currentPage.children.forEach(n => {
          startX = Math.max(startX, n.x + (n.width || 0));
        });
        startX += 100;

        let totalSwatches = 0;
        const colorOrder = ['slate','gray','zinc','neutral','stone','red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose','white','black'];

        for (const col of filteredCols) {
          const colVars = colorVars.filter(v => v.variableCollectionId === col.id);
          if (colVars.length === 0) continue;

          const groups = {};
          const semanticGroups = {
            'background': 'base', 'foreground': 'base', 'border': 'base', 'input': 'base', 'ring': 'base',
            'primary': 'primary', 'primary-foreground': 'primary',
            'secondary': 'secondary', 'secondary-foreground': 'secondary',
            'muted': 'muted', 'muted-foreground': 'muted',
            'accent': 'accent', 'accent-foreground': 'accent',
            'card': 'card', 'card-foreground': 'card',
            'popover': 'popover', 'popover-foreground': 'popover',
            'destructive': 'destructive', 'destructive-foreground': 'destructive',
            'chart-1': 'chart', 'chart-2': 'chart', 'chart-3': 'chart', 'chart-4': 'chart', 'chart-5': 'chart',
          };
          colVars.forEach(v => {
            const parts = v.name.split('/');
            let prefix;
            if (parts.length > 1) {
              prefix = parts[0];
            } else {
              prefix = semanticGroups[v.name] || 'other';
            }
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(v);
          });

          const semanticOrder = ['base','primary','secondary','muted','accent','card','popover','destructive','chart','sidebar'];
          const sortedGroups = Object.entries(groups).sort((a, b) => {
            const aColorIdx = colorOrder.indexOf(a[0]);
            const bColorIdx = colorOrder.indexOf(b[0]);
            if (aColorIdx !== -1 && bColorIdx !== -1) return aColorIdx - bColorIdx;
            return a[0].localeCompare(b[0]);
          });

          const container = figma.createFrame();
          container.name = col.name;
          container.x = startX;
          container.layoutMode = 'VERTICAL';
          container.primaryAxisSizingMode = 'AUTO';
          container.counterAxisSizingMode = 'AUTO';
          container.itemSpacing = 8;
          container.paddingTop = 32;
          container.paddingBottom = 32;
          container.paddingLeft = 32;
          container.paddingRight = 32;
          container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
          container.cornerRadius = 16;

          const title = figma.createText();
          title.characters = col.name;
          title.fontSize = 20;
          title.fontName = { family: 'Inter', style: 'Medium' };
          container.appendChild(title);

          const modeId = col.modes[0].modeId;
          for (const [groupName, vars] of sortedGroups) {
            const rowContainer = figma.createFrame();
            rowContainer.layoutMode = 'HORIZONTAL';
            rowContainer.primaryAxisSizingMode = 'AUTO';
            rowContainer.counterAxisSizingMode = 'AUTO';
            rowContainer.itemSpacing = 16;
            rowContainer.counterAxisAlignItems = 'CENTER';
            rowContainer.fills = [];
            container.appendChild(rowContainer);

            const label = figma.createText();
            label.characters = groupName;
            label.fontSize = 13;
            label.resize(80, label.height);
            label.textAlignHorizontal = 'RIGHT';
            rowContainer.appendChild(label);

            const swatchRow = figma.createFrame();
            swatchRow.layoutMode = 'HORIZONTAL';
            swatchRow.primaryAxisSizingMode = 'AUTO';
            swatchRow.counterAxisSizingMode = 'AUTO';
            swatchRow.fills = [];
            swatchRow.cornerRadius = 6;
            swatchRow.clipsContent = true;
            rowContainer.appendChild(swatchRow);

            for (const v of vars) {
              const swatch = figma.createFrame();
              swatch.name = v.name;
              swatch.resize(48, 32);
              swatch.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
              swatchRow.appendChild(swatch);
              
              try {
                let value = v.valuesByMode[modeId];
                if (value && value.r !== undefined) {
                  swatch.fills = [figma.variables.setBoundVariableForPaint(
                    { type: 'SOLID', color: { r: value.r, g: value.g, b: value.b } }, 'color', v
                  )];
                }
              } catch (e) {}
              totalSwatches++;
            }
          }
          startX += container.width + 60;
        }
        return 'Created ' + totalSwatches + ' swatches';
      })()`;

      try {
        const result = await fastEval(code);
        spinner.succeed(result);
      } catch (e) {
        spinner.fail('Failed to visualize variables: ' + e.message);
      }
    });

  variables
    .command('delete-all')
    .description('Delete all local variables and collections')
    .option('-c, --collection <name>', 'Only delete specific collection')
    .action(async (options) => {
      const spinner = ora('Deleting variables...').start();
      const code = `(async () => {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let deleted = 0;
        for (const col of collections) {
          if (${options.collection ? `col.name === '${options.collection}'` : 'true'}) {
            col.remove();
            deleted++;
          }
        }
        return 'Deleted ' + deleted + ' collections';
      })()`;
      
      try {
        const result = await fastEval(code);
        spinner.succeed(result);
      } catch (e) {
        spinner.fail('Failed: ' + e.message);
      }
    });
}
