import { Command } from '../cli/command.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __dirname = dirname(fileURLToPath(import.meta.url));
const palettesDir = join(__dirname, '..', 'data', 'palettes');

// Load palette from JSON file
function loadPalette(name) {
    return JSON.parse(readFileSync(join(palettesDir, name + '.json'), 'utf8'));
}

// Common Figma code for creating color variables from a palette object
function createPaletteCode(colorsJson, collectionName) {
    return `(async () => {
const colors = ${colorsJson};
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : null;
}
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${collectionName}');
if (!col) col = figma.variables.createVariableCollection('${collectionName}');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [colorName, shades] of Object.entries(colors)) {
  for (const [shade, hex] of Object.entries(shades)) {
    const varName = shade === 'DEFAULT' ? colorName : colorName + '/' + shade;
    const existing = existingVars.find(v => v.name === varName && v.variableCollectionId === col.id);
    if (!existing) {
      const v = figma.variables.createVariable(varName, col, 'COLOR');
      v.setValueForMode(modeId, hexToRgb(hex));
      count++;
    }
  }
}
return 'Created ' + count + ' color variables in ${collectionName}';
})()`;
}

// ── Tokens Commands ─────────────────────────────────

class TokensTailwindCommand extends Command {
    name = 'tokens tailwind';
    description = 'Create Tailwind CSS color palette';
    options = [
        { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Color - Primitive' }
    ];

    async execute(ctx, opts) {
        const spinner = ora('Creating Tailwind color palette...').start();
        const colors = loadPalette('tailwind');
        const code = createPaletteCode(JSON.stringify(colors), opts.collection);
        try {
            const result = await ctx.eval(code);
            spinner.succeed(result || 'Created Tailwind palette');
        } catch (error) {
            spinner.fail('Failed to create palette');
            console.error(error.message);
        }
    }
}

class TokensShadcnCommand extends Command {
    name = 'tokens shadcn';
    description = 'Create shadcn/ui color primitives (from v3.shadcn.com/colors)';
    options = [
        { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'shadcn/primitives' }
    ];

    async execute(ctx, opts) {
        const spinner = ora('Creating shadcn color primitives...').start();
        const colors = loadPalette('tailwind'); // shadcn primitives = tailwind palette
        const code = createPaletteCode(JSON.stringify(colors), opts.collection);
        try {
            const result = await ctx.eval(code);
            spinner.succeed(result || 'Created shadcn primitives');
        } catch (error) {
            spinner.fail('Failed to create shadcn colors');
            console.error(error.message);
        }
    }
}

class TokensPresetCommand extends Command {
    name = 'tokens preset <name>';
    description = 'Add color presets: shadcn, radix';

