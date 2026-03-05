#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { homedir, platform } from 'os';
import { createServer } from 'http';
import { FigJamClient } from './figjam-client.js';
import { FigmaClient } from './core/figma-client.js';
import { isPatched, patchFigma, unpatchFigma, getFigmaCommand, getCdpPort } from './figma-patch.js';

import { CliRouter } from './cli/router.js';
import { isDaemonRunning, daemonExec, fastEval, fastRender, startDaemon, stopDaemon, getFigmaPath, startFigma, killFigma, getManualStartCommand, getFigmaClient, hexToRgb } from './utils/figma.js';
import { loadConfig, saveConfig } from './utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const router = new CliRouter('figma-ds-cli', pkg.version, pkg.description, {
  config: { load: loadConfig, save: saveConfig },
  getFigmaClient,
  getCdpPort,
  getActivePage: FigmaClient.getActivePage,
  fastEval,
  fastRender
});

// Global alias for figmaEval since it's used throughout this file
const figmaEval = fastEval;

const program = router.legacyProgram;

// Helper: Prompt user

// Sync wrapper for figmaEval - uses daemon via curl (fast) or fallback to direct connection
// Removed duplicate/broken implementation. Use the async version above.

// Compatibility wrapper for old figmaUse calls
async function figmaUse(args, options = {}) {
  // Parse eval command
  const evalMatch = args.match(/^eval\s+"(.+)"$/s) || args.match(/^eval\s+'(.+)'$/s);

  if (evalMatch) {
    // Only unescape quotes, NOT \n (which would break string literals like .join('\n'))
    const code = evalMatch[1].replace(/\\"/g, '"');
    try {
      const result = await figmaEval(code);
      if (!options.silent && result !== undefined) {
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      }
      return typeof result === 'object' ? JSON.stringify(result) : String(result || '');
    } catch (error) {
      if (options.silent) return null;
      throw error;
    }
  }

  if (args === 'status' || args.startsWith('status')) {
    try {
      const port = getCdpPort();
      const result = execSync(`curl -s http://localhost:${port}/json`, { encoding: 'utf8', stdio: 'pipe' });
      const pages = JSON.parse(result);
      const figmaPage = pages.find(p => p.url?.includes('figma.com/design') || p.url?.includes('figma.com/file'));
      if (figmaPage) {
        const status = `Connected to Figma\n  File: ${figmaPage.title.replace(' – Figma', '')}`;
        if (!options.silent) console.log(status);
        return status;
      }
      return 'Not connected';
    } catch {
      return 'Not connected';
    }
  }

  if (args === 'variable list') {
    const result = await figmaEval(`(async () => {
      const vars = await figma.variables.getLocalVariablesAsync();
      return vars.map(v => v.name + ' (' + v.resolvedType + ')').join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args === 'collection list') {
    const result = await figmaEval(`(async () => {
      const cols = await figma.variables.getLocalVariableCollectionsAsync();
      return cols.map(c => c.name + ' (' + c.variableIds.length + ' vars)').join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args.startsWith('collection create ')) {
    const name = args.replace('collection create ', '').replace(/"/g, '');
    const result = await figmaEval(`
      const col = figma.variables.createVariableCollection('${name}');
      col.id
    `);
    if (!options.silent) console.log(chalk.green('✓ Created collection: ' + name));
    return result;
  }

  if (args.startsWith('variable find ')) {
    const pattern = args.replace('variable find ', '').replace(/"/g, '');
    const result = await figmaEval(`(async () => {
      const pattern = '${pattern}'.replace('*', '.*');
      const re = new RegExp(pattern, 'i');
      const vars = await figma.variables.getLocalVariablesAsync();
      return vars.filter(v => re.test(v.name)).map(v => v.name).join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args.startsWith('select ')) {
    const nodeId = args.replace('select ', '').replace(/"/g, '');
    await figmaEval(`(async () => {
      const node = await figma.getNodeByIdAsync('${nodeId}');
      if (node) figma.currentPage.selection = [node];
    })()`);
    return 'Selected';
  }

  // Fallback warning
  if (!options.silent) {
    console.log(chalk.yellow('Command not fully supported: ' + args));
  }
  return null;
}

// Helper: Check connection
async function checkConnection() {
  // First check daemon (works for both CDP and Plugin modes)
  try {
    const health = execSync(`curl -s http://127.0.0.1:${3456}/health`, { encoding: 'utf8', timeout: 2000 });
    const data = JSON.parse(health);
    if (data.status === 'ok' && (data.plugin || data.cdp)) {
      return true;
    }
  } catch { }

  // Fallback: check CDP directly
  const connected = await FigmaClient.isConnected();
  if (!connected) {
    console.log(chalk.red('\n✗ Not connected to Figma\n'));
    console.log(chalk.white('  Make sure Figma is running:'));
    console.log(chalk.cyan('  figma-ds-cli connect') + chalk.gray(' (Yolo Mode)'));
    console.log(chalk.cyan('  figma-ds-cli connect --safe') + chalk.gray(' (Safe Mode)\n'));
    process.exit(1);
  }
  return true;
}

// Helper: Check connection (sync version for backwards compat)
function checkConnectionSync() {
  // First check daemon (works for both CDP and Plugin modes)
  try {
    const health = execSync(`curl -s http://127.0.0.1:${3456}/health`, { encoding: 'utf8', timeout: 2000 });
    const data = JSON.parse(health);
    if (data.status === 'ok' && (data.plugin || data.cdp)) {
      return true;
    }
  } catch { }

  // Fallback: check CDP directly
  try {
    const port = getCdpPort();
    execSync(`curl -s http://localhost:${port}/json > /dev/null`, { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch {
    console.log(chalk.red('\n✗ Not connected to Figma\n'));
    console.log(chalk.white('  Make sure Figma is running:'));
    console.log(chalk.cyan('  figma-ds-cli connect') + chalk.gray(' (Yolo Mode)'));
    console.log(chalk.cyan('  figma-ds-cli connect --safe') + chalk.gray(' (Safe Mode)\n'));
    process.exit(1);
  }
}

// Helper: Check if Figma is patched
function isFigmaPatched() {
  const config = loadConfig();
  return config.patched === true;
}

// Helper: Smart positioning code (returns JS to get next free X position)
function smartPosCode(gap = 100) {
  return `
const children = figma.currentPage.children;
let smartX = 0;
if (children.length > 0) {
  children.forEach(n => { smartX = Math.max(smartX, n.x + n.width); });
  smartX += ${gap};
}
`;
}

// Default action when no command is given
program.action(async () => {
  const config = loadConfig();

  // First time? Run init
  if (!config.patched) {
    showBanner();
    console.log(chalk.white('  Welcome! Let\'s get you set up.\n'));
    console.log(chalk.gray('  This takes about 30 seconds. No API key needed.\n'));

    // Step 1: Check Node version
    console.log(chalk.blue('Step 1/3: ') + 'Checking Node.js...');
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor < 18) {
      console.log(chalk.red(`  ✗ Node.js ${nodeVersion} is too old. Please upgrade to Node 18+`));
      process.exit(1);
    }
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));

    // Step 2: Patch Figma
    console.log(chalk.blue('\nStep 2/3: ') + 'Patching Figma Desktop...');
    if (config.patched) {
      console.log(chalk.green('  ✓ Figma already patched'));
    } else {
      console.log(chalk.gray('  (This allows CLI to connect to Figma)'));
      const spinner = ora('  Patching...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma already patched');
        } else if (patchStatus === false) {
          patchFigma();
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma patched');
        } else {
          // Can't determine - assume it's fine (old Figma version)
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma ready (no patch needed)');
        }
      } catch (error) {
        spinner.fail('Patch failed: ' + error.message);
        if ((error.message.includes('EPERM') || error.message.includes('permission') || error.message.includes('Full Disk Access')) && process.platform === 'darwin') {
          console.log(chalk.yellow('\n  ⚠️  Your Terminal needs "Full Disk Access" permission.\n'));
          console.log(chalk.gray('  1. Open System Settings → Privacy & Security → Full Disk Access'));
          console.log(chalk.gray('  2. Click + and add your Terminal app'));
          console.log(chalk.gray('  3. Quit Terminal completely (Cmd+Q)'));
          console.log(chalk.gray('  4. Reopen Terminal and try again\n'));
        } else if (error.message.includes('EPERM') || error.message.includes('permission')) {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
        }
      }
    }

    // Step 3: Start Figma
    console.log(chalk.blue('\nStep 3/3: ') + 'Starting Figma...');
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 1000));
      startFigma();
      console.log(chalk.green('  ✓ Figma started'));

      // Wait for connection
      const spinner = ora('  Waiting for connection...').start();
      let connected = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        connected = await FigmaClient.isConnected();
        if (connected) break;
      }

      if (connected) {
        spinner.succeed('Connected to Figma');
      } else {
        spinner.warn('Connection pending - open a file in Figma');
      }
    } catch (error) {
      console.log(chalk.yellow('  ! Could not start Figma automatically'));
      console.log(chalk.gray('    Start manually: ' + getManualStartCommand()));
    }

    // Done!
    console.log(chalk.green('\n  ✓ Setup complete!\n'));
    showQuickStart();
    return;
  }

  // Already set up - check connection and show status
  showBanner();

  const connected = await FigmaClient.isConnected();
  if (connected) {
    console.log(chalk.green('  ✓ Connected to Figma\n'));
    try {
      const client = new FigmaClient();
      await client.connect();
      const info = await client.getPageInfo();
      console.log(chalk.gray(`  File: ${client.pageTitle.replace(' – Figma', '')}`));
      console.log(chalk.gray(`  Page: ${info.name}`));
      client.close();
    } catch { }
    console.log();
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

function showQuickStart() {
  console.log(chalk.white('  Quick start:\n'));
  console.log(chalk.gray('    figma-ds-cli tokens preset shadcn') + chalk.white('   — Add design tokens'));
  console.log(chalk.gray('    figma-ds-cli render ') + chalk.white('"<Frame ...>"') + chalk.white('  — Create frames'));
  console.log(chalk.gray('    figma-ds-cli canvas info') + chalk.white('            — Inspect canvas'));
  console.log(chalk.gray('    figma-ds-cli var list') + chalk.white('               — List variables'));
  console.log();
}

// ============ WELCOME BANNER ============

function showBanner() {
  console.log(chalk.cyan(`
  ███████╗██╗ ██████╗ ███╗   ███╗ █████╗       ██████╗ ███████╗       ██████╗██╗     ██╗
  ██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗      ██╔══██╗██╔════╝      ██╔════╝██║     ██║
  █████╗  ██║██║  ███╗██╔████╔██║███████║█████╗██║  ██║███████╗█████╗██║     ██║     ██║
  ██╔══╝  ██║██║   ██║██║╚██╔╝██║██╔══██║╚════╝██║  ██║╚════██║╚════╝██║     ██║     ██║
  ██║     ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║      ██████╔╝███████║      ╚██████╗███████╗██║
  ╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚══════╝       ╚═════╝╚══════╝╚═╝
`));
  console.log(chalk.white(`  Design System CLI for Figma ${chalk.gray('v' + pkg.version)}\n`));
}

// ============ INIT (Interactive Onboarding) ============

program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    showBanner();

    console.log(chalk.white('  Welcome! Let\'s get you set up.\n'));
    console.log(chalk.gray('  This takes about 30 seconds. No API key needed.\n'));

    // Step 1: Check Node version
    console.log(chalk.blue('Step 1/4: ') + 'Checking Node.js...');
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor < 18) {
      console.log(chalk.red(`  ✗ Node.js ${nodeVersion} is too old. Please upgrade to Node 18+`));
      process.exit(1);
    }
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));

    // Step 2: Patch Figma
    console.log(chalk.blue('\nStep 2/3: ') + 'Patching Figma Desktop...');
    const config = loadConfig();
    if (config.patched) {
      console.log(chalk.green('  ✓ Figma already patched'));
    } else {
      console.log(chalk.gray('  (This allows CLI to connect to Figma)'));
      const spinner = ora('  Patching...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma already patched');
        } else if (patchStatus === false) {
          patchFigma();
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma patched');
        } else {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma ready (no patch needed)');
        }
      } catch (error) {
        spinner.fail('Patch failed: ' + error.message);
        if ((error.message.includes('EPERM') || error.message.includes('permission') || error.message.includes('Full Disk Access')) && process.platform === 'darwin') {
          console.log(chalk.yellow('\n  ⚠️  Your Terminal needs "Full Disk Access" permission.\n'));
          console.log(chalk.gray('  1. Open System Settings → Privacy & Security → Full Disk Access'));
          console.log(chalk.gray('  2. Click + and add your Terminal app'));
          console.log(chalk.gray('  3. Quit Terminal completely (Cmd+Q)'));
          console.log(chalk.gray('  4. Reopen Terminal and try again\n'));
        } else if (error.message.includes('EPERM') || error.message.includes('permission')) {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
        }
      }
    }

    // Step 3: Start Figma
    console.log(chalk.blue('\nStep 3/3: ') + 'Starting Figma...');
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 1000));
      startFigma();
      console.log(chalk.green('  ✓ Figma started'));

      // Wait for connection
      const spinner = ora('  Waiting for connection...').start();
      let connected = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        connected = await FigmaClient.isConnected();
        if (connected) break;
      }

      if (connected) {
        spinner.succeed('Connected to Figma');
      } else {
        spinner.warn('Connection pending - open a file in Figma');
      }
    } catch (error) {
      console.log(chalk.yellow('  ! Could not start Figma automatically'));
      console.log(chalk.gray('    Start manually: ' + getManualStartCommand()));
    }

    // Done!
    console.log(chalk.green('\n  ✓ Setup complete!\n'));

    showQuickStart();
  });

