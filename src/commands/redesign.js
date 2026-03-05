import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';
import { redesign as redesignAI } from '../core/aiClient.js';

export class RedesignCommand extends Command {
    name = 'redesign <prompt...>';
    description = 'Generates an alternative design using AI next to the selected frame';

    async execute(ctx, opts, ...promptParts) {
        const prompt = promptParts.flat().join(' ');
        console.log(chalk.blue('Redesigning:'), prompt);

        // 1. Extract context from selected frame
        const getContextCode = `(async () => {
            const selection = figma.currentPage.selection;
            if (selection.length !== 1) {
                return { error: 'Please select exactly one frame to redesign.' };
            }
            const node = selection[0];
            return {
                id: node.id,
                name: node.name,
                x: node.x,
                y: node.y,
                width: Math.round(node.width),
                height: Math.round(node.height)
            };
        })()`;

        try {
            const context = await ctx.eval(getContextCode);

            if (context.error) {
                ctx.logError(context.error);
                return;
            }

            console.log(chalk.gray(`Source: ${context.name} (${context.width}x${context.height})`));

            // 2. Generate redesign via AI
            const spinner = ora('AI is generating alternative design...').start();
            let jsx;
            try {
                jsx = await redesignAI(context, prompt);
                spinner.succeed('Design generated');
            } catch (err) {
                spinner.fail('AI generation failed: ' + err.message);
                return;
            }

            console.log(chalk.gray('--- Generated JSX ---'));
            console.log(chalk.gray(jsx));
            console.log(chalk.gray('---------------------'));

            // 3. Render new frame on canvas
            const renderSpinner = ora('Rendering on canvas...').start();
            try {
                const result = await ctx.render(jsx);
                const newId = result && (Array.isArray(result) ? result[0] : (result.id || result));

                if (newId) {
                    // 4. Position right of original
                    await ctx.eval(`(async () => {
                        const original = figma.getNodeById('${context.id}');
                        const newNode = figma.getNodeById('${newId}');
                        if (original && newNode) {
                            newNode.x = original.x + original.width + 200;
                            newNode.y = original.y;
                            if (original.parent && original.parent.type !== 'DOCUMENT') {
                                original.parent.appendChild(newNode);
                                newNode.x = original.x + original.width + 200;
                                newNode.y = original.y;
                            }
                            figma.currentPage.selection = [newNode];
                            figma.viewport.scrollAndZoomIntoView([original, newNode]);
                        }
                        return true;
                    })()`);
                    renderSpinner.succeed('Redesign added to canvas!');
                } else {
                    renderSpinner.fail('Failed to render generated design');
                }
            } catch (err) {
                renderSpinner.fail('Figma render failed: ' + err.message);
            }
        } catch (e) {
            ctx.logError('Failed to communicate with Figma: ' + e.message);
        }
    }
}

export default new RedesignCommand();
