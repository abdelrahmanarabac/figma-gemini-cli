import { Command } from '../cli/command.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';

class RunCommand extends Command {
  name = 'run <file>';
  description = 'Execute a JavaScript file directly inside the Figma environment';
  needsConnection = true;

  async execute(ctx, options, file) {
    const filePath = resolve(process.cwd(), file);
    
    if (!existsSync(filePath)) {
      ctx.logError(`File not found: ${file}`);
      return;
    }

    const spinner = ora(`Executing script: ${file}...`).start();
    
    try {
      const code = readFileSync(filePath, 'utf8');
      
      // We wrap the code in an async block if it's not already
      const wrappedCode = code.includes('async') ? code : `(async () => { ${code} })()`;
      
      const result = await ctx.eval(wrappedCode);
      
      spinner.succeed(`Script executed successfully.`);
      
      if (result !== undefined) {
        console.log(chalk.gray('\n  Result:'));
        console.log(chalk.white(JSON.stringify(result, null, 2)));
        console.log();
      }
    } catch (err) {
      spinner.fail('Script execution failed');
      ctx.logError(err.message);
    }
  }
}

export default [new RunCommand()];
