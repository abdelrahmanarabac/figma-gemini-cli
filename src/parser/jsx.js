/**
 * Simple Regex-based JSX Parser
 * 
 * Restored to a predictable, deterministic pipeline.
 * Replaces complex AST parsing with stable regex-based extraction.
 */

// Map JSX component names → Figma node types
export const COMPONENT_MAP = {
    'Frame': 'FRAME',
    'AutoLayout': 'FRAME',   // Frame with layoutMode
    'Group': 'GROUP',
    'Rectangle': 'RECTANGLE',
    'Ellipse': 'ELLIPSE',
    'Text': 'TEXT',
    'Line': 'LINE',
    'Component': 'COMPONENT',
    'Instance': 'INSTANCE',
    'Image': 'RECTANGLE',    // Image is a rectangle with image fill
    'Icon': 'SVG',           // Icon is usually a frame or svg
    'SVG': 'SVG',
    // Data Visualization Virtual Components
    'Wave': 'SVG',
    'LineChart': 'SVG',
    'BarChart': 'SVG',
    'PieChart': 'SVG'
};

export function registerComponent(tagName, figmaType) {
    COMPONENT_MAP[tagName] = figmaType;
}

// ── Token Detection Pattern (used throughout the parser) ─────────────
// Matches: primary/500, spacing/md, radius/lg, blue/600, color/surface
// Excludes: #hex, raw numbers, CSS functions
const TOKEN_RE = /^[a-zA-Z][a-zA-Z0-9]*\/[a-zA-Z0-9][a-zA-Z0-9-]*$/;

import { ICONS } from '../data/icons.js';

// ── Icon Registry ──
let _iconRegistry = ICONS;

export function getIconRegistrySync() {
    return _iconRegistry;
}

export function registerIcon(name, svg) {
    if (!_iconRegistry) _iconRegistry = {};
    _iconRegistry[name] = svg;
}

/**
 * Resolve an icon by name — replaces CURRENT with the provided color.
 * If color is a token reference (e.g., "color/primary"), CURRENT is kept
 * for downstream auto-binding.
 */
export async function resolveIcon(name, color = 'CURRENT', size = 24) {
    const icons = await loadIconRegistry();
    const svg = icons[name];
    if (!svg) return null;
    const isToken = typeof color === 'string' && TOKEN_RE.test(color);
    return svg
        .replace(/CURRENT/g, isToken ? 'CURRENT' : color)
        .replace(/viewBox="0 0 24 24"/, `viewBox="0 0 24 24" width="${size}" height="${size}"`);
}

/**
 * Check if a string matches the token pattern (e.g., "primary/500", "spacing/md")
 */
export function isTokenReference(val) {
    return typeof val === 'string' && TOKEN_RE.test(val);
}

// Map JSX prop names → Figma API property names
const PROP_MAP = {
    width: 'width', w: 'width',
    height: 'height', h: 'height',
    layoutAlign: 'layoutAlign', 
    layoutGrow: 'layoutGrow',
    minWidth: 'minWidth', minW: 'minWidth',
    maxWidth: 'maxWidth', maxW: 'maxWidth',
    minHeight: 'minHeight', minH: 'minHeight',
    maxHeight: 'maxHeight', maxH: 'maxHeight',
    name: 'name',
    fill: 'fill', bg: 'fill',
    stroke: 'stroke', border: 'stroke',
    strokeWidth: 'strokeWidth',
    opacity: 'opacity',
    cornerRadius: 'cornerRadius', rounded: 'cornerRadius',
    roundedT: 'topRadius', roundedB: 'bottomRadius',
    roundedL: 'leftRadius', roundedR: 'rightRadius',
    roundedTL: 'topLeftRadius', roundedTR: 'topRightRadius',
    roundedBL: 'bottomLeftRadius', roundedBR: 'bottomRightRadius',
    flex: 'layoutMode',
    gap: 'itemSpacing',
    wrap: 'layoutWrap',
    overflow: 'overflow', scroll: 'overflow',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop', pr: 'paddingRight',
    pb: 'paddingBottom', pl: 'paddingLeft',
    justify: 'primaryAxisAlignItems',
    items: 'counterAxisAlignItems',
    fontSize: 'fontSize', size: 'fontSize',
    fontWeight: 'fontWeight', weight: 'fontWeight',
    color: 'fill',
    x: 'x', y: 'y',
    rotate: 'rotation',
    shadow: 'shadow',
    innerShadow: 'innerShadow',
    blur: 'blur',
    backdropBlur: 'backdropBlur',
    overflow: 'clipsContent',
    align: 'textAlignHorizontal',
    alignV: 'textAlignVertical',
    alignH: 'textAlignHorizontal',
    strokeAlign: 'strokeAlign',
    leading: 'lineHeight',
    tracking: 'letterSpacing',
    transform: 'textCase',
    borderTop: 'borderTop', borderBottom: 'borderBottom',
    borderLeft: 'borderLeft', borderRight: 'borderRight',
    borderColor: 'borderColor',
    // Virtual Props
    data: 'data',
    complexity: 'complexity',
    strokeColor: 'strokeColor',
    fillColor: 'fillColor',
    componentId: 'componentId'
};

