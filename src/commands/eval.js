import { Command } from '../cli/command.js';
import { existsSync, readFileSync } from 'fs';
import { isDaemonRunning, daemonExec } from '../utils/figma.js';
import chalk from 'chalk';

class EvalCommand extends Command {
    name = 'eval <code>';
    description = 'Execute JavaScript in Figma context';
    options = [
        { flags: '-f, --file <path>', description: 'Execute from file instead of inline' }
    ];

    async execute(ctx, opts, code) {
        let jsCode = code;

        // File mode
        if (opts.file) {
            if (!existsSync(opts.file)) {
                ctx.logError('File not found: ' + opts.file);
                return;
            }
            jsCode = readFileSync(opts.file, 'utf8');
        }

        try {
            const result = await ctx.eval(jsCode);
            if (result !== undefined && result !== null) {
                console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
            }
        } catch (error) {
            ctx.logError(error.message);
        }
    }
}

class RunCommand extends Command {
    name = 'run <file>';
    description = 'Run JavaScript file in Figma (alias for eval --file)';

    async execute(ctx, opts, file) {
        if (!existsSync(file)) {
            ctx.logError('File not found: ' + file);
            return;
        }
        const code = readFileSync(file, 'utf8');
        try {
            const result = await ctx.eval(code);
            if (result !== undefined) {
                console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
            }
        } catch (e) {
            ctx.logError(e.message);
        }
    }
}

class RawCommand extends Command {
    name = 'raw <command...>';
    description = 'Run raw figma-use command';

    async execute(ctx, opts, ...commandParts) {
        const { execSync } = await import('child_process');
        const cmd = commandParts.flat().join(' ');
        try {
            execSync(`npx figma-use ${cmd}`, { stdio: 'inherit', timeout: 60000 });
        } catch (error) {
            // figma-use may exit with error, that's ok
        }
    }
}

export default [
    new EvalCommand(),
    new RunCommand(),
    new RawCommand(),
];
