import { Command } from '../cli/command.js';
import ora from 'ora';
import chalk from 'chalk';

class TokensExtractCommand extends Command {
    name = 'tokens extract';
    description = 'Extract shadows and text styles from selection into design tokens';

    async execute(ctx, opts) {
        const spinner = ora('Scanning selection...').start();

        const code = `(async () => {
function toRgba(color, opacity) {
    return 'rgba(' + Math.round(color.r*255) + ',' + Math.round(color.g*255) + ',' + Math.round(color.b*255) + ',' + opacity.toFixed(2) + ')';
}

const selection = figma.currentPage.selection;
if (selection.length === 0) {
    return { error: 'No nodes selected. Please select a frame.' };
}

const textNodes = [];
const effectNodes = [];

function walk(node) {
    if (node.type === 'TEXT') textNodes.push(node);
    if (node.effects && node.effects.length > 0) effectNodes.push(node);
    if ('children' in node) {
        for (const child of node.children) walk(child);
    }
}

selection.forEach(walk);

const fontFamilies = new Set();
const fontWeights = new Set();
const fontSizes = new Set();
const lineHeights = new Set();
const letterSpacings = new Set();
const shadows = new Set();
let mixedCount = 0;

for (const node of textNodes) {
    if (node.fontName === figma.mixed || node.fontSize === figma.mixed || node.lineHeight === figma.mixed || node.letterSpacing === figma.mixed) {
        mixedCount++;
        continue;
    }
    if (node.fontName) {
        fontFamilies.add(node.fontName.family);
        fontWeights.add(node.fontName.style);
    }
    if (node.fontSize) fontSizes.add(node.fontSize);
    
    if (node.lineHeight && node.lineHeight.unit !== 'AUTO') {
        const lh = node.lineHeight.unit === 'PERCENT' 
            ? Math.round(node.fontSize * (node.lineHeight.value / 100)) 
            : Math.round(node.lineHeight.value);
        lineHeights.add(lh);
    }
    
    if (node.letterSpacing) {
        const ls = node.letterSpacing.unit === 'PERCENT'
            ? Number((node.fontSize * (node.letterSpacing.value / 100)).toFixed(1))
            : Number(node.letterSpacing.value.toFixed(1));
        letterSpacings.add(ls);
    }
}

for (const node of effectNodes) {
    for (const effect of node.effects) {
        if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.visible) {
            const isInner = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
            const blur = effect.radius;
            const shadowStr = isInner + effect.offset.x + 'px ' + effect.offset.y + 'px ' + blur + 'px ' + effect.spread + 'px ' + toRgba(effect.color, effect.color.a);
            shadows.add(shadowStr);
        }
    }
}

return {
    textNodes: textNodes.length,
    mixedCount,
    fontFamilies: Array.from(fontFamilies).sort(),
    fontWeights: Array.from(fontWeights).sort(),
    fontSizes: Array.from(fontSizes).sort((a,b)=>a-b),
    lineHeights: Array.from(lineHeights).sort((a,b)=>a-b),
    letterSpacings: Array.from(letterSpacings).sort((a,b)=>a-b),
    shadows: Array.from(shadows).sort()
};
})()`;

        try {
            const result = await ctx.eval(code);

            if (result && result.error) {
                spinner.fail(result.error);
                return;
            }

            spinner.succeed('Scanning complete');

            console.log(chalk.cyan('\n  Extraction Summary:'));
            console.log(chalk.gray(`    Text nodes found: ${result.textNodes}`));
            if (result.mixedCount > 0) console.log(chalk.yellow(`    Skipped TEXT nodes due to mixed properties: ${result.mixedCount}`));
            console.log(chalk.gray(`    Unique font families: ${result.fontFamilies.length}`));
            console.log(chalk.gray(`    Unique font sizes: ${result.fontSizes.length}`));
            console.log(chalk.gray(`    Unique font weights: ${result.fontWeights.length}`));
            console.log(chalk.gray(`    Unique line heights: ${result.lineHeights.length}`));
            console.log(chalk.gray(`    Unique letter spacings: ${result.letterSpacings.length}`));
            console.log(chalk.gray(`    Unique shadows: ${result.shadows.length}\n`));

            if (result.fontSizes.length === 0 && result.shadows.length === 0) {
                console.log(chalk.yellow('  No text styles or shadows found to extract.'));
                return;
            }

            const genSpinner = ora('Generating tokens in Figma Variables...').start();

            const genCode = `(async () => {
const data = ${JSON.stringify(result)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const existingVars = await figma.variables.getLocalVariablesAsync();

async function getOrCreateCol(name) {
    let col = cols.find(c => c.name === name);
    if (!col) col = figma.variables.createVariableCollection(name);
    return col;
}

const typoCol = await getOrCreateCol('Typography');
const typoMode = typoCol.modes[0].modeId;

const shadowCol = await getOrCreateCol('Shadows');
const shadowMode = shadowCol.modes[0].modeId;

let created = 0;

function safeCreate(name, col, type, value, modeId) {
    const existing = existingVars.find(v => v.name === name && v.variableCollectionId === col.id);
    if (!existing) {
        try {
            const v = figma.variables.createVariable(name, col, type);
            v.setValueForMode(modeId, value);
            created++;
        } catch(e) {}
    }
}

data.fontFamilies.forEach(v => safeCreate('font-family/' + v.toLowerCase().replace(/\\s+/g, '-'), typoCol, 'STRING', v, typoMode));
data.fontWeights.forEach(v => safeCreate('font-weight/' + v.toLowerCase(), typoCol, 'STRING', v, typoMode));
data.fontSizes.forEach(v => safeCreate('font-size/' + v, typoCol, 'FLOAT', v, typoMode));
data.lineHeights.forEach(v => safeCreate('line-height/' + v, typoCol, 'FLOAT', v, typoMode));
data.letterSpacings.forEach(v => safeCreate('letter-spacing/' + Math.abs(v), typoCol, 'FLOAT', v, typoMode));
data.shadows.forEach((v, idx) => safeCreate('shadow/' + ((idx+1)*100), shadowCol, 'STRING', v, shadowMode));

return created;
})()`;

            const genResult = await ctx.eval(genCode);
            genSpinner.succeed(`Generated ${genResult} new design tokens.\n`);

        } catch (error) {
            spinner.fail('Failed to extract tokens');
            console.error(chalk.red(error.message));
        }
    }
}

export default new TokensExtractCommand();
