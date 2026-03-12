/**
 * Simple Regex-based JSX Parser
 * 
 * Restored to a predictable, deterministic pipeline.
 * Replaces complex AST parsing with stable regex-based extraction.
 */

// Map JSX component names → Figma node types
const COMPONENT_MAP = {
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
    // Virtual Props
    data: 'data',
    complexity: 'complexity',
    strokeColor: 'strokeColor',
    fillColor: 'fillColor'
};

const NUMERIC_PROPS = new Set([
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
    'itemSpacing', 'padding', 'paddingTop', 'paddingRight', 
    'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical',
    'fontSize', 'fontWeight', 'opacity', 'x', 'y', 'rotation', 'strokeWidth',
    'blur', 'backdropBlur', 'letterSpacing', 'lineHeight', 'complexity'
]);

function transformPropValue(key, value, props) {
    if (key === 'layoutMode') {
        if (value === 'row') return 'HORIZONTAL';
        if (value === 'col') return 'VERTICAL';
        return value;
    }
    if (key === 'layoutWrap' && value === true) return 'WRAP';
    if (key === 'primaryAxisAlignItems' || key === 'counterAxisAlignItems' || key === 'textAlignHorizontal' || key === 'textAlignVertical') {
        const map = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN', left: 'LEFT', right: 'RIGHT', top: 'TOP', bottom: 'BOTTOM' };
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
        // We handle these as numeric pixels for now in the plugin side
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
        if (!isNaN(num)) return num;
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
 * Enhanced Prop Parser
 * Handles: multiline, quotes, and nested braces.
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
                // Bare value
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
function extractContent(str, tagName, errors = []) {
    let depth = 1;
    let i = 0;
    const closeTag = `</${tagName}>`;
    const openTagStart = `<${tagName}`;

    while (i < str.length && depth > 0) {
        if (str.slice(i).startsWith(closeTag)) {
            depth--;
            if (depth === 0) return str.slice(0, i);
            i += closeTag.length;
        } else if (str.slice(i).startsWith(openTagStart)) {
            const nextChar = str[i + openTagStart.length];
            if (nextChar === ' ' || nextChar === '>' || nextChar === '/') {
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
        errors.push(`Unclosed tag: <${tagName}>`);
    }
    return str;
}

/**
 * Command Generator
 * parentId is yielded BEFORE children (parent-first order).
 * IDs are deterministic based on seed (timestamp) + counter.
 */
export function* generateCommands(jsx, parentId = null, idPrefix = "", timestamp = 0, counter = { value: 0 }, errors = []) {
    // 1. Clean JSX: Strip comments and normalise
    let cleanJsx = jsx.replace(/{\/\*[\s\S]*?\*\/}/g, '');
    
    let lastIndex = 0;
    while (lastIndex < cleanJsx.length) {
        const remaining = cleanJsx.slice(lastIndex);
        const openMatch = remaining.match(/<([A-Z][a-zA-Z0-9\.]*)/);
        if (!openMatch) break;

        const startIdxInRemaining = openMatch.index;
        const startIdx = lastIndex + startIdxInRemaining;
        const tagName = openMatch[1];
        
        // Find end of this tag
        const endOfTagIdx = findEndOfTag(remaining.slice(startIdxInRemaining));
        if (endOfTagIdx === -1) {
            lastIndex = startIdx + openMatch[0].length;
            continue;
        }
        
        const fullTag = remaining.slice(startIdxInRemaining, startIdxInRemaining + endOfTagIdx + 1);
        const isSelfClosing = fullTag.endsWith('/>');
        const propsStr = fullTag.slice(openMatch[0].length, isSelfClosing ? -2 : -1).trim();

        // Handle text nodes before this tag
        const textBefore = cleanJsx.slice(lastIndex, startIdx).trim();
        if (textBefore && parentId) {
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

        const type = COMPONENT_MAP[tagName] || 'FRAME';
        const props = parseProps(propsStr);
        const id = `${idPrefix}tmp_${timestamp}_${counter.value++}`;

        const cmd = {
            command: 'node.create',
            params: { id, type, props: { name: props.name || tagName, ...props } },
        };
        
        const isVirtualViz = ['Wave', 'LineChart', 'BarChart', 'PieChart'].includes(tagName);
        if (isVirtualViz) {
            cmd.params.props.content = generateDataVisualization(tagName, props);
        }

        if (parentId) cmd.params.parentId = parentId;
        
        yield cmd;

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
                    cmd.params.props.characters = content.trim();
                    endIdx += closeIdx + closeTag.length;
                } else {
                    errors.push(`Unclosed TEXT tag: <${tagName}>`);
                    content = afterOpen;
                    cmd.params.props.characters = content.trim();
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
                    errors.push(`Unclosed SVG tag: <${tagName}>`);
                    content = afterOpen;
                    cmd.params.props.content = content.trim();
                    endIdx += content.length;
                }
            } else if (!isVirtualViz) {
                content = extractContent(afterOpen, tagName, errors);
                yield* generateCommands(content, id, idPrefix, timestamp, counter, errors);
                
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

export function parseJSX(jsxString, idPrefix = "") {
    const { generator, errors } = parseJSXStream(jsxString, idPrefix);
    return { commands: Array.from(generator), errors };
}

export function toBatch(commands) {
    return {
        command: 'batch',
        params: { commands },
    };
}
