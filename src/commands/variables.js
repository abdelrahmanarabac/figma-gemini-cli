import { Command } from '../cli/command.js';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

class VarListCommand extends Command {
  name = 'var list';
  description = 'List all variables';

  async execute(ctx) {
    const code = `(async () => {
const vars = await figma.variables.getLocalVariablesAsync();
if (vars.length === 0) return 'No variables found';
return vars.map(v => v.resolvedType.padEnd(8) + ' ' + v.name).join('\\n');
})()`;
    const result = await ctx.eval(code);
    if (result) console.log(result);
  }
}

class VarCreateCommand extends Command {
  name = 'var create <name>';
  description = 'Create a variable';
  options = [
    { flags: '-c, --collection <id>', description: 'Collection ID or name', required: true },
    { flags: '-t, --type <type>', description: 'Type: COLOR, FLOAT, STRING, BOOLEAN', required: true },
    { flags: '-v, --value <value>', description: 'Initial value' }
  ];

  async execute(ctx, opts, name) {
    const type = opts.type.toUpperCase();
    const code = `(async () => {
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.id === '${opts.collection}' || c.name === '${opts.collection}');
if (!col) return 'Collection not found: ${opts.collection}';
const modeId = col.modes[0].modeId;

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : null;
}

const v = figma.variables.createVariable('${name}', col, '${type}');
${opts.value ? `
let figmaValue = '${opts.value}';
if ('${type}' === 'COLOR') figmaValue = hexToRgb('${opts.value}');
else if ('${type}' === 'FLOAT') figmaValue = parseFloat('${opts.value}');
else if ('${type}' === 'BOOLEAN') figmaValue = '${opts.value}' === 'true';
if (figmaValue !== null && figmaValue !== undefined) { try { v.setValueForMode(modeId, figmaValue); } catch(e) {} }
` : ''}
return 'Created ${type.toLowerCase()} variable: ${name}';
})()`;
    const result = await ctx.eval(code);
    if (result) console.log(result);
  }
}

class VarFindCommand extends Command {
  name = 'var find <pattern>';
  description = 'Find variables by name pattern';

  async execute(ctx, opts, pattern) {
    const code = `(async () => {
const vars = await figma.variables.getLocalVariablesAsync();
const matches = vars.filter(v => v.name.toLowerCase().includes('${pattern.toLowerCase()}'));
if (matches.length === 0) return 'No variables matching "${pattern}"';
return matches.map(v => v.resolvedType.padEnd(8) + ' ' + v.name).join('\\n');
})()`;
    const result = await ctx.eval(code);
    if (result) console.log(result);
  }
}

class VarVisualizeCommand extends Command {
  name = 'var visualize [collection]';
  description = 'Create color swatches on canvas (shadcn-style layout)';

