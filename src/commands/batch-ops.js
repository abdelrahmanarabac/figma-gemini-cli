import { Command } from '../cli/command.js';
import chalk from 'chalk';

class DeleteBatchCommand extends Command {
    name = 'delete-batch <nodeIds>';
    description = 'Delete multiple nodes at once (comma-separated IDs or JSON array)';

    async execute(ctx, opts, nodeIds) {
        let ids;
        try {
            ids = JSON.parse(nodeIds);
        } catch {
            ids = nodeIds.split(',').map(s => s.trim());
        }

        const code = `(async () => {
const ids = ${JSON.stringify(ids)};
let deleted = 0;
for (const id of ids) {
  const node = await figma.getNodeByIdAsync(id);
  if (node) { node.remove(); deleted++; }
}
return 'Deleted ' + deleted + ' nodes';
})()`;

        const result = await ctx.eval(code);
        ctx.logSuccess(result || 'Deleted nodes');
    }
}

class BindBatchCommand extends Command {
    name = 'bind-batch <json>';
    description = 'Bind variables to multiple nodes at once';

    async execute(ctx, opts, json) {
        let bindings;
        try {
            bindings = JSON.parse(json);
        } catch {
            ctx.logError('Invalid JSON. Expected: [{"nodeId": "1:234", "property": "fill", "variable": "primary/500"}, ...]');
            return;
        }

        const code = `(async () => {
const bindings = ${JSON.stringify(bindings)};
const vars = await figma.variables.getLocalVariablesAsync();
let bound = 0;
for (const b of bindings) {
  const node = await figma.getNodeByIdAsync(b.nodeId);
  if (!node) continue;
  const variable = vars.find(v => v.name === b.variable || v.name.endsWith('/' + b.variable));
  if (!variable) continue;
  const prop = b.property.toLowerCase();
  if (prop === 'fill' && 'fills' in node && node.fills.length > 0) {
    node.fills = [figma.variables.setBoundVariableForPaint(node.fills[0], 'color', variable)];
    bound++;
  } else if (prop === 'stroke' && 'strokes' in node && node.strokes.length > 0) {
    node.strokes = [figma.variables.setBoundVariableForPaint(node.strokes[0], 'color', variable)];
    bound++;
  } else if (prop === 'radius' && 'cornerRadius' in node) {
    node.setBoundVariable('cornerRadius', variable);
    bound++;
  } else if (prop === 'gap' && 'itemSpacing' in node) {
    node.setBoundVariable('itemSpacing', variable);
    bound++;
  } else if (prop === 'padding' && 'paddingTop' in node) {
    node.setBoundVariable('paddingTop', variable);
    node.setBoundVariable('paddingBottom', variable);
    node.setBoundVariable('paddingLeft', variable);
    node.setBoundVariable('paddingRight', variable);
    bound++;
  }
}
return 'Bound ' + bound + ' properties';
})()`;

        const result = await ctx.eval(code);
        ctx.logSuccess(result || 'Bound variables');
    }
}

class SetBatchCommand extends Command {
    name = 'set-batch <json>';
    description = 'Set properties on multiple nodes at once';

    async execute(ctx, opts, json) {
        let operations;
        try {
            operations = JSON.parse(json);
        } catch {
            ctx.logError('Invalid JSON. Expected: [{"nodeId": "1:234", "fill": "#ff0000", "radius": 8}, ...]');
            return;
        }

        const code = `(async () => {
const operations = ${JSON.stringify(operations)};
let updated = 0;
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : null;
}
for (const op of operations) {
  const node = await figma.getNodeByIdAsync(op.nodeId);
  if (!node) continue;
  if (op.fill && 'fills' in node) { const rgb = hexToRgb(op.fill); if (rgb) node.fills = [{ type: 'SOLID', color: rgb }]; }
  if (op.stroke && 'strokes' in node) { const rgb = hexToRgb(op.stroke); if (rgb) node.strokes = [{ type: 'SOLID', color: rgb }]; }
  if (op.strokeWidth !== undefined && 'strokeWeight' in node) node.strokeWeight = op.strokeWidth;
  if (op.radius !== undefined && 'cornerRadius' in node) node.cornerRadius = op.radius;
  if (op.opacity !== undefined && 'opacity' in node) node.opacity = op.opacity;
  if (op.name && 'name' in node) node.name = op.name;
  if (op.visible !== undefined && 'visible' in node) node.visible = op.visible;
  if (op.x !== undefined) node.x = op.x;
  if (op.y !== undefined) node.y = op.y;
  if (op.width !== undefined && op.height !== undefined && 'resize' in node) node.resize(op.width, op.height);
  updated++;
}
return 'Updated ' + updated + ' nodes';
})()`;

        const result = await ctx.eval(code);
        ctx.logSuccess(result || 'Updated nodes');
    }
}

class RenameBatchCommand extends Command {
    name = 'rename-batch <json>';
    description = 'Rename multiple nodes at once';

    async execute(ctx, opts, json) {
        let renames;
        try {
            renames = JSON.parse(json);
        } catch {
            ctx.logError('Invalid JSON. Expected: [{"nodeId": "1:234", "name": "New Name"}, ...] or {"1:234": "New Name", ...}');
            return;
        }

        let pairs;
        if (Array.isArray(renames)) {
            pairs = renames.map(r => ({ id: r.nodeId, name: r.name }));
        } else {
            pairs = Object.entries(renames).map(([id, name]) => ({ id, name }));
        }

        const code = `(async () => {
const pairs = ${JSON.stringify(pairs)};
let renamed = 0;
for (const p of pairs) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (node) { node.name = p.name; renamed++; }
}
return 'Renamed ' + renamed + ' nodes';
})()`;

        const result = await ctx.eval(code);
        ctx.logSuccess(result || 'Renamed nodes');
    }
}

export default [
    new DeleteBatchCommand(),
    new BindBatchCommand(),
    new SetBatchCommand(),
    new RenameBatchCommand(),
];