const NUMERIC_PROPS = new Set([
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
    'itemSpacing', 'padding', 'paddingTop', 'paddingRight', 
    'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical',
    'fontSize', 'fontWeight', 'opacity', 'x', 'y', 'rotation', 'strokeWidth',
    'blur', 'backdropBlur', 'letterSpacing', 'lineHeight', 'complexity'
]);

const AUTO_LAYOUT_ONLY_PROPS = [
    'itemSpacing',
    'padding',
    'paddingHorizontal',
    'paddingVertical',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'primaryAxisAlignItems',
    'counterAxisAlignItems',
    'layoutWrap',
];

/* ──────────────────────────────────────────────
   Token Auto-Bind (Phase 1)
   Detects token-shaped values and wraps them
   for variable binding by the renderer.
   ────────────────────────────────────────────── */


function isTokenValue(val) {
    return typeof val === 'string' && TOKEN_RE.test(val);
}

/**
 * Known token value index — built by the renderer at runtime.
 * Populated via setTokenIndex() before parsing.
 * Structure: { colors: Map<hex, tokenPath>, floats: Map<number, tokenPath> }
 */
let TOKEN_INDEX = { colors: new Map(), floats: new Map() };

/**
 * Set the token value index for auto-binding raw values to token references.
 * Called by the renderer before parsing JSX.
 */
export function setTokenIndex(index) {
    if (index?.colors) TOKEN_INDEX.colors = new Map(index.colors);
    if (index?.floats) TOKEN_INDEX.floats = new Map(index.floats);
}

/**
 * Clear the token index (for testing / cleanup).
 */
export function clearTokenIndex() {
    TOKEN_INDEX = { colors: new Map(), floats: new Map() };
}

/**
 * Try to auto-bind a raw hex color to a matching token.
 * E.g., #3B82F6 → "blue/500" if that token exists with that value.
 */
