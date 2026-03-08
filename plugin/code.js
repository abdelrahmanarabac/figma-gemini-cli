/**
 * Figma CLI Bridge Plugin — v2 Structured Commands
 *
 * Sequential Deterministic Renderer.
 * - Global Task Queue for strict chunk ordering.
 * - Single-pass creation to prevent layout collapse.
 */

figma.showUI(__html__, {
  width: 160,
  height: 72,
  position: { x: -9999, y: 9999 }
});

const streams = new Map();
let streamTaskQueue = Promise.resolve(); // Global Sequential Mutex

// ── Command Handlers ─────────────────────────────────

const handlers = {

  'health': async () => ({ status: 'ok' }),

  'tokens.delete_all': async () => {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const colCount = collections.length;
    let varCount = 0;
    for (const col of collections) {
      varCount += col.variableIds.length;
      try { col.remove(); } catch(e) {}
    }
    const orphans = await figma.variables.getLocalVariablesAsync();
    for (const v of orphans) {
      try { v.remove(); } catch(e) {}
    }
    return { deletedCollections: colCount, deletedVariables: varCount + orphans.length };
  },

  'tokens.create_palette': async (params) => {
    const { colors, collectionName } = params;
    const cols = await figma.variables.getLocalVariableCollectionsAsync();
    let col = cols.find(c => c.name === collectionName);
    if (!col) col = figma.variables.createVariableCollection(collectionName);
    const modeId = col.modes[0].modeId;
    const existingVars = await figma.variables.getLocalVariablesAsync();
    let count = 0;

    function hexToRgb(hex) {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : null;
    }

    for (const [colorName, shades] of Object.entries(colors)) {
      if (typeof shades === 'string') {
        const varName = colorName;
        const existing = existingVars.find(v => v.name === varName && v.variableCollectionId === col.id);
        if (!existing) {
          const v = figma.variables.createVariable(varName, col, 'COLOR');
          const rgb = hexToRgb(shades);
          if (rgb) { try { v.setValueForMode(modeId, rgb); count++; } catch(e) {} }
        }
      } else {
        for (const [shade, hex] of Object.entries(shades)) {
          const varName = shade === 'DEFAULT' ? colorName : colorName + '/' + shade;
          const existing = existingVars.find(v => v.name === varName && v.variableCollectionId === col.id);
          if (!existing) {
            const v = figma.variables.createVariable(varName, col, 'COLOR');
            const rgb = hexToRgb(hex);
            if (rgb) { try { v.setValueForMode(modeId, rgb); count++; } catch(e) {} }
          }
        }
      }
    }
    return { created: count, collection: collectionName };
  },

  'tokens.create_shadcn': async (params) => {
    const { primitives, semanticTokens } = params;
    
    function hexToRgb(hex) {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
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
          const rgb = hexToRgb(hex);
          if (rgb) { try { v.setValueForMode(primModeId, rgb); } catch(e) {} }
          primCount++;
        }
        primVarMap[varName] = v;
      }
    }

    let semCol = cols.find(c => c.name === 'shadcn/semantic');
    if (!semCol) semCol = figma.variables.createVariableCollection('shadcn/semantic');

    let lightMode = semCol.modes.find(m => m.name === 'Light');
    let lightModeId = lightMode ? lightMode.modeId : null;
    
    let darkMode = semCol.modes.find(m => m.name === 'Dark');
    let darkModeId = darkMode ? darkMode.modeId : null;

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
      if (lightPrim) { try { v.setValueForMode(lightModeId, { type: 'VARIABLE_ALIAS', id: lightPrim.id }); } catch(e) {} }
      const darkPrim = primVarMap[refs.dark];
      if (darkPrim) { try { v.setValueForMode(darkModeId, { type: 'VARIABLE_ALIAS', id: darkPrim.id }); } catch(e) {} }
    }

    return { primCount, semCount };
  },

  'tokens.create_scale': async (params) => {
    const { values, collectionName, prefix, type = 'FLOAT' } = params;
    const cols = await figma.variables.getLocalVariableCollectionsAsync();
    let col = cols.find(c => c.name === collectionName);
    if (!col) col = figma.variables.createVariableCollection(collectionName);
    const modeId = col.modes[0].modeId;
    const existingVars = await figma.variables.getLocalVariablesAsync();
    let count = 0;

    for (const [name, value] of Object.entries(values)) {
      const varName = prefix ? prefix + '/' + name : name;
      const existing = existingVars.find(v => v.name === varName && v.variableCollectionId === col.id);
      if (!existing) {
        const v = figma.variables.createVariable(varName, col, type);
        try { v.setValueForMode(modeId, value); count++; } catch(e) {}
      }
    }
    return { created: count, collection: collectionName };
  },

  'eval': async (params) => {
    try {
      const result = await eval(`(async () => { ${params.code} })()`);
      return result;
    } catch (err) {
      throw new Error(`Eval failed: ${err.message}`);
    }
  },

  'node.create': async (params) => {
    const node = await createNodeTransaction(params.type, params.props || {}, params.parentId);
    return { nodeId: node.id, name: node.name };
  },

  'batch': async (params) => {
    const registry = new Map();
    const results = [];
    for (const cmd of (params.commands || [])) {
      try {
        if (cmd.command !== 'node.create') continue;
        const p = {};
        if (cmd.params) {
          for (const key in cmd.params) {
            p[key] = cmd.params[key];
          }
        }
        if (p.parentId && registry.has(p.parentId)) p.parentId = registry.get(p.parentId);
        const node = await createNodeTransaction(p.type, p.props || {}, p.parentId);
        if (p.id) registry.set(p.id, node.id);
        results.push({ id: p.id, nodeId: node.id });
      } catch (err) {
        console.error('[Batch Error]', err);
        const typeStr = cmd.params ? cmd.params.type : 'N/A';
        const idStr = cmd.params ? cmd.params.id : 'N/A';
        throw new Error(`[Batch Error] Type: ${typeStr} | ID: ${idStr} | Details: ${err.message}`);
      }
    }
    return { status: 'ok', nodes: results };
  },

  // ── STREAMING TRANSACTIONAL PIPELINE ──
  
  'stream.start': async (msg) => {
    // Reset the global queue for a fresh render session
    streamTaskQueue = Promise.resolve();
    
    streams.set(msg.streamId, {
      registry: new Map(),
      rootId: null,
      count: 0,
      lastYield: Date.now()
    });
    figma.ui.postMessage({ action: 'stream.ready', windowSize: 100 });
    return { status: 'started' };
  },

  'stream.chunk': async (msg) => {
    // Robust Chaining: Append this chunk's work to the tail of the global queue
    streamTaskQueue = streamTaskQueue.then(async () => {
      try {
        const stream = streams.get(msg.streamId);
        if (!stream) return;

        for (const cmd of msg.items) {
          if (cmd.command === 'node.create') {
            const p = {};
      if (cmd.params) {
        for (const key in cmd.params) {
          p[key] = cmd.params[key];
        }
      }
            
            if (p.parentId && stream.registry.has(p.parentId)) {
              p.parentId = stream.registry.get(p.parentId);
            }

            const node = await createNodeTransaction(p.type, p.props || {}, p.parentId);
            
            if (p.id) {
              stream.registry.set(p.id, node.id);
              if (!stream.rootId && !p.parentId) stream.rootId = node.id;
            }
            stream.count++;
          }

          if (Date.now() - stream.lastYield > 16) {
            await new Promise(r => setTimeout(r, 1));
            stream.lastYield = Date.now();
          }
        }

        figma.ui.postMessage({ action: 'stream.ack', count: msg.items.length });
        figma.ui.postMessage({ action: 'stream.progress', processed: stream.count });
      } catch (err) {
        figma.ui.postMessage({ action: 'stream.error', error: `[Chunk Error] ${err.message}` });
        // We don't re-throw here to avoid breaking the entire tail of the queue, 
        // but the error is reported back to CLI.
      }
    });

    return { status: 'queued' };
  },

  'stream.end': async (msg) => {
    await streamTaskQueue;
    const stream = streams.get(msg.streamId);
    if (!stream) return;
    streams.delete(msg.streamId);
    figma.ui.postMessage({ action: 'stream.complete' });
    return { status: 'complete' };
  },

  'stream.abort': async (msg) => {
    const stream = streams.get(msg.streamId);
    if (stream && stream.rootId) {
      const node = await figma.getNodeByIdAsync(stream.rootId);
      if (node) node.remove();
    }
    streams.delete(msg.streamId);
    streamTaskQueue = Promise.resolve();
    return { status: 'aborted' };
  }
};

