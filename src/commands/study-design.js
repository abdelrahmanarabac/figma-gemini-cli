import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';

export class StudyDesignCommand extends Command {
    name = 'study-design';
    description = 'Extracts full design metadata from selected Figma nodes into .design-cache.json';

    options = [
        { flags: '-d, --depth <number>', description: 'Max recursion depth', defaultValue: '20' }
    ];

    async execute(ctx, opts) {
        const maxDepth = parseInt(opts.depth) || 20;
        const spinner = ora('Extracting design data from Figma...').start();

        // One big eval — extracts everything in a single round-trip
        const extractionCode = `(async () => {
const MAX_DEPTH = ${maxDepth};

function getSolidFillHex(node) {
  if (!node.fills || node.fills === figma.mixed || !Array.isArray(node.fills)) return null;
  const f = node.fills.find(f => f.type === 'SOLID' && f.visible !== false);
  if (!f) return null;
  const toHex = v => { const h = Math.round(v * 255).toString(16); return h.length === 1 ? '0' + h : h; };
  return '#' + toHex(f.color.r) + toHex(f.color.g) + toHex(f.color.b);
}

function getSolidStrokeHex(node) {
  if (!node.strokes || !Array.isArray(node.strokes)) return null;
  const s = node.strokes.find(s => s.type === 'SOLID' && s.visible !== false);
  if (!s) return null;
  const toHex = v => { const h = Math.round(v * 255).toString(16); return h.length === 1 ? '0' + h : h; };
  return '#' + toHex(s.color.r) + toHex(s.color.g) + toHex(s.color.b);
}

function extractNode(node, parentId, indexInParent, depth) {
  if (depth > MAX_DEPTH) return null;
  if (!node.visible) return null;

  const base = {
    id: node.id,
    name: node.name || '',
    type: node.type,
    parentId: parentId,
    indexInParent: indexInParent,
    x: Math.round(node.x || 0),
    y: Math.round(node.y || 0),
    width: Math.round(node.width || 0),
    height: Math.round(node.height || 0),
    absoluteX: 0,
    absoluteY: 0,
    opacity: node.opacity !== undefined ? node.opacity : 1,
    visible: node.visible,
    fills: getSolidFillHex(node),
    strokes: getSolidStrokeHex(node),
    strokeWeight: node.strokeWeight || 0,
    childIds: []
  };

  // Absolute coordinates from transform
  if (node.absoluteTransform) {
    base.absoluteX = Math.round(node.absoluteTransform[0][2]);
    base.absoluteY = Math.round(node.absoluteTransform[1][2]);
  }

  // Corner radius
  if ('cornerRadius' in node) {
    base.cornerRadius = node.cornerRadius !== figma.mixed ? node.cornerRadius : 0;
  } else {
    base.cornerRadius = 0;
  }

  // Layout properties (frames, components, instances)
  if ('layoutMode' in node) {
    base.layoutMode = node.layoutMode || 'NONE';
    base.layoutSizingH = node.layoutSizingHorizontal || 'FIXED';
    base.layoutSizingV = node.layoutSizingVertical || 'FIXED';
    base.primaryAxisAlign = node.primaryAxisAlignItems || 'MIN';
    base.counterAxisAlign = node.counterAxisAlignItems || 'MIN';
    base.layoutGrow = node.layoutGrow || 0;
    base.layoutPositioning = node.layoutPositioning || 'AUTO';
    base.layoutWrap = node.layoutWrap || 'NO_WRAP';
    base.paddingTop = node.paddingTop || 0;
    base.paddingRight = node.paddingRight || 0;
    base.paddingBottom = node.paddingBottom || 0;
    base.paddingLeft = node.paddingLeft || 0;
    base.itemSpacing = node.itemSpacing || 0;
    base.counterAxisSpacing = node.counterAxisSpacing || 0;
    base.clipsContent = node.clipsContent || false;
  }

  // Text properties
  if (node.type === 'TEXT') {
    base.characters = node.characters || '';
    base.fontSize = node.fontSize !== figma.mixed ? node.fontSize : 14;
    base.fontFamily = 'Inter';
    base.fontStyle = 'Regular';
    if (node.fontName && node.fontName !== figma.mixed) {
      base.fontFamily = node.fontName.family;
      base.fontStyle = node.fontName.style;
    }
    base.textAlignH = node.textAlignHorizontal || 'LEFT';
    base.textAlignV = node.textAlignVertical || 'TOP';
    base.textAutoResize = node.textAutoResize || 'NONE';
    // Text layout sizing
    if ('layoutSizingHorizontal' in node) {
      base.layoutSizingH = node.layoutSizingHorizontal || 'HUG';
      base.layoutSizingV = node.layoutSizingVertical || 'HUG';
    }
    if ('layoutGrow' in node) base.layoutGrow = node.layoutGrow || 0;
    if ('layoutPositioning' in node) base.layoutPositioning = node.layoutPositioning || 'AUTO';
  }

  // Component info
  base.isComponent = node.type === 'COMPONENT';
  base.isInstance = node.type === 'INSTANCE';
  base.mainComponentId = node.type === 'INSTANCE' && node.mainComponent ? node.mainComponent.id : null;

  // Recurse children
  const results = [base];
  if ('children' in node && node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const extracted = extractNode(child, node.id, i, depth + 1);
      if (extracted) {
        base.childIds.push(child.id);
        results.push(...extracted);
      }
    }
  }

  return results;
}

// Entry: extract from selection
const selection = figma.currentPage.selection;
if (selection.length === 0) {
  return { error: 'No selection. Select one or more frames to study.' };
}

const allNodes = [];
const rootIds = [];
for (let i = 0; i < selection.length; i++) {
  const extracted = extractNode(selection[i], selection[i].parent ? selection[i].parent.id : null, i, 0);
  if (extracted) {
    rootIds.push(selection[i].id);
    allNodes.push(...extracted);
  }
}

// Build flat nodes map
const nodes = {};
let totalFrames = 0, totalText = 0, totalComponents = 0, totalInstances = 0, maxDepthSeen = 0;
for (const n of allNodes) {
  nodes[n.id] = n;
  if (n.type === 'FRAME') totalFrames++;
  if (n.type === 'TEXT') totalText++;
  if (n.type === 'COMPONENT') totalComponents++;
  if (n.type === 'INSTANCE') totalInstances++;
}

// Compute max depth
function getDepth(id, d) {
  const node = nodes[id];
  if (!node || !node.childIds || node.childIds.length === 0) return d;
  let max = d;
  for (const cid of node.childIds) {
    max = Math.max(max, getDepth(cid, d + 1));
  }
  return max;
}
for (const rid of rootIds) maxDepthSeen = Math.max(maxDepthSeen, getDepth(rid, 0));

return {
  version: 1,
  timestamp: new Date().toISOString(),
  pageId: figma.currentPage.id,
  pageName: figma.currentPage.name,
  nodes: nodes,
  summary: {
    totalNodes: allNodes.length,
    totalFrames: totalFrames,
    totalText: totalText,
    totalComponents: totalComponents,
    totalInstances: totalInstances,
    maxDepth: maxDepthSeen,
    rootIds: rootIds
  }
};
})()`;

        try {
            const result = await ctx.eval(extractionCode);

            if (!result || result.error) {
                spinner.fail(result?.error || 'Extraction failed');
                return;
            }

            // Write cache file
            writeFileSync('.design-cache.json', JSON.stringify(result, null, 2));
            spinner.succeed('Design data extracted');

            // Print summary
            const s = result.summary;
            console.log(chalk.gray(`\n  Page: ${result.pageName}`));
            console.log(chalk.gray(`  Nodes: ${s.totalNodes} (${s.totalFrames} frames, ${s.totalText} text, ${s.totalComponents} components, ${s.totalInstances} instances)`));
            console.log(chalk.gray(`  Depth: ${s.maxDepth}`));
            console.log(chalk.gray(`  Roots: ${s.rootIds.join(', ')}`));
            console.log(chalk.green(`\n  Saved to .design-cache.json\n`));

        } catch (e) {
            spinner.fail('Failed to extract design data: ' + e.message);
        }
    }
}

export default new StudyDesignCommand();
