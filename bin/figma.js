#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Commands
import { connectCommands } from '../src/commands/connect.js';
import { variableCommands } from '../src/commands/variables.js';
import { tokenCommands } from '../src/commands/tokens.js';
import { renderCommands } from '../src/commands/render.js';

// UI
import { showBanner } from '../src/ui/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('figma-ds-cli')
  .description('CLI for managing Figma design systems')
  .version(pkg.version);

// Register commands
connectCommands(program);
variableCommands(program);
tokenCommands(program);
renderCommands(program);

// Default action: show help if no command
if (!process.argv.slice(2).length) {
  showBanner();
  program.outputHelp();
} else {
  program.parse(process.argv);
}
