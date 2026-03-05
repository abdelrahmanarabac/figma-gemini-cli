/**
 * Figma CLI Bridge Plugin — v2 Structured Commands
 *
 * All messages route through the structured command handler (msg.type === 'command').
 * The 'eval' handler exists for incremental migration of legacy commands.
 * New commands MUST use dedicated handlers, not eval.
 */

figma.showUI(__html__, {
  width: 160,
  height: 72,
  position: { x: -9999, y: 9999 }
});

// ── Command Handlers ─────────────────────────────────

const handlers = {

  'health': async () => ({ status: 'ok' }),

  'page.info': async () => {
    const page = figma.currentPage;
    return {
      name: page.name,
      id: page.id,
      childCount: page.children.length,
    };
  },

  'page.list': async () => {
    return figma.root.children.map(p => ({ id: p.id, name: p.name }));
  },

  'canvas.bounds': async () => {
    const nodes = figma.currentPage.children;
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return { minX, minY, maxX, maxY };
  },

  'selection.get': async () => {
    return figma.currentPage.selection.map(n => serializeNode(n, 1));
  },

  'selection.set': async (params) => {
    const nodes = params.nodeIds.map(id => figma.getNodeById(id)).filter(Boolean);
    figma.currentPage.selection = nodes;
    return { selected: nodes.length };
  },

  'node.read': async (params) => {
    const node = figma.getNodeById(params.nodeId);
    if (!node) throw new Error(`Node ${params.nodeId} not found`);
    return serializeNode(node, params.depth || 2);
  },

  'node.find': async (params) => {
    const query = (params.query || '').toLowerCase();
    const limit = params.limit || 50;
    const results = [];
    figma.currentPage.findAll(n => {
      if (results.length >= limit) return false;
      if (n.name.toLowerCase().includes(query)) {
        if (!params.type || n.type === params.type) {
          results.push({ id: n.id, name: n.name, type: n.type, width: n.width, height: n.height });
          return true;
        }
      }
      return false;
    });
    return results;
  },

  'node.create': async (params) => {
    const node = await createNode(params.type, params.props || {}, params.parentId);
    return { nodeId: node.id, name: node.name };
  },

  'node.update': async (params) => {
    const node = figma.getNodeById(params.nodeId);
    if (!node) throw new Error(`Node ${params.nodeId} not found`);
    applyProps(node, params.props || {});
    return { nodeId: node.id, name: node.name };
  },

  'node.delete': async (params) => {
    const ids = params.nodeIds || [];
    let deleted = 0;
    for (const id of ids) {
      const node = figma.getNodeById(id);
      if (node) { node.remove(); deleted++; }
    }
    return { deleted };
  },

  'node.toComponent': async (params) => {
    const results = [];
    for (const id of (params.nodeIds || [])) {
      const node = figma.getNodeById(id);
      if (node && 'type' in node && node.type === 'FRAME') {
        const comp = figma.createComponentFromNode(node);
        results.push({ nodeId: comp.id, name: comp.name });
      }
    }
    return results;
  },

  'variable.list': async (params) => {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const results = [];
    for (const col of collections) {
      if (params.collection && col.name !== params.collection) continue;
      for (const varId of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(varId);
        if (v) {
          if (params.type && v.resolvedType !== params.type) continue;
          results.push({
            id: v.id,
            name: v.name,
            type: v.resolvedType,
            collection: col.name,
          });
        }
      }
    }
    return results;
  },

  'collection.list': async () => {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    return collections.map(c => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map(m => ({ id: m.modeId, name: m.name })),
      variableCount: c.variableIds.length,
    }));
  },

  'batch': async (params) => {
    const results = [];
    for (const cmd of (params.commands || [])) {
      const handler = handlers[cmd.command];
      if (!handler) {
        results.push({ error: `Unknown command: ${cmd.command}` });
        continue;
      }
      try {
        const result = await handler(cmd.params || {});
        results.push({ status: 'ok', data: result });
      } catch (err) {
        results.push({ status: 'error', error: err.message });
      }
    }
    return results;
  },

  // Controlled eval — legacy migration only. Routes through the same
  // command protocol pipeline. New commands should NOT use this.
  'eval': async (params) => {
    if (!params.code) throw new Error('Missing "code" parameter');
    let code = params.code.trim();
    if (!code.startsWith('return ')) {
      const isSimpleExpr = !code.includes(';');
      const isIIFE = code.startsWith('(function') || code.startsWith('(async function');
      const isArrowIIFE = code.startsWith('(() =>') || code.startsWith('(async () =>');
      if (isSimpleExpr || isIIFE || isArrowIIFE) {
        code = `return ${code}`;
      } else {
        const lastSemicolon = code.lastIndexOf(';');
        if (lastSemicolon !== -1) {
          const beforeLast = code.substring(0, lastSemicolon + 1);
          const lastStmt = code.substring(lastSemicolon + 1).trim();
          if (lastStmt && !lastStmt.startsWith('return ')) {
            code = beforeLast + ' return ' + lastStmt;
          }
        }
      }
    }
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const fn = new AsyncFunction('figma', `return (async () => { ${code} })()`);
    return await fn(figma);
  },

  'render': async (params) => {
    // Basic render: create a frame
    const frame = figma.createFrame();
    frame.name = 'Rendered Frame';
    frame.resize(100, 100);
    figma.currentPage.appendChild(frame);
    return { nodeId: frame.id, name: frame.name };
  },
};

