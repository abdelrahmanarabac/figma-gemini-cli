/**
 * JSX Parser + AST Transformer
 *
 * Parses JSX design DSL into structured commands.
 * Uses acorn + acorn-jsx for real AST parsing (no regex).
 *
 * Pipeline: JSX string → acorn AST → command list
 */

import * as acorn from 'acorn';
import jsx from 'acorn-jsx';

const JSXParser = acorn.Parser.extend(jsx());

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
};

// Map JSX prop names → Figma API property names
const PROP_MAP = {
    // Size
    width: 'width', w: 'width',
    height: 'height', h: 'height',
    minWidth: 'minWidth', minW: 'minWidth',
    maxWidth: 'maxWidth', maxW: 'maxWidth',
    minHeight: 'minHeight', minH: 'minHeight',
    maxHeight: 'maxHeight', maxH: 'maxHeight',

    // Name
    name: 'name',

    // Fill / Stroke
    fill: 'fill', bg: 'fill',
    stroke: 'stroke',
    strokeWidth: 'strokeWidth',
    strokeAlign: 'strokeAlign',
    opacity: 'opacity',

    // Corner radius
    cornerRadius: 'cornerRadius', rounded: 'cornerRadius',
    cornerSmoothing: 'cornerSmoothing',
    roundedTL: 'topLeftRadius', roundedTR: 'topRightRadius',
    roundedBL: 'bottomLeftRadius', roundedBR: 'bottomRightRadius',

    // Layout
    flex: 'layoutMode',          // "row" → HORIZONTAL, "col" → VERTICAL
    gap: 'itemSpacing',
    wrap: 'layoutWrap',
    rowGap: 'counterAxisSpacing',
    grow: 'layoutGrow',
    stretch: 'layoutAlign',

    // Padding
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop', pr: 'paddingRight',
    pb: 'paddingBottom', pl: 'paddingLeft',

    // Alignment
    justify: 'primaryAxisAlignItems',
    items: 'counterAxisAlignItems',

    // Text props
    fontSize: 'fontSize', size: 'fontSize',
    fontWeight: 'fontWeight', weight: 'fontWeight',
    color: 'color',
    font: 'fontFamily',

    // Position
    position: 'position',
    x: 'x', y: 'y',
    rotate: 'rotation',

    // Effects
    shadow: 'shadow',
    blur: 'blur',
    overflow: 'clipsContent',

    // Blend
    blendMode: 'blendMode',

    // Variant (for custom components like Button)
    variant: 'variant',
};