function tryBindColorToToken(value) {
    if (typeof value !== 'string') return null;
    const hex = value.toLowerCase().trim();
    if (!/^#[0-9a-f]{6}$/.test(hex) && !/^#[0-9a-f]{3}$/.test(hex)) return null;

    // Normalize 3-char hex to 6-char
    const normalized = hex.length === 4
        ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
        : hex;

    return TOKEN_INDEX.colors.get(normalized) || null;
}

/**
 * Try to auto-bind a raw numeric value to a matching token.
 * E.g., 16 → "spacing/4xl" if that token exists with value 16.
 */
function tryBindFloatToToken(value) {
    if (typeof value !== 'number') return null;
    return TOKEN_INDEX.floats.get(value) || null;
}

function transformPropValue(key, value, props) {
    if (key === 'layoutMode') {
        if (value === 'row') return 'HORIZONTAL';
        if (value === 'col') return 'VERTICAL';
        return value;
    }
    if (key === 'layoutWrap' && value === true) return 'WRAP';
    if (key === 'overflow') {
        const map = { scroll: 'SCROLLS', vertical: 'SCROLLS_VERTICAL', horizontal: 'SCROLLS_HORIZONTAL', both: 'SCROLLS' };
        return map[String(value).toLowerCase()] || value;
    }
    if (key === 'primaryAxisAlignItems' || key === 'counterAxisAlignItems' || key === 'textAlignHorizontal' || key === 'textAlignVertical') {
        const map = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN', 'space-between': 'SPACE_BETWEEN', 'space-around': 'CENTER', left: 'LEFT', right: 'RIGHT', top: 'TOP', bottom: 'BOTTOM' };
        return map[value] || value;
    }
    if (key === 'strokeAlign') {
        const map = { inside: 'INSIDE', outside: 'OUTSIDE', center: 'CENTER' };
        return map[value] || value.toUpperCase();
    }
    if (key === 'textCase') {
        const map = { uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE', none: 'ORIGINAL' };
        return map[value] || value.toUpperCase();
    }
    if (key === 'letterSpacing' || key === 'lineHeight') {
        if (typeof value === 'string' && value.trim() !== '') {
            const num = Number(value);
            if (!isNaN(num)) return num;
        }
    }
    if (key === 'width' || key === 'height') {
        if (value === 'fill') return 'fill';
        if (value === 'hug') return 'hug';
    }
    if (key === 'fontWeight') {
        const map = { thin: 100, light: 300, regular: 400, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
        return map[value] || value;
    }
    if (key === 'data') {
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            try { return JSON.parse(value); } catch(e) { return value; }
        }
    }
    if (NUMERIC_PROPS.has(key) && typeof value === 'string' && value.trim() !== '') {
        const num = Number(value);
        if (!isNaN(num)) value = num;
    }

    // ── Phase 1: Explicit token reference (e.g., bg={primary/500}) ──
    if (isTokenValue(value)) {
        if (key === 'fill') {
            return { type: 'VARIABLE_BOUND', propKey: 'color', variableName: value };
        }
        if (key === 'stroke') {
            return { type: 'VARIABLE_BOUND', propKey: 'color', variableName: value };
        }
        if (key === 'itemSpacing' || key === 'padding' || key === 'paddingTop' ||
            key === 'paddingRight' || key === 'paddingBottom' || key === 'paddingLeft' ||
            key === 'paddingHorizontal' || key === 'paddingVertical') {
            return { type: 'VARIABLE_BOUND', propKey: 'float', variableName: value };
        }
        if (key === 'cornerRadius' || key === 'topLeftRadius' || key === 'topRightRadius' ||
            key === 'bottomLeftRadius' || key === 'bottomRightRadius') {
            return { type: 'VARIABLE_BOUND', propKey: 'float', variableName: value };
        }
        return { type: 'VARIABLE_BOUND', propKey: 'auto', variableName: value };
    }

    // ── Phase 2: Auto-bind raw values to tokens (if token index is populated) ──
    // Color props: try to match raw hex to a known color token
    if (key === 'fill' || key === 'stroke') {
        const tokenPath = tryBindColorToToken(value);
        if (tokenPath) {
            return { type: 'VARIABLE_BOUND', propKey: 'color', variableName: tokenPath };
        }
    }

    // Numeric props: try to match raw number to a known spacing/radius token
    if (typeof value === 'number') {
        if (key === 'itemSpacing' || key === 'padding' || key === 'paddingTop' ||
            key === 'paddingRight' || key === 'paddingBottom' || key === 'paddingLeft' ||
            key === 'paddingHorizontal' || key === 'paddingVertical') {
            const tokenPath = tryBindFloatToToken(value);
            if (tokenPath) {
                return { type: 'VARIABLE_BOUND', propKey: 'float', variableName: tokenPath };
            }
        }
        if (key === 'cornerRadius' || key === 'topLeftRadius' || key === 'topRightRadius' ||
            key === 'bottomLeftRadius' || key === 'bottomRightRadius') {
            const tokenPath = tryBindFloatToToken(value);
            if (tokenPath) {
                return { type: 'VARIABLE_BOUND', propKey: 'float', variableName: tokenPath };
            }
        }
    }

    return value;
}

/**
 * Procedural Visualization Generator
 */
function generateDataVisualization(tagName, props) {
    const w = typeof props.width === 'number' ? props.width : 400;
    const h = typeof props.height === 'number' ? props.height : 200;
    const strokeColor = props.strokeColor || '#3B82F6';
    const fillColor = props.fillColor || props.fill || 'rgba(59, 130, 246, 0.2)';
    
    let rawData = props.data || [10, 40, 20, 80, 50, 90, 30, 70];
    if (typeof rawData === 'string') rawData = rawData.split(',').map(n => Number(n.trim()));
    const data = Array.isArray(rawData) ? rawData : [10, 40, 20, 80, 50, 90, 30, 70];
    
    if (tagName === 'Wave') {
        const complexity = props.complexity || 3;
        let d = `M 0 ${h/2} `;
        for (let i = 1; i <= complexity; i++) {
            const x = (w / complexity) * i;
            const prevX = (w / complexity) * (i - 1);
            const cp1x = prevX + (x - prevX) / 2;
            const y = (i % 2 === 0) ? h * 0.2 : h * 0.8;
            const prevY = (i % 2 === 0) ? h * 0.8 : h * 0.2;
            d += `C ${cp1x} ${prevY === h*0.2 ? h*0.2 : h*0.8}, ${cp1x} ${y === h*0.2 ? h*0.2 : h*0.8}, ${x} ${y} `;
        }
        d += `L ${w} ${h} L 0 ${h} Z`;
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="${fillColor}"/></svg>`;
    }

    if (tagName === 'LineChart') {
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min;
        
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - (((val - min) / range) * (h * 0.8)) - (h * 0.1);
            return `${x},${y}`;
        });

        const dLine = `M ${points.join(' L ')}`;
        const dArea = `${dLine} L ${w},${h} L 0,${h} Z`;

        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="${dArea}" fill="${fillColor}" />
            <path d="${dLine}" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    if (tagName === 'BarChart') {
        const max = Math.max(...data, 1);
        const gap = 8;
        const totalGap = gap * (data.length - 1);
        const barW = (w - totalGap) / data.length;
        
        let rects = '';
        data.forEach((val, i) => {
            const barH = (val / max) * (h * 0.9);
            const x = i * (barW + gap);
            const y = h - barH;
            const r = Math.min(barW / 2, 4); // subtle rounding
            rects += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="${r}" fill="${fillColor}"/>`;
        });

        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
    }
    
    if (tagName === 'PieChart') {
        const cx = w/2; const cy = h/2;
        const radius = Math.min(cx, cy) * 0.9;
        const total = data.reduce((a,b)=>a+b, 0);
        let currentAngle = -Math.PI / 2;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        let paths = '';
        
        data.forEach((val, i) => {
            const sliceAngle = (val / total) * 2 * Math.PI;
            const x1 = cx + radius * Math.cos(currentAngle);
            const y1 = cy + radius * Math.sin(currentAngle);
            const x2 = cx + radius * Math.cos(currentAngle + sliceAngle);
            const y2 = cy + radius * Math.sin(currentAngle + sliceAngle);
            const largeArc = sliceAngle > Math.PI ? 1 : 0;
            
            paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
            currentAngle += sliceAngle;
        });
        
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
    }

    return null;
}