    async execute(ctx, opts, preset) {
        const presetLower = preset.toLowerCase();

        if (presetLower === 'shadcn') {
            const spinner = ora('Adding shadcn colors...').start();
            const shadcnData = loadPalette('shadcn');
            const primitives = shadcnData.primitives;
            const semanticTokens = shadcnData.semantic;

            const code = `(async () => {
const primitives = ${JSON.stringify(primitives)};
const semanticTokens = ${JSON.stringify(semanticTokens)};

function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : null;
}

const cols = await figma.variables.getLocalVariableCollectionsAsync();
let primCol = cols.find(c => c.name === 'shadcn/primitives');
if (!primCol) primCol = figma.variables.createVariableCollection('shadcn/primitives');
const primModeId = primCol.modes[0].modeId;

const existingVars = await figma.variables.getLocalVariablesAsync('COLOR');
const primVarMap = {};
let primCount = 0;

for (const [colorName, shades] of Object.entries(primitives)) {
  for (const [shade, hex] of Object.entries(shades)) {
    const varName = shade === 'DEFAULT' ? colorName : colorName + '/' + shade;
    let v = existingVars.find(ev => ev.name === varName && ev.variableCollectionId === primCol.id);
    if (!v) {
      v = figma.variables.createVariable(varName, primCol, 'COLOR');
      v.setValueForMode(primModeId, hexToRgb(hex));
      primCount++;
    }
    primVarMap[varName] = v;
  }
}

let semCol = cols.find(c => c.name === 'shadcn/semantic');
if (!semCol) semCol = figma.variables.createVariableCollection('shadcn/semantic');

let lightModeId = semCol.modes.find(m => m.name === 'Light')?.modeId;
let darkModeId = semCol.modes.find(m => m.name === 'Dark')?.modeId;

if (!lightModeId) {
  semCol.renameMode(semCol.modes[0].modeId, 'Light');
  lightModeId = semCol.modes[0].modeId;
}
if (!darkModeId) {
  darkModeId = semCol.addMode('Dark');
}

let semCount = 0;
for (const [name, refs] of Object.entries(semanticTokens)) {
  let v = existingVars.find(ev => ev.name === name && ev.variableCollectionId === semCol.id);
  if (!v) {
    v = figma.variables.createVariable(name, semCol, 'COLOR');
    semCount++;
  }
  const lightPrim = primVarMap[refs.light];
  if (lightPrim) v.setValueForMode(lightModeId, { type: 'VARIABLE_ALIAS', id: lightPrim.id });
  const darkPrim = primVarMap[refs.dark];
  if (darkPrim) v.setValueForMode(darkModeId, { type: 'VARIABLE_ALIAS', id: darkPrim.id });
}

return 'Created ' + primCount + ' primitives + ' + semCount + ' semantic tokens (Light/Dark)';
})()`;

            try {
                const result = await ctx.eval(code);
                spinner.succeed(result || 'Added shadcn colors');
                console.log(chalk.gray('\n  Collections created:'));
                console.log(chalk.gray('    • shadcn/primitives - 244 color primitives'));
                console.log(chalk.gray('    • shadcn/semantic   - 32 semantic tokens (Light/Dark mode)\n'));
            } catch (error) {
                spinner.fail('Failed to add shadcn');
                console.error(chalk.red(error.message));
            }

        } else if (presetLower === 'radix') {
            const spinner = ora('Adding Radix UI colors...').start();
            const radixColors = loadPalette('radix');
            const code = createPaletteCode(JSON.stringify(radixColors), 'radix/colors');

            try {
                const result = await ctx.eval(code);
                spinner.succeed(result || 'Added Radix UI colors');
                console.log(chalk.gray('\n  Collection created:'));
                console.log(chalk.gray('    • radix/colors - 156 colors (13 families × 12 steps)\n'));
            } catch (error) {
                spinner.fail('Failed to add Radix colors');
                console.error(chalk.red(error.message));
            }

        } else if (presetLower === 'material') {
            console.log(chalk.yellow('Material Design preset coming soon!'));
            console.log(chalk.gray('Available now: shadcn, radix'));
        } else {
            console.log(chalk.red(`Unknown preset: ${preset}`));
            console.log(chalk.gray('Available presets: shadcn, radix, material (coming soon)'));
        }
    }
}

class TokensSpacingCommand extends Command {
    name = 'tokens spacing';
    description = 'Create spacing scale (4px base)';
    options = [
        { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Spacing' }
    ];

    async execute(ctx, opts) {
        const spinner = ora('Creating spacing scale...').start();
        const spacings = {
            '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
            '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28,
            '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
            '14': 56, '16': 64, '20': 80, '24': 96, '28': 112,
            '32': 128, '36': 144, '40': 160, '44': 176, '48': 192
        };

        const code = `(async () => {
const spacings = ${JSON.stringify(spacings)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${opts.collection}');
if (!col) col = figma.variables.createVariableCollection('${opts.collection}');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(spacings)) {
  const existing = existingVars.find(v => v.name === 'spacing/' + name);
  if (!existing) {
    const v = figma.variables.createVariable('spacing/' + name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return 'Created ' + count + ' spacing variables';
})()`;

        try {
            const result = await ctx.eval(code);
            spinner.succeed(result || 'Created spacing scale');
        } catch (error) {
            spinner.fail('Failed to create spacing scale');
        }
    }
}

class TokensRadiiCommand extends Command {
    name = 'tokens radii';
    description = 'Create border radius scale';
    options = [
        { flags: '-c, --collection <name>', description: 'Collection name', defaultValue: 'Radii' }
    ];

