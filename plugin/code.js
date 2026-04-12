/**
 * Figma CLI Bridge Plugin — v2 Structured Commands
 *
 * Sequential Deterministic Renderer.
 * - Global Task Queue for strict chunk ordering.
 * - Single-pass creation to prevent layout collapse.
 */

figma.showUI(__html__, {
  width: 160,
  height: 100,
  position: { x: -9999, y: 9999 }
});

const streams = new Map();
let streamTaskQueue = Promise.resolve(); // Global Sequential Mutex

// ── Global Helpers ─────────────────────────────────────

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) / 255,
      g: parseInt(clean[1] + clean[1], 16) / 255,
      b: parseInt(clean[2] + clean[2], 16) / 255,
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

function hexToRgba(hex, alpha) {
  var rgb = hexToRgb(hex);
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha !== undefined ? Number(alpha) : 1 };
}

function scaleResponsiveValue(value, factor, min) {
  return Math.max(min, Math.round(value * factor));
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null) {
      return arguments[i];
    }
  }
  return undefined;
}

function normalizeFontStyleName(weight) {
  const styleMap = {
    '100': 'Thin',
    '200': 'Extra Light',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'Semi Bold',
    '700': 'Bold',
    '800': 'Extra Bold',
    '900': 'Black',
  };
  return styleMap[String(weight)] || 'Regular';
}

function buildTextStyleDescription(styleSpec) {
  if (styleSpec.description) {
    return styleSpec.description;
  }

  if (styleSpec.tokens) {
    return 'Tokens: ' + Object.entries(styleSpec.tokens).map(function(entry) {
      return entry[0] + '=' + entry[1];
    }).join(', ');
  }

  return '';
}

async function resolveTextStyleFont(styleSpec) {
  const requestedFont = styleSpec.fontName || {
    family: styleSpec.fontFamily || 'Roboto',
    style: normalizeFontStyleName(styleSpec.fontWeight || 400),
  };

  try {
    await figma.loadFontAsync(requestedFont);
    return requestedFont;
  } catch (error) {
    const fallbackFont = {
      family: 'Inter',
      style: normalizeFontStyleName(styleSpec.fontWeight || 400),
    };

    try {
      await figma.loadFontAsync(fallbackFont);
      return fallbackFont;
    } catch (innerError) {
      const safeFallback = { family: 'Inter', style: 'Regular' };
      await figma.loadFontAsync(safeFallback);
      return safeFallback;
    }
  }
}

async function upsertTextStyle(styleSpec, existingTextStyles) {
  let style = existingTextStyles.find(function(item) {
    return item.name === styleSpec.name;
  });
  let created = false;

  if (!style) {
    style = figma.createTextStyle();
    existingTextStyles.push(style);
    created = true;
  }

  style.name = styleSpec.name;
  style.fontName = await resolveTextStyleFont(styleSpec);

  if (styleSpec.fontSize !== undefined) {
    style.fontSize = Number(styleSpec.fontSize);
  }

  if (styleSpec.lineHeight !== undefined) {
    style.lineHeight = typeof styleSpec.lineHeight === 'object'
      ? styleSpec.lineHeight
      : { value: Number(styleSpec.lineHeight), unit: 'PIXELS' };
  }

  if (styleSpec.letterSpacing !== undefined) {
    style.letterSpacing = typeof styleSpec.letterSpacing === 'object'
      ? styleSpec.letterSpacing
      : { value: Number(styleSpec.letterSpacing), unit: 'PIXELS' };
  }

  if (styleSpec.textCase !== undefined) {
    style.textCase = styleSpec.textCase;
  }

  if ('description' in style) {
    try {
      style.description = buildTextStyleDescription(styleSpec);
    } catch (error) {}
  }

  return { style: style, created: created };
}

async function applyResponsiveAdaptation(node, breakpoint) {
  const isMobile = breakpoint <= 375;
  const isTabletOrSmaller = breakpoint <= 768;

  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    if (isTabletOrSmaller && node.layoutMode === 'HORIZONTAL' && 'children' in node && node.children.length > 1) {
      node.layoutMode = 'VERTICAL';
    }

    if (isMobile) {
      if ('itemSpacing' in node && typeof node.itemSpacing === 'number' && node.itemSpacing > 16) {
        node.itemSpacing = scaleResponsiveValue(node.itemSpacing, 0.75, 8);
      }

      const paddingKeys = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
      for (const key of paddingKeys) {
        if (key in node && typeof node[key] === 'number' && node[key] > 24) {
          node[key] = scaleResponsiveValue(node[key], 0.66, 16);
        }
      }
    }
  }

  if (node.type === 'TEXT' && isMobile && typeof node.fontSize === 'number' && node.fontSize > 24) {
    node.fontSize = Math.max(18, Math.round(node.fontSize * 0.75));
  }

  if ('children' in node) {
    for (const child of node.children) {
      if (
        isTabletOrSmaller &&
        'layoutMode' in node &&
        node.layoutMode !== 'NONE' &&
        'layoutSizingHorizontal' in child &&
        child.layoutSizingHorizontal === 'FIXED' &&
        typeof child.width === 'number' &&
        child.width > breakpoint * 0.9
      ) {
        try {
          child.layoutSizingHorizontal = 'FILL';
        } catch (e) {}
      }

      await applyResponsiveAdaptation(child, breakpoint);
    }
  }
}

// ── Wireframe Helpers ──────────────────────────────────

function _applyWireframeToNode(node, opts) {
  try {
    if (node.type === 'TEXT') {
      if (opts.textFill) {
        node.fills = [{ type: 'SOLID', color: opts.textFill }];
      }
      if (opts.strokeWidth > 0) {
        node.strokes = [{ type: 'SOLID', color: opts.stroke }];
        node.strokeWeight = opts.strokeWidth;
      } else {
        node.strokes = [];
      }
      return;
    }

    if ('children' in node && node.children) {
      for (var cwi = 0; cwi < node.children.length; cwi++) {
        _applyWireframeToNode(node.children[cwi], opts);
      }
    }

    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
      var firstFill = node.fills[0];
      if (firstFill.type === 'SOLID') {
        node.fills = [{ type: 'SOLID', color: opts.fill }];
      } else if (opts.hideImages && firstFill.type === 'IMAGE') {
        node.fills = [{ type: 'SOLID', color: opts.fill }];
      }
    }

    if (opts.stroke && opts.strokeWidth > 0 && 'strokes' in node) {
      node.strokes = [{ type: 'SOLID', color: opts.stroke }];
      node.strokeWeight = opts.strokeWidth;
    }
  } catch (e) {}
}

function _resetWireframeNode(node) {
  try {
    if ('fills' in node) {
      node.fills = [];
    }
    if ('strokes' in node) {
      node.strokes = [];
    }
    if ('effects' in node) {
      node.effects = [];
    }
  } catch (e) {}
}

// ── Eval Operation Dispatcher ────────────────────────
// Replaces broken AsyncFunction-based eval with safe, pre-registered operations.
// Figma's CSP blocks `new AsyncFunction()` on the plugin main thread.