/**
 * Helper to compute line and column from an absolute index
 */
function getPosition(str, index) {
    if (!str || index < 0) return { line: 1, column: 1 };
    const prefix = str.slice(0, index);
    const lines = prefix.split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function pushError(errors, message, fullStr, index) {
    const pos = getPosition(fullStr, index);
    errors.push({
        message,
        line: pos.line,
        column: pos.column,
        index
    });
}

/**
 * Enhanced Prop Parser
 * Handles: multiline, quotes, empty values, nested braces.
 */
function parseProps(propsStr) {
    const props = {};
    let i = 0;
    while (i < propsStr.length) {
        // Skip whitespace
        while (i < propsStr.length && /\s/.test(propsStr[i])) i++;
        if (i >= propsStr.length) break;

        let keyStart = i;
        while (i < propsStr.length && /[a-zA-Z0-9_-]/.test(propsStr[i])) i++;
        if (i === keyStart) { i++; continue; } // safety fallback
        const key = propsStr.slice(keyStart, i);
        
        while (i < propsStr.length && /\s/.test(propsStr[i])) i++;
        if (propsStr[i] === '=') {
            i++;
            while (i < propsStr.length && /\s/.test(propsStr[i])) i++;
            let value;
            if (propsStr[i] === '"' || propsStr[i] === "'") {
                const quote = propsStr[i];
                i++;
                let valStart = i;
                // Match until the matching quote, respecting escaped quotes
                while (i < propsStr.length) {
                    if (propsStr[i] === quote && propsStr[i-1] !== '\\') break;
                    i++;
                }
                value = propsStr.slice(valStart, i).replace(/\\"/g, '"').replace(/\\'/g, "'");
                i++;
            } else if (propsStr[i] === '{') {
                i++;
                let valStart = i;
                let braceDepth = 1;
                let inQuote = null;
                while (i < propsStr.length && braceDepth > 0) {
                    const c = propsStr[i];
                    if ((c === '"' || c === "'") && propsStr[i-1] !== '\\') {
                        if (!inQuote) inQuote = c;
                        else if (inQuote === c) inQuote = null;
                    } else if (!inQuote) {
                        if (c === '{') braceDepth++;
                        else if (c === '}') braceDepth--;
                    }
                    if (braceDepth > 0) i++;
                }
                value = propsStr.slice(valStart, i);
                i++;
                
                // Attempt to parse JSON or literal
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(Number(value)) && value.trim() !== '') value = Number(value);
            } else {
                // Bare value - read until next whitespace or end of string
                let valStart = i;
                while (i < propsStr.length && !/\s/.test(propsStr[i])) i++;
                value = propsStr.slice(valStart, i);
            }
            const mappedKey = PROP_MAP[key] || key;
            props[mappedKey] = transformPropValue(mappedKey, value, props);
        } else {
            props[PROP_MAP[key] || key] = true;
        }
    }
    return props;
}

/**
 * Finds the actual end of an opening tag, skipping strings and braces.
 */
function findEndOfTag(str) {
    let inQuote = null;
    let braceDepth = 0;
    let i = 0;
    const MAX_DEPTH = 50;
    while (i < str.length) {
        const char = str[i];
        
        if (char === '"' || char === "'") {
            if (!inQuote) {
                inQuote = char;
            } else if (inQuote === char) {
                // Check for escapes
                let isEscaped = false;
                let j = i - 1;
                while (j >= 0 && str[j] === '\\') {
                    isEscaped = !isEscaped;
                    j--;
                }
                if (!isEscaped) inQuote = null;
            }
        } else if (!inQuote) {
            if (char === '{') {
                braceDepth++;
                if (braceDepth > MAX_DEPTH) return -1; // Max depth guard
            } else if (char === '}') {
                braceDepth--;
            } else if (char === '>' && braceDepth === 0) {
                return i;
            }
        }
        i++;
    }
    return -1;
}

