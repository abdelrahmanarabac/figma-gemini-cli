import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fastEval, fastRender } from '../utils/figma.js';

export function renderCommands(program) {
  program
    .command('render <jsx>')
    .description('Render JSX to Figma')
    .option('--x <n>', 'X position', parseInt)
    .option('--y <n>', 'Y position', parseInt)
    .action(async (jsx, options) => {
      const spinner = ora('Rendering to Figma...').start();
      try {
        // Use the fastRender utility which handles both daemon and direct connection
        const result = await fastRender(jsx);
        spinner.succeed('Rendered successfully');
        if (result && result.id) {
          console.log(chalk.gray(`  Node ID: ${result.id}`));
          if (result.name) console.log(chalk.gray(`  Name: ${result.name}`));
        }
      } catch (e) {
        spinner.fail('Failed to render: ' + e.message);
      }
    });

  program
    .command('render-batch <json>')
    .description('Render multiple JSX frames at once')
    .action(async (json) => {
      const spinner = ora('Rendering batch...').start();
      try {
        const frames = JSON.parse(json);
        const results = [];
        for (const jsx of frames) {
          const res = await fastRender(jsx);
          results.push(res);
        }
        spinner.succeed(`Rendered ${results.length} frames`);
      } catch (e) {
        spinner.fail('Batch render failed: ' + e.message);
      }
    });
}