// ── Single-Pass Transaction ──────────────────────────

async function createNodeTransaction(type, props, parentId) {
  let node;
  let parent = figma.currentPage;

  if (parentId) {
    parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found in document.`);
  }

  // 1. Create instance
  switch (type) {
    case 'FRAME': node = figma.createFrame(); break;
    case 'RECTANGLE': node = figma.createRectangle(); break;
    case 'ELLIPSE': node = figma.createEllipse(); break;
    case 'TEXT': node = figma.createText(); break;
    case 'LINE': node = figma.createLine(); break;
    default: node = figma.createFrame();
  }

  // 2. Immediate properties (Independent of parent)
  if (props.name) node.name = props.name;
  
  if (node.type === 'TEXT') {
    try {
      const weight = String(props.fontWeight || '400').toLowerCase();
      const styleMap = {
        '100': 'Thin', '200': 'Extra Light', '300': 'Light', '400': 'Regular',
        '500': 'Medium', '600': 'Semi Bold', '700': 'Bold', '800': 'Extra Bold', '900': 'Black',
        'thin': 'Thin', 'light': 'Light', 'regular': 'Regular', 'medium': 'Medium', 'bold': 'Bold', 'semibold': 'Semi Bold'
      };
      const style = styleMap[weight] || 'Regular';
      await figma.loadFontAsync({ family: 'Inter', style });
      node.fontName = { family: 'Inter', style };
      if (props.fontSize !== undefined) node.fontSize = props.fontSize;
      if (props.characters !== undefined) node.characters = props.characters;
    } catch (e) {
      throw new Error(`TEXT setup failed: ${e.message}`);
    }
  }

  // Appearance
  try {
    const fills = [];
    if (props.fill) {
      const c = parseColor(props.fill);
      if (c) {
        if ('a' in c) {
          fills.push({ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a });
        } else {
          fills.push({ type: 'SOLID', color: c });
        }
      }
    }

    if (fills.length > 0) {
      node.fills = fills;
    } else if (node.type === 'FRAME') {
      node.fills = []; // Frames transparent by default
    }
  } catch (e) {
    throw new Error(`Fills setup failed: ${e.message}`);
  }

  try {
    if (props.stroke) {
      const c = parseColor(props.stroke);
      if (c) {
        if ('a' in c) {
          node.strokes = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
        } else {
          node.strokes = [{ type: 'SOLID', color: c }];
        }
        node.strokeWeight = props.strokeWidth || 1;
      }
    }
  } catch (e) {
    throw new Error(`Stroke setup failed: ${e.message}`);
  }

  // Effects (Shadows/Blurs)
  try {
    const effects = [];
    if (props.shadow) {
      const s = parseShadow(props.shadow);
      if (s) effects.push(s);
    }
    if (props.innerShadow) {
      const s = parseInnerShadow(props.innerShadow);
      if (s) effects.push(s);
    }
    if (props.blur !== undefined) {
      effects.push({ type: 'LAYER_BLUR', radius: props.blur, visible: true });
    }
    if (props.backdropBlur !== undefined) {
      effects.push({ type: 'BACKGROUND_BLUR', radius: props.backdropBlur, visible: true });
    }

    if (effects.length > 0) {
      node.effects = effects;
    }
  } catch (e) {
    console.warn('Effects setup failed:', e.message);
  }

  try {
    if (props.cornerRadius !== undefined) node.cornerRadius = props.cornerRadius;
    if (props.opacity !== undefined) node.opacity = props.opacity;
  } catch (e) {
    throw new Error(`Misc appearance failed: ${e.message}`);
  }

  // 3. Layout CONFIG (Self)
  try {
    if (props.layoutMode && 'layoutMode' in node) node.layoutMode = props.layoutMode;
    if (props.itemSpacing !== undefined && 'itemSpacing' in node) node.itemSpacing = props.itemSpacing;
    if (props.counterAxisSpacing !== undefined && 'counterAxisSpacing' in node) node.counterAxisSpacing = props.counterAxisSpacing;
    if (props.layoutWrap && 'layoutWrap' in node) node.layoutWrap = props.layoutWrap;
  } catch (e) {
    throw new Error(`Layout config failed: ${e.message}`);
  }
  
  // Padding
  try {
    if (props.padding !== undefined && 'paddingTop' in node) node.paddingTop = node.paddingRight = node.paddingBottom = node.paddingLeft = props.padding;
    if (props.paddingHorizontal !== undefined && 'paddingLeft' in node) node.paddingLeft = node.paddingRight = props.paddingHorizontal;
    if (props.paddingVertical !== undefined && 'paddingTop' in node) node.paddingTop = node.paddingBottom = props.paddingVertical;
    if (props.paddingTop !== undefined && 'paddingTop' in node) node.paddingTop = props.paddingTop;
    if (props.paddingRight !== undefined && 'paddingRight' in node) node.paddingRight = props.paddingRight;
    if (props.paddingBottom !== undefined && 'paddingBottom' in node) node.paddingBottom = props.paddingBottom;
    if (props.paddingLeft !== undefined && 'paddingLeft' in node) node.paddingLeft = props.paddingLeft;
  } catch (e) {
    throw new Error(`Padding failed: ${e.message}`);
  }

  try {
    if (props.primaryAxisAlignItems && 'primaryAxisAlignItems' in node) node.primaryAxisAlignItems = props.primaryAxisAlignItems;
    if (props.counterAxisAlignItems && 'counterAxisAlignItems' in node) node.counterAxisAlignItems = props.counterAxisAlignItems;
  } catch (e) {
    throw new Error(`Axis align failed: ${e.message}`);
  }

  // 4. FIXED SIZING (Before Append)
  try {
    const isShapeOrFrame = (type === 'RECTANGLE' || type === 'ELLIPSE' || type === 'FRAME');
    const defaultW = isShapeOrFrame ? 40 : (node.width || 100);
    const defaultH = isShapeOrFrame ? 40 : (node.height || 100);

    const targetW = (typeof props.width === 'number') ? props.width : defaultW;
    const targetH = (typeof props.height === 'number') ? props.height : defaultH;
    
    if (typeof node.resize === 'function') {
      node.resize(targetW, targetH);
    }
  } catch (e) {
    console.warn('Initial resize failed:', e.message);
  }

  // 5. APPEND
  if (parent && 'appendChild' in parent) {
    parent.appendChild(node);
  }

  // 6. DYNAMIC SIZING (After Append)
  const hasALParent = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
  const isALFrame = 'layoutMode' in node && node.layoutMode !== 'NONE';

  if ('layoutSizingHorizontal' in node) {
    try {
      if (typeof props.width === 'number') {
        node.layoutSizingHorizontal = 'FIXED';
        node.resize(props.width, node.height);
      } else if (props.width === 'fill' && hasALParent) {
        node.layoutSizingHorizontal = 'FILL';
      } else if (props.width === 'hug' || node.type === 'TEXT' || isALFrame) {
        node.layoutSizingHorizontal = 'HUG';
      } else {
        node.layoutSizingHorizontal = 'FIXED';
      }
    } catch (e) {
      console.warn('Failed to set horizontal sizing:', e.message);
    }
  }
  if ('layoutSizingVertical' in node) {
    try {
      if (typeof props.height === 'number') {
        node.layoutSizingVertical = 'FIXED';
        node.resize(node.width, props.height);
      } else if (props.height === 'fill' && hasALParent) {
        node.layoutSizingVertical = 'FILL';
      } else if (props.height === 'hug' || node.type === 'TEXT' || isALFrame) {
        node.layoutSizingVertical = 'HUG';
      } else {
        node.layoutSizingVertical = 'FIXED';
      }
    } catch (e) {
      console.warn('Failed to set vertical sizing:', e.message);
    }
  }

  // Text Auto-resize
  if (node.type === 'TEXT' && 'textAutoResize' in node) {
    if (props.width === 'fill' || typeof props.width === 'number') {
      node.textAutoResize = 'HEIGHT';
    } else {
      node.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
  }

  // 7. ROOT POSITIONING
  if (!parentId) {
    const siblings = figma.currentPage.children;
    let maxX = -Infinity;
    for (const s of siblings) if (s.id !== node.id) maxX = Math.max(maxX, s.x + s.width);
    if (maxX !== -Infinity && node.x === 0) node.x = maxX + 200;
  }
  if (props.position === 'absolute' && 'layoutPositioning' in node) node.layoutPositioning = 'ABSOLUTE';
  if (props.x !== undefined) node.x = props.x;
  if (props.y !== undefined) node.y = props.y;

  return node;
}

// ── Utils ────────────────────────────────────────────

function parseColor(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Handle rgba(r, g, b, a)
  const rgbaMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]) / 255,
      g: parseInt(rgbaMatch[2]) / 255,
      b: parseInt(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    };
  }

  const clean = str.replace('#', '');
  let r, g, b;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16) / 255;
    g = parseInt(clean.slice(2, 4), 16) / 255;
    b = parseInt(clean.slice(4, 6), 16) / 255;
  } else return null;
  return { r, g, b };
}

function parseShadow(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Extract color part (hex or rgba)
  const colorMatch = str.match(/(?:#[a-fA-F0-9]{3,6}|rgba?\s*\([^)]+\))/);
  const colorStr = colorMatch ? colorMatch[0] : '#000000';
  const color = parseColor(colorStr);
  
  // Remove color from string to parse numbers
  const numStr = str.replace(colorStr, '').trim();
  const nums = numStr.split(/\s+/).map(n => parseFloat(n));
  
  // x y blur [spread]
  const x = nums[0] || 0;
  const y = nums[1] || 0;
  const blur = nums[2] || 0;
  const spread = nums[3] || 0;
  
  return {
    type: 'DROP_SHADOW',
    color: { r: color.r, g: color.g, b: color.b, a: (color.a !== undefined) ? color.a : 1 },
    offset: { x, y },
    radius: blur,
    spread: spread,
    visible: true,
    blendMode: 'NORMAL'
  };
}

function parseInnerShadow(str) {
  if (!str || typeof str !== 'string') return null;
  
  const colorMatch = str.match(/(?:#[a-fA-F0-9]{3,6}|rgba?\s*\([^)]+\))/);
  const colorStr = colorMatch ? colorMatch[0] : '#000000';
  const color = parseColor(colorStr);
  
  const numStr = str.replace(colorStr, '').trim();
  const nums = numStr.split(/\s+/).map(n => parseFloat(n));
  
  const x = nums[0] || 0;
  const y = nums[1] || 0;
  const blur = nums[2] || 0;
  const spread = nums[3] || 0;
  
  return {
    type: 'INNER_SHADOW',
    color: { r: color.r, g: color.g, b: color.b, a: (color.a !== undefined) ? color.a : 1 },
    offset: { x, y },
    radius: blur,
    spread: spread,
    visible: true,
    blendMode: 'NORMAL'
  };
}

figma.ui.onmessage = async (msg) => {
  // 1. Resolve handler (streaming action OR single command)
  const actionName = (msg.action === 'command') ? msg.command : (msg.action || msg.command);
  const handler = handlers[actionName];

  if (handler) {
    try {
      // 2. Execute handler
      const result = await handler(msg.params || msg);
      
      // 3. If it was a singular command, send back a 'result' type message
      if (msg.action === 'command') {
        figma.ui.postMessage({ type: 'result', id: msg.id, result });
      }
    } catch (err) {
      console.error('[FigCli Error]', err);
      // Report errors back through the appropriate channel
      if (msg.action && msg.action.startsWith('stream.')) {
        figma.ui.postMessage({ action: 'stream.error', error: err.message, id: msg.id });
      } else {
        figma.ui.postMessage({ type: 'result', id: msg.id, error: err.message });
      }
    }
  } else {
    console.warn(`[FigCli] No handler for action: ${actionName}`);
  }
};
