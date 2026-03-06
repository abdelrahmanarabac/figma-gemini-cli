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
    const nodes = [];
    for (const id of params.nodeIds) {
      const node = await figma.getNodeByIdAsync(id);
      if (node) nodes.push(node);
    }
    figma.currentPage.selection = nodes;
    return { selected: nodes.length };
  },

  'node.read': async (params) => {
    const node = await figma.getNodeByIdAsync(params.nodeId);
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
    // Smart positioning: if root-level node (no parent), place after existing content
    if (!params.parentId) {
      const children = figma.currentPage.children;
      let maxX = 0;
      for (const c of children) {
        if (c.id !== node.id) maxX = Math.max(maxX, c.x + c.width);
      }
      if (maxX > 0 && node.x === 0) node.x = maxX + 100;
    }
    return { nodeId: node.id, name: node.name };
  },

  'node.update': async (params) => {
    const node = await figma.getNodeByIdAsync(params.nodeId);
    if (!node) throw new Error(`Node ${params.nodeId} not found`);
    applyProps(node, params.props || {});
    return { nodeId: node.id, name: node.name };
  },

  'node.delete': async (params) => {
    const ids = params.nodeIds || [];
    let deleted = 0;
    for (const id of ids) {
      const node = await figma.getNodeByIdAsync(id);
      if (node) { node.remove(); deleted++; }
    }
    return { deleted };
  },

  'node.toComponent': async (params) => {
    const results = [];
    for (const id of (params.nodeIds || [])) {
      const node = await figma.getNodeByIdAsync(id);
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
    const registry = new Map();
    for (let i = 0; i < (params.commands || []).length; i++) {
      const cmd = params.commands[i];
      const handler = handlers[cmd.command];
      if (!handler) {
        results.push({ error: `Unknown command: ${cmd.command}` });
        continue;
      }
      try {
        const cmdParams = Object.assign({}, cmd.params || {});
        // Resolve parentId
        if (cmdParams.parentId) {
          if (registry.has(cmdParams.parentId)) {
            cmdParams.parentId = registry.get(cmdParams.parentId);
          } else {
            throw new Error(`Virtual parent NOT RESOLVED in registry: ${cmdParams.parentId}`);
          }
        }

        const result = await handler(cmdParams);
        results.push({ status: 'ok', data: result });

        // Track generated ID
        if (cmdParams.id && result && result.nodeId) {
          registry.set(cmdParams.id, result.nodeId);
        }
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
  let parent = figma.currentPage;

  if (parentId) {
    parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) {
      throw new Error(`Hierarchy Error: Cannot append child. Parent node resolving to "${parentId}" not found in Figma document.`);
    }
  }

  switch (type) {
    case 'FRAME':
      node = figma.createFrame();
      node.fills = []; // Figma defaults to white; clear it so backgrounds are transparent unless defined
      node.layoutMode = 'HORIZONTAL';
      node.primaryAxisSizingMode = 'AUTO';
      node.counterAxisSizingMode = 'AUTO';
      break;
    case 'RECTANGLE':
      node = figma.createRectangle();
      break;
    case 'ELLIPSE':
      node = figma.createEllipse();
      break;
    case 'TEXT':
      node = figma.createText();
      const family = props.fontFamily || 'Inter';
      const style = getFontStyle(props.fontWeight);
      await figma.loadFontAsync({ family, style });
      node.fontName = { family, style };
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

  // 🐛 THE FIX: We MUST append the node to the parent BEFORE applying properties.
  // Figma ignores auto-layout sizing (like 'fill') if the node is floating unbound
  // on the absolute canvas when the properties are applied.
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
// ORDER MATTERS: layout mode must be set BEFORE resize,
// otherwise Figma's AUTO sizing overrides explicit dimensions.

function applyProps(node, props) {
  // 1. Name
  if (props.name) node.name = props.name;

  // 2. Layout mode — MUST be set early so sizing logic knows the context
  if (props.layoutMode && 'layoutMode' in node) {
    node.layoutMode = props.layoutMode; // HORIZONTAL or VERTICAL
  }

  // 3. Prioritize Content (Characters & Fonts)
  // This ensures Figma knows the intrinsic size of text before we apply constraints.
  if (node.type === 'TEXT') {
    if (props.fontSize !== undefined) node.fontSize = props.fontSize;
    if (props.characters !== undefined) {
      node.characters = props.characters;
    }
    if (props.color) {
      const tColor = parseColor(props.color);
      if (tColor) node.fills = [{ type: 'SOLID', color: tColor }];
    }
  }

  // 4. Robust Sizing Logic
  const hasLayout = node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE';
  const numW = (typeof props.width === 'number') ? props.width : undefined;
  const numH = (typeof props.height === 'number') ? props.height : undefined;

  // 4.1 Guard against 0-sized collapse
  // If a node starts at 0x0, Figma's layout engine can sometimes lock it there.
  if (node.width === 0 || node.height === 0) {
    node.resize(Math.max(node.width, 100), Math.max(node.height, 100));
  }

  // 4.2 Horizontal Sizing
  if ('layoutSizingHorizontal' in node) {
    if (props.width === 'fill') {
      // Logic for FILL
      if (hasLayout && node.parent.layoutMode === 'HORIZONTAL' && node.parent.primaryAxisSizingMode === 'AUTO') {
        node.layoutSizingHorizontal = 'HUG'; // Fallback to HUG if parent is HUG on same axis
      } else {
        node.layoutSizingHorizontal = 'FILL';
        if ('layoutAlign' in node) node.layoutAlign = 'STRETCH'; // Force stretch for legacy stability
      }
    } else if (numW !== undefined) {
      node.layoutSizingHorizontal = 'FIXED';
      node.resize(numW, node.height);
    } else {
      node.layoutSizingHorizontal = 'HUG';
    }
  } else if (numW !== undefined) {
    node.resize(numW, node.height);
  }

  // 4.3 Vertical Sizing
  if ('layoutSizingVertical' in node) {
    if (props.height === 'fill') {
      if (hasLayout && node.parent.layoutMode === 'VERTICAL' && node.parent.primaryAxisSizingMode === 'AUTO') {
        node.layoutSizingVertical = 'HUG';
      } else {
        node.layoutSizingVertical = 'FILL';
      }
    } else if (numH !== undefined) {
      node.layoutSizingVertical = 'FIXED';
      node.resize(node.width, numH);
    } else {
      node.layoutSizingVertical = 'HUG';
    }
  } else if (numH !== undefined) {
    node.resize(node.width, numH);
  }

  // 4.4 Text Auto-Resize adjustments
  if (node.type === 'TEXT') {
    if (props.width === 'fill' || numW !== undefined) {
      node.textAutoResize = 'HEIGHT'; // Fixed width / Fill width
    } else if (numH !== undefined) {
      node.textAutoResize = 'NONE';   // Fixed height
    } else {
      node.textAutoResize = 'WIDTH_AND_HEIGHT'; // Auto-size (HUG)
    }
  }

  // 5. Fill color (Frames/Shapes)
  if (node.type !== 'TEXT' && props.fill) {
    const color = parseColor(props.fill);
    if (color) node.fills = [{ type: 'SOLID', color: color }];
  }

  // 6. Stroke
  if (props.stroke) {
    const sColor = parseColor(props.stroke);
    if (sColor) node.strokes = [{ type: 'SOLID', color: sColor }];
  }
  if (props.strokeWidth !== undefined) node.strokeWeight = props.strokeWidth;
  if (props.strokeAlign) {
    const saMap = { inside: 'INSIDE', outside: 'OUTSIDE', center: 'CENTER' };
    node.strokeAlign = saMap[props.strokeAlign] || 'CENTER';
  }

  // 7. Corner radius
  if (props.cornerRadius !== undefined) node.cornerRadius = props.cornerRadius;
  if (props.topLeftRadius !== undefined) node.topLeftRadius = props.topLeftRadius;
  if (props.topRightRadius !== undefined) node.topRightRadius = props.topRightRadius;
  if (props.bottomLeftRadius !== undefined) node.bottomLeftRadius = props.bottomLeftRadius;
  if (props.bottomRightRadius !== undefined) node.bottomRightRadius = props.bottomRightRadius;
  if (props.cornerSmoothing !== undefined) node.cornerSmoothing = props.cornerSmoothing;

  // 8. Opacity
  if (props.opacity !== undefined) node.opacity = props.opacity;

  // 9. Layout details (gap, wrap, grow)
  if (props.itemSpacing !== undefined && 'itemSpacing' in node) node.itemSpacing = props.itemSpacing;
  if (props.counterAxisSpacing !== undefined && 'counterAxisSpacing' in node) node.counterAxisSpacing = props.counterAxisSpacing;
  if (props.layoutWrap && 'layoutWrap' in node) node.layoutWrap = props.layoutWrap;
  if (props.layoutGrow !== undefined && 'layoutGrow' in node) node.layoutGrow = props.layoutGrow;

  // 10. Padding
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

  // 11. Alignment
  if (props.primaryAxisAlignItems && 'primaryAxisAlignItems' in node) {
    node.primaryAxisAlignItems = props.primaryAxisAlignItems;
  }
  if (props.counterAxisAlignItems && 'counterAxisAlignItems' in node) {
    node.counterAxisAlignItems = props.counterAxisAlignItems;
  }

  // 12. Child sizing mode (legacy layoutAlign)
  if (props.layoutAlign && 'layoutAlign' in node) node.layoutAlign = props.layoutAlign;

  // 13. Min/Max constraints
  if (props.minWidth !== undefined) node.minWidth = props.minWidth;
  if (props.maxWidth !== undefined) node.maxWidth = props.maxWidth;
  if (props.minHeight !== undefined) node.minHeight = props.minHeight;
  if (props.maxHeight !== undefined) node.maxHeight = props.maxHeight;

  // 14. Clipping
  if (props.clipsContent !== undefined && 'clipsContent' in node) {
    node.clipsContent = props.clipsContent;
  }

  // 15. Shadow
  if (props.shadow && 'effects' in node) {
    const parts = props.shadow.match(/(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(rgba?\([^)]+\)|#\w+)/);
    if (parts) {
      const [_, ox, oy, sBlur, colorStr] = parts;
      let shColor = { r: 0, g: 0, b: 0 };
      let shOpacity = 0.25;
      const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        shColor = { r: +rgbaMatch[1] / 255, g: +rgbaMatch[2] / 255, b: +rgbaMatch[3] / 255 };
        shOpacity = rgbaMatch[4] !== undefined ? +rgbaMatch[4] : 1;
      } else {
        shColor = parseColor(colorStr) || shColor;
      }
      const shadowColorObj = Object.assign({}, shColor, { a: shOpacity });
      node.effects = (node.effects || []).concat([{
        type: 'DROP_SHADOW', visible: true,
        offset: { x: +ox, y: +oy }, radius: +sBlur, spread: 0,
        color: shadowColorObj
      }]);
    }
  }

  // 16. Blur
  if (props.blur !== undefined && 'effects' in node) {
    node.effects = (node.effects || []).concat([{
      type: 'LAYER_BLUR', visible: true, radius: props.blur
    }]);
  }

  // 17. Position
  if (props.position === 'absolute' && 'layoutPositioning' in node) {
    node.layoutPositioning = 'ABSOLUTE';
  }
  if (props.x !== undefined) node.x = props.x;
  if (props.y !== undefined) node.y = props.y;
  if (props.rotation !== undefined) node.rotation = props.rotation;

  // 18. Blend mode
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
    if ('textAutoResize' in node) data.textAutoResize = node.textAutoResize;
  }
  if ('layoutSizingHorizontal' in node) data.layoutSizingHorizontal = node.layoutSizingHorizontal;
  if ('layoutSizingVertical' in node) data.layoutSizingVertical = node.layoutSizingVertical;
  if ('layoutAlign' in node) data.layoutAlign = node.layoutAlign;
  if ('layoutGrow' in node) data.layoutGrow = node.layoutGrow;

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
