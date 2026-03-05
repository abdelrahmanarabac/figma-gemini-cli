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
export function parseJSX(jsxString) {
    const errors = [];

    // Wrap in expression for acorn
    let ast;
    try {
        ast = JSXParser.parse(`(${jsxString})`, {
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
    transformElement(expr, commands, null, errors, 0);

    return { commands, errors };
}

/**
 * Recursively transform a JSX element into commands.
 */
function transformElement(node, commands, parentIndex, errors, depth) {
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
    const textContent = extractTextContent(node);

    // For Text nodes, set characters from children text
    if (type === 'TEXT' && textContent) {
        props.characters = textContent;
    }

    // AutoLayout shorthand: if tag is AutoLayout, force layout
    if (tagName === 'AutoLayout' && !props.layoutMode) {
        props.layoutMode = 'VERTICAL';
    }

    // Build command
    const cmd = {
        command: 'node.create',
        params: { type, props: { name: props.name || tagName, ...props } },
    };

    // If this is a child, reference parent
    if (parentIndex !== null) {
        cmd.params.parentIndex = parentIndex;
    }

    const myIndex = commands.length;
    commands.push(cmd);

    // Process children (skip text-only children for TEXT nodes)
    if (type !== 'TEXT') {
        const children = getElementChildren(node);
        for (const child of children) {
            transformElement(child, commands, myIndex, errors, depth + 1);
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