  async execute(ctx, opts, collection) {
    const spinner = ora('Creating color palette...').start();

    // This is a long eval — the visualize code generates Figma frames with bound variables
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
figma.currentPage.children.forEach(n => { startX = Math.max(startX, n.x + (n.width || 0)); });
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
    if (parts.length > 1) { prefix = parts[0]; }
    else if (v.name.startsWith('sidebar-')) { prefix = 'sidebar'; }
    else { prefix = semanticGroups[v.name] || 'other'; }
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(v);
  });

  const semanticOrder = ['base','primary','secondary','muted','accent','card','popover','destructive','chart','sidebar'];
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const aColorIdx = colorOrder.indexOf(a[0]);
    const bColorIdx = colorOrder.indexOf(b[0]);
    const aSemanticIdx = semanticOrder.indexOf(a[0]);
    const bSemanticIdx = semanticOrder.indexOf(b[0]);
    if (aColorIdx !== -1 && bColorIdx !== -1) return aColorIdx - bColorIdx;
    if (aColorIdx !== -1) return -1;
    if (bColorIdx !== -1) return 1;
    if (aSemanticIdx !== -1 && bSemanticIdx !== -1) return aSemanticIdx - bSemanticIdx;
    return a[0].localeCompare(b[0]);
  });

  const container = figma.createFrame();
  container.name = col.name;
  container.x = startX; container.y = 0;
  container.layoutMode = 'VERTICAL';
  container.primaryAxisSizingMode = 'AUTO'; container.counterAxisSizingMode = 'AUTO';
  container.itemSpacing = 8;
  container.paddingTop = 32; container.paddingBottom = 32; container.paddingLeft = 32; container.paddingRight = 32;
  container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  container.cornerRadius = 16;

  const title = figma.createText();
  title.characters = col.name; title.fontSize = 20;
  title.fontName = { family: 'Inter', style: 'Medium' };
  title.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  container.appendChild(title);

  const spacer = figma.createFrame(); spacer.resize(1, 16); spacer.fills = [];
  container.appendChild(spacer);

  const modeId = col.modes[0].modeId;
  const swatchesToBind = [];

  for (const [groupName, vars] of sortedGroups) {
    const rowContainer = figma.createFrame();
    rowContainer.name = groupName;
    rowContainer.layoutMode = 'HORIZONTAL';
    rowContainer.primaryAxisSizingMode = 'AUTO'; rowContainer.counterAxisSizingMode = 'AUTO';
    rowContainer.itemSpacing = 16; rowContainer.counterAxisAlignItems = 'CENTER';
    rowContainer.fills = [];
    container.appendChild(rowContainer);

    const label = figma.createText();
    label.characters = groupName; label.fontSize = 13;
    label.fontName = { family: 'Inter', style: 'Medium' };
    label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    label.resize(80, label.height); label.textAlignHorizontal = 'RIGHT';
    rowContainer.appendChild(label);

    const swatchRow = figma.createFrame();
    swatchRow.layoutMode = 'HORIZONTAL';
    swatchRow.primaryAxisSizingMode = 'AUTO'; swatchRow.counterAxisSizingMode = 'AUTO';
    swatchRow.itemSpacing = 0; swatchRow.fills = [];
    swatchRow.cornerRadius = 6; swatchRow.clipsContent = true;
    rowContainer.appendChild(swatchRow);

    vars.sort((a, b) => {
      const aNum = parseInt(a.name.split('/').pop()) || 0;
      const bNum = parseInt(b.name.split('/').pop()) || 0;
      return aNum - bNum;
    });

    for (const v of vars) {
      const swatch = figma.createFrame();
      swatch.name = v.name; swatch.resize(48, 32);
      swatch.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      swatchRow.appendChild(swatch);
      swatchesToBind.push({ swatch, variable: v, modeId });
      totalSwatches++;
    }
  }

  for (const { swatch, variable, modeId } of swatchesToBind) {
    try {
      let value = variable.valuesByMode[modeId];
      if (value && value.type === 'VARIABLE_ALIAS') {
        const resolved = figma.variables.getVariableById(value.id);
        if (resolved) value = resolved.valuesByMode[Object.keys(resolved.valuesByMode)[0]];
      }
      if (value && value.r !== undefined) {
        swatch.fills = [figma.variables.setBoundVariableForPaint(
          { type: 'SOLID', color: { r: value.r, g: value.g, b: value.b } }, 'color', variable
        )];
      }
    } catch (e) {}
  }

  startX += container.width + 60;
}

