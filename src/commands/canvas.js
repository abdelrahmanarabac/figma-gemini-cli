import { Command } from '../cli/command.js';

// Helper: generate nodeSelector code snippet
function nodeSel(nodeId) {
    return nodeId
        ? `const node = await figma.getNodeByIdAsync('${nodeId}'); const nodes = node ? [node] : [];`
        : `const nodes = figma.currentPage.selection;`;
}

// Helper: hex → Figma rgb
function rgb(hex) {
    const h = hex.replace('#', '');
    return `{ r: ${(parseInt(h.slice(0, 2), 16) / 255).toFixed(3)}, g: ${(parseInt(h.slice(2, 4), 16) / 255).toFixed(3)}, b: ${(parseInt(h.slice(4, 6), 16) / 255).toFixed(3)} }`;
}

// ── Canvas ──────────────────────────────────────────

class CanvasInfoCommand extends Command {
    name = 'canvas info';
    description = 'Show canvas info (bounds, element count, free space)';

    async execute(ctx) {
        const code = `(function() {
const children = figma.currentPage.children;
if (children.length === 0) return JSON.stringify({ empty: true, message: 'Canvas is empty', nextX: 0, nextY: 0 });
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
children.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height); });
return JSON.stringify({ elements: children.length, bounds: { x: Math.round(minX), y: Math.round(minY), width: Math.round(maxX - minX), height: Math.round(maxY - minY) }, nextX: Math.round(maxX + 100), nextY: 0, frames: children.filter(n => n.type === 'FRAME').length, components: children.filter(n => n.type === 'COMPONENT').length }, null, 2);
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class CanvasNextCommand extends Command {
    name = 'canvas next';
    description = 'Get next free position on canvas';
    options = [
        { flags: '-g, --gap <n>', description: 'Gap from existing elements', defaultValue: '100' },
        { flags: '-d, --direction <dir>', description: 'Direction: right, below', defaultValue: 'right' }
    ];

    async execute(ctx, opts) {
        const below = opts.direction === 'below';
        const code = below
            ? `const c=figma.currentPage.children;if(!c.length)JSON.stringify({x:0,y:0});else{let m=-Infinity;c.forEach(n=>{m=Math.max(m,n.y+n.height)});JSON.stringify({x:0,y:Math.round(m+${opts.gap})})}`
            : `const c=figma.currentPage.children;if(!c.length)JSON.stringify({x:0,y:0});else{let m=-Infinity;c.forEach(n=>{m=Math.max(m,n.x+n.width)});JSON.stringify({x:Math.round(m+${opts.gap}),y:0})}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Find/Select/Get ─────────────────────────────────

class FindCommand extends Command {
    name = 'find <name>';
    description = 'Find nodes by name (partial match)';
    options = [
        { flags: '-t, --type <type>', description: 'Filter by type (FRAME, TEXT, etc.)' },
        { flags: '-l, --limit <n>', description: 'Limit results', defaultValue: '20' }
    ];

    async execute(ctx, opts, name) {
        const code = `(function() {
const results = [];
function search(node) {
  if (node.name && node.name.toLowerCase().includes('${name.toLowerCase()}')) {
    ${opts.type ? `if (node.type === '${opts.type.toUpperCase()}')` : ''}
    results.push({ id: node.id, name: node.name, type: node.type });
  }
  if (node.children && results.length < ${opts.limit}) node.children.forEach(search);
}
search(figma.currentPage);
return results.length === 0 ? 'No nodes found matching "${name}"' : results.slice(0, ${opts.limit}).map(r => r.id + ' [' + r.type + '] ' + r.name).join('\\n');
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SelectCommand extends Command {
    name = 'select <nodeId>';
    description = 'Select a node by ID';

    async execute(ctx, opts, nodeId) {
        const code = `(async () => { const n = await figma.getNodeByIdAsync('${nodeId}'); if (!n) return 'Node not found'; figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); return 'Selected: ' + n.name; })()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class GetCommand extends Command {
    name = 'get [nodeId]';
    description = 'Get properties of node or selection';

    async execute(ctx, opts, nodeId) {
        const sel = nodeId ? `const node = await figma.getNodeByIdAsync('${nodeId}');` : `const node = figma.currentPage.selection[0];`;
        const code = `(async () => { ${sel} if (!node) return 'No node found'; return JSON.stringify({ id: node.id, name: node.name, type: node.type, x: node.x, y: node.y, width: node.width, height: node.height, visible: node.visible, locked: node.locked, opacity: node.opacity, rotation: node.rotation, cornerRadius: node.cornerRadius, layoutMode: node.layoutMode, fills: node.fills?.length, strokes: node.strokes?.length, children: node.children?.length }, null, 2); })()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Delete/Duplicate/Arrange ────────────────────────

class DeleteCommand extends Command {
    name = 'delete [nodeId]';
    description = 'Delete node by ID or current selection';

    async execute(ctx, opts, nodeId) {
        const code = nodeId
            ? `(async () => { const n = await figma.getNodeByIdAsync('${nodeId}'); if (n) { n.remove(); return 'Deleted: ${nodeId}'; } return 'Node not found'; })()`
            : `const sel = figma.currentPage.selection; if (!sel.length) 'No selection'; else { const c = sel.length; sel.forEach(n => n.remove()); 'Deleted ' + c + ' elements'; }`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class DuplicateCommand extends Command {
    name = 'duplicate [nodeId]';
    description = 'Duplicate node by ID or current selection';
    options = [{ flags: '--offset <n>', description: 'Offset from original', defaultValue: '20' }];

    async execute(ctx, opts, nodeId) {
        const code = nodeId
            ? `(async () => { const n = await figma.getNodeByIdAsync('${nodeId}'); if (n) { const c = n.clone(); c.x += ${opts.offset}; c.y += ${opts.offset}; figma.currentPage.selection = [c]; return 'Duplicated: ' + c.id; } return 'Node not found'; })()`
            : `const sel = figma.currentPage.selection; if (!sel.length) 'No selection'; else { const clones = sel.map(n => { const c = n.clone(); c.x += ${opts.offset}; c.y += ${opts.offset}; return c; }); figma.currentPage.selection = clones; 'Duplicated ' + clones.length + ' elements'; }`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class ArrangeCommand extends Command {
    name = 'arrange';
    description = 'Arrange frames on canvas';
    options = [
        { flags: '-g, --gap <n>', description: 'Gap between frames', defaultValue: '100' },
        { flags: '-c, --cols <n>', description: 'Number of columns (0 = single row)', defaultValue: '0' }
    ];

    async execute(ctx, opts) {
        const code = `
const frames = figma.currentPage.children.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT');
if (frames.length === 0) 'No frames to arrange';
else {
  frames.sort((a, b) => a.name.localeCompare(b.name));
  let x = 0, y = 0, rowHeight = 0, col = 0;
  const gap = ${opts.gap}, cols = ${opts.cols};
  frames.forEach(f => {
    f.x = x; f.y = y;
    rowHeight = Math.max(rowHeight, f.height);
    if (cols > 0 && ++col >= cols) { col = 0; x = 0; y += rowHeight + gap; rowHeight = 0; }
    else { x += f.width + gap; }
  });
  'Arranged ' + frames.length + ' frames';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Set Commands ────────────────────────────────────

class SetFillCommand extends Command {
    name = 'set fill <color>';
    description = 'Set fill color';
    options = [{ flags: '-n, --node <id>', description: 'Node ID (uses selection if not set)' }];

    async execute(ctx, opts, color) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { if ('fills' in n) n.fills = [{ type: 'SOLID', color: ${rgb(color)} }]; });
return 'Fill set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetStrokeCommand extends Command {
    name = 'set stroke <color>';
    description = 'Set stroke color';
    options = [
        { flags: '-n, --node <id>', description: 'Node ID' },
        { flags: '-w, --weight <n>', description: 'Stroke weight', defaultValue: '1' }
    ];

    async execute(ctx, opts, color) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { if ('strokes' in n) { n.strokes = [{ type: 'SOLID', color: ${rgb(color)} }]; n.strokeWeight = ${opts.weight}; } });
return 'Stroke set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetRadiusCommand extends Command {
    name = 'set radius <value>';
    description = 'Set corner radius';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];

    async execute(ctx, opts, value) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { if ('cornerRadius' in n) n.cornerRadius = ${value}; });
return 'Radius set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetSizeCommand extends Command {
    name = 'set size <width> <height>';
    description = 'Set size';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];

    async execute(ctx, opts, width, height) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { if ('resize' in n) n.resize(${width}, ${height}); });
return 'Size set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetPosCommand extends Command {
    name = 'set pos <x> <y>';
    description = 'Set position';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];

    async execute(ctx, opts, x, y) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { n.x = ${x}; n.y = ${y}; });