// ── Node Creation ─────────────────────────────────────

async function createNode(type, props, parentId) {
  let node;
  const parent = parentId ? figma.getNodeById(parentId) : figma.currentPage;

  switch (type) {
    case 'FRAME':
      node = figma.createFrame();
      break;
    case 'RECTANGLE':
      node = figma.createRectangle();
      break;
    case 'ELLIPSE':
      node = figma.createEllipse();
      break;
    case 'TEXT':
      node = figma.createText();
      await figma.loadFontAsync({ family: props.fontFamily || 'Inter', style: getFontStyle(props.fontWeight) });
      break;
    case 'LINE':
      node = figma.createLine();
      break;
    case 'COMPONENT':
      node = figma.createComponent();
      break;
    case 'GROUP': {
      // Groups need children first — create a temp frame
      const rect = figma.createRectangle();
      rect.resize(100, 100);
      if (parent && 'appendChild' in parent) parent.appendChild(rect);
      node = figma.group([rect], parent || figma.currentPage);
      rect.remove();
      break;
    }
    default:
      node = figma.createFrame();
  }

  if (parent && 'appendChild' in parent && type !== 'GROUP') {
    parent.appendChild(node);
  }

  applyProps(node, props);

  // Handle children recursively
  if (props.children && Array.isArray(props.children)) {
    for (const childDef of props.children) {
      await createNode(childDef.type || 'FRAME', childDef.props || childDef, node.id);
    }
  }

  return node;
}

function getFontStyle(weight) {
  if (!weight) return 'Regular';
  const w = typeof weight === 'string' ? weight : String(weight);
  const map = {
    '100': 'Thin', '200': 'Extra Light', '300': 'Light',
    '400': 'Regular', '500': 'Medium', '600': 'Semi Bold',
    '700': 'Bold', '800': 'Extra Bold', '900': 'Black',
    'thin': 'Thin', 'light': 'Light', 'regular': 'Regular',
    'normal': 'Regular', 'medium': 'Medium', 'semibold': 'Semi Bold',
    'bold': 'Bold', 'extrabold': 'Extra Bold', 'black': 'Black',
  };
  return map[w] || 'Regular';
}

// ── Property Applicator ──────────────────────────────