// ============ SETUP (alias for init) ============

program
  .command('setup')
  .description('Setup Figma for CLI access (alias for init)')
  .action(async () => {
    // Redirect to init
    execSync('figma-ds-cli init', { stdio: 'inherit' });
  });



// ============ UNPATCH ============

program
  .command('unpatch')
  .description('Restore Figma to original state (removes remote debugging patch)')
  .action(async () => {
    const spinner = ora('Checking Figma patch status...').start();

    try {
      const patchStatus = isPatched();

      if (patchStatus === false) {
        spinner.succeed('Figma is already in original state (not patched)');
        return;
      }

      if (patchStatus === null) {
        spinner.warn('Cannot determine patch status. Figma version may be incompatible.');
        return;
      }

      spinner.text = 'Restoring Figma to original state...';
      unpatchFigma();

      // Update config
      const config = loadConfig();
      config.patched = false;
      saveConfig(config);

      spinner.succeed('Figma restored to original state');
      console.log(chalk.gray('  Remote debugging is now blocked by default.'));
      console.log(chalk.gray('  Run "node src/index.js connect" to re-enable it.'));
    } catch (err) {
      spinner.fail(`Failed to unpatch: ${err.message}`);
    }
  });

// ============ CONNECT ============

program
  .command('connect')
  .description('Connect to Figma Desktop')
  .option('--safe', 'Use Safe Mode (plugin-based, no patching required)')
  .action(async (options) => {
    // Fun welcome message
    console.log(chalk.hex('#FF6B35')('\n  ✨ Hey designer! ') + chalk.white("Don't be afraid of the terminal!"));
    console.log(chalk.hex('#4ECDC4')('  🎨 Happy vibe coding!\n'));

    const config = loadConfig();

    // Safe Mode: Plugin-based connection (no patching, no CDP)
    if (options.safe) {
      console.log(chalk.hex('#4ECDC4')('  🔒 Safe Mode ') + chalk.gray('(plugin-based, no patching required)\n'));

      // Stop any existing daemon
      stopDaemon();

      // Start daemon in plugin mode
      const daemonSpinner = ora('Starting daemon in Safe Mode...').start();
      try {
        startDaemon(true, 'plugin');  // Force restart in plugin mode
        await new Promise(r => setTimeout(r, 1000));
        if (isDaemonRunning()) {
          daemonSpinner.succeed('Daemon running in Safe Mode');
        } else {
          daemonSpinner.fail('Daemon failed to start');
          return;
        }
      } catch (e) {
        daemonSpinner.fail('Daemon failed: ' + e.message);
        return;
      }

      // Show plugin setup instructions
      console.log(chalk.hex('#FF6B35')('\n  ┌─────────────────────────────────────────────────────┐'));
      console.log(chalk.hex('#FF6B35')('  │') + chalk.white.bold('  Setup the FigCli plugin                           ') + chalk.hex('#FF6B35')('│'));
      console.log(chalk.hex('#FF6B35')('  └─────────────────────────────────────────────────────┘\n'));

      console.log(chalk.white.bold('  ONE-TIME SETUP:\n'));
      console.log(chalk.cyan('  1. ') + chalk.white('Open Figma Desktop and any design file'));
      console.log(chalk.cyan('  2. ') + chalk.white('Go to ') + chalk.yellow('Plugins → Development → Import plugin from manifest'));
      console.log(chalk.cyan('  3. ') + chalk.white('Navigate to: ') + chalk.yellow(process.cwd() + '/plugin/manifest.json'));
      console.log(chalk.cyan('  4. ') + chalk.white('Click ') + chalk.yellow('Open') + chalk.white(' — plugin is now installed!\n'));

      console.log(chalk.white.bold('  EACH SESSION:\n'));
      console.log(chalk.cyan('  → ') + chalk.white('In Figma: ') + chalk.yellow('Plugins → Development → FigCli\n'));

      console.log(chalk.gray('  💡 Tip: Right-click plugin → "Add to toolbar" for one-click access\n'));

      // Wait for plugin connection
      const pluginSpinner = ora('Waiting for plugin connection...').start();
      let pluginConnected = false;
      for (let i = 0; i < 30; i++) {  // Wait up to 30 seconds
        await new Promise(r => setTimeout(r, 1000));
        try {
          const healthRes = execSync(`curl -s http://127.0.0.1:${3456}/health`, { encoding: 'utf8' });
          const health = JSON.parse(healthRes);
          if (health.plugin) {
            pluginSpinner.succeed('Plugin connected!');
            console.log(chalk.green('\n  ✓ Ready! Safe Mode active.\n'));
            pluginConnected = true;
            break;
          }
        } catch { }
      }

      if (!pluginConnected) {
        pluginSpinner.warn('Plugin not detected. Start the plugin in Figma to connect.');
      }
      return;
    }

    // Yolo Mode: CDP-based connection (default)
    console.log(chalk.hex('#FF6B35')('  🚀 Yolo Mode ') + chalk.gray('(direct CDP connection)\n'));

    // Patch Figma if needed
    if (!config.patched) {
      const patchSpinner = ora('Setting up Figma connection...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          patchSpinner.succeed('Figma ready');
        } else if (patchStatus === false) {
          patchFigma();
          patchSpinner.succeed('Figma configured');
        } else {
          patchSpinner.succeed('Figma ready');
        }
        config.patched = true;
        saveConfig(config);
      } catch (err) {
        patchSpinner.fail('Setup failed');

        // macOS Full Disk Access needed
        if (process.platform === 'darwin') {
          console.log(chalk.hex('#FF6B35')('\n  ┌─────────────────────────────────────────────────────┐'));
          console.log(chalk.hex('#FF6B35')('  │') + chalk.white.bold('  One-time setup required                           ') + chalk.hex('#FF6B35')('│'));
          console.log(chalk.hex('#FF6B35')('  └─────────────────────────────────────────────────────┘\n'));

          console.log(chalk.white('  Your Terminal needs permission to configure Figma.\n'));

          console.log(chalk.cyan('  Step 1: ') + chalk.white('Open ') + chalk.yellow('System Settings'));
          console.log(chalk.cyan('  Step 2: ') + chalk.white('Go to ') + chalk.yellow('Privacy & Security → Full Disk Access'));
          console.log(chalk.cyan('  Step 3: ') + chalk.white('Click ') + chalk.yellow('+') + chalk.white(' and add ') + chalk.yellow('Terminal'));
          console.log(chalk.cyan('  Step 4: ') + chalk.white('Quit Terminal completely ') + chalk.gray('(Cmd+Q)'));
          console.log(chalk.cyan('  Step 5: ') + chalk.white('Reopen Terminal and try again\n'));

          console.log(chalk.gray('  Or use Safe Mode: ') + chalk.cyan('node src/index.js connect --safe\n'));
        } else {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
          console.log(chalk.gray('  Or use Safe Mode: ') + chalk.cyan('node src/index.js connect --safe\n'));
        }
        return;
      }
    }

    // Stop any existing daemon
    stopDaemon();

    console.log(chalk.blue('Starting Figma...'));
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 500));
    } catch { }

    startFigma();
    console.log(chalk.green('✓ Figma started\n'));

    // Wait and check connection
    const spinner = ora('Waiting for connection...').start();
    let connected = false;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = await figmaUse('status', { silent: true });
      if (result && result.includes('Connected')) {
        spinner.succeed('Connected to Figma');
        console.log(chalk.gray(result.trim()));
        connected = true;
        break;
      }
    }

    if (!connected) {
      spinner.warn('Open a file in Figma to connect');
      return;
    }

    // Start daemon for fast commands (force restart to get fresh connection)
    const daemonSpinner = ora('Starting speed daemon...').start();
    try {
      startDaemon(true, 'auto');  // Auto mode: uses plugin if connected, otherwise CDP
      await new Promise(r => setTimeout(r, 1500));
      if (isDaemonRunning()) {
        daemonSpinner.succeed('Speed daemon running (commands are now 10x faster)');
      } else {
        daemonSpinner.warn('Daemon failed to start, commands will be slower');
      }
    } catch (e) {
      daemonSpinner.warn('Daemon failed: ' + e.message);
    }
  });

