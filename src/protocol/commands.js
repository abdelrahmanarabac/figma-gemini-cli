/**
 * Command Protocol — Structured command definitions and validation.
 * Every CLI→Plugin interaction is a typed command envelope.
 * NO eval. NO arbitrary code. Just data.
 */

import { randomUUID } from 'crypto';

// Valid Figma node types
const NODE_TYPES = new Set([
    'FRAME', 'GROUP', 'RECTANGLE', 'ELLIPSE', 'TEXT',
    'COMPONENT', 'INSTANCE', 'LINE', 'VECTOR', 'BOOLEAN_OPERATION'
]);

// Command registry: name → param validation rules
const COMMANDS = {
    'health': { params: [] },
    'page.info': { params: [] },
    'page.list': { params: [] },
    'canvas.bounds': { params: [] },
    'selection.get': { params: [] },
    'selection.set': { params: ['nodeIds'] },
    'node.create': { params: ['type'], optional: ['name', 'props', 'children', 'parentId'] },
    'node.read': { params: ['nodeId'], optional: ['depth'] },
    'node.update': { params: ['nodeId', 'props'] },
    'node.delete': { params: ['nodeIds'] },
    'node.find': { params: ['query'], optional: ['type', 'limit'] },
    'node.toComponent': { params: ['nodeIds'] },
    'variable.list': { params: [], optional: ['collection', 'type'] },
    'variable.create': { params: ['collection', 'name', 'type', 'values'] },
    'variable.bind': { params: ['nodeId', 'property', 'variableId'] },
    'variable.delete': { params: ['variableIds'] },
    'collection.list': { params: [] },
    'collection.create': { params: ['name'], optional: ['modes'] },
    'export.render': { params: ['nodeId', 'format'], optional: ['scale'] },
    'batch': { params: ['commands'] },
};

// Validation limits
const MAX_DEPTH = 10;
const MAX_BATCH = 100;
const MAX_PAYLOAD_KB = 1024;

/**
 * Validate a command object. Returns { valid, error? }
 */
export function validateCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') {
        return { valid: false, error: 'Command must be an object' };
    }
    if (!cmd.command || typeof cmd.command !== 'string') {
        return { valid: false, error: 'Missing or invalid "command" field' };
    }

    const schema = COMMANDS[cmd.command];
    if (!schema) {
        return { valid: false, error: `Unknown command: "${cmd.command}"` };
    }

    const params = cmd.params || {};

    // Check required params
    for (const req of schema.params) {
        if (params[req] === undefined) {
            return { valid: false, error: `Missing required param "${req}" for ${cmd.command}` };
        }
    }

    // Type-specific validation
    if (cmd.command === 'node.create') {
        if (!NODE_TYPES.has(params.type)) {
            return { valid: false, error: `Invalid node type: "${params.type}". Valid: ${[...NODE_TYPES].join(', ')}` };
        }
        const depthErr = checkDepth(params.children, 1);
        if (depthErr) return depthErr;
    }

    if (cmd.command === 'batch') {
        if (!Array.isArray(params.commands)) {
            return { valid: false, error: 'batch.commands must be an array' };
        }
        if (params.commands.length > MAX_BATCH) {
            return { valid: false, error: `Batch exceeds max ${MAX_BATCH} commands` };
        }
        for (const sub of params.commands) {
            const subResult = validateCommand(sub);
            if (!subResult.valid) return subResult;
        }
    }

    // Size check
    const size = JSON.stringify(cmd).length / 1024;
    if (size > MAX_PAYLOAD_KB) {
        return { valid: false, error: `Payload ${size.toFixed(0)}KB exceeds max ${MAX_PAYLOAD_KB}KB` };
    }

    return { valid: true };
}

function checkDepth(children, depth) {
    if (!children || !Array.isArray(children)) return null;
    if (depth > MAX_DEPTH) {
        return { valid: false, error: `Node tree exceeds max depth of ${MAX_DEPTH}` };
    }
    for (const child of children) {
        const err = checkDepth(child.children, depth + 1);
        if (err) return err;
    }
    return null;
}

/**
 * Create a validated command envelope.
 */
export function createCommand(command, params = {}) {
    const envelope = {
        id: randomUUID(),
        version: '1.0',
        type: 'command',
        command,
        params,
    };

    const result = validateCommand(envelope);
    if (!result.valid) {
        throw new Error(`Invalid command: ${result.error}`);
    }

    return envelope;
}

/**
 * Create a batch command from an array of { command, params } objects.
 */
export function createBatch(commands) {
    return createCommand('batch', { commands });
}

export { COMMANDS, NODE_TYPES, MAX_DEPTH, MAX_BATCH };
