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

  'node.inspect': async (params) => {
    let node;
    if (params && params.id) {
      node = await figma.getNodeByIdAsync(params.id);
    } else {
      node = figma.currentPage.selection[0];
    }
    
    if (!node) throw new Error('Node not found or nothing selected');
    return serializeNode(node);
  },

  'node.update': async (params) => {
    const node = await figma.getNodeByIdAsync(params.id);
    if (!node) throw new Error('Node not found');
    // Apply props to the existing node using the same transaction logic
    await applyPropsToNode(node, params.props || {});
    return { nodeId: node.id, status: 'updated' };
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
    case 'SVG': 
      if (props.content) {
        try {
          node = figma.createNodeFromSvg(props.content);
          if (props.width && props.height) node.resize(props.width, props.height);
        } catch (e) {
          throw new Error(`SVG Creation failed: ${e.message}`);
        }
      } else {
        node = figma.createFrame();
      }
      break;
    default: node = figma.createFrame();
  }

  // 2. Append to parent (Required for some property applications like 'fill' sizing)
  if (parent && 'appendChild' in parent) {
    parent.appendChild(node);
  }

  // 3. Apply properties
  await applyPropsToNode(node, props);

  // 4. Root Positioning (if no parent)
  if (!parentId) {
    const siblings = figma.currentPage.children;
    let maxX = -Infinity;
    for (const s of siblings) if (s.id !== node.id) maxX = Math.max(maxX, s.x + s.width);
    if (maxX !== -Infinity && node.x === 0) node.x = maxX + 200;
  }
  
  return node;
}

// ── Utils ────────────────────────────────────────────

async function findVariableByName(name) {
  if (!name || typeof name !== 'string') return null;
  const vars = await figma.variables.getLocalVariablesAsync();
  // Match by name (e.g. "slate/500") or full path, case-insensitive and whitespace-agnostic
  const clean = (s) => s.toLowerCase().replace(/\s+/g, '');
  const searchName = clean(name);
  return vars.find(v => clean(v.name) === searchName);
}

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