// Layout value transforms
function transformPropValue(key, value) {
    if (key === 'layoutMode') {
        if (value === 'row') return 'HORIZONTAL';
        if (value === 'col') return 'VERTICAL';
        return value;
    }
    if (key === 'layoutWrap' && value === true) return 'WRAP';
    if (key === 'layoutAlign' && value === true) return 'STRETCH';
    if (key === 'clipsContent') return value === 'hidden' ? true : value;
    if (key === 'primaryAxisAlignItems' || key === 'counterAxisAlignItems') {
        const map = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN' };
        return map[value] || value;
    }
    if (key === 'fontWeight') {
        const map = { thin: 100, light: 300, regular: 400, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
        return map[value] || value;
    }
    return value;
}

/**
 * Parse JSX string into structured commands.
 * @param {string} jsxString - JSX design DSL
 * @returns {{ commands: object[], errors: string[] }}
 */
export function parseJSX(jsxString, idPrefix = "") {
    const errors = [];

    // Pre-process JSX to handle unquoted attributes (common when CLI args strip quotes)
    // 1. Wrap unquoted booleans in {}
    let processed = jsxString.replace(/([a-zA-Z0-9_-]+)=(true|false)(?=\s|>|\/|$)/g, '$1={$2}');
    // 2. Wrap unquoted numbers in {}
    processed = processed.replace(/([a-zA-Z0-9_-]+)=([\-+]?[0-9]*\.?[0-9]+)(?=\s|>|\/|$)/g, '$1={$2}');
    // 3. Wrap unquoted strings (anything else without quotes/braces) in ""
    processed = processed.replace(/([a-zA-Z0-9_-]+)=([^"'{}\s/>][^\s/>]*)(?=\s|>|\/|$)/g, '$1="$2"');
    // 4. Handle completely empty values e.g. w= followed by space or > (prevents 1:13 error)
    processed = processed.replace(/([a-zA-Z0-9_-]+)=(?=\s|>|\/|$)(?!=")/g, '$1=""');

    // Wrap in expression for acorn
    let ast;
    try {
        ast = JSXParser.parse(`(${processed})`, {
            ecmaVersion: 2020,
            sourceType: 'module',
        });
    } catch (err) {
        return { commands: [], errors: [`JSX parse error: ${err.message}`] };
    }

    // Find the JSX expression
    const expr = ast.body[0]?.expression;
    if (!expr || expr.type !== 'JSXElement') {
        return { commands: [], errors: ['No JSX element found'] };
    }

    const commands = [];
    transformElement(expr, commands, undefined, errors, 0, idPrefix);

    return { commands, errors };
}

/**
 * Recursively transform a JSX element into commands.
 */
function transformElement(node, commands, parentId, errors, depth, idPrefix) {
    if (depth > 10) {
        errors.push('Max nesting depth (10) exceeded');
        return;
    }

    const tagName = getTagName(node);
    if (!tagName) {
        errors.push('Could not resolve JSX tag name');
        return;
    }

    const figmaType = COMPONENT_MAP[tagName];
    if (!figmaType) {
        // Treat unknown components as Frame (Button, Card, etc.)
        errors.push(`Unknown component "${tagName}" — treating as FRAME`);
    }

    const type = figmaType || 'FRAME';
    const props = extractProps(node, errors);
    const children = getElementChildren(node);
    const textContent = extractTextContent(node);

    // --- SMART LAYOUT INFERENCE ENGINE (Web DOM Flow) ---
    // If a structural frame has children, isn't explicitly absolute, and has no layout mode,
    // we analyze its children to infer the correct web-like formatting context.
    if (type === 'FRAME' && children.length > 0 && props.position !== 'absolute' && !props.layoutMode) {

        const childTags = children.map(c => getTagName(c) || 'Frame');
        const hasBlocks = childTags.some(t => ['Frame', 'AutoLayout', 'Group', 'Component'].includes(t));
        const hasText = childTags.includes('Text');
        const hasIcons = childTags.some(t => ['Ellipse', 'Line', 'Rectangle', 'Vector', 'Star', 'Polygon'].includes(t));

        const isInteractive = ['Button', 'Input', 'Badge', 'Chip'].includes(tagName);

        if (children.length === 1 && !hasBlocks) {
            // Rule 1: Single Child Tight Wrapper
            props.layoutMode = 'HORIZONTAL';
            if (props.itemSpacing === undefined) props.itemSpacing = 0;
            if (props.primaryAxisAlignItems === undefined) props.primaryAxisAlignItems = 'CENTER';
            if (props.counterAxisAlignItems === undefined) props.counterAxisAlignItems = 'CENTER';

        } else if (isInteractive) {
            // Rule 2: Interactive Components
            props.layoutMode = 'HORIZONTAL';
            if (props.itemSpacing === undefined) props.itemSpacing = 8;
            if (props.counterAxisAlignItems === undefined) props.counterAxisAlignItems = 'CENTER';

        } else if (!hasBlocks && hasText && hasIcons) {
            // Rule 3: Icon + Text Row
            props.layoutMode = 'HORIZONTAL';
            if (props.itemSpacing === undefined) props.itemSpacing = 8;
            if (props.counterAxisAlignItems === undefined) props.counterAxisAlignItems = 'CENTER';

        } else if (!hasBlocks && childTags.every(t => t === 'Text')) {
            // Rule 4: Text Stack
            props.layoutMode = 'VERTICAL';
            if (props.itemSpacing === undefined) props.itemSpacing = 4;
            if (props.width === undefined) props.width = 'fill';

        } else {
            // Rule 5: Structural Container
            props.layoutMode = 'VERTICAL';
            if (props.itemSpacing === undefined) props.itemSpacing = 16;
            if (props.width === undefined && depth > 0) props.width = 'fill';
        }
    }
    // ----------------------------------------------------

    // For Text nodes, set characters from children text
    if (type === 'TEXT' && textContent) {
        props.characters = textContent;
    }

    // AutoLayout shorthand: if tag is AutoLayout, force layout
    if (tagName === 'AutoLayout' && !props.layoutMode) {
        props.layoutMode = 'VERTICAL';
    }

    const id = `${idPrefix}node_${commands.length}`;

    // Build command
    const cmd = {
        command: 'node.create',
        params: { id, type, props: { name: props.name || tagName, ...props } },
    };

    // If this is a child, reference parent
    if (parentId) {
        cmd.params.parentId = parentId;
    }

    commands.push(cmd);

    // Process children (skip text-only children for TEXT nodes)
    if (type !== 'TEXT') {
        const children = getElementChildren(node);
        for (const child of children) {
            transformElement(child, commands, id, errors, depth + 1, idPrefix);
        }
    }
}

function getTagName(node) {
    const name = node.openingElement?.name;
    if (!name) return null;
    if (name.type === 'JSXIdentifier') return name.name;
    if (name.type === 'JSXMemberExpression') {
        return `${name.object.name}.${name.property.name}`;
    }
    return null;
}

function extractProps(node, errors) {
    const props = {};
    const attrs = node.openingElement?.attributes || [];

    for (const attr of attrs) {
        if (attr.type !== 'JSXAttribute') continue;

        const rawKey = attr.name?.name;
        if (!rawKey) continue;

        const mappedKey = PROP_MAP[rawKey] || rawKey;
        let value;

        if (attr.value === null) {
            // Boolean attribute: <Frame wrap />
            value = true;
        } else if (attr.value.type === 'Literal') {
            value = attr.value.value;
        } else if (attr.value.type === 'JSXExpressionContainer') {
            value = evaluateExpression(attr.value.expression, errors);
        } else {
            errors.push(`Unsupported attribute value type for "${rawKey}"`);
            continue;
        }

        // --- COLLISION PREVENTION ---
        // If the mappedKey (e.g., 'width') is already set by a primary prop
        // and we are currently processing a secondary shorthand (e.g., 'w'),
        // we skip the secondary to avoid overwriting "fill" with something else.
        if (props[mappedKey] !== undefined && rawKey !== mappedKey) {
            continue;
        }

        props[mappedKey] = transformPropValue(mappedKey, value);
    }

    return props;
}


function evaluateExpression(expr, errors) {
    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'UnaryExpression' && expr.operator === '-' && expr.argument.type === 'Literal') {
        return -expr.argument.value;
    }
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
        return expr.quasis[0]?.value?.cooked || '';
    }
    if (expr.type === 'ObjectExpression') {
        const obj = {};
        for (const prop of expr.properties) {
            const key = prop.key?.name || prop.key?.value;
            obj[key] = evaluateExpression(prop.value, errors);
        }
        return obj;
    }
    if (expr.type === 'ArrayExpression') {
        return expr.elements.map(el => evaluateExpression(el, errors));
    }
    errors.push(`Cannot evaluate expression type: ${expr.type}`);
    return undefined;
}

function extractTextContent(node) {
    const children = node.children || [];
    const textParts = [];

    for (const child of children) {
        if (child.type === 'JSXText') {
            const trimmed = child.value.trim();
            if (trimmed) textParts.push(trimmed);
        }
        if (child.type === 'JSXExpressionContainer' && child.expression.type === 'Literal') {
            textParts.push(String(child.expression.value));
        }
    }

    return textParts.length > 0 ? textParts.join(' ') : null;
}

function getElementChildren(node) {
    return (node.children || []).filter(c => c.type === 'JSXElement');
}

/**
 * Wrap parsed commands into a batch envelope.
 */
export function toBatch(commands) {
    return {
        command: 'batch',
        params: { commands },
    };
}
