import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { FigmaClient } from '../core/figma-client.js';
import { isPatched, patchFigma, unpatchFigma } from '../figma-patch.js';
import { 
  startFigma, 
  killFigma, 
  isDaemonRunning, 
  startDaemon, 
  getManualStartCommand 
} from '../utils/figma.js';
import { loadConfig, setConfig } from '../utils/config.js';
import { showBanner, showQuickStart } from '../ui/logger.js';

export function connectCommands(program) {
  program
    .command('connect')
    .description('Connect to Figma Desktop')
    .option('--safe', 'Use Safe Mode (Plugin only, no patching)')
    .action(async (options) => {
      const config = loadConfig();
      const mode = options.safe ? 'safe' : 'yolo';
      setConfig('mode', mode);

      if (mode === 'yolo' && !isPatched()) {
        const spinner = ora('Patching Figma for direct connection...').start();
        try {
          patchFigma();
          spinner.succeed('Figma patched successfully');
          setConfig('patched', true);
        } catch (e) {
          spinner.fail('Failed to patch Figma: ' + e.message);
          process.exit(1);
        }
      }

      showBanner();
      
      const connected = await FigmaClient.isConnected();
      if (connected) {
        console.log(chalk.green('  ✓ Connected to Figma\n'));
        showQuickStart();
      } else {
        console.log(chalk.yellow('  ⚠ Figma not connected\n'));
        console.log(chalk.white('  Starting Figma...'));
        try {
          killFigma();
          await new Promise(r => setTimeout(r, 500));
          startFigma();
          console.log(chalk.green('  ✓ Figma started\n'));

          const spinner = ora('  Waiting for connection...').start();
          for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (await FigmaClient.isConnected()) {
              spinner.succeed('Connected to Figma\n');
              startDaemon(false, mode);
              showQuickStart();
              return;
            }
          }
          spinner.warn('Open a file in Figma to connect\n');
          showQuickStart();
        } catch {
          console.log(chalk.gray('  Start manually: ' + getManualStartCommand() + '\n'));
        }
      }
    });

  program
    .command('status')
    .description('Check connection status')
    .action(async () => {
      const connected = await FigmaClient.isConnected();
      if (connected) {
        const client = new FigmaClient();
        await client.connect();
        const info = await client.getPageInfo();
        console.log(chalk.green('✓ Connected to Figma'));
        console.log(chalk.gray(`  File: ${client.pageTitle.replace(' – Figma', '')}`));
        console.log(chalk.gray(`  Page: ${info.name}`));
        client.close();
      } else {
        console.log(chalk.red('✗ Not connected'));
      }
    });
}