return 'Position set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetOpacityCommand extends Command {
    name = 'set opacity <value>';
    description = 'Set opacity (0-1)';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];

    async execute(ctx, opts, value) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { if ('opacity' in n) n.opacity = ${value}; });
return 'Opacity set on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetNameCommand extends Command {
    name = 'set name <name>';
    description = 'Rename node';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];

    async execute(ctx, opts, name) {
        const code = `(async () => {
${nodeSel(opts.node)}
if (nodes.length === 0) return 'No node found';
nodes.forEach(n => { n.name = '${name.replace(/'/g, "\\'")}'; });
return 'Renamed ' + nodes.length + ' elements to ${name}';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SetAutolayoutCommand extends Command {
    name = 'set autolayout <direction>';
    description = 'Apply auto-layout to selection (row/col)';
    options = [
        { flags: '-g, --gap <n>', description: 'Gap between items', defaultValue: '8' },
        { flags: '-p, --padding <n>', description: 'Padding' }
    ];

    async execute(ctx, opts, direction) {
        const layoutMode = direction === 'col' || direction === 'vertical' ? 'VERTICAL' : 'HORIZONTAL';
        const code = `
const sel = figma.currentPage.selection;
if (sel.length === 0) 'No selection';
else {
  sel.forEach(n => {
    if (n.type === 'FRAME' || n.type === 'COMPONENT') {
      n.layoutMode = '${layoutMode}';
      n.primaryAxisSizingMode = 'AUTO';
      n.counterAxisSizingMode = 'AUTO';
      n.itemSpacing = ${opts.gap};
      ${opts.padding ? `n.paddingTop = n.paddingRight = n.paddingBottom = n.paddingLeft = ${opts.padding};` : ''}
    }
  });
  'Auto-layout applied to ' + sel.length + ' frames';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Bind Commands ───────────────────────────────────

function bindCode(varName, nodeOpt, property) {
    const propMap = {
        fill: `if ('fills' in n && n.fills.length > 0) { n.fills = [figma.variables.setBoundVariableForPaint(n.fills[0], 'color', v)]; }`,
        stroke: `if ('strokes' in n) { const s = n.strokes[0] || { type: 'SOLID', color: {r:0,g:0,b:0} }; n.strokes = [figma.variables.setBoundVariableForPaint(s, 'color', v)]; }`,
        radius: `if ('cornerRadius' in n) n.setBoundVariable('cornerRadius', v);`,
        gap: `if ('itemSpacing' in n) n.setBoundVariable('itemSpacing', v);`,
    };
    return `(async () => {
${nodeSel(nodeOpt)}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
nodes.forEach(n => { ${propMap[property]} });
return 'Bound ' + v.name + ' to ${property} on ' + nodes.length + ' elements';
})()`;
}

class BindFillCommand extends Command {
    name = 'bind fill <varName>';
    description = 'Bind color variable to fill';
    options = [{ flags: '-n, --node <id>', description: 'Node ID (uses selection if not set)' }];
    async execute(ctx, opts, varName) { const r = await ctx.eval(bindCode(varName, opts.node, 'fill')); if (r) console.log(r); }
}

class BindStrokeCommand extends Command {
    name = 'bind stroke <varName>';
    description = 'Bind color variable to stroke';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];
    async execute(ctx, opts, varName) { const r = await ctx.eval(bindCode(varName, opts.node, 'stroke')); if (r) console.log(r); }
}

class BindRadiusCommand extends Command {
    name = 'bind radius <varName>';
    description = 'Bind number variable to corner radius';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];
    async execute(ctx, opts, varName) { const r = await ctx.eval(bindCode(varName, opts.node, 'radius')); if (r) console.log(r); }
}

