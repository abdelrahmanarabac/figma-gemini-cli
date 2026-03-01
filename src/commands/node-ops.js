import { Command } from '../cli/command.js';
import { execSync } from 'child_process';

class NodeTreeCommand extends Command {
    name = 'node tree [nodeId]';
    description = 'Show node tree structure';
    options = [
        { flags: '-d, --depth <n>', description: 'Max depth', defaultValue: '3' }
    ];

    async execute(ctx, opts, nodeId) {
        let cmd = 'npx figma-use node tree';
        if (nodeId) cmd += ` "${nodeId}"`;
        cmd += ` --depth ${opts.depth}`;
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class NodeBindingsCommand extends Command {
    name = 'node bindings [nodeId]';
    description = 'Show variable bindings for node';

    async execute(ctx, opts, nodeId) {
        let cmd = 'npx figma-use node bindings';
        if (nodeId) cmd += ` "${nodeId}"`;
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class NodeToComponentCommand extends Command {
    name = 'node to-component <nodeIds...>';
    description = 'Convert frames to components';

    async execute(ctx, opts, ...nodeIds) {
        const ids = nodeIds.flat();
        const cmd = `npx figma-use node to-component "${ids.join(' ')}"`;
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class NodeDeleteCommand extends Command {
    name = 'node delete <nodeIds...>';
    description = 'Delete nodes by ID';

    async execute(ctx, opts, ...nodeIds) {
        const ids = nodeIds.flat();
        const cmd = `npx figma-use node delete "${ids.join(' ')}"`;
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

export default [
    new NodeTreeCommand(),
    new NodeBindingsCommand(),
    new NodeToComponentCommand(),
    new NodeDeleteCommand(),
];
