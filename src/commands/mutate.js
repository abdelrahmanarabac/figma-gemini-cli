import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'fs';
import { mutate as mutateAI } from '../core/aiClient.js';

// ── Strict System Prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Figma node mutator. You receive JSX describing the current state of selected Figma nodes.

ABSOLUTE RULES:
1. You may ONLY modify nodes whose IDs exist in the input JSX.
2. Every "id" in your output MUST exactly match an ID from the input.
3. You MUST NOT create new nodes, new IDs, or new frames.
4. You MUST NOT invent node IDs.
5. If the goal cannot be achieved by mutating existing nodes, respond with:
   { "error": "Cannot achieve goal with mutation only" }
6. Use the mutate_nodes function. Do not return raw code.
7. Only set properties that need to change. Omit unchanged properties.
8. For text changes, use the exact node ID of the TEXT node, not its parent.
9. For layout changes, use the exact node ID of the FRAME node.`;

// ── Tool Schema ──────────────────────────────────────────────────
const TOOL_SCHEMA = {
  name: "mutate_nodes",
  description: "Mutates EXISTING Figma nodes by their exact IDs from the input JSX. Every ID must exist in the input. No new nodes allowed.",
  parameters: {
    type: "object",
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Exact node ID from input JSX." },
            text: { type: "string", description: "New text content (TEXT nodes only)." },
            fontSize: { type: "number" },
            fontWeight: { type: "string", enum: ["regular", "medium", "semibold", "bold"] },
            textColor: { type: "string", description: "Text fill color hex #RRGGBB." },
            bg: { type: "string", description: "Background fill hex #RRGGBB." },
            layout: { type: "string", enum: ["row", "col"] },
            justify: { type: "string", enum: ["start", "center", "end", "between"] },
            items: { type: "string", enum: ["start", "center", "end", "stretch"] },
            gap: { type: "number" },
            grow: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            sizingH: { type: "string", enum: ["FIXED", "HUG", "FILL"] },
            sizingV: { type: "string", enum: ["FIXED", "HUG", "FILL"] },
            padding: { type: "number", description: "Uniform padding all sides." },
            pt: { type: "number" }, pr: { type: "number" },
            pb: { type: "number" }, pl: { type: "number" },
            rounded: { type: "number" },
            opacity: { type: "number" },
            visible: { type: "boolean" },
            delete: { type: "boolean", description: "Remove this node." },
            name: { type: "string" }
          },
          required: ["id"],
          additionalProperties: false
        }
      }
    },
    required: ["updates"],
    additionalProperties: false
  }
};

// ── Serializer: cache node → JSX string ──────────────────────────
function nodeToJSX(node, cache, depth = 0) {
  const indent = '  '.repeat(depth);
  const attrs = [`id="${node.id}"`];

  if (node.name) attrs.push(`name="${node.name}"`);
  attrs.push(`w={${node.width}} h={${node.height}}`);

  if (node.type === 'TEXT') {
    if (node.fontSize) attrs.push(`size={${node.fontSize}}`);
    if (node.fontStyle && node.fontStyle !== 'Regular') attrs.push(`weight="${node.fontStyle.toLowerCase()}"`);
    if (node.fills) attrs.push(`color="${node.fills}"`);
    if (node.layoutSizingH) attrs.push(`sizingH="${node.layoutSizingH}"`);
    if (node.layoutGrow) attrs.push(`grow={${node.layoutGrow}}`);
    const safeText = (node.characters || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${indent}<Text ${attrs.join(' ')}>${safeText}</Text>`;
  }

  // Frame / Component / Instance
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    attrs.push(`flex="${node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'}"`);
  }
  if (node.fills) attrs.push(`bg="${node.fills}"`);
  if (node.cornerRadius > 0) attrs.push(`rounded={${node.cornerRadius}}`);
  if (node.opacity < 1) attrs.push(`opacity={${node.opacity}}`);

  // Sizing
  if (node.layoutSizingH) attrs.push(`sizingH="${node.layoutSizingH}"`);
  if (node.layoutSizingV) attrs.push(`sizingV="${node.layoutSizingV}"`);

  // Alignment
  if (node.primaryAxisAlign && node.primaryAxisAlign !== 'MIN') attrs.push(`justify="${node.primaryAxisAlign}"`);
  if (node.counterAxisAlign && node.counterAxisAlign !== 'MIN') attrs.push(`items="${node.counterAxisAlign}"`);

  // Spacing
  const pt = node.paddingTop || 0, pr = node.paddingRight || 0;
  const pb = node.paddingBottom || 0, pl = node.paddingLeft || 0;
  if (pt === pr && pt === pb && pt === pl) {
    if (pt > 0) attrs.push(`p={${pt}}`);
  } else {
    if (pt > 0) attrs.push(`pt={${pt}}`);
    if (pr > 0) attrs.push(`pr={${pr}}`);
    if (pb > 0) attrs.push(`pb={${pb}}`);
    if (pl > 0) attrs.push(`pl={${pl}}`);
  }
  if (node.itemSpacing > 0) attrs.push(`gap={${node.itemSpacing}}`);
  if (node.layoutGrow) attrs.push(`grow={${node.layoutGrow}}`);

  // Positioning
  if (node.layoutPositioning === 'ABSOLUTE') {
    attrs.push(`position="absolute" x={${node.x}} y={${node.y}}`);
  }

  // Component info
  if (node.isComponent) attrs.push('component={true}');
  if (node.isInstance) attrs.push(`instance="${node.mainComponentId}"`);

  // Children
  const childIds = node.childIds || [];
  if (childIds.length === 0) {
    return `${indent}<Frame ${attrs.join(' ')} />`;
  }

  const childJSX = childIds
    .map(cid => cache.nodes[cid] ? nodeToJSX(cache.nodes[cid], cache, depth + 1) : null)
    .filter(Boolean)
    .join('\n');

  return `${indent}<Frame ${attrs.join(' ')}>\n${childJSX}\n${indent}</Frame>`;
}

