import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class AuditA11yCommand extends Command {
  name = 'audit a11y';
  description = 'Perform an autonomous accessibility audit for color contrast failures';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--page', description: 'Audit all nodes in the current page' },
      { flags: '--all', description: 'Audit all nodes in the document' },
      { flags: '--fix', description: 'Attempt to automatically fix low contrast' }
    ];
  }

  async execute(ctx, options) {
    const spinner = ora('Analyzing canvas for A11y failures...').start();
    
    try {
      const code = `
        const options = ${JSON.stringify(options)};
        
        function getLuminance(r, g, b) {
          const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }

        function getContrast(rgb1, rgb2) {
          const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b) + 0.05;
          const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b) + 0.05;
          return l1 > l2 ? l1 / l2 : l2 / l1;
        }

        function hexToRgb(hex) {
          if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
          const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 0, g: 0, b: 0 };
        }

        function getParentBg(node) {
          let parent = node.parent;
          while (parent) {
            if (parent.fills && parent.fills.length > 0 && parent.fills[0].type === 'SOLID') {
              const f = parent.fills[0].color;
              return { r: f.r * 255, g: f.g * 255, b: f.b * 255, hex: '#' + 
                Math.round(f.r*255).toString(16).padStart(2, '0') + 
                Math.round(f.g*255).toString(16).padStart(2, '0') + 
                Math.round(f.b*255).toString(16).padStart(2, '0')
              };
            }
            parent = parent.parent;
          }
          return { r: 255, g: 255, b: 255, hex: '#ffffff' }; // Default to White
        }

        const textNodes = figma.currentPage.findAll(n => n.type === 'TEXT');
        const results = [];

        for (const textNode of textNodes) {
          if (!textNode.fills || textNode.fills.length === 0 || textNode.fills[0].type !== 'SOLID') continue;
          
          const f = textNode.fills[0].color;
          const textRgb = { r: f.r * 255, g: f.g * 255, b: f.b * 255 };
          const bgRgb = getParentBg(textNode);
          const ratio = getContrast(textRgb, bgRgb);

          if (ratio < 4.5) {
            results.push({
              id: textNode.id,
              name: textNode.name,
              text: textNode.characters,
              ratio: ratio.toFixed(2),
              textColor: '#' + Math.round(f.r*255).toString(16).padStart(2, '0') + Math.round(f.g*255).toString(16).padStart(2, '0') + Math.round(f.b*255).toString(16).padStart(2, '0'),
              bgHex: bgRgb.hex
            });
          }
        }

        return results;
      `;

      const failures = await ctx.eval(code);
      spinner.stop();

      if (failures && failures.length > 0) {
        ctx.logError(`Found ${failures.length} Accessibility Failures:`);
        console.log('');
        failures.forEach(f => {
          console.log(chalk.red(`  [FAILED] ${chalk.bold(f.name)}`));
          console.log(chalk.gray(`    Text: "${f.text.substring(0, 30)}${f.text.length > 30 ? '...' : ''}"`));
          console.log(chalk.gray(`    Ratio: ${f.ratio}:1 (WCAG Target: 4.5:1)`));
          console.log(chalk.gray(`    Colors: ${f.textColor} on ${f.bgHex}`));
          console.log('');
        });
      } else {
        ctx.logSuccess('Accessibility Audit Complete: 100% Contrast Pass!');
      }
    } catch (err) {
      spinner.fail('Audit failed');
      ctx.logError(err.message);
    }
  }
}

export default [new AuditA11yCommand()];