/**
 * Balanced Tag Content Extractor
 */
function extractContent(str, tagName, errors = [], fullJsx = "", absoluteIndex = 0) {
    let depth = 1;
    let i = 0;
    const closeTag = `</${tagName}>`;
    const openTagStart = `<${tagName}`;
    const MAX_DEPTH = 50;

    while (i < str.length && depth > 0) {
        if (depth > MAX_DEPTH) {
            pushError(errors, `Exceeded maximum tag depth of ${MAX_DEPTH}`, fullJsx, absoluteIndex + i);
            break;
        }

        if (str.slice(i).startsWith(closeTag)) {
            depth--;
            if (depth === 0) return str.slice(0, i);
            i += closeTag.length;
        } else if (str.slice(i).startsWith(openTagStart)) {
            const nextChar = str[i + openTagStart.length];
            if (nextChar === ' ' || nextChar === '>' || nextChar === '/' || nextChar === '\n' || nextChar === '\t') {
                const endOfTag = findEndOfTag(str.slice(i));
                if (endOfTag !== -1) {
                    const tagContent = str.slice(i, i + endOfTag + 1);
                    if (!tagContent.endsWith('/>')) {
                        depth++;
                    }
                    i += endOfTag + 1;
                } else {
                    i++;
                }
            } else {
                i++;
            }
        } else {
            i++;
        }
    }
    
    if (depth > 0) {
        pushError(errors, `Unclosed tag: <${tagName}>`, fullJsx, absoluteIndex);
    }
    return str;
}

/**
 * Command Generator
 * parentId is yielded BEFORE children (parent-first order).
 * IDs are deterministic based on seed (timestamp) + counter.
 */