function applyProps(node, props) {
  // Name
  if (props.name) node.name = props.name;

  // Size
  if (props.width !== undefined || props.height !== undefined) {
    node.resize(
      props.width || node.width || 100,
      props.height || node.height || 100
    );
  }

  // Fill color
  if (props.fill) {
    const color = parseColor(props.fill);
    if (color) node.fills = [{ type: 'SOLID', color }];
  }

  // Stroke
  if (props.stroke) {
    const color = parseColor(props.stroke);
    if (color) node.strokes = [{ type: 'SOLID', color }];
  }
  if (props.strokeWidth !== undefined) node.strokeWeight = props.strokeWidth;
  if (props.strokeAlign) {
    const map = { inside: 'INSIDE', outside: 'OUTSIDE', center: 'CENTER' };
    node.strokeAlign = map[props.strokeAlign] || 'CENTER';
  }

  // Corner radius
  if (props.cornerRadius !== undefined) node.cornerRadius = props.cornerRadius;
  if (props.topLeftRadius !== undefined) node.topLeftRadius = props.topLeftRadius;
  if (props.topRightRadius !== undefined) node.topRightRadius = props.topRightRadius;
  if (props.bottomLeftRadius !== undefined) node.bottomLeftRadius = props.bottomLeftRadius;
  if (props.bottomRightRadius !== undefined) node.bottomRightRadius = props.bottomRightRadius;
  if (props.cornerSmoothing !== undefined) node.cornerSmoothing = props.cornerSmoothing;

  // Opacity
  if (props.opacity !== undefined) node.opacity = props.opacity;

  // Layout
  if (props.layoutMode && 'layoutMode' in node) {
    node.layoutMode = props.layoutMode; // HORIZONTAL or VERTICAL
    node.primaryAxisSizingMode = 'AUTO';
    node.counterAxisSizingMode = 'AUTO';
  }
  if (props.itemSpacing !== undefined && 'itemSpacing' in node) node.itemSpacing = props.itemSpacing;
  if (props.counterAxisSpacing !== undefined && 'counterAxisSpacing' in node) node.counterAxisSpacing = props.counterAxisSpacing;
  if (props.layoutWrap && 'layoutWrap' in node) node.layoutWrap = props.layoutWrap;
  if (props.layoutGrow !== undefined && 'layoutGrow' in node) node.layoutGrow = props.layoutGrow;

  // Padding
  if (props.padding !== undefined) {
    node.paddingTop = node.paddingRight = node.paddingBottom = node.paddingLeft = props.padding;
  }
  if (props.paddingHorizontal !== undefined) {
    node.paddingLeft = node.paddingRight = props.paddingHorizontal;
  }
  if (props.paddingVertical !== undefined) {
    node.paddingTop = node.paddingBottom = props.paddingVertical;
  }
  if (props.paddingTop !== undefined) node.paddingTop = props.paddingTop;
  if (props.paddingRight !== undefined) node.paddingRight = props.paddingRight;
  if (props.paddingBottom !== undefined) node.paddingBottom = props.paddingBottom;
  if (props.paddingLeft !== undefined) node.paddingLeft = props.paddingLeft;

  // Alignment
  if (props.primaryAxisAlignItems && 'primaryAxisAlignItems' in node) {
    node.primaryAxisAlignItems = props.primaryAxisAlignItems;
  }
  if (props.counterAxisAlignItems && 'counterAxisAlignItems' in node) {
    node.counterAxisAlignItems = props.counterAxisAlignItems;
  }

  // Sizing mode
  if (props.layoutAlign && 'layoutAlign' in node) node.layoutAlign = props.layoutAlign;

  // Clipping
  if (props.clipsContent !== undefined && 'clipsContent' in node) {
    node.clipsContent = props.clipsContent;
  }

  // Text-specific
  if ('characters' in node && props.characters) {
    node.characters = props.characters;
  }
  if ('fontSize' in node && props.fontSize) node.fontSize = props.fontSize;
  if ('fills' in node && props.color) {
    const color = parseColor(props.color);
    if (color) node.fills = [{ type: 'SOLID', color }];
  }

  // Position
  if (props.x !== undefined) node.x = props.x;
  if (props.y !== undefined) node.y = props.y;
  if (props.rotation !== undefined) node.rotation = props.rotation;

  // Blend mode
  if (props.blendMode && 'blendMode' in node) node.blendMode = props.blendMode.toUpperCase();
}

function parseColor(input) {
  if (typeof input !== 'string') return null;
  const hex = input.replace('#', '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    };
  }
  // Named colors
  const named = { white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#00ff00', gray: '#888888', grey: '#888888' };
  if (named[input.toLowerCase()]) return parseColor(named[input.toLowerCase()]);
  return null;
}

// ── Serialization ────────────────────────────────────

function serializeNode(node, depth = 1) {
  const data = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };

  if ('opacity' in node) data.opacity = node.opacity;
  if ('fills' in node) {
    try { data.fills = JSON.parse(JSON.stringify(node.fills)); } catch (e) { }
  }
  if ('cornerRadius' in node) data.cornerRadius = node.cornerRadius;
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    data.layoutMode = node.layoutMode;
    data.itemSpacing = node.itemSpacing;
  }
  if ('characters' in node) {
    data.characters = node.characters;
    data.fontSize = node.fontSize;
  }

  if (depth > 0 && 'children' in node) {
    data.children = node.children.map(c => serializeNode(c, depth - 1));
  }

  return data;
}

// ── Message Router ───────────────────────────────────

figma.ui.onmessage = async (msg) => {
  // New structured command protocol
  if (msg.action === 'command') {
    const handler = handlers[msg.command];
    if (!handler) {
      figma.ui.postMessage({
        type: 'result',
        id: msg.id,
        error: `Unknown command: ${msg.command}`,
      });
      return;
    }

    try {
      const result = await handler(msg.params || {});
      figma.ui.postMessage({ type: 'result', id: msg.id, result });
    } catch (err) {
      figma.ui.postMessage({ type: 'result', id: msg.id, error: err.message });
    }
    return;
  }



  if (msg.type === 'connected') {
    figma.notify('✓ FigCli connected', { timeout: 2000 });
  }
  if (msg.type === 'disconnected') {
    figma.notify('FigCli disconnected', { timeout: 2000 });
  }
};

figma.on('close', () => { });
console.log('FigCli plugin started (v2 — structured commands)');
