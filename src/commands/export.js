import { Command } from '../cli/command.js';
import { execSync } from 'child_process';

class ExportJsxCommand extends Command {
    name = 'export-jsx [nodeId]';
    description = 'Export node as JSX/React code';
    options = [
        { flags: '-o, --output <file>', description: 'Output file (otherwise stdout)' },
        { flags: '--pretty', description: 'Format output' },
        { flags: '--match-icons', description: 'Match vectors to Iconify icons' }
    ];

    async execute(ctx, opts, nodeId) {
        let cmd = 'npx figma-use export jsx';
        if (nodeId) cmd += ` "${nodeId}"`;
        if (opts.pretty) cmd += ' --pretty';
        if (opts.matchIcons) cmd += ' --match-icons';
        if (opts.output) {
            cmd += ` > "${opts.output}"`;
            execSync(cmd, { shell: true, stdio: 'inherit', timeout: 60000 });
        } else {
            execSync(cmd, { stdio: 'inherit', timeout: 60000 });
        }
    }
}

class ExportStorybookCommand extends Command {
    name = 'export-storybook [nodeId]';
    description = 'Export components as Storybook stories';
    options = [
        { flags: '-o, --output <file>', description: 'Output file (otherwise stdout)' }
    ];

    async execute(ctx, opts, nodeId) {
        let cmd = 'npx figma-use export storybook';
        if (nodeId) cmd += ` "${nodeId}"`;
        if (opts.output) {
            cmd += ` > "${opts.output}"`;
            execSync(cmd, { shell: true, stdio: 'inherit', timeout: 60000 });
        } else {
            execSync(cmd, { stdio: 'inherit', timeout: 60000 });
        }
    }
}

export default [
    new ExportJsxCommand(),
    new ExportStorybookCommand(),
];