export function* generateCommands(jsx, parentId = null, idPrefix = "", timestamp = 0, counter = { value: 0 }, errors = [], fullJsxContext = null, globalOffset = 0) {
    let isRootCall = false;
    if (fullJsxContext === null) {
        isRootCall = true;
        // Strip BOM and normalize line endings
        jsx = String(jsx || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
        
        // Reject oversized input
        if (jsx.length > 500000) {
            pushError(errors, "Input too large (max 500KB)", jsx, 0);
            return;
        }
        fullJsxContext = jsx;
    }

    // 1. Clean JSX: Replace comments with spaces to preserve char offsets
    let cleanJsx = jsx.replace(/{\/\*[\s\S]*?\*\/}/g, match => ' '.repeat(match.length));
    
    let lastIndex = 0;
    let rootNodesCount = 0;

    while (lastIndex < cleanJsx.length) {
        const remaining = cleanJsx.slice(lastIndex);
        const openMatch = remaining.match(/<([A-Z][a-zA-Z0-9\.]*)/);
        if (!openMatch) {
            // Graceful: stray text at root level → skip silently, no hard error
            break;
        }

        const startIdxInRemaining = openMatch.index;
        const startIdx = lastIndex + startIdxInRemaining;
        const absoluteStartIdx = globalOffset + startIdx;
        const tagName = openMatch[1];

        // Find end of this tag
        const endOfTagIdx = findEndOfTag(remaining.slice(startIdxInRemaining));
        if (endOfTagIdx === -1) {
            // Graceful: malformed tag → render as frame with what we have
            lastIndex = startIdx + openMatch[0].length;
            continue;
        }

        const fullTag = remaining.slice(startIdxInRemaining, startIdxInRemaining + endOfTagIdx + 1);
        const isSelfClosing = fullTag.endsWith('/>');
        const propsStr = fullTag.slice(openMatch[0].length, isSelfClosing ? -2 : -1).trim();

        // Handle text nodes before this tag — render them, don't error
        const textBefore = cleanJsx.slice(lastIndex, startIdx).trim();
        if (textBefore) {
            if (parentId) {
                const textId = `${idPrefix}tmp_${timestamp}_${counter.value++}`;
                yield {
                    command: 'node.create',
                    params: {
                        id: textId,
                        type: 'TEXT',
                        parentId,
                        props: { name: 'Text', characters: textBefore }
                    }
                };
            }
            // Root level: silently ignore stray text (no hard error)
        }

        const type = COMPONENT_MAP[tagName] || 'FRAME';
        const props = parseProps(propsStr);
        if (tagName === 'AutoLayout' && props.layoutMode === undefined) {
            props.layoutMode = 'VERTICAL';
        }
        const id = `${idPrefix}tmp_${timestamp}_${counter.value++}`;

        const cmd = {
            command: 'node.create',
            params: { id, type, props: { name: props.name || tagName, ...props } },
        };
        
        const isVirtualViz = ['Wave', 'LineChart', 'BarChart', 'PieChart'].includes(tagName);
        if (isVirtualViz) {
            cmd.params.props.content = generateDataVisualization(tagName, props);
        } else if (tagName === 'Icon') {
            const iconName = props.name || props.icon || '';
            const iconColor = props.color || props.stroke || 'CURRENT';
            const iconSize = props.fontSize || props.size || props.width || 24;
            if (iconName) {
                const icons = getIconRegistrySync();
                const svg = icons[iconName];
                if (svg) {
                    const isToken = typeof iconColor === 'string' && TOKEN_RE.test(iconColor);
                    cmd.params.props.content = svg
                        .replace(/CURRENT/g, isToken ? 'CURRENT' : iconColor)
                        .replace(/viewBox="0 0 24 24"/, `viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}"`);
                    cmd.params.props.name = `Icon: ${iconName}`;
                    cmd.params.props.width = iconSize;
                    cmd.params.props.height = iconSize;
                } else {
                    pushError(errors, `Unknown icon: "${iconName}"`, fullJsxContext, absoluteStartIdx);
                }
            }
        }

        if (parentId) cmd.params.parentId = parentId;
        
        yield cmd;
        if (isRootCall) rootNodesCount++;

        let endIdx = startIdx + fullTag.length;
        if (!isSelfClosing) {
            const afterOpen = cleanJsx.slice(endIdx);
            
            let content;
            if (type === 'TEXT') {
                // For TEXT components, search for the NEXT literal </Text> or </tagName>
                const closeTag = `</${tagName}>`;
                const closeIdx = afterOpen.indexOf(closeTag);
                if (closeIdx !== -1) {
                    content = afterOpen.slice(0, closeIdx);
                    const textContent = content.trim();
                    if (textContent) cmd.params.props.characters = textContent;
                    endIdx += closeIdx + closeTag.length;
                } else {
                    pushError(errors, `Unclosed TEXT tag: <${tagName}>`, fullJsxContext, absoluteStartIdx);
                    content = afterOpen;
                    const textContent = content.trim();
                    if (textContent) cmd.params.props.characters = textContent;
                    endIdx += content.length;
                }
            } else if (tagName === 'SVG') {
                // For raw SVG tags, extract inner text as string content, DO NOT parse as React children
                const closeTag = `</${tagName}>`;
                const closeIdx = afterOpen.indexOf(closeTag);
                if (closeIdx !== -1) {
                    content = afterOpen.slice(0, closeIdx);
                    cmd.params.props.content = content.trim();
                    endIdx += closeIdx + closeTag.length;
                } else {
                    pushError(errors, `Unclosed SVG tag: <${tagName}>`, fullJsxContext, absoluteStartIdx);
                    content = afterOpen;
                    cmd.params.props.content = content.trim();
                    endIdx += content.length;
                }
            } else if (!isVirtualViz && tagName !== 'Icon') {
                content = extractContent(afterOpen, tagName, errors, fullJsxContext, globalOffset + endIdx);
                yield* generateCommands(content, id, idPrefix, timestamp, counter, errors, fullJsxContext, globalOffset + endIdx);
                
                const expectedClose = `</${tagName}>`;
                if (afterOpen.slice(content.length).startsWith(expectedClose)) {
                    endIdx += content.length + expectedClose.length;
                } else {
                    endIdx += content.length;
                }
            }
        }

        lastIndex = endIdx;
    }

    // Handle trailing text
    const textAfter = cleanJsx.slice(lastIndex).trim();
    if (textAfter && parentId) {
        const textId = `${idPrefix}tmp_${timestamp}_${counter.value++}`;
        yield {
            command: 'node.create',
            params: {
                id: textId,
                type: 'TEXT',
                parentId,
                props: { name: 'Text', characters: textAfter }
            }
        };
    }
}
/**
 * Main entry points
 */
export function parseJSXStream(jsxString, idPrefix = "") {
    const timestamp = 0; 
    const errors = [];
    const generator = generateCommands(jsxString, null, idPrefix, timestamp, { value: 0 }, errors);
    return { generator, errors };
}

function inferDiagnosticCode(message) {
    if (message.startsWith('Unclosed TEXT tag:')) return 'UNCLOSED_TEXT_TAG';
    if (message.startsWith('Unclosed SVG tag:')) return 'UNCLOSED_SVG_TAG';
    if (message.startsWith('Unclosed tag:')) return 'UNCLOSED_TAG';
    if (message.startsWith('Input too large')) return 'INPUT_TOO_LARGE';
    if (message.startsWith('Trailing content') || message.startsWith('Text content outside root')) return 'TRAILING_CONTENT';
    if (message.startsWith('Malformed or extremely deep tag')) return 'MALFORMED_TAG';
    return 'PARSE_ERROR';
}

function createDiagnostic(code, message, extra = {}) {
    return {
        code,
        severity: 'warning',
        message,
        ...extra,
    };
}

function hasAutoLayout(props = {}) {
    return props.layoutMode === 'HORIZONTAL' || props.layoutMode === 'VERTICAL';
}

function buildStructuralDiagnostics(errors, commands, jsxString) {
    const diagnostics = errors.map(err => {
        const msg = typeof err === 'string' ? err : err.message;
        const diag = {
            code: inferDiagnosticCode(msg),
            severity: 'warning',
            message: msg,
        };
        if (err.line !== undefined) {
            diag.line = err.line;
            diag.column = err.column;
            diag.index = err.index;
        }
        return diag;
    });

    if (typeof jsxString === 'string' && jsxString.trim() !== '' && commands.length === 0) {
        diagnostics.push({
            code: 'EMPTY_OUTPUT',
            severity: 'error',
            message: 'JSX did not produce any commands.',
        });
    }

    return diagnostics;
}

function buildSemanticDiagnostics(ast) {
    const diagnostics = [];

    function visit(node, parent = null) {
        const props = node.props || {};
        const nodeName = props.name || node.type;
        const isAutoLayout = hasAutoLayout(props);
        const hasAutoLayoutParent = Boolean(parent && hasAutoLayout(parent.props));
        const autoLayoutProps = AUTO_LAYOUT_ONLY_PROPS.filter(prop => props[prop] !== undefined);

        if (autoLayoutProps.length > 0 && !isAutoLayout) {
            diagnostics.push(createDiagnostic(
                'AUTO_LAYOUT_PROPS_REQUIRE_FLEX',
                `${nodeName} uses auto-layout props (${autoLayoutProps.join(', ')}) without flex={row|col} or <AutoLayout>.`,
                {
                    nodeId: node.id,
                    nodeName,
                    nodeType: node.type,
                    relatedProps: autoLayoutProps,
                },
            ));
        }

        if (props.width === 'fill' && !hasAutoLayoutParent) {
            diagnostics.push(createDiagnostic(
                'FILL_REQUIRES_AUTO_LAYOUT_PARENT',
                `${nodeName} uses w={fill} without an auto-layout parent.`,
                {
                    nodeId: node.id,
                    nodeName,
                    nodeType: node.type,
                    prop: 'width',
                },
            ));
        }

        if (props.height === 'fill' && !hasAutoLayoutParent) {
            diagnostics.push(createDiagnostic(
                'FILL_REQUIRES_AUTO_LAYOUT_PARENT',
                `${nodeName} uses h={fill} without an auto-layout parent.`,
                {
                    nodeId: node.id,
                    nodeName,
                    nodeType: node.type,
                    prop: 'height',
                },
            ));
        }

        const hugProps = [];
        if (props.width === 'hug') hugProps.push('width');
        if (props.height === 'hug') hugProps.push('height');

        const canUseHug = node.type === 'TEXT' || isAutoLayout || hasAutoLayoutParent;
        if (hugProps.length > 0 && !canUseHug) {
            diagnostics.push(createDiagnostic(
                'HUG_REQUIRES_AUTO_LAYOUT_CONTEXT',
                `${nodeName} uses ${hugProps.map(prop => `${prop === 'width' ? 'w' : 'h'}={hug}`).join(' and ')} outside a valid auto-layout context.`,
                {
                    nodeId: node.id,
                    nodeName,
                    nodeType: node.type,
                    relatedProps: hugProps,
                },
            ));
        }

        for (const child of node.children) {
            visit(child, node);
        }
    }

    for (const root of ast) {
        visit(root, null);
    }

    return diagnostics;
}

function buildDiagnostics(errors, commands, ast, jsxString) {
    return [
        ...buildStructuralDiagnostics(errors, commands, jsxString),
        ...buildSemanticDiagnostics(ast),
    ];
}

function buildAstFromCommands(commands) {
    const nodes = new Map();
    const roots = [];

    for (const command of commands) {
        if (command.command !== 'node.create') continue;

        const node = {
            id: command.params.id,
            type: command.params.type,
            props: { ...(command.params.props || {}) },
            children: [],
        };
        nodes.set(node.id, node);
    }

    for (const command of commands) {
        if (command.command !== 'node.create') continue;

        const node = nodes.get(command.params.id);
        const parentId = command.params.parentId;

        if (parentId && nodes.has(parentId)) {
            nodes.get(parentId).children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

function collectAstMetadata(ast, diagnostics) {
    let nodeCount = 0;
    let textNodeCount = 0;
    let maxDepth = 0;

    function visit(node, depth = 1) {
        nodeCount++;
        if (node.type === 'TEXT') textNodeCount++;
        if (depth > maxDepth) maxDepth = depth;
        for (const child of node.children) {
            visit(child, depth + 1);
        }
    }

    for (const root of ast) {
        visit(root, 1);
    }

    return {
        rootCount: ast.length,
        nodeCount,
        textNodeCount,
        maxDepth,
        diagnosticCount: diagnostics.length,
    };
}

/**
 * Phase 3: Expand repeat prop into N sibling commands with indexed names.
 * Clones children for each repeat instance.
 */
function expandRepeatCommands(commands) {
    // First pass: collect commands and detect repeat groups
    const repeatGroups = new Map(); // parentId -> array of clone parentIds
    const expanded = [];
    const cloneCounter = {};

    for (const cmd of commands) {
        if (cmd.command !== 'node.create') {
            expanded.push(cmd);
            continue;
        }

        const props = cmd.params.props || {};
        const repeatVal = props.repeat;
        const repeatCount = (typeof repeatVal === 'number' && repeatVal >= 1 && repeatVal <= 100) ? Math.round(repeatVal) : 1;
        const baseName = props.name || cmd.params.type || 'Node';

        // Remove repeat from props
        if (props.repeat !== undefined) delete props.repeat;

        if (repeatCount <= 1) {
            expanded.push(cmd);
            continue;
        }

        // Track clones for this parentId
        if (!cloneCounter[cmd.params.id]) cloneCounter[cmd.params.id] = 0;
        cloneCounter[cmd.params.id] = repeatCount;

        const cloneIds = [];
        for (let i = 0; i < repeatCount; i++) {
            const cloneId = `${cmd.params.id}_r${i + 1}`;
            cloneIds.push(cloneId);
        }
        repeatGroups.set(cmd.params.id, cloneIds);

        // Emit clone parent commands
        for (let i = 0; i < repeatCount; i++) {
            const cloneId = cloneIds[i];
            const cloneProps = { ...props, name: `${baseName}_${i + 1}` };
            expanded.push({
                command: 'node.create',
                params: { ...cmd.params, id: cloneId, props: cloneProps },
            });
        }
    }

    // Second pass: clone children for each repeat instance
    // Children of a repeated parent need to be duplicated N times
    const childrenByParent = new Map();
    for (const cmd of expanded) {
        if (cmd.command !== 'node.create') continue;
        const pid = cmd.params.parentId;
        if (!pid) continue;

        // Find which original parent this refers to
        const origParent = findOriginalParent(pid, repeatGroups);
        if (origParent && repeatGroups.has(origParent)) {
            if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
            childrenByParent.get(pid).push(cmd);
        }
    }

    // Clone children for each repeat clone
    const finalCommands = [];
    const seen = new Set();

    for (const cmd of expanded) {
        if (cmd.command !== 'node.create') {
            finalCommands.push(cmd);
            continue;
        }

        // Check if this command's parentId maps to a repeat group
        const pid = cmd.params.parentId;
        if (pid && repeatGroups.has(pid)) {
            // This child belongs to a repeated parent — skip original, clones added below
            if (seen.has(cmd.params.id)) continue;
            seen.add(cmd.params.id);

            const clones = repeatGroups.get(pid);
            for (let i = 0; i < clones.length; i++) {
                finalCommands.push({
                    ...cmd,
                    params: { ...cmd.params, parentId: clones[i], id: `${cmd.params.id}_r${i + 1}` },
                });
            }
            continue;
        }

        finalCommands.push(cmd);
    }

    return finalCommands;
}

function findOriginalParent(childParentId, repeatGroups) {
    for (const [orig, clones] of repeatGroups) {
        if (childParentId === orig) return orig;
        // Check if it's a clone of this parent
        for (const c of clones) {
            if (childParentId.startsWith(c)) return orig;
        }
    }
    return null;
}

export function compileJSX(jsxString, idPrefix = "") {
    const { generator, errors } = parseJSXStream(jsxString, idPrefix);
    const commands = Array.from(generator);
    const expandedCommands = expandRepeatCommands(commands);
    const ast = buildAstFromCommands(expandedCommands);
    const diagnostics = buildDiagnostics(errors, expandedCommands, ast, jsxString);
    const metadata = collectAstMetadata(ast, diagnostics);

    return {
        ok: diagnostics.every(diagnostic => diagnostic.severity !== 'error'),
        ast,
        commands: expandedCommands,
        errors,
        diagnostics,
        metadata,
    };
}

export function parseJSX(jsxString, idPrefix = "") {
    const result = compileJSX(jsxString, idPrefix);
    return {
        commands: result.commands,
        errors: result.errors,
        diagnostics: result.diagnostics,
        metadata: result.metadata,
        ast: result.ast,
        ok: result.ok,
    };
}

export function toBatch(commands) {
    return {
        command: 'batch',
        params: { commands },
    };
}