figma.viewport.scrollAndZoomIntoView(figma.currentPage.children.slice(-filteredCols.length));
return 'Created ' + totalSwatches + ' color swatches';
})()`;

    try {
      const result = await ctx.eval(code);
      spinner.succeed(result || 'Created color palette');
    } catch (error) {
      spinner.fail('Failed to create palette');
      console.error(chalk.red(error.message));
    }
  }
}

class VarCreateBatchCommand extends Command {
  name = 'var create-batch <json>';
  description = 'Create multiple variables at once (faster than individual calls)';
  options = [
    { flags: '-c, --collection <id>', description: 'Collection ID or name', required: true }
  ];

  async execute(ctx, opts, json) {
    let vars;
    try { vars = JSON.parse(json); } catch {
      ctx.logError('Invalid JSON. Expected: [{"name": "color/red", "type": "COLOR", "value": "#ff0000"}, ...]');
      return;
    }
    if (!Array.isArray(vars)) { ctx.logError('Expected JSON array'); return; }

    const code = `(async () => {
const vars = ${JSON.stringify(vars)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.id === '${opts.collection}' || c.name === '${opts.collection}');
if (!col) return 'Collection not found: ${opts.collection}';
const modeId = col.modes[0].modeId;

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : null;
}

let created = 0;
for (const v of vars) {
  const type = (v.type || 'COLOR').toUpperCase();
  const variable = figma.variables.createVariable(v.name, col, type);
  if (v.value !== undefined) {
    let figmaValue = v.value;
    if (type === 'COLOR') figmaValue = hexToRgb(v.value);
    else if (type === 'FLOAT') figmaValue = parseFloat(v.value);
    else if (type === 'BOOLEAN') figmaValue = v.value === true || v.value === 'true';
    if (figmaValue !== null && figmaValue !== undefined) {
      try { variable.setValueForMode(modeId, figmaValue); } catch(e) {}
    }
  }
  created++;
}
return 'Created ' + created + ' variables';
})()`;

    const result = await ctx.eval(code);
    ctx.logSuccess(result || `Created ${vars.length} variables`);
  }
}

class VarDeleteAllCommand extends Command {
  name = 'var delete-all';
  description = 'Delete all local variables and collections';
  options = [
    { flags: '-c, --collection <name>', description: 'Only delete variables in this collection' }
  ];

  async execute(ctx, opts) {
    const spinner = ora('Deleting variables...').start();
    const filterCode = opts.collection
      ? `cols = cols.filter(c => c.name.includes('${opts.collection}'));`
      : '';

    const code = `(async () => {
let cols = await figma.variables.getLocalVariableCollectionsAsync();
${filterCode}
let deleted = 0;
for (const col of cols) {
  const vars = await figma.variables.getLocalVariablesAsync();
  const colVars = vars.filter(v => v.variableCollectionId === col.id);
  for (const v of colVars) { v.remove(); deleted++; }
  col.remove();
}
return 'Deleted ' + deleted + ' variables and ' + cols.length + ' collections';
})()`;

    try {
      const result = await ctx.eval(code);
      spinner.succeed(result);
    } catch (error) {
      spinner.fail('Failed to delete variables');
      console.error(chalk.red(error.message));
    }
  }
}

// ── Collections ─────────────────────────────────────

class ColListCommand extends Command {
  name = 'col list';
  description = 'List all variable collections';

  async execute(ctx) {
    const code = `(async () => {
const cols = await figma.variables.getLocalVariableCollectionsAsync();
if (cols.length === 0) return 'No collections found';
return cols.map(c => c.id + ' ' + c.name + ' (' + c.modes.map(m => m.name).join(', ') + ')').join('\\n');
})()`;
    const result = await ctx.eval(code);
    if (result) console.log(result);
  }
}

class ColCreateCommand extends Command {
  name = 'col create <name>';
  description = 'Create a variable collection';
  options = [
    { flags: '-m, --modes <modes>', description: 'Comma-separated mode names (e.g., "Light,Dark")' }
  ];

  async execute(ctx, opts, name) {
    const modes = opts.modes ? opts.modes.split(',').map(m => m.trim()) : [];
    const code = `(async () => {
const col = figma.variables.createVariableCollection('${name}');
${modes.length > 0 ? `
const modes = ${JSON.stringify(modes)};
col.renameMode(col.modes[0].modeId, modes[0]);
for (let i = 1; i < modes.length; i++) { col.addMode(modes[i]); }
` : ''}
return 'Created collection: ' + col.name + ' (id: ' + col.id + ')';
})()`;
    const result = await ctx.eval(code);
    if (result) console.log(result);
  }
}

export default [
  new VarListCommand(),
  new VarCreateCommand(),
  new VarFindCommand(),
  new VarVisualizeCommand(),
  new VarCreateBatchCommand(),
  new VarDeleteAllCommand(),
  new ColListCommand(),
  new ColCreateCommand(),
];
