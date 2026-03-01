import { Command } from '../cli/command.js';
import { execSync } from 'child_process';

class LintCommand extends Command {
    name = 'lint';
    description = 'Lint design for issues (figma-use)';
    options = [
        { flags: '--fix', description: 'Auto-fix issues where possible' },
        { flags: '--rule <rule>', description: 'Run specific rule' },
        { flags: '--preset <preset>', description: 'Preset: recommended, strict, accessibility, design-system' }
    ];

    async execute(ctx, opts) {
        let cmd = 'npx figma-use lint';
        if (opts.fix) cmd += ' --fix';
        if (opts.rule) cmd += ` --rule ${opts.rule}`;
        if (opts.preset) cmd += ` --preset ${opts.preset}`;
        if (opts.json) cmd += ' --json';
        try {
            execSync(cmd, { stdio: 'inherit', timeout: 60000 });
        } catch { }
    }
}

class AnalyzeColorsCommand extends Command {
    name = 'analyze colors';
    description = 'Analyze color usage';

    async execute(ctx, opts) {
        let cmd = 'npx figma-use analyze colors';
        if (opts.json) cmd += ' --json';
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class AnalyzeTypographyCommand extends Command {
    name = 'analyze typography';
    description = 'Analyze typography usage';

    async execute(ctx, opts) {
        let cmd = 'npx figma-use analyze typography';
        if (opts.json) cmd += ' --json';
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class AnalyzeSpacingCommand extends Command {
    name = 'analyze spacing';
    description = 'Analyze spacing (gap/padding) usage';

    async execute(ctx, opts) {
        let cmd = 'npx figma-use analyze spacing';
        if (opts.json) cmd += ' --json';
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

class AnalyzeClustersCommand extends Command {
    name = 'analyze clusters';
    description = 'Find repeated patterns (potential components)';

    async execute(ctx, opts) {
        let cmd = 'npx figma-use analyze clusters';
        if (opts.json) cmd += ' --json';
        execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    }
}

export default [
    new LintCommand(),
    new AnalyzeColorsCommand(),
    new AnalyzeTypographyCommand(),
    new AnalyzeSpacingCommand(),
    new AnalyzeClustersCommand(),
];