async function serializeNode(node) {
  const hasALParent = node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE';

  const props = {
    id: node.id,
    name: node.name,
    opacity: node.opacity !== 1 ? parseFloat(node.opacity.toFixed(2)) : undefined,
  };

  // 1. Sizing & Constraints
  if ('layoutSizingHorizontal' in node) {
    if (node.layoutSizingHorizontal === 'FILL') props.w = 'fill';
    else if (node.layoutSizingHorizontal === 'HUG') props.w = 'hug';
    else props.w = Math.round(node.width);
  } else {
    props.w = Math.round(node.width);
  }

  if ('minWidth' in node && node.minWidth !== null && node.minWidth !== 0) props.minW = Math.round(node.minWidth);
  if ('maxWidth' in node && node.maxWidth !== null && node.maxWidth !== Infinity) props.maxW = Math.round(node.maxWidth);

  if ('layoutSizingVertical' in node) {
    if (node.layoutSizingVertical === 'FILL') props.h = 'fill';
    else if (node.layoutSizingVertical === 'HUG') props.h = 'hug';
    else props.h = Math.round(node.height);
  } else {
    props.h = Math.round(node.height);
  }

  if ('minHeight' in node && node.minHeight !== null && node.minHeight !== 0) props.minH = Math.round(node.minHeight);
  if ('maxHeight' in node && node.maxHeight !== null && node.maxHeight !== Infinity) props.maxH = Math.round(node.maxHeight);

  // 2. Position & Absolute
  const isAbsolute = 'layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE';
  if (isAbsolute) {
    props.position = 'absolute';
    props.x = Math.round(node.x);
    props.y = Math.round(node.y);
  } else if (!hasALParent) {
    props.x = Math.round(node.x);
    props.y = Math.round(node.y);
  }

  // 3. Layout (Self)
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    props.flex = node.layoutMode === 'HORIZONTAL' ? 'row' : 'col';
    props.gap = (await resolveVariable(node, 'itemSpacing')) || node.itemSpacing;
    if ('layoutWrap' in node && node.layoutWrap === 'WRAP') props.wrap = true;
    
    const alignMap = { 'MIN': 'start', 'CENTER': 'center', 'MAX': 'end', 'SPACE_BETWEEN': 'between' };
    if (node.primaryAxisAlignItems !== 'MIN') props.justify = alignMap[node.primaryAxisAlignItems] || 'start';
    if (node.counterAxisAlignItems !== 'MIN') props.items = alignMap[node.counterAxisAlignItems] || 'start';

    const pt = (await resolveVariable(node, 'paddingTop')) || node.paddingTop;
    const pr = (await resolveVariable(node, 'paddingRight')) || node.paddingRight;
    const pb = (await resolveVariable(node, 'paddingBottom')) || node.paddingBottom;
    const pl = (await resolveVariable(node, 'paddingLeft')) || node.paddingLeft;

    if (pt === pr && pt === pb && pt === pl) {
      if (pt !== 0) props.p = pt;
    } else {
      if (pt === pb && pt !== 0) props.py = pt;
      else { if (pt !== 0) props.pt = pt; if (pb !== 0) props.pb = pb; }
      if (pl === pr && pl !== 0) props.px = pl;
      else { if (pl !== 0) props.pl = pl; if (pr !== 0) props.pr = pr; }
    }
  }

  // 4. Appearance
  if ('cornerRadius' in node && node.cornerRadius !== 0) {
    const radiusVar = await resolveVariable(node, 'cornerRadius');
    if (radiusVar) {
      props.rounded = radiusVar;
    } else if (node.cornerRadius !== figma.mixed) {
      props.rounded = node.cornerRadius;
    } else {
      // Individual corners if mixed
      const tl = (await resolveVariable(node, 'topLeftRadius')) || node.topLeftRadius;
      const tr = (await resolveVariable(node, 'topRightRadius')) || node.topRightRadius;
      const bl = (await resolveVariable(node, 'bottomLeftRadius')) || node.bottomLeftRadius;
      const br = (await resolveVariable(node, 'bottomRightRadius')) || node.bottomRightRadius;

      if (tl === tr && tl !== 0) props.roundedT = tl;
      else { if (tl !== 0) props.roundedTL = tl; if (tr !== 0) props.roundedTR = tr; }
      
      if (bl === br && bl !== 0) props.roundedB = bl;
      else { if (bl !== 0) props.roundedBL = bl; if (br !== 0) props.roundedBR = br; }
    }
  }

  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const varName = await resolveVariable(node, 'fills');
    if (varName) props.fill = varName;
    else if (node.fills[0].type === 'SOLID') props.fill = serializeColor(node.fills[0].color, node.fills[0].opacity);
  }

  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const varName = await resolveVariable(node, 'strokes');
    if (varName) props.stroke = varName;
    else if (node.strokes[0].type === 'SOLID') props.stroke = serializeColor(node.strokes[0].color, node.strokes[0].opacity);
    props.strokeWidth = node.strokeWeight;
  }

  if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
    for (const effect of node.effects) {
      if (effect.type === 'DROP_SHADOW') props.shadow = `${effect.offset.x} ${effect.offset.y} ${effect.radius} ${serializeColor(effect.color, effect.color.a)}`;
      else if (effect.type === 'INNER_SHADOW') props.innerShadow = `${effect.offset.x} ${effect.offset.y} ${effect.radius} ${serializeColor(effect.color, effect.color.a)}`;
      else if (effect.type === 'LAYER_BLUR') props.blur = effect.radius;
      else if (effect.type === 'BACKGROUND_BLUR') props.backdropBlur = effect.radius;
    }
  }

  let finalType = node.type;

  // ICON DETECTION & SVG EXPORT
  const hasTextNodes = (n) => {
    if (n.type === 'TEXT') return true;
    if ('children' in n) return n.children.some(child => hasTextNodes(child));
    return false;
  };

  const isIconLike = (
    node.type === 'VECTOR' || 
    node.type === 'BOOLEAN_OPERATION' || 
    node.type === 'LINE' || 
    node.type === 'ELLIPSE' || 
    ((node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE' || node.type === 'COMPONENT') && 
     node.width <= 128 && node.height <= 128 && !hasTextNodes(node))
  );

  if (isIconLike) {
    try {
      const svg = await node.exportAsync({ format: 'SVG' });
      props.content = String.fromCharCode(...svg);
      finalType = 'SVG';
    } catch (e) {
      console.warn('Failed to export icon SVG:', e.message);
    }
  }

  if (node.type === 'TEXT') {
    props.text = node.characters;
    props.size = node.fontSize === figma.mixed ? undefined : node.fontSize;
    
    // Use textAutoResize to determine sizing props
    if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
      props.w = 'hug';
      props.h = 'hug';
    } else if (node.textAutoResize === 'HEIGHT') {
      props.h = 'hug';
      // w is already set by the sizing logic above
    }
    
    // Weight mapping
    const style = (node.fontName !== figma.mixed && node.fontName) ? node.fontName.style.toLowerCase() : '';
    if (style.includes('black')) props.weight = 'black';
    else if (style.includes('extrabold')) props.weight = 'extrabold';
    else if (style.includes('semibold') || style.includes('semi bold')) props.weight = 'semibold';
    else if (style.includes('bold')) props.weight = 'bold';
    else if (style.includes('medium')) props.weight = 'medium';
    else if (style.includes('light')) props.weight = 'light';
    else if (style.includes('thin')) props.weight = 'thin';
    else props.weight = 'regular';

    // Text Case (Transform)
    if (node.textCase !== figma.mixed) {
      if (node.textCase === 'UPPER') props.transform = 'uppercase';
      else if (node.textCase === 'LOWER') props.transform = 'lowercase';
      else if (node.textCase === 'TITLE') props.transform = 'capitalize';
    }

    // Letter Spacing (Tracking)
    if (node.letterSpacing && node.letterSpacing !== figma.mixed && node.letterSpacing.value !== 0) {
       props.tracking = parseFloat(node.letterSpacing.value.toFixed(2));
    }

    // Line Height (Leading)
    if (node.lineHeight && node.lineHeight !== figma.mixed && node.lineHeight.unit !== 'AUTO') {
       if (node.lineHeight.unit === 'PIXELS') props.leading = parseFloat(node.lineHeight.value.toFixed(2));
       else if (node.lineHeight.unit === 'PERCENT') props.leading = parseFloat((node.lineHeight.value / 100).toFixed(2));
    }

    const hAlignMap = { 'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right', 'JUSTIFIED': 'justify' };
    if (node.textAlignHorizontal !== 'LEFT') props.align = hAlignMap[node.textAlignHorizontal];
    const vAlignMap = { 'TOP': 'top', 'CENTER': 'center', 'BOTTOM': 'bottom' };
    if (node.textAlignVertical !== 'TOP') props.alignV = vAlignMap[node.textAlignVertical];
  }

  const children = [];
  if (finalType !== 'SVG' && 'children' in node) {
    for (const child of node.children) {
      children.push(await serializeNode(child));
    }
  }

  // 5. Stroke Details (Alignment)
  if ('strokeAlign' in node && node.strokes && node.strokes.length > 0) {
    props.strokeAlign = node.strokeAlign.toLowerCase();
  }

  return {
    type: finalType,
    props,
    children
  };
}

