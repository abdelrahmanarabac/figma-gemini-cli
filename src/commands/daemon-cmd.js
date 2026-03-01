import { Command } from '../cli/command.js';
import { isDaemonRunning, startDaemon, stopDaemon } from '../utils/figma.js';
import chalk from 'chalk';

const DAEMON_PORT = 3456;

class DaemonStatusCommand extends Command {
    name = 'daemon status';
    description = 'Check if daemon is running';
    needsConnection = false;

    async execute(ctx) {
        if (isDaemonRunning()) {
            ctx.log(chalk.green('✓ Daemon is running on port ' + DAEMON_PORT));
        } else {
            ctx.log(chalk.yellow('○ Daemon is not running'));
            ctx.log(chalk.gray('  Run "figma-ds-cli connect" to start it automatically'));
        }
    }
}

class DaemonStartCommand extends Command {
    name = 'daemon start';
    description = 'Start the daemon manually';
    needsConnection = false;

    async execute(ctx) {
        if (isDaemonRunning()) {
            ctx.log(chalk.green('✓ Daemon already running'));
            return;
        }
        ctx.log(chalk.blue('Starting daemon...'));
        startDaemon();
        await new Promise(r => setTimeout(r, 1500));
        if (isDaemonRunning()) {
            ctx.log(chalk.green('✓ Daemon started on port ' + DAEMON_PORT));
        } else {
            ctx.logError('Failed to start daemon');
        }
    }
}

class DaemonStopCommand extends Command {
    name = 'daemon stop';
    description = 'Stop the daemon';
    needsConnection = false;

    async execute(ctx) {
        ctx.log(chalk.blue('Stopping daemon...'));
        stopDaemon();
        ctx.logSuccess('Daemon stopped');
    }
}

class DaemonRestartCommand extends Command {
    name = 'daemon restart';
    description = 'Restart the daemon';
    needsConnection = false;

    async execute(ctx) {
        ctx.log(chalk.blue('Restarting daemon...'));
        stopDaemon();
        await new Promise(r => setTimeout(r, 500));
        startDaemon();
        await new Promise(r => setTimeout(r, 1500));
        if (isDaemonRunning()) {
            ctx.logSuccess('Daemon restarted');
        } else {
            ctx.logError('Failed to restart daemon');
        }
    }
}

class DaemonReconnectCommand extends Command {
    name = 'daemon reconnect';
    description = 'Reconnect to Figma (use if connection is stale)';
    needsConnection = false;

    async execute(ctx) {
        if (!isDaemonRunning()) {
            ctx.log(chalk.yellow('○ Daemon is not running'));
            ctx.log(chalk.gray('  Run "figma-ds-cli connect" first'));
            return;
        }
        ctx.log(chalk.blue('Reconnecting to Figma...'));
        try {
            const response = await fetch(`http://localhost:${DAEMON_PORT}/reconnect`);
            const result = await response.json();
            if (result.error) {
                ctx.logError('Reconnect failed: ' + result.error);
            } else {
                ctx.logSuccess('Reconnected to Figma');
            }
        } catch (e) {
            ctx.logError('Failed: ' + e.message);
        }
    }
}

export default [
    new DaemonStatusCommand(),
    new DaemonStartCommand(),
    new DaemonStopCommand(),
    new DaemonRestartCommand(),
    new DaemonReconnectCommand(),
];