    async execute(ctx, opts) {
        const spinner = ora('Creating border radii...').start();
        const radii = {
            'none': 0, 'sm': 2, 'default': 4, 'md': 6, 'lg': 8,
            'xl': 12, '2xl': 16, '3xl': 24, 'full': 9999
        };

        const code = `(async () => {
const radii = ${JSON.stringify(radii)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${opts.collection}');
if (!col) col = figma.variables.createVariableCollection('${opts.collection}');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(radii)) {
  const existing = existingVars.find(v => v.name === 'radius/' + name);
  if (!existing) {
    const v = figma.variables.createVariable('radius/' + name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return 'Created ' + count + ' radius variables';
})()`;

        try {
            const result = await ctx.eval(code);
            spinner.succeed(result || 'Created border radii');
        } catch (error) {
            spinner.fail('Failed to create radii');
        }
    }
}

class TokensImportCommand extends Command {
    name = 'tokens import <file>';
    description = 'Import tokens from JSON file';
    options = [
        { flags: '-c, --collection <name>', description: 'Collection name' }
    ];

    async execute(ctx, opts, file) {
        let tokensData;
        try {
            tokensData = JSON.parse(readFileSync(file, 'utf8'));
        } catch (error) {
            ctx.logError(`Could not read file: ${file}`);
            process.exit(1);
        }

        const spinner = ora('Importing tokens...').start();
        const collectionName = opts.collection || 'Imported Tokens';

        const code = `(async () => {
const data = ${JSON.stringify(tokensData)};
const collectionName = '${collectionName}';

function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (!r) return null;
  return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 };
}

function detectType(value) {
  if (typeof value === 'string' && value.startsWith('#')) return 'COLOR';
  if (typeof value === 'number') return 'FLOAT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  return 'STRING';
}

function flattenTokens(obj, prefix = '') {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    const name = prefix ? prefix + '/' + key : key;
    if (val && typeof val === 'object' && !val.value && !val.type) {
      result.push(...flattenTokens(val, name));
    } else {
      const value = val?.value ?? val;
      const type = val?.type?.toUpperCase() || detectType(value);
      result.push({ name, value, type });
    }
  }
  return result;
}

const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === collectionName);
if (!col) col = figma.variables.createVariableCollection(collectionName);
const modeId = col.modes[0].modeId;

const existingVars = await figma.variables.getLocalVariablesAsync();
const tokens = flattenTokens(data);
let count = 0;

for (const { name, value, type } of tokens) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    try {
      const figmaType = type === 'COLOR' ? 'COLOR' : type === 'FLOAT' || type === 'NUMBER' ? 'FLOAT' : type === 'BOOLEAN' ? 'BOOLEAN' : 'STRING';
      const v = figma.variables.createVariable(name, col, figmaType);
      let figmaValue = value;
      if (figmaType === 'COLOR') figmaValue = hexToRgb(value);
      if (figmaValue !== null) { v.setValueForMode(modeId, figmaValue); count++; }
    } catch (e) {}
  }
}

return 'Imported ' + count + ' tokens into ' + collectionName;
})()`;

        try {
            const result = await ctx.eval(code);
            spinner.succeed(result || 'Tokens imported');
        } catch (error) {
            spinner.fail('Failed to import tokens');
            console.error(error.message);
        }
    }
}

export default [
    new TokensTailwindCommand(),
    new TokensShadcnCommand(),
    new TokensPresetCommand(),
    new TokensSpacingCommand(),
    new TokensRadiiCommand(),
    new TokensImportCommand(),
];