async function executeEvalOperation(op, args) {
  switch (op) {
    case 'variables.list': {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      return {
        collections: collections.map(c => ({
          id: c.id,
          name: c.name,
          modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
          variableIds: c.variableIds,
        })),
        variables: variables.map(v => ({
          id: v.id,
          name: v.name,
          type: v.resolvedType,
          collectionId: v.variableCollectionId,
          valuesByMode: v.valuesByMode,
          resolvedType: v.resolvedType,
        })),
      };
    }

    case 'variables.create': {
      const { name, type, value, collectionRef, isAlias } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      const col = collections.find(c => c.name === collectionRef || c.id === collectionRef);
      if (!col) return { success: false, error: 'Collection not found.' };

      async function parseValue(val, varType, alias) {
        if (alias) {
          const cleanVal = typeof val === 'string' ? (val.startsWith('{') && val.endsWith('}') ? val.slice(1, -1) : val) : String(val);
          const target = variables.find(v => v.name === cleanVal || v.id === cleanVal);
          if (!target) throw new Error('Alias target not found: ' + cleanVal);
          return { type: 'VARIABLE_ALIAS', id: target.id };
        }
        if (varType === 'COLOR') {
          const hex = String(val).replace('#', '');
          return {
            r: parseInt(hex.substring(0, 2), 16) / 255,
            g: parseInt(hex.substring(2, 4), 16) / 255,
            b: parseInt(hex.substring(4, 6), 16) / 255,
            a: 1,
          };
        }
        if (varType === 'FLOAT') return typeof val === 'number' ? val : parseFloat(val);
        if (varType === 'BOOLEAN') return val === 'true' || val === true;
        return val;
      }

      const v = figma.variables.createVariable(name, col, type);
      const parsed = await parseValue(value, type, isAlias);
      v.setValueForMode(col.modes[0].modeId, parsed);
      return { success: true, id: v.id };
    }

    case 'variables.rename': {
      const { ref, newName } = args;
      const variables = await figma.variables.getLocalVariablesAsync();
      const v = variables.find(v => v.id === ref || v.name === ref);
      if (!v) return { success: false, error: 'Variable not found.' };
      v.name = newName;
      return { success: true };
    }

    case 'variables.delete': {
      const { ref } = args;
      const variables = await figma.variables.getLocalVariablesAsync();
      const v = variables.find(v => v.id === ref || v.name === ref);
      if (!v) return { success: false, error: 'Variable not found.' };
      v.remove();
      return { success: true };
    }

    case 'collection.create': {
      const { name } = args;
      const col = figma.variables.createVariableCollection(name);
      return { success: true, id: col.id };
    }

    case 'collection.rename': {
      const { ref, newName } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.id === ref || c.name === ref);
      if (!col) return { success: false, error: 'Collection not found.' };
      col.name = newName;
      return { success: true };
    }

    case 'collection.delete': {
      const { ref } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.id === ref || c.name === ref);
      if (!col) return { success: false, error: 'Collection not found.' };
      col.remove();
      return { success: true };
    }

    case 'page.create': {
      const { name } = args;
      const newPage = figma.createPage();
      if (name) newPage.name = name;
      try { await figma.setCurrentPageAsync(newPage); } catch (e) {}
      return { id: newPage.id, name: newPage.name };
    }

    case 'page.rename': {
      const { id, name } = args;
      const page = figma.root.children.find(p => p.id === id);
      if (!page) return { error: 'Page not found' };
      page.name = name;
      return { success: true };
    }

    case 'page.delete': {
      const { id } = args;
      const page = figma.root.children.find(p => p.id === id);
      if (!page) return { error: 'Page not found' };
      if (figma.root.children.length <= 1) return { error: 'Cannot delete the only page' };
      page.remove();
      return { success: true };
    }

    case 'page.switch': {
      const { id } = args;
      const page = figma.root.children.find(p => p.id === id);
      if (!page) return { error: 'Page not found' };
      try { await figma.setCurrentPageAsync(page); } catch (e) {}
      return { success: true };
    }

    case 'instance.create': {
      const { componentId, x, y } = args;
      const component = await figma.getNodeByIdAsync(componentId);
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) return { error: 'Component not found' };
      const instance = component.createInstance();
      const posX = typeof x === 'number' ? x : 0;
      const posY = typeof y === 'number' ? y : 0;
      instance.x = posX;
      instance.y = posY;
      figma.currentPage.appendChild(instance);
      return { success: true, id: instance.id, name: instance.name };
    }

    case 'instance.swap': {
      const { instanceId, componentId } = args;
      const instance = await figma.getNodeByIdAsync(instanceId);
      if (!instance || instance.type !== 'INSTANCE') return { error: 'Instance not found or not an instance' };
      const component = await figma.getNodeByIdAsync(componentId);
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) return { error: 'Component not found' };
      await instance.swapComponent(component);
      return { success: true };
    }

    case 'instance.set_overrides': {
      const { instanceId, propName, value } = args;
      const instance = await figma.getNodeByIdAsync(instanceId);
      if (!instance || instance.type !== 'INSTANCE') return { error: 'Instance not found' };
      const props = instance.componentProperties;
      if (!(propName in props)) return { error: `Property ${propName} not found on instance` };
      instance.setProperties({ [propName]: value });
      return { success: true };
    }

    case 'instance.update_text': {
      const { instanceId, text } = args;
      const instance = await figma.getNodeByIdAsync(instanceId);
      if (!instance || instance.type !== 'INSTANCE') return { error: 'Instance not found' };
      // Find first TEXT node in the instance and update its characters
      function findTextNodes(node) {
        const results = [];
        if (node.type === 'TEXT') results.push(node);
        if (node.children) {
          for (const child of node.children) {
            results.push(...findTextNodes(child));
          }
        }
        return results;
      }
      const textNodes = findTextNodes(instance);
      if (textNodes.length === 0) return { error: 'No text nodes found in instance' };
      const textNode = textNodes[0];
      const font = textNode.fontName || { family: 'Inter', style: 'Regular' };
      await figma.loadFontAsync(font);
      textNode.characters = text;
      return { success: true, textNodeId: textNode.id };
    }

    case 'node.setAutoLayout': {
      const { id, mode } = args;
      const node = await figma.getNodeByIdAsync(id);
      if (!node) return { error: 'Node not found' };
      if (!('layoutMode' in node)) return { error: 'Node does not support autolayout' };
      const modeMap = { 'row': 'HORIZONTAL', 'col': 'VERTICAL', 'none': 'NONE' };
      node.layoutMode = modeMap[mode] || 'NONE';
      return { success: true, id: node.id };
    }

    case 'node.bind': {
      const { property, variableName, nodeIds } = args;
      const variables = await figma.variables.getLocalVariablesAsync();
      const v = variables.find(v => v.name === variableName || v.id === variableName);
      if (!v) return { success: false, error: 'Variable not found.' };

      let nodes = [];
      if (nodeIds && nodeIds.length > 0) {
        nodes = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      } else {
        nodes = figma.currentPage.selection;
      }
      if (nodes.length === 0) return { success: false, error: 'No nodes selected or provided.' };

      const results = [];
      for (const node of nodes) {
        if (!node) continue;
        try {
          if (property === 'fill' || property === 'bg') {
            node.fills = [{
              type: 'SOLID',
              color: { r: 0, g: 0, b: 0 },
              boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
            }];
          } else if (property === 'stroke' || property === 'border') {
            node.strokes = [{
              type: 'SOLID',
              color: { r: 0, g: 0, b: 0 },
              boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
            }];
          } else if (property === 'gap' || property === 'spacing') {
            node.setBoundVariable('itemSpacing', v);
          } else if (property === 'radius' || property === 'rounded') {
            node.setBoundVariable('cornerRadius', v);
          } else if (property === 'padding') {
            node.setBoundVariable('paddingTop', v);
            node.setBoundVariable('paddingBottom', v);
            node.setBoundVariable('paddingLeft', v);
            node.setBoundVariable('paddingRight', v);
          }
          results.push(node.id);
        } catch (e) {
          console.warn('Bind error for node ' + node.id + ': ' + e.message);
        }
      }
      return { success: true, count: results.length };
    }

    case 'proto.link': {
      const { source, target, transition, duration, trigger } = args;
      const options = { transition, duration, trigger };
      async function findNode(query) {
        if (query.includes(':')) {
          const n = await figma.getNodeByIdAsync(query);
          if (n) return n;
        }
        const nodes = figma.currentPage.findAll(n => n.name === query);
        return nodes[0];
      }
      const sourceNode = await findNode(source);
      const targetNode = await findNode(target);
      if (!sourceNode) return { success: false, error: "Source node '" + source + "' not found." };
      if (!targetNode) return { success: false, error: "Target node '" + target + "' not found." };
      if (!('reactions' in sourceNode)) return { success: false, error: "Source node does not support interactions." };

      let destinationNode = targetNode;
      while (destinationNode.parent && destinationNode.parent.type !== 'PAGE') destinationNode = destinationNode.parent;

      const actionObj = {
        type: 'NODE',
        destinationId: destinationNode.id,
        navigation: 'NAVIGATE',
        transition: { type: options.transition.toUpperCase(), easing: { type: 'EASE_IN_AND_OUT' }, duration: parseInt(options.duration, 10) }
      };
      if (options.transition.toUpperCase() === 'INSTANT') actionObj.transition = null;

      const newReaction = { trigger: { type: options.trigger.toUpperCase() }, actions: [actionObj] };
      const currentReactions = sourceNode.reactions || [];
      const filteredReactions = currentReactions.filter(r => r.trigger.type !== newReaction.trigger.type);
      const newReactions = filteredReactions.concat([newReaction]);
      await sourceNode.setReactionsAsync(newReactions);

      return { success: true, sourceName: sourceNode.name, targetName: destinationNode.name, trigger: newReaction.trigger.type, transition: newReaction.actions[0].transition ? newReaction.actions[0].transition.type : 'INSTANT' };
    }

    case 'audit.a11y': {
      const { scope } = args;
      const WHITE = { r: 255, g: 255, b: 255, hex: '#ffffff' };
      function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      function getContrast(rgb1, rgb2) {
        const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b) + 0.05;
        const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b) + 0.05;
        return l1 > l2 ? l1 / l2 : l2 / l1;
      }
      function toHex(value) { return Math.round(value).toString(16).padStart(2, '0'); }
      function isSolidPaint(paint) { return !!paint && paint.type === 'SOLID' && !!paint.color; }
      function toRgb(color, opacity) {
        const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
        return { r, g, b, opacity: opacity === undefined ? 1 : opacity, hex: '#' + toHex(r) + toHex(g) + toHex(b) };
      }
      function getSolidFill(node) {
        if (!node || !('fills' in node)) return null;
        if (!Array.isArray(node.fills)) return null;
        const solid = node.fills.find(paint => paint.visible !== false && isSolidPaint(paint));
        if (!solid) return null;
        return toRgb(solid.color, solid.opacity);
      }
      function getParentBg(node) {
        let parent = node.parent;
        while (parent) {
          const fill = getSolidFill(parent);
          if (fill) return fill;
          parent = parent.parent;
        }
        return WHITE;
      }
      function getThreshold(node) {
        const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 14;
        const fontStyle = node.fontName && node.fontName !== figma.mixed ? String(node.fontName.style || '') : '';
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && /bold/i.test(fontStyle));
        return isLargeText ? 3 : 4.5;
      }

      const roots = scope === 'all' && Array.isArray(figma.root.children) && figma.root.children.length > 0 ? figma.root.children : [figma.currentPage];
      const failures = [];
      let scanned = 0;

      for (const root of roots) {
        if (!root || typeof root.findAll !== 'function') continue;
        const textNodes = root.findAll(node => node.type === 'TEXT');
        for (const textNode of textNodes) {
          scanned++;
          if (!textNode.visible || !textNode.characters) continue;
          const textRgb = getSolidFill(textNode);
          if (!textRgb) continue;
          const bgRgb = getParentBg(textNode);
          const ratio = getContrast(textRgb, bgRgb);
          const threshold = getThreshold(textNode);
          if (ratio < threshold) {
            failures.push({
              id: textNode.id,
              page: root.name || 'Untitled Page',
              name: textNode.name,
              text: textNode.characters,
              ratio: ratio.toFixed(2),
              threshold,
              textColor: textRgb.hex,
              bgHex: bgRgb.hex
            });
          }
        }
      }
      return { scope, scanned, failures };
    }

    case 'canvas.info': {
      const selection = figma.currentPage.selection;
      const frames = figma.currentPage.children.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' || n.type === 'INSTANCE');
      return {
        selection: selection.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          width: Math.round(n.width),
          height: Math.round(n.height),
          x: Math.round(n.x),
          y: Math.round(n.y),
        })),
        page: { id: figma.currentPage.id, name: figma.currentPage.name },
        frames: frames.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          width: Math.round(f.width),
          height: Math.round(f.height),
          x: Math.round(f.x),
          y: Math.round(f.y),
        })),
      };
    }

    case 'node.copy': {
      const { id } = args;
      const node = await figma.getNodeByIdAsync(id);
      if (!node) return { error: 'Node not found' };
      const data = await serializeNode(node);
      // Add raw properties recursively from serialized props
      function addRawData(n) {
        if (!n || !n.props) return;
        var p = n.props;
        // Map serialized props back to raw values
        var layoutMode = p.flex === 'row' ? 'HORIZONTAL' : p.flex === 'col' ? 'VERTICAL' : 'NONE';
        var padVal = p.p || 0;
        n.raw = {
          width: p.w === 'fill' ? 0 : p.w === 'hug' ? 0 : (typeof p.w === 'number' ? Math.round(p.w) : 0),
          height: p.h === 'fill' ? 0 : p.h === 'hug' ? 0 : (typeof p.h === 'number' ? Math.round(p.h) : 0),
          fills: [],
          strokes: [],
          cornerRadius: typeof p.rounded === 'number' ? Math.round(p.rounded) : 0,
          strokeWeight: typeof p.strokeWidth === 'number' ? p.strokeWidth : 0,
          layoutMode: layoutMode,
          itemSpacing: typeof p.gap === 'number' ? Math.round(p.gap) : 0,
          paddingLeft: typeof p.pl === 'number' ? p.pl : (typeof padVal === 'number' ? padVal : 0),
          paddingRight: typeof p.pr === 'number' ? p.pr : (typeof padVal === 'number' ? padVal : 0),
          paddingTop: typeof p.pt === 'number' ? p.pt : (typeof padVal === 'number' ? padVal : 0),
          paddingBottom: typeof p.pb === 'number' ? p.pb : (typeof padVal === 'number' ? padVal : 0),
          primaryAxisAlignItems: p.justify || 'MIN',
          counterAxisAlignItems: p.items || 'MIN',
          layoutWrap: p.wrap ? 'WRAP' : 'NO_WRAP',
          clipsContent: false,
        };
        // Fills - from props
        if (p.fill && typeof p.fill === 'string' && p.fill.startsWith('#')) {
          var hex = p.fill.replace('#', '');
          n.raw.fills = [{ type: 'SOLID', color: { r: parseInt(hex.substring(0,2),16)/255, g: parseInt(hex.substring(2,4),16)/255, b: parseInt(hex.substring(4,6),16)/255, a: 1 } }];
        }
        // Strokes - from props
        if (p.stroke && typeof p.stroke === 'string' && p.stroke.startsWith('#')) {
          var shex = p.stroke.replace('#', '');
          n.raw.strokes = [{ type: 'SOLID', color: { r: parseInt(shex.substring(0,2),16)/255, g: parseInt(shex.substring(2,4),16)/255, b: parseInt(shex.substring(4,6),16)/255, a: 1 } }];
        }
        // Text properties
        if (n.type === 'TEXT') {
          n.raw.characters = p.text || p.characters || '';
          n.raw.fontSize = p.size || 14;
          var fw = (p.weight || 'regular').toLowerCase();
          var styleMap = { thin: 'Thin', light: 'Light', regular: 'Regular', medium: 'Medium', semibold: 'Semi Bold', bold: 'Bold' };
          n.raw.fontName = { family: 'Inter', style: styleMap[fw] || 'Regular' };
          n.raw.textAlignHorizontal = 'LEFT';
          n.raw.textAlignVertical = 'TOP';
        }
        // Children
        if (n.children && n.children.length > 0) {
          for (var i = 0; i < n.children.length; i++) {
            addRawData(n.children[i]);
          }
        }
      }
      addRawData(data);
      return data;
    }

    case 'node.paste': {
      const { data } = args;
      if (!data) return { error: 'No node data provided' };
      if (!data.raw) return { error: 'No raw data in node' };

      // Create node from data (handles children recursively)
      var newNode = await createNodeFromData(data);
      if (!newNode) return { error: 'Failed to create node' };

      // Position on page
      var maxX = 0;
      var page = figma.currentPage;
      for (var j = 0; j < page.children.length; j++) {
        var rightEdge = page.children[j].x + page.children[j].width;
        if (rightEdge > maxX) maxX = rightEdge;
      }
      newNode.x = maxX + 200;
      newNode.y = 0;
      page.appendChild(newNode);

      return { success: true, id: newNode.id, name: newNode.name };
    }

    case 'node.inspect': {
      let node;
      if (args.id) {
        node = await figma.getNodeByIdAsync(args.id);
      } else {
        node = figma.currentPage.selection[0];
      }
      if (!node) throw new Error('Node not found or nothing selected');
      return serializeNode(node);
    }

    case 'node.find': {
      const { query } = args;
      const nodes = figma.currentPage.findAll(n => n.name.includes(query));
      return nodes.map(n => ({ id: n.id, name: n.name, type: n.type }));
    }

    case 'node.find.byId': {
      const { id } = args;
      const node = await figma.getNodeByIdAsync(id);
      if (!node) return { error: 'Node not found' };
      return { id: node.id, name: node.name, type: node.type };
    }

    case 'node.selection': {
      const sel = figma.currentPage.selection;
      return sel.map(n => ({ id: n.id, name: n.name, type: n.type }));
    }

    case 'selection.details': {
      const sel = figma.currentPage.selection;
      const results = [];
      for (const n of sel) {
        let parentPage = null;
        let p = n.parent;
        while (p) {
          if (p.type === 'PAGE') { parentPage = { id: p.id, name: p.name }; break; }
          p = p.parent;
        }
        results.push({ id: n.id, name: n.name, type: n.type, page: parentPage });
      }
      return { selection: results, currentPage: { id: figma.currentPage.id, name: figma.currentPage.name } };
    }

    case 'node.to_component': {
      const { id } = args;
      const sel = figma.currentPage.selection;
      const nodeId = id || (sel.length > 0 ? sel[0].id : null);
      const node = nodeId ? await figma.getNodeByIdAsync(nodeId) : null;
      if (!node) return { error: 'Node not found' };
      if (node.type === 'COMPONENT') return { id: node.id, name: node.name };
      
      const comp = figma.createComponent();
      comp.name = node.name;
      comp.resize(node.width, node.height);
      comp.x = node.x; comp.y = node.y;
      if (node.parent) node.parent.insertChild(node.parent.children.indexOf(node), comp);
      comp.appendChild(node);
      node.x = 0; node.y = 0;
      return { id: comp.id, name: comp.name };
    }

    case 'node.setSelection': {
      const { id, ids } = args;
      const targetIds = ids || (id ? [id] : []);
      const nodes = await Promise.all(targetIds.map(tid => figma.getNodeByIdAsync(tid)));
      const validNodes = nodes.filter(n => n && 'type' in n);
      if (validNodes.length === 0) return { error: 'No nodes found' };
      figma.currentPage.selection = validNodes;
      return { success: true, count: validNodes.length };
    }

    case 'node.clone': {
      const { id, targetPageId } = args;
      const src = await figma.getNodeByIdAsync(id);
      if (!src) return { error: 'Source node not found' };
      const clone = src.clone();

      // Determine target page
      let targetPage = figma.currentPage;
      if (targetPageId) {
        const p = await figma.getNodeByIdAsync(targetPageId);
        if (p && p.type === 'PAGE') targetPage = p;
      }

      // Find rightmost position on target page
      let maxX = 0;
      for (const child of targetPage.children) {
        const rightEdge = child.x + child.width;
        if (rightEdge > maxX) maxX = rightEdge;
      }
      clone.x = maxX + 200;
      clone.y = 0;
      targetPage.appendChild(clone);
      return { success: true, id: clone.id, name: clone.name, page: targetPage.name };
    }

    case 'node.delete': {
      const { id } = args;
      const node = await figma.getNodeByIdAsync(id);
      if (!node) return { error: 'Node not found' };
      node.remove();
      return { deleted: id };
    }

    case 'node.rename': {
      const { id, name } = args;
      const node = await figma.getNodeByIdAsync(id);
      if (!node) return { error: 'Node not found' };
      node.name = name;
      return { id: node.id, name: node.name };
    }

    case 'style.list': {
      const textStyles = await figma.getLocalTextStylesAsync();
      const paintStyles = await figma.getLocalPaintStylesAsync();
      const effectStyles = await figma.getLocalEffectStylesAsync();
      const gridStyles = await figma.getLocalGridStylesAsync();
      return {
        text: textStyles.map(s => ({ id: s.id, name: s.name, type: 'TEXT' })),
        paint: paintStyles.map(s => ({ id: s.id, name: s.name, type: 'PAINT' })),
        effect: effectStyles.map(s => ({ id: s.id, name: s.name, type: 'EFFECT' })),
        grid: gridStyles.map(s => ({ id: s.id, name: s.name, type: 'GRID' })),
      };
    }

    case 'style.create_text': {
      const { name, fontSize, fontWeight = 400, lineHeight, letterSpacing = 0, fontFamily = 'Inter' } = args;
      const existingTextStyles = await figma.getLocalTextStylesAsync();
      const styleSpec = { name, fontSize, fontWeight, lineHeight, letterSpacing, fontFamily };
      const result = await upsertTextStyle(styleSpec, existingTextStyles);
      return { success: true, id: result.style.id, name: result.style.name, created: result.created };
    }

    case 'style.create_effect': {
      const { name, effects } = args;
      const existingStyles = await figma.getLocalEffectStylesAsync();
      const existing = existingStyles.find(s => s.name === name);
      const style = existing || figma.createLocalEffectStyle();
      style.name = name;
      style.effects = effects;
      return { success: true, id: style.id, name: style.name, created: !existing };
    }

    case 'style.create_text_styles': {
      const styles = Array.isArray(args.styles) ? args.styles : [];
      const existingTextStyles = await figma.getLocalTextStylesAsync();
      const results = [];
      for (const styleSpec of styles) {
        const result = await upsertTextStyle(styleSpec, existingTextStyles);
        results.push({ success: true, id: result.style.id, name: result.style.name, created: result.created });
      }
      return { success: true, results, total: styles.length };
    }

    case 'style.delete_all': {
      const textStyles = await figma.getLocalTextStylesAsync();
      const paintStyles = await figma.getLocalPaintStylesAsync();
      const effectStyles = await figma.getLocalEffectStylesAsync();
      const gridStyles = await figma.getLocalGridStylesAsync();

      const all = textStyles.concat(paintStyles).concat(effectStyles).concat(gridStyles);
      const count = all.length;
      for (const s of all) {
        try { s.remove(); } catch(e) {}
      }
      return { deleted: count };
    }

    case 'style.create_paint': {
      const { name, color } = args;
      if (!color) return { error: 'Color is required' };
      const paintStyles = await figma.getLocalPaintStylesAsync();
      const existing = paintStyles.find(s => s.name === name);
      if (existing) return { success: true, id: existing.id, name: existing.name, created: false };
      const style = figma.createPaintStyle();
      const hex = color.replace('#', '');
      style.name = name;
      style.paints = [{
        type: 'SOLID',
        color: {
          r: parseInt(hex.substring(0, 2), 16) / 255,
          g: parseInt(hex.substring(2, 4), 16) / 255,
          b: parseInt(hex.substring(4, 6), 16) / 255,
        },
      }];
      return { success: true, id: style.id, name: style.name, created: true };
    }

    case 'style.create_grid': {
      const { name, grid } = args;
      const gridStyles = await figma.getLocalGridStylesAsync();
      const existing = gridStyles.find(s => s.name === name);
      if (existing) return { success: true, id: existing.id, name: existing.name, created: false };
      const style = figma.createGridStyle();
      style.name = name;
      if (grid) {
        var layoutGrid = grid.pattern || grid;
        try {
          style.layoutGrids = [layoutGrid];
        } catch (e) {
          return { success: false, error: 'Invalid grid structure: ' + e.message };
        }
      }
      return { success: true, id: style.id, name: style.name, created: true };
    }

    case 'style.update_typography': {
      const { family, pattern } = args;
      const textStyles = await figma.getLocalTextStylesAsync();
      const filter = pattern ? new RegExp(pattern, 'i') : null;
      const targets = filter ? textStyles.filter(s => filter.test(s.name)) : textStyles;
      let updated = 0;
      let failed = 0;
      for (const style of targets) {
        try {
          const fontName = { family: family, style: style.fontName.style || 'Regular' };
          await figma.loadFontAsync(fontName);
          style.fontName = fontName;
          updated++;
        } catch (e) {
          failed++;
        }
      }
      return { success: true, updated, failed, total: targets.length };
    }

    case 'style.export': {
      const { format = 'css', outputDir } = args;
      const textStyles = await figma.getLocalTextStylesAsync();
      const paintStyles = await figma.getLocalPaintStylesAsync();
      const effectStyles = await figma.getLocalEffectStylesAsync();
      const gridStyles = await figma.getLocalGridStylesAsync();
      return {
        success: true,
        count: textStyles.length + paintStyles.length + effectStyles.length + gridStyles.length,
        text: textStyles.map(s => ({ id: s.id, name: s.name })),
        paint: paintStyles.map(s => ({ id: s.id, name: s.name })),
        effect: effectStyles.map(s => ({ id: s.id, name: s.name })),
        grid: gridStyles.map(s => ({ id: s.id, name: s.name })),
      };
    }

    case 'wireframe.apply': {
      var wfNodeIds = args.nodeIds;
      var wfBg = args.bg || '#ffffff';
      var wfFill = args.fill || '#e2e8f0';
      var wfStroke = args.stroke || '#94a3b8';
      var wfTextFill = args.textFill || '#64748b';
      var wfStrokeWidth = args.strokeWidth || 2;
      var wfHideImages = args.hideImages || false;

      var wfFillRgb = hexToRgb(wfFill);
      var wfStrokeRgb = hexToRgb(wfStroke);
      var wfBgRgb = hexToRgb(wfBg);
      var wfTextFillRgb = hexToRgb(wfTextFill);
      var wfTargets = await Promise.all(wfNodeIds.map(function(id) { return figma.getNodeByIdAsync(id); }));
      var wfValid = wfTargets.filter(function(n) { return n && 'type' in n; });
      var wfResults = [];
      for (var vi = 0; vi < wfValid.length; vi++) {
        var wfNode = wfValid[vi];
        _applyWireframeToNode(wfNode, {
          fill: wfFillRgb,
          stroke: wfStrokeRgb,
          bg: wfBgRgb,
          textFill: wfTextFillRgb,
          strokeWidth: wfStrokeWidth,
          hideImages: wfHideImages,
        });
        wfResults.push({ id: wfNode.id, name: wfNode.name });
      }
      return { success: true, count: wfResults.length, nodes: wfResults };
    }

    case 'wireframe.reset': {
      var wfResetIds = args.nodeIds;
      var wfResetTargets = await Promise.all(wfResetIds.map(function(id) { return figma.getNodeByIdAsync(id); }));
      var wfResetValid = wfResetTargets.filter(function(n) { return n && 'type' in n; });
      for (var wri = 0; wri < wfResetValid.length; wri++) {
        var wfResetNode = wfResetValid[wri];
        _resetWireframeNode(wfResetNode);
      }
      return { success: true, count: wfResetValid.length };
    }

    case 'wireframe.list': {
      var wfAllFrames = figma.currentPage.findAll(function(n) { return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'RECTANGLE' || n.type === 'TEXT'; });
      var wfNodes = [];
      for (var wfi = 0; wfi < wfAllFrames.length && wfNodes.length < 50; wfi++) {
        var wfCheckNode = wfAllFrames[wfi];
        if (wfCheckNode && wfCheckNode.fills && wfCheckNode.fills.length > 0 && wfCheckNode.fills[0] && wfCheckNode.fills[0].type === 'SOLID') {
          var wfC = wfCheckNode.fills[0].color;
          var wfr = Math.round(wfC.r * 255);
          var wfg = Math.round(wfC.g * 255);
          var wfb = Math.round(wfC.b * 255);
          if (wfr === wfg && wfg === wfb) {
            wfNodes.push({ id: wfCheckNode.id, name: wfCheckNode.name, saved: false });
          }
        }
      }
      return { success: true, nodes: wfNodes, total: wfNodes.length };
    }

    case 'theme.toggle': {
      const { targetMode } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const results = [];
      for (const col of collections) {
        const mode = col.modes.find(m => m.name.toLowerCase() === targetMode.toLowerCase());
        if (mode) {
          try {
            col.currentModeId = mode.modeId;
            results.push({ collection: col.name, mode: mode.name, success: true });
          } catch (e) {
            results.push({ collection: col.name, error: e.message });
          }
        } else {
          results.push({ collection: col.name, error: 'Mode "' + targetMode + '" not found' });
        }
      }
      const successCount = results.filter(r => r.success).length;
      return { success: true, targetMode, count: successCount, total: collections.length, results };
    }

    case 'theme.list': {
      var collections = await figma.variables.getLocalVariableCollectionsAsync();
      var themes = [];
      for (var i = 0; i < collections.length; i++) {
        var col = collections[i];
        var currentModeName = null;
        for (var j = 0; j < col.modes.length; j++) {
          if (col.modes[j].modeId === col.currentModeId) {
            currentModeName = col.modes[j].name;
            break;
          }
        }
        themes.push({
          collection: col.name,
          collectionId: col.id,
          modes: col.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
          currentMode: currentModeName,
        });
      }
      return { success: true, themes };
    }

    case 'mode.add': {
      const { collectionRef, modeName } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.id === collectionRef || c.name === collectionRef);
      if (!col) return { success: false, error: 'Collection not found.' };
      const modeId = col.addMode(modeName);
      return { success: true, modeId, colName: col.name };
    }

    case 'mode.rename': {
      const { collectionRef, oldMode, newModeName } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.id === collectionRef || c.name === collectionRef);
      if (!col) return { success: false, error: 'Collection not found.' };
      const mode = col.modes.find(m => m.name === oldMode || m.modeId === oldMode);
      if (!mode) return { success: false, error: 'Mode not found.' };
      col.renameMode(mode.modeId, newModeName);
      return { success: true, modeId: mode.modeId };
    }

    case 'mode.delete': {
      var collections = await figma.variables.getLocalVariableCollectionsAsync();
      var col = collections.find(function(c) { return c.id === args.collectionRef || c.name === args.collectionRef; });
      if (!col) return { success: false, error: 'Collection not found.' };
      var mode = col.modes.find(function(m) { return m.name === args.modeRef || m.modeId === args.modeRef; });
      if (!mode) return { success: false, error: 'Mode not found.' };
      if (col.modes.length <= 1) return { success: false, error: 'Cannot delete the last mode.' };
      try { col.removeMode(mode.modeId); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
    }

    case 'viewport.center': {
      const { id } = args;
      const node = id ? await figma.getNodeByIdAsync(id) : figma.currentPage.selection[0];
      if (!node) return { error: 'No node ID provided and nothing selected.' };
      figma.viewport.scrollAndZoomIntoView([node]);
      return { id: node.id, name: node.name, type: node.type };
    }

    case 'viewport.select-and-zoom': {
      const { query } = args;
      const nodes = figma.currentPage.findAll(function(n) { return n.name.toLowerCase().includes(query.toLowerCase()); });
      if (nodes.length === 0) return { error: 'No nodes matching: ' + query };
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      return { found: nodes.length, ids: nodes.map(function(n) { return n.id; }) };
    }

    case 'page.list': {
      const pages = figma.root.children;
      return {
        pages: pages.map(p => ({ id: p.id, name: p.name })),
        currentPage: { id: figma.currentPage.id, name: figma.currentPage.name },
      };
    }

    case 'inventory.scan': {
      if (typeof figma.loadAllPagesAsync === 'function') {
        try { await figma.loadAllPagesAsync(); } catch (error) {}
      }
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      const textStyles = await figma.getLocalTextStylesAsync();
      const components = figma.root.findAll(node => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET');
      return {
        pageName: figma.currentPage.name,
        selection: figma.currentPage.selection.map(node => ({ id: node.id, name: node.name, type: node.type })),
        variableCollections: collections.map(collection => ({
          id: collection.id,
          name: collection.name,
          modes: collection.modes.map(mode => mode.name),
        })),
        variables: variables.map(variable => {
          const collection = collections.find(item => item.id === variable.variableCollectionId);
          return {
            id: variable.id,
            name: variable.name,
            type: variable.resolvedType,
            collectionName: collection ? collection.name : '',
          };
        }),
        textStyles: textStyles.map(style => ({ id: style.id, name: style.name })),
        components: components.slice(0, 300).map(component => ({
          id: component.id,
          name: component.name,
          type: component.type,
        })),
      };
    }

    case 'node.find.byName': {
      const { name } = args;
      const node = figma.currentPage.findOne(n => n.name === name);
      if (!node) return { error: 'Node not found: ' + name };
      return { id: node.id, name: node.name, type: node.type };
    }

    case 'variable.set_value': {
      const { variableName, modeName, value } = args;
      const variables = await figma.variables.getLocalVariablesAsync();
      const v = variables.find(v => v.name === variableName || v.id === variableName);
      if (!v) return { success: false, error: 'Variable not found.' };

      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.id === v.variableCollectionId);
      if (!col) return { success: false, error: 'Collection not found.' };

      const mode = col.modes.find(m => m.name === modeName || m.modeId === modeName);
      if (!mode) return { success: false, error: 'Mode not found.' };

      async function parseValue(val, type) {
        const cleanVal = val.startsWith('{') && val.endsWith('}') ? val.slice(1, -1) : val;
        const target = variables.find(v => v.name === cleanVal || v.id === cleanVal);
        if (target) return { type: 'VARIABLE_ALIAS', id: target.id };
        if (type === 'COLOR') {
          const hex = val.replace('#', '');
          return {
            r: parseInt(hex.substring(0, 2), 16) / 255,
            g: parseInt(hex.substring(2, 4), 16) / 255,
            b: parseInt(hex.substring(4, 6), 16) / 255,
            a: 1
          };
        }
        if (type === 'FLOAT') return parseFloat(val);
        if (type === 'BOOLEAN') return val === 'true';
        return val;
      }

      try {
        const parsed = await parseValue(value, v.resolvedType);
        v.setValueForMode(mode.modeId, parsed);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'mode.edit': {
      const { collectionName, oldName, newName } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.name === collectionName || c.id === collectionName);
      if (!col) return { success: false, error: 'Collection not found.' };
      const mode = col.modes.find(m => m.name === oldName || m.modeId === oldName);
      if (!mode) return { success: false, error: 'Mode not found.' };
      col.renameMode(mode.modeId, newName);
      return { success: true, colName: col.name };
    }

    case 'mode.multi': {
      const { collectionName, fromName, toName, strategy, factor, filterPrefix } = args;
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const col = collections.find(c => c.name === collectionName || c.id === collectionName);
      if (!col) return { success: false, error: 'Collection not found: ' + collectionName };

      const sourceMode = col.modes.find(m => m.name.toLowerCase() === fromName.toLowerCase());
      if (!sourceMode) return { success: false, error: 'Source mode "' + fromName + '" not found.' };

      let targetMode = col.modes.find(m => m.name.toLowerCase() === toName.toLowerCase());
      if (!targetMode) {
        try {
          const newId = col.addMode(toName);
          targetMode = { modeId: newId, name: toName };
        } catch (e) {
          return { success: false, error: 'Could not create target mode: ' + e.message };
        }
      }

      const variables = await figma.variables.getLocalVariablesAsync();
      const colVars = variables.filter(v => v.variableCollectionId === col.id);

      function rgbToHsl(r, g, b) {
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
          let d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        return { r, g, b };
      }

      function transformValue(v, sourceVal) {
        if (filterPrefix && !v.name.startsWith(filterPrefix)) return sourceVal;
        if (strategy === 'invert' && v.resolvedType === 'COLOR') {
          const { r, g, b, a } = sourceVal;
          const [h, s, l] = rgbToHsl(r, g, b);
          const newL = 1 - l;
          const rgb = hslToRgb(h, s, newL);
          return { r: rgb.r, g: rgb.g, b: rgb.b, a: a };
        }
        if (strategy === 'scale' && v.resolvedType === 'FLOAT') {
          return sourceVal * factor;
        }
        if (strategy === 'copy') return sourceVal;
        return sourceVal;
      }

      let count = 0;
      for (const v of colVars) {
        const sourceValue = v.valuesByMode[sourceMode.modeId];
        if (sourceValue === undefined) continue;
        try {
          const newValue = transformValue(v, sourceValue);
          v.setValueForMode(targetMode.modeId, newValue);
          count++;
        } catch (err) { /* skip */ }
      }
      return { success: true, count, colName: col.name, targetModeName: targetMode.name };
    }

    case 'tokens.export': {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      const cols = collections.map(c => ({
        id: c.id,
        name: c.name,
        modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
        variableIds: c.variableIds
      }));
      const vars = variables.map(v => {
        const values = {};
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (val && typeof val === 'object' && 'r' in val) {
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            values[modeId] = '#' + toHex(val.r) + toHex(val.g) + toHex(val.b);
          } else if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
            values[modeId] = { alias: val.id };
          } else {
            values[modeId] = val;
          }
        }
        return {
          id: v.id,
          name: v.name,
          type: v.resolvedType,
          collectionId: v.variableCollectionId,
          values
        };
      });
      return { collections: cols, variables: vars };
    }

    case 'effect.drop_shadow': {
      const { nodeIds, color = '#000000', opacity = 0.15, x = 0, y = 4, blur = 8, spread = 0 } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      const effect = {
        type: 'DROP_SHADOW',
        visible: true,
        blendMode: 'NORMAL',
        color: hexToRgba(color, opacity),
        offset: { x: Number(x), y: Number(y) },
        radius: Number(blur),
        spread: Number(spread),
      };
      const results = [];
      for (const node of valid) {
        const existing = (node.effects || []).filter(e => e.type !== 'DROP_SHADOW');
        node.effects = [...existing, effect];
        results.push({ id: node.id, name: node.name });
      }
      return { success: true, count: results.length, nodes: results };
    }

    case 'effect.inner_shadow': {
      const { nodeIds, color = '#000000', opacity = 0.1, x = 0, y = 2, blur = 4, spread = 0 } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      const effect = {
        type: 'INNER_SHADOW',
        visible: true,
        blendMode: 'NORMAL',
        color: hexToRgba(color, opacity),
        offset: { x: Number(x), y: Number(y) },
        radius: Number(blur),
        spread: Number(spread),
      };
      const results = [];
      for (const node of valid) {
        const existing = (node.effects || []).filter(e => e.type !== 'INNER_SHADOW');
        node.effects = [...existing, effect];
        results.push({ id: node.id, name: node.name });
      }
      return { success: true, count: results.length, nodes: results };
    }

    case 'effect.layer_blur': {
      const { nodeIds, blur = 10 } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      const effect = {
        type: 'LAYER_BLUR',
        visible: true,
        radius: Number(blur),
      };
      const results = [];
      for (const node of valid) {
        const existing = (node.effects || []).filter(e => e.type !== 'LAYER_BLUR');
        node.effects = [...existing, effect];
        results.push({ id: node.id, name: node.name });
      }
      return { success: true, count: results.length, nodes: results };
    }

    case 'effect.background_blur': {
      const { nodeIds, blur = 20 } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      const effect = {
        type: 'BACKGROUND_BLUR',
        visible: true,
        radius: Number(blur),
      };
      const results = [];
      for (const node of valid) {
        const existing = (node.effects || []).filter(e => e.type !== 'BACKGROUND_BLUR');
        node.effects = [...existing, effect];
        results.push({ id: node.id, name: node.name });
      }
      return { success: true, count: results.length, nodes: results };
    }

    case 'effect.glass': {
      const { nodeIds, color = '#ffffff', opacity = 0.1, blur = 30, borderColor = '#ffffff', borderOpacity = 0.2, borderWidth = 1, cornerRadius = 16 } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      const results = [];
      for (const node of valid) {
        // Add background blur for glass effect
        const blurEffect = {
          type: 'BACKGROUND_BLUR',
          visible: true,
          radius: Number(blur),
        };
        const existing = (node.effects || []).filter(e => e.type !== 'BACKGROUND_BLUR');
        node.effects = [...existing, blurEffect];

        // Add semi-transparent fill
        if (node.fills && Array.isArray(node.fills)) {
          const hasSolid = node.fills.some(f => f.type === 'SOLID');
          if (!hasSolid || node.fills.length === 0) {
            node.fills = [{
              type: 'SOLID',
              color: hexToRgb(color),
              opacity: Number(opacity),
            }];
          } else {
            // Add as top layer
            node.fills = [...node.fills, {
              type: 'SOLID',
              color: hexToRgb(color),
              opacity: Number(opacity),
            }];
          }
        }

        // Add subtle border stroke
        if (borderWidth > 0 && node.strokes !== undefined) {
          node.strokes = [{
            type: 'SOLID',
            color: hexToRgb(borderColor),
            opacity: Number(borderOpacity),
          }];
          node.strokeWeight = Number(borderWidth);
          node.strokeAlign = 'INSIDE';
        }

        // Set corner radius if specified
        if ('cornerRadius' in node) {
          node.cornerRadius = Number(cornerRadius);
        }

        results.push({ id: node.id, name: node.name });
      }
      return { success: true, count: results.length, nodes: results };
    }

    case 'effect.clear': {
      const { nodeIds } = args;
      const targets = await Promise.all(nodeIds.map(id => figma.getNodeByIdAsync(id)));
      const valid = targets.filter(n => n && 'effects' in n);
      for (const node of valid) {
        node.effects = [];
      }
      return { success: true, count: valid.length };
    }

    case 'script.run': {
      const { code } = args;
      try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction(code);
        return await fn();
      } catch (e) {
        return { error: e.message };
      }
    }

    default:
      return { error: `Unknown operation: ${op}` };
  }
}