// ============ FIGJAM ============

const figjam = program
  .command('figjam')
  .alias('fj')
  .description('FigJam commands (sticky notes, shapes, connectors)');

// Helper: Get FigJam client
async function getFigJamClient(pageTitle) {
  const client = new FigJamClient();
  try {
    const pages = await FigJamClient.listPages();
    if (pages.length === 0) {
      console.log(chalk.red('\n✗ No FigJam pages open\n'));
      console.log(chalk.gray('  Open a FigJam file in Figma Desktop first.\n'));
      process.exit(1);
    }

    const targetPage = pageTitle || pages[0].title;
    await client.connect(targetPage);
    return client;
  } catch (error) {
    console.log(chalk.red('\n✗ ' + error.message + '\n'));
    process.exit(1);
  }
}

figjam
  .command('list')
  .description('List open FigJam pages')
  .action(async () => {
    try {
      const pages = await FigJamClient.listPages();
      if (pages.length === 0) {
        console.log(chalk.yellow('\n  No FigJam pages open\n'));
        return;
      }
      console.log(chalk.cyan('\n  Open FigJam Pages:\n'));
      pages.forEach((p, i) => {
        console.log(chalk.white(`  ${i + 1}. ${p.title}`));
      });
      console.log();
    } catch (error) {
      console.log(chalk.red('\n✗ Could not connect to Figma\n'));
      console.log(chalk.gray('  Make sure Figma is running with: figma-ds-cli connect\n'));
    }
  });