// ── Validator ────────────────────────────────────────────────────
const TEXT_ONLY_PROPS = ['text', 'fontSize', 'fontWeight', 'textColor'];
const FRAME_ONLY_PROPS = ['layout', 'justify', 'items', 'gap', 'grow', 'sizingH', 'sizingV', 'padding', 'pt', 'pr', 'pb', 'pl'];

function validateUpdates(updates, cache) {
  const errors = [];
  for (const u of updates) {
    if (!cache.nodes[u.id]) {
      errors.push({ id: u.id, error: 'ID not found in design cache' });
      continue;
    }
    const node = cache.nodes[u.id];
    for (const prop of TEXT_ONLY_PROPS) {
      if (u[prop] !== undefined && node.type !== 'TEXT') {
        errors.push({ id: u.id, error: `"${prop}" only valid on TEXT nodes, got ${node.type}` });
      }
    }
    for (const prop of FRAME_ONLY_PROPS) {
      if (u[prop] !== undefined && node.type === 'TEXT') {
        errors.push({ id: u.id, error: `"${prop}" not valid on TEXT nodes` });
      }
    }
  }
  return errors;
}

function buildUpdateCommands(updates) {
  const commands = [];

  const justifyMap = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN' };
  const itemsMap = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'STRETCH' };
  const weightMap = { regular: 'Regular', medium: 'Medium', semibold: 'Semi Bold', bold: 'Bold' };

  for (const u of updates) {
    if (u.delete) {
      commands.push({ command: 'node.delete', params: { nodeIds: [u.id] } });
      continue;
    }

    const props = {};

    if (u.text !== undefined) props.characters = u.text;
    if (u.fontSize !== undefined) props.fontSize = u.fontSize;
    if (u.fontWeight !== undefined) props.fontWeight = weightMap[u.fontWeight] || 'Regular';
    if (u.textColor !== undefined) props.fill = u.textColor;

    if (u.bg !== undefined) props.fill = u.bg;
    if (u.rounded !== undefined) props.cornerRadius = u.rounded;
    if (u.opacity !== undefined) props.opacity = u.opacity;
    if (u.visible !== undefined) props.visible = u.visible;
    if (u.name !== undefined) props.name = u.name;

    if (u.layout !== undefined) props.layoutMode = u.layout === 'row' ? 'HORIZONTAL' : 'VERTICAL';
    if (u.justify !== undefined) props.primaryAxisAlignItems = justifyMap[u.justify];
    if (u.items !== undefined) props.counterAxisAlignItems = itemsMap[u.items];
    if (u.gap !== undefined) props.itemSpacing = u.gap;
    if (u.grow !== undefined) props.layoutGrow = u.grow;

    if (u.width !== undefined) props.width = u.width;
    if (u.height !== undefined) props.height = u.height;
    if (u.sizingH !== undefined) props.layoutSizingHorizontal = u.sizingH;
    if (u.sizingV !== undefined) props.layoutSizingVertical = u.sizingV;

    if (u.padding !== undefined) props.padding = u.padding;
    if (u.pt !== undefined) props.paddingTop = u.pt;
    if (u.pr !== undefined) props.paddingRight = u.pr;
    if (u.pb !== undefined) props.paddingBottom = u.pb;
    if (u.pl !== undefined) props.paddingLeft = u.pl;

    commands.push({ command: 'node.update', params: { nodeId: u.id, props } });
  }

  return commands;
}