class BindGapCommand extends Command {
    name = 'bind gap <varName>';
    description = 'Bind number variable to auto-layout gap';
    options = [{ flags: '-n, --node <id>', description: 'Node ID' }];
    async execute(ctx, opts, varName) { const r = await ctx.eval(bindCode(varName, opts.node, 'gap')); if (r) console.log(r); }
}

class BindPaddingCommand extends Command {
    name = 'bind padding <varName>';
    description = 'Bind number variable to padding';
    options = [
        { flags: '-n, --node <id>', description: 'Node ID' },
        { flags: '-s, --side <side>', description: 'Side: top, right, bottom, left, all', defaultValue: 'all' }
    ];

    async execute(ctx, opts, varName) {
        const sides = opts.side === 'all'
            ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
            : [`padding${opts.side.charAt(0).toUpperCase() + opts.side.slice(1)}`];
        const code = `(async () => {
${nodeSel(opts.node)}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
const sides = ${JSON.stringify(sides)};
nodes.forEach(n => { sides.forEach(side => { if (side in n) n.setBoundVariable(side, v); }); });
return 'Bound ' + v.name + ' to padding on ' + nodes.length + ' elements';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class BindListCommand extends Command {
    name = 'bind list';
    description = 'List available variables for binding';
    options = [{ flags: '-t, --type <type>', description: 'Filter: COLOR, FLOAT' }];

    async execute(ctx, opts) {
        const code = `(async () => {
const vars = await figma.variables.getLocalVariablesAsync();
const filtered = vars${opts.type ? `.filter(v => v.resolvedType === '${opts.type.toUpperCase()}')` : ''};
return filtered.map(v => v.resolvedType.padEnd(8) + ' ' + v.name).join('\\n') || 'No variables';
})()`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Sizing Commands ─────────────────────────────────

class SizingHugCommand extends Command {
    name = 'sizing hug';
    description = 'Set to hug contents';
    options = [{ flags: '-a, --axis <axis>', description: 'Axis: both, h, v', defaultValue: 'both' }];

    async execute(ctx, opts) {
        const h = opts.axis === 'h' || opts.axis === 'both';
        const v = opts.axis === 'v' || opts.axis === 'both';
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    ${h ? `if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'HUG';` : ''}
    ${v ? `if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'HUG';` : ''}
    if (n.layoutMode) { n.primaryAxisSizingMode = 'AUTO'; n.counterAxisSizingMode = 'AUTO'; }
  });
  'Set hug on ' + nodes.length + ' elements';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SizingFillCommand extends Command {
    name = 'sizing fill';
    description = 'Set to fill container';
    options = [{ flags: '-a, --axis <axis>', description: 'Axis: both, h, v', defaultValue: 'both' }];

    async execute(ctx, opts) {
        const h = opts.axis === 'h' || opts.axis === 'both';
        const v = opts.axis === 'v' || opts.axis === 'both';
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    ${h ? `if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'FILL';` : ''}
    ${v ? `if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'FILL';` : ''}
  });
  'Set fill on ' + nodes.length + ' elements';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class SizingFixedCommand extends Command {
    name = 'sizing fixed <width> [height]';
    description = 'Set to fixed size';

    async execute(ctx, opts, width, height) {
        const h = height || width;
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'FIXED';
    if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'FIXED';
    if ('resize' in n) n.resize(${width}, ${h});
  });
  'Set fixed ${width}x${h} on ' + nodes.length + ' elements';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

// ── Layout Shortcuts ────────────────────────────────

class PaddingCommand extends Command {
    name = 'padding <value> [r] [b] [l]';
    description = 'Set padding (CSS-style: 1-4 values)';

    async execute(ctx, opts, value, r, b, l) {
        let top = value, right = r || value, bottom = b || value, left = l || r || value;
        if (!r) { right = value; bottom = value; left = value; }
        else if (!b) { bottom = value; left = r; }
        else if (!l) { left = r; }
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('paddingTop' in n) {
      n.paddingTop = ${top}; n.paddingRight = ${right};
      n.paddingBottom = ${bottom}; n.paddingLeft = ${left};
    }
  });
  'Set padding on ' + nodes.length + ' elements';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class GapCommand extends Command {
    name = 'gap <value>';
    description = 'Set auto-layout gap';

    async execute(ctx, opts, value) {
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => { if ('itemSpacing' in n) n.itemSpacing = ${value}; });
  'Set gap ${value} on ' + nodes.length + ' elements';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

class AlignCommand extends Command {
    name = 'align <alignment>';
    description = 'Align items: start, center, end, stretch';

    async execute(ctx, opts, alignment) {
        const map = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'STRETCH' };
        const val = map[alignment.toLowerCase()] || 'CENTER';
        const code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('primaryAxisAlignItems' in n) n.primaryAxisAlignItems = '${val}';
    if ('counterAxisAlignItems' in n) n.counterAxisAlignItems = '${val}';
  });
  'Aligned ' + nodes.length + ' elements to ${alignment}';
}`;
        const result = await ctx.eval(code);
        if (result) console.log(result);
    }
}

export default [
    // Canvas
    new CanvasInfoCommand(),
    new CanvasNextCommand(),
    // Find/Select/Get
    new FindCommand(),
    new SelectCommand(),
    new GetCommand(),
    // Manipulate
    new DeleteCommand(),
    new DuplicateCommand(),
    new ArrangeCommand(),
    // Set
    new SetFillCommand(),
    new SetStrokeCommand(),
    new SetRadiusCommand(),
    new SetSizeCommand(),
    new SetPosCommand(),
    new SetOpacityCommand(),
    new SetNameCommand(),
    new SetAutolayoutCommand(),
    // Bind
    new BindFillCommand(),
    new BindStrokeCommand(),
    new BindRadiusCommand(),
    new BindGapCommand(),
    new BindPaddingCommand(),
    new BindListCommand(),
    // Sizing
    new SizingHugCommand(),
    new SizingFillCommand(),
    new SizingFixedCommand(),
    // Layout
    new PaddingCommand(),
    new GapCommand(),
    new AlignCommand(),
];