figjam
  .command('info')
  .description('Show current FigJam page info')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (options) => {
    const client = await getFigJamClient(options.page);
    try {
      const info = await client.getPageInfo();
      console.log(chalk.cyan('\n  FigJam Page Info:\n'));
      console.log(chalk.white(`  Name: ${info.name}`));
      console.log(chalk.white(`  ID: ${info.id}`));
      console.log(chalk.white(`  Elements: ${info.childCount}`));
      console.log();
    } finally {
      client.close();
    }
  });

figjam
  .command('nodes')
  .description('List nodes on current FigJam page')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-l, --limit <n>', 'Limit number of nodes', '20')
  .action(async (options) => {
    const client = await getFigJamClient(options.page);
    try {
      const nodes = await client.listNodes(parseInt(options.limit));
      if (nodes.length === 0) {
        console.log(chalk.yellow('\n  No elements on this page\n'));
        return;
      }
      console.log(chalk.cyan('\n  FigJam Elements:\n'));
      nodes.forEach(n => {
        const type = n.type.padEnd(16);
        const name = (n.name || '(unnamed)').substring(0, 30);
        console.log(chalk.gray(`  ${n.id.padEnd(8)}`), chalk.white(type), chalk.gray(name), chalk.gray(`(${n.x}, ${n.y})`));
      });
      console.log();
    } finally {
      client.close();
    }
  });

