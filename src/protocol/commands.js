/**
 * Command Protocol — Structured command definitions and validation.
 */

import { randomUUID } from 'crypto';

// Valid Figma node types
const NODE_TYPES = new Set([
    'FRAME', 'GROUP', 'RECTANGLE', 'ELLIPSE', 'TEXT',
    'COMPONENT', 'INSTANCE', 'LINE', 'VECTOR', 'BOOLEAN_OPERATION', 'SVG'
]);

// Command registry: Only include commands handled by the plugin
const COMMANDS = {
    'health': { params: [] },
    'node.create': { params: ['type'], optional: ['name', 'props', 'children', 'parentId'] },
    'batch': { params: ['commands'] },
    'style.list': { params: [] },
    'style.update_typography': { params: ['family'], optional: ['pattern', 'weightMap'] },
    'tokens.delete_all': { params: [] },
    'tokens.create_palette': { params: ['colors', 'collectionName'] },
    'tokens.create_shadcn': { params: ['primitives', 'semanticTokens'] },
    'tokens.create_scale': { params: ['values', 'collectionName', 'prefix'], optional: ['type'] },
    'eval': { params: ['code'] },
    'stream.start': { params: ['streamId'] },
    'stream.chunk': { params: ['streamId', 'items'] },
    'stream.end': { params: ['streamId'] },
    'stream.abort': { params: ['streamId'] },
};

/**
 * Validate a command object.
 */
export function validateCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return { valid: false, error: 'Command must be an object' };
    const commandName = cmd.command || cmd.action; // Support both naming conventions
    if (!commandName) return { valid: false, error: 'Missing command name' };

    const schema = COMMANDS[commandName];
    if (!schema) return { valid: true }; // Allow unknown for extensibility but warning-less

    const params = cmd.params || cmd;
    for (const req of schema.params) {
        if (params[req] === undefined) return { valid: false, error: `Missing param "${req}"` };
    }

    return { valid: true };
}

export function createCommand(command, params = {}) {
    return {
        id: randomUUID(),
        version: '1.0',
        type: 'command',
        command,
        params,
    };
}

export { COMMANDS, NODE_TYPES };
