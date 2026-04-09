import { Command } from '../cli/command.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

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

    const spinner = ctx.startSpinner(`Executing script: ${file}...`);
    
    try {
      const code = readFileSync(filePath, 'utf8');
      const wrappedCode = code.includes('async') ? code : `(async () => { ${code} })()`;

      const result = await ctx.evalOp('script.run', { code: wrappedCode });
      if (result && result.error) {
        process.exitCode = 1;
        spinner.fail('Script execution failed', {
          file,
          filePath,
          executed: false,
          error: result.error,
        });
        return;
      }
      const payload = {
        file,
        filePath,
        executed: true,
        result: result ?? null,
      };

      if (ctx.isJson) {
        ctx.logSuccess('Script executed successfully.', payload);
      } else {
        spinner.succeed('Script executed successfully.');
      }

      if (result !== undefined) {
        if (!ctx.isJson) {
          console.log(chalk.gray('\n  Result:'));
          console.log(chalk.white(JSON.stringify(result, null, 2)));
          console.log();
        }
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail('Script execution failed', {
        file,
        filePath,
        executed: false,
        error: err.message,
      });
    }
  }
}

export default [new RunCommand()];