figjam
  .command('sticky <text>')
  .description('Create a sticky note')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-c, --color <hex>', 'Background color')
  .action(async (text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating sticky note...').start();
    try {
      const result = await client.createSticky(text, parseFloat(options.x), parseFloat(options.y), options.color);
      spinner.succeed(`Sticky created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create sticky: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('shape <text>')
  .description('Create a shape with text')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-w, --width <n>', 'Width', '200')
  .option('-h, --height <n>', 'Height', '100')
  .option('-t, --type <type>', 'Shape type (ROUNDED_RECTANGLE, RECTANGLE, ELLIPSE, DIAMOND)', 'ROUNDED_RECTANGLE')
  .action(async (text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating shape...').start();
    try {
      const result = await client.createShape(
        text,
        parseFloat(options.x),
        parseFloat(options.y),
        parseFloat(options.width),
        parseFloat(options.height),
        options.type
      );
      spinner.succeed(`Shape created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create shape: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('text <content>')
  .description('Create a text node')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-s, --size <n>', 'Font size', '16')
  .action(async (content, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating text...').start();
    try {
      const result = await client.createText(content, parseFloat(options.x), parseFloat(options.y), parseFloat(options.size));
      spinner.succeed(`Text created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create text: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('connect <startId> <endId>')
  .description('Create a connector between two nodes')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (startId, endId, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating connector...').start();
    try {
      const result = await client.createConnector(startId, endId);
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Connector created: ${result.id}`);
      }
    } catch (error) {
      spinner.fail('Failed to create connector: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('delete <nodeId>')
  .description('Delete a node by ID')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Deleting node...').start();
    try {
      const result = await client.deleteNode(nodeId);
      if (result.deleted) {
        spinner.succeed(`Node ${nodeId} deleted`);
      } else {
        spinner.fail(result.error || 'Node not found');
      }
    } catch (error) {
      spinner.fail('Failed to delete node: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('move <nodeId> <x> <y>')
  .description('Move a node to a new position')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, x, y, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Moving node...').start();
    try {
      const result = await client.moveNode(nodeId, parseFloat(x), parseFloat(y));
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Node ${result.id} moved to (${result.x}, ${result.y})`);
      }
    } catch (error) {
      spinner.fail('Failed to move node: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('update <nodeId> <text>')
  .description('Update text content of a node')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Updating text...').start();
    try {
      const result = await client.updateText(nodeId, text);
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Node ${result.id} text updated`);
      }
    } catch (error) {
      spinner.fail('Failed to update text: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('eval <code>')
  .description('Execute JavaScript in FigJam context')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (code, options) => {
    const client = await getFigJamClient(options.page);
    try {
      const result = await client.eval(code);
      if (result !== undefined) {
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      }
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    } finally {
      client.close();
    }
  });

// Auto-load capabilities before parsing
(async () => {
  await router.discoverCommands(join(__dirname, 'commands'));
  await router.discoverCommands(join(__dirname, 'capabilities'));
  program.parse();
})();