// ── Command Handlers ─────────────────────────────────

// Helper: create a node from raw copy data (for recursive children)
async function createNodeFromData(data) {
  if (!data || !data.raw) return null;
  const raw = data.raw;

  var newNode;
  if (data.type === 'TEXT') {
    newNode = figma.createText();
    try {
      await figma.loadFontAsync(raw.fontName || { family: 'Inter', style: 'Regular' });
      newNode.fontName = raw.fontName || { family: 'Inter', style: 'Regular' };
    } catch(e) {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      newNode.fontName = { family: 'Inter', style: 'Regular' };
    }
    newNode.characters = raw.characters || '';
    newNode.fontSize = raw.fontSize || 14;
    if (raw.textAlignHorizontal) newNode.textAlignHorizontal = raw.textAlignHorizontal;
    if (raw.textAlignVertical) newNode.textAlignVertical = raw.textAlignVertical;
  } else if (data.type === 'ELLIPSE') {
    newNode = figma.createEllipse();
  } else if (data.type === 'RECTANGLE') {
    newNode = figma.createRectangle();
  } else if (data.type === 'LINE') {
    newNode = figma.createLine();
  } else {
    newNode = figma.createFrame();
  }

  newNode.name = data.props.name || 'Pasted';
  if (raw.width > 0 && raw.height > 0) newNode.resize(raw.width, raw.height);
  if (raw.fills && raw.fills.length > 0) newNode.fills = raw.fills;
  if (raw.strokes && raw.strokes.length > 0) {
    newNode.strokes = raw.strokes;
    newNode.strokeWeight = raw.strokeWeight || 1;
  }
  if (raw.cornerRadius > 0 && 'cornerRadius' in newNode) newNode.cornerRadius = raw.cornerRadius;

  if (raw.layoutMode && raw.layoutMode !== 'NONE' && 'layoutMode' in newNode) {
    newNode.layoutMode = raw.layoutMode;
    newNode.itemSpacing = raw.itemSpacing;
    newNode.paddingLeft = raw.paddingLeft;
    newNode.paddingRight = raw.paddingRight;
    newNode.paddingTop = raw.paddingTop;
    newNode.paddingBottom = raw.paddingBottom;
    newNode.primaryAxisAlignItems = raw.primaryAxisAlignItems;
    newNode.counterAxisAlignItems = raw.counterAxisAlignItems;
    newNode.layoutWrap = raw.layoutWrap;
  }
  if ('clipsContent' in newNode) newNode.clipsContent = raw.clipsContent;

  // Children
  if (data.children && data.children.length > 0) {
    for (var i = 0; i < data.children.length; i++) {
      var childNode = await createNodeFromData(data.children[i]);
      if (childNode) newNode.appendChild(childNode);
    }
  }

  return newNode;
}