export class MutateCommand extends Command {
  name = 'mutate <prompt...>';
  description = 'Applies AI-driven mutations to selected Figma nodes using the design cache';

  async execute(ctx, opts, ...promptParts) {
    const prompt = promptParts.flat().join(' ');

    // 1. Load cache
    if (!existsSync('.design-cache.json')) {
      ctx.logError('No design cache found. Run "study-design" first to extract design data.');
      return;
    }

    let cache;
    try {
      cache = JSON.parse(readFileSync('.design-cache.json', 'utf8'));
    } catch (e) {
      ctx.logError('Failed to read .design-cache.json: ' + e.message);
      return;
    }

    // Warn if cache is stale (> 5 min)
    const cacheAge = Date.now() - new Date(cache.timestamp).getTime();
    if (cacheAge > 5 * 60 * 1000) {
      console.log(chalk.yellow('⚠ Design cache is ' + Math.round(cacheAge / 60000) + ' min old. Consider running study-design again.'));
    }

    // 2. Get current selection and slice relevant nodes
    const selection = await ctx.command('selection.get');
    if (!selection?.data || selection.data.length === 0) {
      ctx.logError('No nodes selected in Figma.');
      return;
    }
    const selectionIds = selection.data.map(n => n.id);

    // Find all selected nodes + descendants in cache
    const relevantIds = new Set();
    function collectDescendants(id) {
      if (!cache.nodes[id]) return;
      relevantIds.add(id);
      const node = cache.nodes[id];
      if (node.childIds) node.childIds.forEach(cid => collectDescendants(cid));
    }
    selectionIds.forEach(id => collectDescendants(id));

    if (relevantIds.size === 0) {
      ctx.logError('Selected nodes not found in cache. Run "study-design" again.');
      return;
    }

    // 3. Serialize to rich JSX
    const jsxParts = selectionIds
      .filter(id => cache.nodes[id])
      .map(id => nodeToJSX(cache.nodes[id], cache, 0));
    const fullJSX = jsxParts.join('\n\n');

    console.log(chalk.gray('\n--- Design Context (from cache) ---'));
    console.log(chalk.gray(fullJSX));
    console.log(chalk.gray('-----------------------------------\n'));

    // 4. LLM call → validate → execute
    const spinner = ora('AI is analyzing design...').start();
    let updates;
    try {
      const response = await mutateAI(SYSTEM_PROMPT, fullJSX, prompt, TOOL_SCHEMA);
      updates = response.updates;
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        spinner.fail('AI returned no mutations.');
        return;
      }
      spinner.succeed(`AI proposed ${updates.length} mutation(s)`);
    } catch (err) {
      spinner.fail('AI call failed: ' + err.message);
      return;
    }

    console.log(chalk.gray(JSON.stringify(updates, null, 2)));

    // 5. Validate
    const errors = validateUpdates(updates, cache);
    if (errors.length > 0) {
      console.log(chalk.red('\n✗ Validation failed:'));
      errors.forEach(e => console.log(chalk.red(`  ${e.id}: ${e.error}`)));
      return;
    }
    console.log(chalk.green('✓ Validation passed'));

    // 6. Execute
    const execSpinner = ora('Applying mutations...').start();
    try {
      const { sendBatch } = await import('../transport/bridge.js');
      const cmds = buildUpdateCommands(updates);
      const res = await sendBatch(cmds);
      const results = res.data || [];

      execSpinner.succeed('Mutations applied');
      if (Array.isArray(results)) {
        const ok = results.filter(r => r.status === 'ok').length;
        const fail = results.filter(r => r.status !== 'ok').length;
        console.log(chalk.gray(`  ${ok} succeeded, ${fail} failed`));
        results.filter(r => r.status !== 'ok').forEach(r => console.log(chalk.red(`  ✗ ${r.error}`)));
      }
    } catch (e) {
      execSpinner.fail('Mutation execution failed: ' + e.message);
    }
  }

  // Public method for programmatic use
  async applyUpdates(ctx, updates, cache) {
    // 5. Validate
    const errors = validateUpdates(updates, cache);
    if (errors.length > 0) {
      return { ok: false, errors };
    }

    // 6. Execute
    const spinner = ora('Applying mutations...').start();
    try {
      const { sendBatch } = await import('../transport/bridge.js');
      const cmds = buildUpdateCommands(updates);
      const res = await sendBatch(cmds);
      spinner.succeed('Mutations applied');
      return { ok: true, results: res.data };
    } catch (e) {
      spinner.fail('Mutation failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }
}

export { SYSTEM_PROMPT, TOOL_SCHEMA, nodeToJSX, validateUpdates, buildUpdateCommands };
export default new MutateCommand();