async function resolveVariable(node, prop) {
  if (!node.boundVariables) return null;
  
  let bound = node.boundVariables[prop];
  
  // Property expansion mapping
  if (!bound) {
    if (prop === 'cornerRadius') bound = node.boundVariables['topLeftRadius'];
    if (prop === 'paddingTop') bound = node.boundVariables['paddingTop']; // already tried
    if (prop === 'fills' && node.fills && node.fills[0] && node.fills[0].boundVariables && node.fills[0].boundVariables.color) {
        const v = await figma.variables.getVariableByIdAsync(node.fills[0].boundVariables.color.id);
        return v ? v.name : null;
    }
    if (prop === 'strokes' && node.strokes && node.strokes[0] && node.strokes[0].boundVariables && node.strokes[0].boundVariables.color) {
        const v = await figma.variables.getVariableByIdAsync(node.strokes[0].boundVariables.color.id);
        return v ? v.name : null;
    }
  }

  if (!bound) return null;
  const id = Array.isArray(bound) ? bound[0].id : bound.id;
  if (!id) return null;
  const v = await figma.variables.getVariableByIdAsync(id);
  return v ? v.name : null;
}

function serializeColor(color, opacity) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  
  const hasOpacity = opacity !== undefined && opacity < 1;

  if (!hasOpacity) {
    // Snap to pure white/black ONLY if no opacity
    if (r > 250 && g > 250 && b > 250) return '#ffffff';
    if (r < 5 && g < 5 && b < 5) return '#000000';
  }

  if (hasOpacity) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(opacity.toFixed(2))})`;
  }
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

async function applyPropsToNode(node, props) {
  if (props.name) node.name = props.name;

  // Infer layoutMode if AL properties are present but flex is missing
  if (!props.layoutMode && node.type === 'FRAME') {
    const hasALProps = props.primaryAxisAlignItems !== undefined || 
                       props.counterAxisAlignItems !== undefined || 
                       props.itemSpacing !== undefined ||
                       props.padding !== undefined ||
                       props.paddingHorizontal !== undefined ||
                       props.paddingVertical !== undefined ||
                       props.paddingTop !== undefined ||
                       props.paddingBottom !== undefined ||
                       props.paddingLeft !== undefined ||
                       props.paddingRight !== undefined;
    if (hasALProps) {
      // Default to VERTICAL (col) if multiple children or unspecified, as it is a safer default for cards/stacks
      props.layoutMode = 'VERTICAL';
    }
  }

  if (node.type === 'TEXT') {
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

    if (props.textCase !== undefined) {
      const val = String(props.textCase).toLowerCase();
      const caseMap = { uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE', none: 'ORIGINAL' };
      node.textCase = caseMap[val] || (typeof props.textCase === 'string' ? props.textCase.toUpperCase() : 'ORIGINAL');
    }
    if (props.letterSpacing !== undefined) {
      node.letterSpacing = { value: props.letterSpacing, unit: 'PIXELS' };
    }
    if (props.lineHeight !== undefined) {
       if (props.lineHeight < 5) node.lineHeight = { value: props.lineHeight * 100, unit: 'PERCENT' };
       else node.lineHeight = { value: props.lineHeight, unit: 'PIXELS' };
    }
    if (props.textAlignHorizontal) node.textAlignHorizontal = props.textAlignHorizontal;
    if (props.textAlignVertical) node.textAlignVertical = props.textAlignVertical;
  }

  // Sizing (Independent of Layout)
  if (typeof props.width === 'number' || typeof props.height === 'number') {
    const targetW = (typeof props.width === 'number') ? props.width : node.width;
    const targetH = (typeof props.height === 'number') ? props.height : node.height;
    node.resize(targetW, targetH);
  }

  // Styling (Solid colors and Variable Bindings)
  if (props.fill) {
    const v = await findVariableByName(props.fill);
    if (v) {
      node.fills = [{
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0 },
        boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
      }];
    } else {
      const c = parseColor(props.fill);
      if (c) {
        if ('a' in c) {
          node.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
        } else {
          node.fills = [{ type: 'SOLID', color: c }];
        }
      }
    }
  } else if (node.type === 'FRAME' && !('fills' in props)) {
    node.fills = []; // Frames transparent by default if not specified
  }

  if (props.stroke) {
    const v = await findVariableByName(props.stroke);
    if (v) {
      node.strokes = [{
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0 },
        boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
      }];
    } else {
      const c = parseColor(props.stroke);
      if (c) {
        if ('a' in c) {
          node.strokes = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
        } else {
          node.strokes = [{ type: 'SOLID', color: c }];
        }
      }
    }
  }
  if (props.strokeWidth !== undefined) node.strokeWeight = props.strokeWidth;
  if (props.strokeAlign && 'strokeAlign' in node) {
    const alignMap = { inside: 'INSIDE', outside: 'OUTSIDE', center: 'CENTER' };
    node.strokeAlign = alignMap[props.strokeAlign.toLowerCase()] || 'INSIDE';
  }

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
  if (effects.length > 0) node.effects = effects;

  if (props.cornerRadius !== undefined) {
    const v = await findVariableByName(String(props.cornerRadius));
    if (v) {
      try { node.setBoundVariable('cornerRadius', v); } catch(e) { console.warn('Radius bind failed:', e.message); }
    } else if (typeof props.cornerRadius === 'number') {
      node.cornerRadius = props.cornerRadius;
    }
  }
  
  // Individual corners
  if (props.topLeftRadius !== undefined && 'topLeftRadius' in node) node.topLeftRadius = props.topLeftRadius;
  if (props.topRightRadius !== undefined && 'topRightRadius' in node) node.topRightRadius = props.topRightRadius;
  if (props.bottomLeftRadius !== undefined && 'bottomLeftRadius' in node) node.bottomLeftRadius = props.bottomLeftRadius;
  if (props.bottomRightRadius !== undefined && 'bottomRightRadius' in node) node.bottomRightRadius = props.bottomRightRadius;

  // Composite shorthand individual corners
  if (props.topRadius !== undefined && 'topLeftRadius' in node) node.topLeftRadius = node.topRightRadius = props.topRadius;
  if (props.bottomRadius !== undefined && 'bottomLeftRadius' in node) node.bottomLeftRadius = node.bottomRightRadius = props.bottomRadius;
  if (props.leftRadius !== undefined && 'topLeftRadius' in node) node.topLeftRadius = node.bottomLeftRadius = props.leftRadius;
  if (props.rightRadius !== undefined && 'topRightRadius' in node) node.topRightRadius = node.bottomRightRadius = props.rightRadius;
  
  if (props.opacity !== undefined) node.opacity = props.opacity;

  // Layout Properties
  if (props.layoutMode && 'layoutMode' in node) node.layoutMode = props.layoutMode;
  if (props.itemSpacing !== undefined && 'itemSpacing' in node) {
     const v = await findVariableByName(String(props.itemSpacing));
     if (v) {
        try { node.setBoundVariable('itemSpacing', v); } catch(e) { console.warn('Spacing bind failed:', e.message); }
     } else if (typeof props.itemSpacing === 'number') {
        node.itemSpacing = props.itemSpacing;
     }
  }
  if (props.counterAxisSpacing !== undefined && 'counterAxisSpacing' in node) node.counterAxisSpacing = props.counterAxisSpacing;
  if (props.layoutWrap && 'layoutWrap' in node) node.layoutWrap = props.layoutWrap;

  if (props.primaryAxisAlignItems && 'primaryAxisAlignItems' in node) node.primaryAxisAlignItems = props.primaryAxisAlignItems;
  if (props.counterAxisAlignItems && 'counterAxisAlignItems' in node) node.counterAxisAlignItems = props.counterAxisAlignItems;

  // Padding
  const pMap = { 
    paddingLeft: props.paddingLeft || props.paddingHorizontal || props.padding, 
    paddingRight: props.paddingRight || props.paddingHorizontal || props.padding, 
    paddingTop: props.paddingTop || props.paddingVertical || props.padding, 
    paddingBottom: props.paddingBottom || props.paddingVertical || props.padding 
  };
  for (const [key, val] of Object.entries(pMap)) {
    if (val !== undefined && key in node) {
      const v = await findVariableByName(String(val));
      if (v) {
        try { node.setBoundVariable(key, v); } catch(e) { console.warn(`${key} bind failed:`, e.message); }
      } else if (typeof val === 'number') {
        node[key] = val;
      }
    }
  }

  // Advanced Layout Sizing (Fill/Hug)
  const parent = node.parent;
  const hasALParent = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
  const isALFrame = 'layoutMode' in node && node.layoutMode !== 'NONE';

  if ('layoutSizingHorizontal' in node) {
    if (typeof props.width === 'number') {
      node.layoutSizingHorizontal = 'FIXED';
    } else if (props.width === 'fill' && hasALParent) {
      node.layoutSizingHorizontal = 'FILL';
    } else if (props.width === 'hug' || node.type === 'TEXT' || isALFrame) {
      node.layoutSizingHorizontal = 'HUG';
    }
  }

  if ('layoutSizingVertical' in node) {
    if (typeof props.height === 'number') {
      node.layoutSizingVertical = 'FIXED';
    } else if (props.height === 'fill' && hasALParent) {
      node.layoutSizingVertical = 'FILL';
    } else if (props.height === 'hug' || node.type === 'TEXT' || isALFrame) {
      node.layoutSizingVertical = 'HUG';
    }
  }

  // Text Auto-resize logic
  if (node.type === 'TEXT' && 'textAutoResize' in node) {
    const hasFixedWidth = typeof props.width === 'number' || props.width === 'fill';
    const hasFixedHeight = typeof props.height === 'number' || props.height === 'fill';

    if (hasFixedWidth && hasFixedHeight) node.textAutoResize = 'NONE';
    else if (hasFixedWidth) node.textAutoResize = 'HEIGHT';
    else node.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  if (props.position === 'absolute' && 'layoutPositioning' in node) {
    if (hasALParent) node.layoutPositioning = 'ABSOLUTE';
  }
  
  if (props.x !== undefined) node.x = props.x;
  if (props.y !== undefined) node.y = props.y;
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