const handlers = {

  'health': async () => ({ status: 'ok' }),

  'render.jsx': async (params) => {
    const { jsx } = params;
    if (!jsx || typeof jsx !== 'string') return { error: 'No JSX provided' };

    const { generator, errors } = parseJSXStream(jsx);
    if (errors.length > 0) return { error: errors[0].message };

    const registry = new Map();
    let created = 0;
    for (const cmd of generator) {
      try {
        const p = cmd.params || {};
        if (p.parentId && registry.has(p.parentId)) p.parentId = registry.get(p.parentId);
        const node = await createNodeTransaction(p.type, p.props || {}, p.parentId);
        if (p.id) registry.set(p.id, node.id);
        created++;
      } catch (e) {
        console.warn('Command failed:', e.message);
      }
    }
    return { success: true, count: created };
  },

  'component.create_set': async (params) => {
    const { name, childrenIds } = params;
    const idList = Array.isArray(childrenIds) ? childrenIds : String(childrenIds || '').split(',').map(s => s.trim()).filter(Boolean);
    const nodes = await Promise.all(idList.map(id => figma.getNodeByIdAsync(id)));

    const validNodes = nodes.filter(n => n && (n.type === 'COMPONENT' || n.type === 'FRAME' || n.type === 'INSTANCE' || n.type === 'RECTANGLE' || n.type === 'ELLIPSE' || n.type === 'TEXT'));

    const components = await Promise.all(validNodes.map(async n => {
      let target = n;
      if (n.type !== 'COMPONENT') {
        const comp = figma.createComponent();
        comp.name = n.name;
        comp.resize(n.width, n.height);
        comp.x = n.x; comp.y = n.y;
        comp.appendChild(n);
        n.x = 0; n.y = 0;
        target = comp;
      }
      figma.currentPage.appendChild(target);
      return target;
    }));

    if (components.length === 0) throw new Error('No valid nodes to combine into a component set.');

    const componentSet = figma.combineAsVariants(components, figma.currentPage);
    if (name) componentSet.name = name;
    return { id: componentSet.id, name: componentSet.name, variantCount: componentSet.children.length };
  },

  'component.add_variant': async (params) => {
    const { id, variantName, properties } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error('Component not found.');
    if (node.type === 'COMPONENT_SET') throw new Error('Target is already a Component Set. Use component add-prop instead.');
    if (node.type !== 'COMPONENT') throw new Error('Target must be a Component.');

    // Parse properties: "State=Hover,bg=#2563eb"
    const propPairs = {};
    if (properties) {
      properties.split(',').forEach(pair => {
        const eq = pair.indexOf('=');
        if (eq > 0) {
          propPairs[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
        }
      });
    }

    // Clone the component
    const clone = node.clone();
    clone.name = variantName || node.name;

    // Apply style overrides from properties
    if (propPairs.bg) {
      const hex = propPairs.bg.replace('#', '');
      clone.fills = [{
        type: 'SOLID',
        color: {
          r: parseInt(hex.substring(0, 2), 16) / 255,
          g: parseInt(hex.substring(2, 4), 16) / 255,
          b: parseInt(hex.substring(4, 6), 16) / 255,
        }
      }];
    }

    // Position clone next to original
    clone.x = node.x + node.width + 20;
    clone.y = node.y;

    // Create Component Set with original + clone
    const parent = node.parent;
    const index = parent.children.indexOf(node);
    const componentSet = figma.combineAsVariants([node, clone], parent, index);

    // Handle properties
    const propKeys = Object.keys(propPairs).filter(k => k !== 'bg');
    if (propKeys.length > 0) {
      const firstKey = propKeys[0];
      const firstVal = propPairs[firstKey];

      // Get auto-generated property key
      const autoKeys = Object.keys(componentSet.componentPropertyDefinitions).filter(k => /^Property \d+$/.test(k));
      const firstAutoKey = autoKeys[0] || null;

      if (firstAutoKey) {
        // Strip ALL key=value from variant names first
        for (let i = 0; i < componentSet.children.length; i++) {
          const child = componentSet.children[i];
          const parts = child.name.split(',').map(p => p.trim());
          child.name = parts.filter(p => p.indexOf('=') < 0).join(', ') || child.name;
        }

        // Rename Property 1 → State
        try {
          componentSet.renameComponentProperty(firstAutoKey, firstKey);
        } catch (e) {
          console.warn('[FigCli] Could not rename property: ' + e.message);
        }
      }

      // Set clean variant names
      if (firstKey) {
        componentSet.children[0].name = `${firstKey}=Default`;
        componentSet.children[1].name = `${firstKey}=${firstVal}`;
      }
    }

    return {
      id: componentSet.id,
      name: componentSet.name,
      variantCount: componentSet.children.length,
      variants: componentSet.children.map(c => ({ id: c.id, name: c.name })),
    };
  },

  'component.add_variant_to_set': async (params) => {
    const { id, variantName, properties } = params;
    const componentSet = await figma.getNodeByIdAsync(id);
    if (!componentSet) throw new Error('Component Set not found.');
    if (componentSet.type !== 'COMPONENT_SET') throw new Error('Target must be a Component Set.');

    // Parse properties
    const propPairs = {};
    if (properties) {
      properties.split(',').forEach(pair => {
        const eq = pair.indexOf('=');
        if (eq > 0) {
          propPairs[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
        }
      });
    }

    // Clone first variant as base
    const base = componentSet.children[0];
    const clone = base.clone();
    clone.name = variantName || base.name;

    // Apply style overrides
    if (propPairs.bg) {
      const hex = propPairs.bg.replace('#', '');
      clone.fills = [{
        type: 'SOLID',
        color: {
          r: parseInt(hex.substring(0, 2), 16) / 255,
          g: parseInt(hex.substring(2, 4), 16) / 255,
          b: parseInt(hex.substring(4, 6), 16) / 255,
        }
      }];
    }

    // Position
    clone.x = componentSet.children[componentSet.children.length - 1].x + base.width + 20;
    clone.y = componentSet.children[componentSet.children.length - 1].y;

    // Append to set
    componentSet.appendChild(clone);

    // Set variant name
    const propKeys = Object.keys(propPairs).filter(k => k !== 'bg');
    if (propKeys.length > 0) {
      const nameParts = propKeys.map(k => `${k}=${propPairs[k]}`).filter(Boolean);
      clone.name = nameParts.join(', ');
    }

    return {
      id: componentSet.id,
      name: componentSet.name,
      variantCount: componentSet.children.length,
      variants: componentSet.children.map(c => ({ id: c.id, name: c.name })),
    };
  },

  'component.add_property': async (params) => {
    const { id, name, type, defaultValue } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component Set.');
    }
    const propName = node.addComponentProperty(name, type.toUpperCase(), defaultValue);
    return { propertyName: propName };
  },

  'component.rename_property': async (params) => {
    const { id, oldName, newName } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component Set.');
    }

    // Try Figma API first
    try {
      node.renameComponentProperty(oldName, newName);
      return { propertyName: newName };
    } catch (e) {
      console.warn('[FigCli] renameComponentProperty blocked: ' + e.message);
    }

    // Fallback: rebuild property and variant names
    const variants = node.children;
    const propDefs = node.componentPropertyDefinitions;

    // Find the old property key
    let oldKey = null;
    for (const [key, def] of Object.entries(propDefs)) {
      if (key === oldName || def.name === oldName) {
        oldKey = key;
        break;
      }
    }
    if (!oldKey) throw new Error('Property "' + oldName + '" not found.');

    // Get old property details
    const oldDef = propDefs[oldKey];

    // Extract old values from variant names
    const oldValues = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const name = String(v.name || '');
      const prefix = oldKey + '=';
      if (name.indexOf(prefix) === 0) {
        const val = name.substring(prefix.length).split(',')[0].trim();
        oldValues.push(val);
      } else {
        oldValues.push('Variant ' + (i + 1));
      }
    }

    // Add new property with same type and default
    node.addComponentProperty(newName, oldDef.type, oldDef.defaultValue);

    // Completely replace variant names (Figma auto-added "newName=Default" on add)
    for (let i = 0; i < variants.length; i++) {
      variants[i].name = newName + '=' + (oldValues[i] || 'Variant');
    }

    // Delete old property
    try {
      node.deleteComponentProperty(oldKey);
    } catch (e) {
      console.warn('[FigCli] Warning: Could not delete old property: ' + e.message);
    }

    return { propertyName: newName };
  },

  'component.detach': async (params) => {
    const { id } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error('Node not found.');
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component or Component Set.');
    }

    let count = 0;
    if (node.type === 'COMPONENT_SET') {
      // Detach all variants to frames, then detach the set
      for (const child of [...node.children]) {
        child.remove();
        count++;
      }
      // The set should be empty now, detach it
      const parent = node.parent;
      if (parent) {
        node.remove();
      }
    } else if (node.type === 'COMPONENT') {
      // Clone the component as a frame, then remove the component
      const clone = node.clone();
      clone.name = node.name;
      const parent = node.parent;
      if (parent) {
        const idx = parent.children.indexOf(node);
        parent.insertChild(idx, clone);
      }
      node.remove();
      count = 1;
    }

    return { count };
  },

  'viewport.pan': async (params) => {
    const { x, y } = params;
    figma.viewport.scrollAndZoomIntoView([{ x: Number(x), y: Number(y) }]);
    return { success: true, x: Number(x), y: Number(y) };
  },

  'viewport.zoom': async (params) => {
    const { level } = params;
    const node = figma.currentPage.selection[0];
    if (node) {
      figma.viewport.scrollAndZoomIntoView([node]);
    }
    return { success: true, level };
  },

  'viewport.center': async (params) => {
    const { id } = params;
    const node = id ? await figma.getNodeByIdAsync(id) : figma.currentPage.selection[0];
    if (!node) return { error: 'No node ID provided and nothing selected.' };
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.currentPage.selection = [node];
    return { id: node.id, name: node.name, type: node.type };
  },

  'viewport.select-and-zoom': async (params) => {
    const { query } = params;
    const nodes = figma.currentPage.findAll(function(n) { return n.name.toLowerCase().includes(query.toLowerCase()); });
    if (nodes.length === 0) return { error: 'No nodes matching: ' + query };
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    return { found: nodes.length, ids: nodes.map(function(n) { return n.id; }) };
  },

  'component.inspect': async (params) => {
    const { id } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component Set.');
    }
    const props = {};
    for (const [key, def] of Object.entries(node.componentPropertyDefinitions)) {
      props[key] = {
        type: def.type,
        defaultValue: def.defaultValue,
        variantOptions: def.variantOptions || null,
        preferredValues: def.preferredValues || null,
      };
    }
    return {
      id: node.id,
      name: node.name,
      properties: props,
      variants: node.children.map(function(c) {
        return { id: c.id, name: c.name, componentProperties: c.componentProperties };
      }),
    };
  },

  'component.update_text': async (params) => {
    const { id, text } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component Set.');
    }
    let updated = 0;
    for (var i = 0; i < node.children.length; i++) {
      var variant = node.children[i];
      var texts = variant.findAll(function(n) { return n.type === 'TEXT'; });
      for (var j = 0; j < texts.length; j++) {
        if (texts[j].characters === '' || texts[j].characters === undefined) {
          try { texts[j].characters = text; updated++; } catch(e) {}
        }
      }
    }
    return { updated: updated, totalVariants: node.children.length };
  },

  'component.delete_property': async (params) => {
    const { id, name } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error('Node not found.');
    if (node.type !== 'COMPONENT_SET') {
      throw new Error('Target must be a Component Set.');
    }

    const keys = Object.keys(node.componentPropertyDefinitions);

    // Find the matching key - check both key and def.name
    var found = null;
    for (var k = 0; k < keys.length; k++) {
      var def = node.componentPropertyDefinitions[keys[k]];
      if (keys[k] === name || def.name === name) {
        found = keys[k];
        break;
      }
    }
    if (!found) {
      throw new Error('Property "' + name + '" not found. Available: ' + keys.join(', '));
    }

    // Remove property from all child variant names before deleting
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.type === 'COMPONENT') {
        var parts = child.name.split(',').map(function(p) { return p.trim(); });
        var newParts = parts.filter(function(p) {
          var eqIdx = p.indexOf('=');
          if (eqIdx < 0) return true;
          var pKey = p.substring(0, eqIdx).trim();
          return pKey !== found;
        });
        child.name = newParts.join(', ');
      }
    }

    try {
      node.deleteComponentProperty(found);
    } catch (e) {
      // Figma may block deletion of certain auto-generated properties
      // Variant names are already cleaned up above, so this is acceptable
      console.warn('[FigCli] Warning: Could not delete property "' + found + '": ' + e.message);
    }
    return { deleted: found };
  },

  'component.set_property': async (params) => {
    const { id, propertyName, value } = params;
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'COMPONENT') {
      throw new Error('Target must be a Component (Variant).');
    }

    const propDefs = node.parent && node.parent.type === 'COMPONENT_SET'
      ? node.parent.componentPropertyDefinitions
      : {};

    // Use the actual property key if propertyName is the display name
    let actualKey = propertyName;
    for (const [key, def] of Object.entries(propDefs)) {
      if (key === propertyName || def.name === propertyName) {
        actualKey = key;
        break;
      }
    }

    const parts = node.name.split(',').map(p => p.trim()).filter(Boolean);
    const newParts = parts.filter(function(p) {
      var eqIdx = p.indexOf('=');
      if (eqIdx < 0) return true;
      var pKey = p.substring(0, eqIdx).trim();
      return pKey !== actualKey && pKey !== propertyName;
    });
    newParts.push(`${actualKey}=${value}`);
    node.name = newParts.join(', ');
    
    return { name: node.name };
  },

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

  'style.list': async () => {
    const textStyles = await figma.getLocalTextStylesAsync();
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();
    const gridStyles = await figma.getLocalGridStylesAsync();

    return {
      text: textStyles.map(s => ({ id: s.id, name: s.name, type: 'TEXT' })),
      paint: paintStyles.map(s => ({ id: s.id, name: s.name, type: 'PAINT' })),
      effect: effectStyles.map(s => ({ id: s.id, name: s.name, type: 'EFFECT' })),
      grid: gridStyles.map(s => ({ id: s.id, name: s.name, type: 'GRID' }))
    };
  },

  'style.delete_all': async () => {
    const textStyles = await figma.getLocalTextStylesAsync();
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();
    const gridStyles = await figma.getLocalGridStylesAsync();

    const all = textStyles.concat(paintStyles).concat(effectStyles).concat(gridStyles);
    const count = all.length;
    for (const s of all) {
      try { s.remove(); } catch(e) {}
    }
    return { deleted: count };
  },

  'style.create_text': async (params) => {
    const existingTextStyles = await figma.getLocalTextStylesAsync();
    const result = await upsertTextStyle(params, existingTextStyles);
    return { id: result.style.id, name: result.style.name, created: result.created };
  },

  'style.create_text_styles': async (params) => {
    const styles = Array.isArray(params.styles) ? params.styles : [];
    const existingTextStyles = await figma.getLocalTextStylesAsync();
    const names = [];
    let created = 0;
    let updated = 0;

    for (const styleSpec of styles) {
      const result = await upsertTextStyle(styleSpec, existingTextStyles);
      names.push(result.style.name);
      if (result.created) {
        created++;
      } else {
        updated++;
      }
    }

    return {
      total: styles.length,
      created,
      updated,
      names,
    };
  },

  'style.update_typography': async (params) => {
    const { family, pattern, weightMap = {} } = params;
    const styles = await figma.getLocalTextStylesAsync();
    const regex = pattern ? new RegExp(pattern) : null;
    const targetStyles = styles.filter(s => !regex || regex.test(s.name));
    
    const results = { updated: 0, failed: 0, total: targetStyles.length, errors: [] };
    
    for (const style of targetStyles) {
      const oldFont = style.fontName;
      // 1. Direct weight mapping or preservation
      const targetWeight = weightMap[oldFont.style] || oldFont.style;
      const newFont = { family, style: targetWeight };
      
      try {
        await figma.loadFontAsync(newFont);
        style.fontName = newFont;
        results.updated++;
      } catch (err) {
        // 2. Intelligent Fallback Strategy
        const commonWeights = ['Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black', 'Light', 'Thin'];
        let found = false;
        for (const w of commonWeights) {
          try {
            const fallbackFont = { family, style: w };
            await figma.loadFontAsync(fallbackFont);
            style.fontName = fallbackFont;
            results.updated++;
            found = true;
            break;
          } catch (e) {}
        }
        if (!found) {
          results.failed++;
          results.errors.push(`Style "${style.name}": Could not load "${family}" with weight "${targetWeight}" or any common fallback.`);
        }
      }
    }
    return results;
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

  'tokens.create_system': async (params) => {
    const system = params.system || {};
    const collectionSpecs = Array.isArray(system.collections) ? system.collections : [];
    const textStyleSpecs = Array.isArray(system.textStyles) ? system.textStyles : [];

    const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const existingVariables = await figma.variables.getLocalVariablesAsync();
    const collectionMap = new Map();
    const modeMap = new Map();
    const variableMap = new Map();

    let createdCollections = 0;
    let createdVariables = 0;
    let createdTextStyles = 0;

    function getVariableKey(collectionName, variableName) {
      return `${collectionName}::${variableName}`;
    }

    async function ensureCollection(collectionSpec) {
      let collection = existingCollections.find(c => c.name === collectionSpec.name);
      if (!collection) {
        collection = figma.variables.createVariableCollection(collectionSpec.name);
        existingCollections.push(collection);
        createdCollections++;
      }

      const desiredModes = Array.isArray(collectionSpec.modes) && collectionSpec.modes.length > 0
        ? collectionSpec.modes
        : ['Base'];

      if (collection.modes.length > 0 && collection.modes[0].name !== desiredModes[0]) {
        collection.renameMode(collection.modes[0].modeId, desiredModes[0]);
      }

      for (let i = 1; i < desiredModes.length; i++) {
        if (!collection.modes.find(mode => mode.name === desiredModes[i])) {
          collection.addMode(desiredModes[i]);
        }
      }

      collectionMap.set(collectionSpec.name, collection);
      modeMap.set(
        collectionSpec.name,
        new Map(collection.modes.map(mode => [mode.name, mode.modeId]))
      );

      return collection;
    }

    async function ensureVariable(collectionSpec, variableSpec) {
      const collection = collectionMap.get(collectionSpec.name) || await ensureCollection(collectionSpec);
      let variable = existingVariables.find(v => v.variableCollectionId === collection.id && v.name === variableSpec.name);
      if (!variable) {
        variable = figma.variables.createVariable(variableSpec.name, collection, variableSpec.type);
        existingVariables.push(variable);
        createdVariables++;
      }
      variableMap.set(getVariableKey(collectionSpec.name, variableSpec.name), variable);
      return variable;
    }

    function resolveAlias(value) {
      if (!value || typeof value !== 'object' || !value.alias) return null;
      const targetCollection = value.alias.collection;
      const targetVariable = value.alias.variable;
      return variableMap.get(getVariableKey(targetCollection, targetVariable)) || null;
    }

    function resolveValueForVariable(variable, value) {
      if (value && typeof value === 'object' && value.alias) {
        const aliasTarget = resolveAlias(value);
        if (!aliasTarget) {
          throw new Error(`Alias target not found: ${value.alias.collection}/${value.alias.variable}`);
        }
        return { type: 'VARIABLE_ALIAS', id: aliasTarget.id };
      }

      if (variable.resolvedType === 'COLOR') {
        if (typeof value !== 'string') {
          throw new Error(`Expected color string for ${variable.name}`);
        }
        const parsed = parseColor(value);
        if (!parsed) {
          throw new Error(`Invalid color value for ${variable.name}: ${value}`);
        }
        return {
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
          a: parsed.a !== undefined ? parsed.a : 1,
        };
      }

      if (variable.resolvedType === 'FLOAT') return Number(value);
      if (variable.resolvedType === 'BOOLEAN') return Boolean(value);
      return String(value);
    }

    for (const collectionSpec of collectionSpecs) {
      await ensureCollection(collectionSpec);
    }

    for (const collectionSpec of collectionSpecs) {
      for (const variableSpec of (collectionSpec.variables || [])) {
        await ensureVariable(collectionSpec, variableSpec);
      }
    }

    for (const collectionSpec of collectionSpecs) {
      const collectionModes = modeMap.get(collectionSpec.name);
      const fallbackModeId = collectionModes.values().next().value;

      for (const variableSpec of (collectionSpec.variables || [])) {
        const variable = variableMap.get(getVariableKey(collectionSpec.name, variableSpec.name));
        const values = variableSpec.values || {};

        for (const [modeName, rawValue] of Object.entries(values)) {
          const modeId = collectionModes.get(modeName) || fallbackModeId;
          const resolvedValue = resolveValueForVariable(variable, rawValue);
          variable.setValueForMode(modeId, resolvedValue);
        }
      }
    }

    const existingTextStyles = await figma.getLocalTextStylesAsync();

    for (const styleSpec of textStyleSpecs) {
      const result = await upsertTextStyle(styleSpec, existingTextStyles);
      if (result.created) {
        createdTextStyles++;
      }
    }

    return {
      system: system.name || 'custom',
      prefix: system.prefix || null,
      collections: collectionSpecs.length,
      variables: createdVariables,
      textStyles: createdTextStyles,
      createdCollections,
      collectionNames: collectionSpecs.map(collection => collection.name),
    };
  },

  'eval': async (params) => {
    try {
      const { op, args = {} } = params;

      if (op) {
        return await executeEvalOperation(op, args);
      }

      return { error: 'No operation provided. Use ctx.evalOp() with a valid operation name.' };
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
    
    // 1. Update the root node itself
    await applyPropsToNode(node, params.props || {});

    // 2. Deep update for children using Intelligent Name-Matching
    if (params.batch && params.batch.length > 1) {
      const registry = new Map();
      registry.set(params.batch[0].params.id, node); // Root mapping

      for (let i = 1; i < params.batch.length; i++) {
        const cmd = params.batch[i];
        if (cmd.command !== 'node.create') continue;
        
        const p = cmd.params || {};
        const parentNode = registry.get(p.parentId);
        if (!parentNode || !parentNode.children) continue;

        // HEURISTIC: Find child by name first (Strong Match)
        const targetName = (p.props && p.props.name) ? p.props.name : null;
        let child = null;
        
        if (targetName) {
           child = parentNode.children.find(c => c.name === targetName);
        }

        // FALLBACK: Match by type if only one child of that type exists
        if (!child) {
          const sameTypeChildren = parentNode.children.filter(c => c.type === p.type);
          if (sameTypeChildren.length === 1) {
            child = sameTypeChildren[0];
          }
        }

        if (child) {
          await applyPropsToNode(child, p.props || {});
          if (p.id) registry.set(p.id, child);
        }
      }
    }

    return { nodeId: node.id, status: 'updated' };
  },

  'node.hydrate': async (params) => {
    const { id, data, clone = false, gap = 40 } = params;
    const sourceNode = await figma.getNodeByIdAsync(id);
    if (!sourceNode) throw new Error('Source node for hydration not found');

    const records = Array.isArray(data) ? data : [data];
    const results = [];

    async function injectData(node, entry) {
      if (node.type === 'TEXT' && node.name.startsWith('#')) {
        const key = node.name.slice(1);
        if (entry[key] !== undefined) {
          await figma.loadFontAsync(node.fontName);
          node.characters = String(entry[key]);
        }
      }
      if ('children' in node) {
        for (const child of node.children) {
          await injectData(child, entry);
        }
      }
    }

    let lastNode = sourceNode;
    for (let i = 0; i < records.length; i++) {
      let targetNode = sourceNode;
      if (clone || i > 0) {
        targetNode = sourceNode.clone();
        if ('appendChild' in sourceNode.parent) {
          sourceNode.parent.appendChild(targetNode);
        }
        targetNode.x = lastNode.x + lastNode.width + gap;
        targetNode.y = lastNode.y;
        lastNode = targetNode;
      }
      
      await injectData(targetNode, records[i]);
      results.push({ id: targetNode.id, name: targetNode.name });
    }

    return { status: 'hydrated', count: results.length, nodes: results };
  },

  'node.responsive': async (params) => {
    const { id, breakpoints, gap = 100 } = params;
    const sourceNode = await figma.getNodeByIdAsync(id);
    if (!sourceNode) throw new Error('Source node not found');

    const results = [];
    let lastX = sourceNode.x + sourceNode.width + gap;

    for (const width of breakpoints) {
      const clone = sourceNode.clone();
      if ('appendChild' in sourceNode.parent) {
        sourceNode.parent.appendChild(clone);
      }
      
      clone.name = `${sourceNode.name} (${width}px)`;
      clone.resize(width, clone.height);
      await applyResponsiveAdaptation(clone, width);
      clone.x = lastX;
      clone.y = sourceNode.y;
      
      lastX += width + gap;
      results.push({ id: clone.id, name: clone.name, width });
    }

    return { status: 'responsive_complete', count: results.length, nodes: results };
  },

  'node.skeleton': async (params) => {
    const { id, color = '#e2e8f0', rounded = 4 } = params;
    const sourceNode = await figma.getNodeByIdAsync(id);
    if (!sourceNode) throw new Error('Source node not found');

    const clone = sourceNode.clone();
    clone.name = `${sourceNode.name} (Skeleton)`;
    if (sourceNode.parent && 'appendChild' in sourceNode.parent) {
      sourceNode.parent.appendChild(clone);
    }
    clone.x = sourceNode.x;
    clone.y = sourceNode.y + sourceNode.height + 100;

    const skeletonColor = parseColor(color);

    async function skeletonize(node, depth = 0) {
      try {
        if (node.type === 'TEXT') {
          const rect = figma.createRectangle();
          rect.name = 'SkeletonBar';
          rect.resize(node.width, node.height);
          
          // Bars are always the darkest
          rect.fills = [{ type: 'SOLID', color: parseColor('#e2e8f0') }];
          rect.cornerRadius = rounded;
          
          if (node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE') {
             const index = node.parent.children.indexOf(node);
             try {
               node.parent.insertChild(index, rect);
               
               // Copy sizing modes safely (Rectangles cannot HUG)
               if ('layoutSizingHorizontal' in node) {
                 const h = node.layoutSizingHorizontal;
                 rect.layoutSizingHorizontal = (h === 'FILL') ? 'FILL' : 'FIXED';
               }
               if ('layoutSizingVertical' in node) {
                 const v = node.layoutSizingVertical;
                 rect.layoutSizingVertical = (v === 'FILL') ? 'FILL' : 'FIXED';
               }
             } catch (e) {
               console.warn(`Failed to insert skeleton bar into parent: ${e.message}`);
               rect.x = node.x;
               rect.y = node.y;
             }
          } else {
             rect.x = node.x;
             rect.y = node.y;
          }
          
          try {
            node.remove();
          } catch (e) {
            console.warn(`Failed to remove original text node: ${e.message}`);
            node.opacity = 0; // Fallback
          }
        } else if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'VECTOR') {
          try {
            node.fills = [{ type: 'SOLID', color: parseColor('#e2e8f0') }];
            node.strokes = [];
            node.effects = [];
          } catch (e) {}
        } else if (node.type === 'FRAME' || node.type === 'INSTANCE' || node.type === 'COMPONENT' || node.type === 'GROUP') {
          let activeNode = node;
          
          // If it's an instance, we must detach it to modify its internal hierarchy for the skeleton
          if (node.type === 'INSTANCE') {
            try {
              activeNode = node.detachInstance();
            } catch (e) {
              console.warn('Failed to detach instance during skeletonization:', e.message);
              // If we can't detach, we treat it as a single block
              node.fills = [{ type: 'SOLID', color: parseColor('#e2e8f0') }];
              return;
            }
          }

          // HIERARCHICAL DEPTH SHADING
          let frameColor = '#f8fafc'; // Default Depth 0
          if (depth === 1) frameColor = '#f1f5f9';
          if (depth >= 2) frameColor = '#e2e8f0';

          try {
            if ('fills' in activeNode && activeNode.fills !== figma.mixed) {
               activeNode.fills = [{ type: 'SOLID', color: parseColor(frameColor) }];
            }
            if ('strokes' in activeNode) activeNode.strokes = [];
            if ('effects' in activeNode) activeNode.effects = [];
          } catch (e) {}
          
          if ('children' in activeNode) {
            const children = Array.from(activeNode.children);
            for (const child of children) {
              await skeletonize(child, depth + 1);
            }
          }
        }
      } catch (err) {
        console.warn(`Skeletonize error on node ${node.name} (${node.type}):`, err.message);
      }
    }

    await skeletonize(clone, 0);
    return { status: 'skeletonized', id: clone.id, name: clone.name };
  },

  'node.create': async (params) => {
    const node = await createNodeTransaction(params.type, params.props || {}, params.parentId);
    return { nodeId: node.id, name: node.name };
  },

  'batch': async (params) => {
    const registry = new Map();
    const results = [];
    const cmds = params.commands || [];
    for (let ci = 0; ci < cmds.length; ci++) {
      const cmd = cmds[ci];
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
        console.error('[Batch Error]', err.stack || err.message);
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
    case 'INSTANCE':
      if (props.componentId) {
        const comp = await figma.getNodeByIdAsync(props.componentId);
        if (comp && comp.type === 'COMPONENT') {
          node = comp.createInstance();
        } else if (comp && comp.type === 'COMPONENT_SET') {
          node = comp.defaultVariant.createInstance();
        } else {
          node = figma.createFrame();
        }
      } else {
        node = figma.createFrame();
      }
      break;
    case 'SVG': 
      if (props.content) {
        try {
          node = figma.createNodeFromSvg(props.content);
          const targetW = typeof props.width === 'number' ? props.width : 100;
          const targetH = typeof props.height === 'number' ? props.height : 100;
          node.resize(targetW, targetH);
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

// ── Variable & Token Cache ───────────────────────────
let variableCache = null;
let lastCacheUpdate = 0;
const CACHE_TIMEOUT = 5000; // 5 seconds

async function getVariableCache() {
  if (!figma.variables) return [];
  const now = Date.now();
  if (!variableCache || (now - lastCacheUpdate > CACHE_TIMEOUT)) {
    try {
      const vars = await figma.variables.getLocalVariablesAsync();
      variableCache = vars;
      lastCacheUpdate = now;
    } catch (e) {
      console.warn('[FigCli] Variable cache update failed:', e.message);
      return [];
    }
  }
  return variableCache || [];
}

async function findVariableByName(name) {
  if (!name || typeof name !== 'string') return null;
  const vars = await getVariableCache();
  const clean = (s) => s.toLowerCase().replace(/\s+/g, '');
  const searchName = clean(name);
  return vars.find(v => clean(v.name) === searchName);
}

async function findStyleByName(name) {
  if (!name || typeof name !== 'string') return null;
  const styles = await figma.getLocalTextStylesAsync();
  const clean = (s) => s.toLowerCase().replace(/\s+/g, '');
  const searchName = clean(name);
  return styles.find(s => clean(s.name) === searchName);
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

async function parseGradient(str) {
  if (!str || typeof str !== 'string') return null;

  // Support custom shorthand format: linear-135-color/primary-color/surface-alt
  if (str.startsWith('linear-') && !str.includes('(')) {
    // Extract angle and color tokens using regex
    // Format: linear-{angle}-color/{name}-color/{name}
    const match = str.match(/^linear-(\d+)-(.+)$/);
    if (!match) return null;

    const angle = parseFloat(match[1]) || 180;
    // Split by "-color/" to get color tokens, preserving hyphens in names
    const afterAngle = match[2];
    const colorTokens = afterAngle.split(/-color\//).map((t, i) => i === 0 ? t : 'color/' + t);
    if (colorTokens.length < 2) return null;

    const stops = await Promise.all(colorTokens.map(async (token, i) => {
      const v = await findVariableByName(token);
      let color = null;

      if (v) {
        try {
          if (v.valuesByMode) {
            const modeIds = Object.keys(v.valuesByMode);
            if (modeIds.length > 0) {
              const val = v.valuesByMode[modeIds[0]];
              if (val && typeof val === 'object' && 'r' in val) {
                color = { r: val.r, g: val.g, b: val.b, a: val.a !== undefined ? val.a : 1 };
              }
            }
          }
        } catch(e) {
          console.warn('Gradient var resolve error for', token, e.message);
        }
      }

      if (!color) {
        color = parseColor(token);
      }

      if (!color) return null;

      const position = i / (colorTokens.length - 1);

      const stop = {
        color: { r: color.r, g: color.g, b: color.b, a: color.a !== undefined ? color.a : 1 },
        position
      };
      return stop;
    }));

    // Filter out any stops that failed to resolve
    const resolvedStops = stops.filter(Boolean);
    if (resolvedStops.length < 2) return null;

    const rad = (angle - 90) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      type: 'GRADIENT_LINEAR',
      gradientStops: stops,
      gradientTransform: [
        [cos, sin, (1 - cos - sin) / 2],
        [-sin, cos, (1 + sin - cos) / 2]
      ]
    };
  }

  // Standard CSS gradient syntax
  const isLinear = str.startsWith('linear-gradient');
  const isRadial = str.startsWith('radial-gradient');
  const isAngular = str.startsWith('conic-gradient');
  if (!isLinear && !isRadial && !isAngular) return null;

  const contentMatch = str.match(/\((.*)\)/);
  if (!contentMatch) return null;
  const content = contentMatch[1];
  const parts = content.split(/,(?![^(]*\))/).map(p => p.trim());
  
  let angle = 180;
  let stopsStartIdx = 0;

  if (isLinear) {
    if (parts[0].includes('deg')) {
      angle = parseFloat(parts[0]);
      stopsStartIdx = 1;
    } else if (parts[0].startsWith('to ')) {
      const dir = parts[0].replace('to ', '');
      if (dir === 'right') angle = 90;
      else if (dir === 'bottom') angle = 180;
      else if (dir === 'left') angle = 270;
      else if (dir === 'top') angle = 0;
      stopsStartIdx = 1;
    }
  } else if (isRadial || isAngular) {
    if (parts[0].includes('at ') || parts[0].includes('from ') || parts[0] === 'circle' || parts[0] === 'ellipse') {
      stopsStartIdx = 1;
    }
  }

  const stops = await Promise.all(parts.slice(stopsStartIdx).map(async (s, i, arr) => {
    const stopParts = s.split(/\s+(?![^(]*\))/);
    const colorStr = stopParts[0];
    const offsetStr = stopParts[1];

    const v = await findVariableByName(colorStr);
    const color = parseColor(colorStr);
    let position = i / (arr.length - 1);
    if (offsetStr && offsetStr.includes('%')) {
      position = parseFloat(offsetStr) / 100;
    }

    const stop = {
      color: { r: color ? color.r : 0, g: color ? color.g : 0, b: color ? color.b : 0, a: color && color.a !== undefined ? color.a : 1 },
      position
    };

    if (v) {
      stop.boundVariables = { color: { type: 'VARIABLE_ALIAS', id: v.id } };
    }

    return stop;
  }));
  if (isLinear) {
    const rad = (angle - 90) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      type: 'GRADIENT_LINEAR',
      gradientStops: stops,
      gradientTransform: [
        [cos, sin, (1 - cos - sin) / 2],
        [-sin, cos, (1 + sin - cos) / 2]
      ]
    };
  } else if (isRadial) {
    return {
      type: 'GRADIENT_RADIAL',
      gradientStops: stops,
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0]
      ]
    };
  } else {
    return {
      type: 'GRADIENT_ANGULAR',
      gradientStops: stops,
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0]
      ]
    };
  }
}

async function serializeNode(node) {
  const hasALParent = node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE';

  const props = {
    id: node.id,
    name: node.name || node.type.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
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

  // Overflow / Scroll
  if ('overflow' in node && node.overflow && node.overflow !== 'VISIBLE') {
    const ovMap = { 'SCROLLS': 'scroll', 'SCROLLS_VERTICAL': 'vertical', 'SCROLLS_HORIZONTAL': 'horizontal' };
    props.overflow = ovMap[node.overflow] || node.overflow;
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
    if (varName) {
      props.fill = varName;
    } else {
      const fillStrs = node.fills.map(f => {
        if (f.type === 'SOLID') return serializeColor(f.color, f.opacity);
        if (f.type === 'GRADIENT_LINEAR' || f.type === 'GRADIENT_RADIAL' || f.type === 'GRADIENT_ANGULAR') {
          const stops = f.gradientStops.map(s => `${serializeColor(s.color, s.color.a)} ${Math.round(s.position * 100)}%`).join(', ');
          if (f.type === 'GRADIENT_LINEAR') {
             // Extract angle from gradientTransform
             let angle = 180;
             if (f.gradientTransform) {
                const [[a, b], [c, d]] = f.gradientTransform;
                const rad = Math.atan2(b, a);
                angle = Math.round((rad * 180 / Math.PI) + 90);
                if (angle < 0) angle += 360;
             }
             return `linear-gradient(${angle}deg, ${stops})`;
          }
          if (f.type === 'GRADIENT_ANGULAR') {
             return `conic-gradient(from 180deg, ${stops})`;
          }
          return `radial-gradient(circle, ${stops})`;
        }
        return null;
      }).filter(Boolean);
      
      if (fillStrs.length === 1) props.fill = fillStrs[0];
      else if (fillStrs.length > 1) props.fill = `[${fillStrs.join(', ')}]`;
    }
  }

  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const varName = await resolveVariable(node, 'strokes');
    if (varName) {
      props.stroke = varName;
    } else {
      if (node.strokes[0].type === 'SOLID') {
        props.stroke = serializeColor(node.strokes[0].color, node.strokes[0].opacity);
      } else if (node.strokes[0].type === 'GRADIENT_LINEAR' || node.strokes[0].type === 'GRADIENT_RADIAL') {
        const stops = node.strokes[0].gradientStops.map(s => `${serializeColor(s.color, s.color.a)} ${Math.round(s.position * 100)}%`).join(', ');
        if (node.strokes[0].type === 'GRADIENT_LINEAR') {
           let angle = 180;
           if (node.strokes[0].gradientTransform) {
              const [[a, b], [c, d]] = node.strokes[0].gradientTransform;
              const rad = Math.atan2(b, a);
              angle = Math.round((rad * 180 / Math.PI) + 90);
              if (angle < 0) angle += 360;
           }
           props.stroke = `linear-gradient(${angle}deg, ${stops})`;
        } else {
           props.stroke = `radial-gradient(circle, ${stops})`;
        }
      }
    }
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
    node.type === 'ELLIPSE'
  );
  if (isIconLike) {
    try {
      const svg = await node.exportAsync({ format: 'SVG' });
      props.content = new TextDecoder().decode(svg);
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

async function resolveVariableValue(variable, modeId, depth = 0) {
  if (!variable || depth > 5) return null;
  const raw = variable.valuesByMode[modeId];
  if (raw === undefined || raw === null) return null;
  if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
    const target = await figma.variables.getVariableByIdAsync(raw.id);
    if (!target) return null;
    // Aliased variable may be in a different collection with different modes
    // Use the first available mode of the target variable
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const targetCol = collections.find(c => c.id === target.variableCollectionId);
    if (targetCol && targetCol.modes.length > 0) {
      return resolveVariableValue(target, targetCol.modes[0].modeId, depth + 1);
    }
    return resolveVariableValue(target, Object.keys(target.valuesByMode)[0], depth + 1);
  }
  return raw;
}

async function applyPropsToNode(node, props) {
  if (props.name) node.name = props.name;

  if (node.type === 'TEXT') {
    // 1. Apply Text Style if provided
    if (props.style) {
      const s = await findStyleByName(props.style);
      if (s) {
        await node.setTextStyleIdAsync(s.id);
      }
    }

    const weight = String(props.fontWeight || '400').toLowerCase();
    const styleMap = {
      '100': 'Thin', '200': 'Extra Light', '300': 'Light', '400': 'Regular',
      '500': 'Medium', '600': 'Semi Bold', '700': 'Bold', '800': 'Extra Bold', '900': 'Black',
      'thin': 'Thin', 'light': 'Light', 'regular': 'Regular', 'medium': 'Medium', 'bold': 'Bold', 'semibold': 'Semi Bold'
    };
    const style = styleMap[weight] || 'Regular';

    // Only set font/size if no style is applied or if explicitly overridden (though style is preferred)
    if (!node.textStyleId) {
      await figma.loadFontAsync({ family: 'Inter', style });
      node.fontName = { family: 'Inter', style };
      if (props.fontSize !== undefined) {
        let fontSizeVal = props.fontSize;
        if (typeof fontSizeVal === 'string') {
          const v = await findVariableByName(fontSizeVal);
          if (v) {
            const collections = await figma.variables.getLocalVariableCollectionsAsync();
            const col = collections.find(c => c.id === v.variableCollectionId);
            if (col && col.modes.length > 0) {
              fontSizeVal = await resolveVariableValue(v, col.modes[0].modeId);
            }
          }
        }
        if (typeof fontSizeVal === 'number') {
          node.fontSize = fontSizeVal;
        }
      }
    } else {
       // Even with a style, we might need to load the font to change characters
       const styleNode = await figma.getStyleByIdAsync(node.textStyleId);
       if (styleNode && styleNode.fontName) {
         await figma.loadFontAsync(styleNode.fontName);
       }
    }
    
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

  // Styling (Solid colors, Gradients, Layered Fills, and Variable Bindings)
  if (props.fill) {
    // Phase 1: Handle VARIABLE_BOUND marker from parser
    if (typeof props.fill === 'object' && props.fill.type === 'VARIABLE_BOUND') {
      const v = await findVariableByName(props.fill.variableName);
      if (v) {
        node.fills = [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
        }];
      }
    } else {
      const v = await findVariableByName(props.fill);
      if (v) {
        node.fills = [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
        }];
      } else {
        const parseFill = async (f) => {
          const g = await parseGradient(f);
          if (g) return g;
          const c = parseColor(f);
          if (c) return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a !== undefined ? c.a : 1 };
          return null;
        };

      function splitFills(str) {
        const result = [];
        let current = '';
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '(') depth++;
          else if (char === ')') depth--;
          
          if (char === ',' && depth === 0) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current) result.push(current.trim());
        return result;
      }

      if (typeof props.fill === 'string' && props.fill.startsWith('[') && props.fill.endsWith(']')) {
        const items = splitFills(props.fill.slice(1, -1));
        node.fills = (await Promise.all(items.map(parseFill))).filter(Boolean);
      } else {
        const singleFill = await parseFill(props.fill);
        if (singleFill) node.fills = [singleFill];
      }
      }
    }
  } else if (node.type === 'FRAME' && !('fills' in props)) {
    node.fills = []; // Frames transparent by default if not specified
  }

  // Icon Special Handling: Move fills/strokes to inner vectors and clear root frame background
  if (node.name && String(node.name).startsWith('Icon:')) {
    if (props.fill) {
      const iconFills = node.fills;
      node.fills = []; // Remove background from root frame
      const vectors = ('findAll' in node) ? node.findAll(n => n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION') : [];
      for (const v of vectors) {
         if (v.strokes && v.strokes.length > 0) {
            v.strokes = iconFills;
         } else {
            v.fills = iconFills;
         }
      }
    }
  }

  if (props.bgGradient) {
    const gradient = await parseGradient(props.bgGradient);
    if (gradient) {
      node.fills = [gradient];
    }
  }

  if (props.stroke) {
    // Phase 1: Handle VARIABLE_BOUND marker
    if (typeof props.stroke === 'object' && props.stroke.type === 'VARIABLE_BOUND') {
      const v = await findVariableByName(props.stroke.variableName);
      if (v) {
        node.strokes = [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
        }];
      }
    } else {
      const v = await findVariableByName(props.stroke);
      if (v) {
        node.strokes = [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } }
        }];
      } else {
        const gradient = await parseGradient(props.stroke);
        if (gradient) {
          node.strokes = [gradient];
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
    // Phase 1: Handle VARIABLE_BOUND marker
    if (typeof props.cornerRadius === 'object' && props.cornerRadius.type === 'VARIABLE_BOUND') {
      const v = await findVariableByName(props.cornerRadius.variableName);
      if (v) {
        try { node.setBoundVariable('cornerRadius', v); } catch(e) { console.warn('Radius var bind failed:', e.message); }
      }
    } else {
      const v = await findVariableByName(String(props.cornerRadius));
      if (v) {
        try { node.setBoundVariable('cornerRadius', v); } catch(e) { console.warn('Radius bind failed:', e.message); }
      } else if (typeof props.cornerRadius === 'number') {
        node.cornerRadius = props.cornerRadius;
      }
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
     if (typeof props.itemSpacing === 'object' && props.itemSpacing.type === 'VARIABLE_BOUND') {
        const v = await findVariableByName(props.itemSpacing.variableName);
        if (v) { try { node.setBoundVariable('itemSpacing', v); } catch(e) { console.warn('Spacing var bind failed:', e.message); } }
     } else {
        const v = await findVariableByName(String(props.itemSpacing));
        if (v) {
           try { node.setBoundVariable('itemSpacing', v); } catch(e) { console.warn('Spacing bind failed:', e.message); }
        } else if (typeof props.itemSpacing === 'number') {
           node.itemSpacing = props.itemSpacing;
        }
     }
  }
  if (props.counterAxisSpacing !== undefined && 'counterAxisSpacing' in node) node.counterAxisSpacing = props.counterAxisSpacing;
  if (props.layoutWrap && 'layoutWrap' in node) node.layoutWrap = props.layoutWrap;

  // Overflow / Scroll behavior
  if (props.overflow && 'overflow' in node) {
    const ovMap = { scroll: 'SCROLLS', vertical: 'SCROLLS_VERTICAL', horizontal: 'SCROLLS_HORIZONTAL' };
    const val = String(props.overflow).toUpperCase();
    // Handle both already-transformed values and raw input
    if (['SCROLLS', 'SCROLLS_VERTICAL', 'SCROLLS_HORIZONTAL'].includes(val)) {
      node.overflow = val;
    } else {
      node.overflow = ovMap[String(props.overflow).toLowerCase()] || props.overflow;
    }
  }

  if (props.primaryAxisAlignItems && 'primaryAxisAlignItems' in node) node.primaryAxisAlignItems = props.primaryAxisAlignItems;
  if (props.counterAxisAlignItems && 'counterAxisAlignItems' in node) node.counterAxisAlignItems = props.counterAxisAlignItems;

  // Padding
  const pMap = { 
    paddingLeft: firstDefined(props.paddingLeft, props.paddingHorizontal, props.padding), 
    paddingRight: firstDefined(props.paddingRight, props.paddingHorizontal, props.padding), 
    paddingTop: firstDefined(props.paddingTop, props.paddingVertical, props.padding), 
    paddingBottom: firstDefined(props.paddingBottom, props.paddingVertical, props.padding) 
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

  // Advanced Layout Sizing (Fill/Hug/Fixed)
  const parent = node.parent;
  const hasALParent = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
  const isALFrame = 'layoutMode' in node && node.layoutMode !== 'NONE';
  const canUseAutoLayoutSizing = hasALParent || isALFrame;

  if ('layoutSizingHorizontal' in node) {
    if (typeof props.width === 'number') {
      node.layoutSizingHorizontal = 'FIXED';
      node.resize(props.width, node.height);
    } else if (props.width === 'fill' && hasALParent) {
      node.layoutSizingHorizontal = 'FILL';
    } else if (canUseAutoLayoutSizing && (props.width === 'hug' || node.type === 'TEXT' || isALFrame)) {
      node.layoutSizingHorizontal = 'HUG';
    }
  }

  if ('layoutSizingVertical' in node) {
    if (typeof props.height === 'number') {
      node.layoutSizingVertical = 'FIXED';
      node.resize(node.width, props.height);
    } else if (props.height === 'fill' && hasALParent) {
      node.layoutSizingVertical = 'FILL';
    } else if (canUseAutoLayoutSizing && (props.height === 'hug' || node.type === 'TEXT' || isALFrame)) {
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
  // Handle file info request from UI (for multi-file mode)
  if (msg.type === 'getFileInfo') {
    var fileId = figma.fileKey;
    if (!fileId) {
      var rootName = (figma.root && figma.root.name) || 'root';
      fileId = 'file_' + rootName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    }
    var fileName = (figma.root && figma.root.name) || (figma.currentPage && figma.currentPage.name) || 'Untitled';
    figma.ui.postMessage({ type: 'fileInfo', fileId: fileId, fileName: fileName });
  }

  // Handle connected notification
  if (msg.type === 'connected') {
    var fileId = figma.fileKey;
    if (!fileId) {
      var rootName = (figma.root && figma.root.name) || 'root';
      fileId = 'file_' + rootName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    }
    var fileName = (figma.root && figma.root.name) || (figma.currentPage && figma.currentPage.name) || 'Untitled';
    figma.ui.postMessage({ type: 'fileInfo', fileId: fileId, fileName: fileName });
  }

  // 1. Resolve handler (streaming action OR single command)
  var actionName = (msg.action === 'command') ? msg.command : (msg.action || msg.command);
  var handler = handlers[actionName];

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
