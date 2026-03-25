import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class AuditA11yCommand extends Command {
  name = 'audit a11y';
  description = 'Perform a contrast accessibility audit for the current page or entire document';
  needsConnection = true;

  constructor() {
    super();
    this.options = [
      { flags: '--page', description: 'Audit all nodes in the current page' },
      { flags: '--all', description: 'Audit all nodes in the document' }
    ];
  }

  async execute(ctx, options) {
    const spinner = ctx.isInteractive ? ora('Analyzing canvas for A11y failures...').start() : null;
    
    try {
      const scope = options.all ? 'all' : 'page';
      const code = `
        const scope = ${JSON.stringify(scope)};
        const WHITE = { r: 255, g: 255, b: 255, hex: '#ffffff' };
        
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

        function toHex(value) {
          return Math.round(value).toString(16).padStart(2, '0');
        }

        function isSolidPaint(paint) {
          return !!paint && paint.type === 'SOLID' && !!paint.color;
        }

        function toRgb(color, opacity) {
          const r = Math.round(color.r * 255);
          const g = Math.round(color.g * 255);
          const b = Math.round(color.b * 255);
          return {
            r,
            g,
            b,
            opacity: opacity === undefined ? 1 : opacity,
            hex: '#' + toHex(r) + toHex(g) + toHex(b),
          };
        }

        function getSolidFill(node) {
          if (!node || !('fills' in node)) return null;
          if (!Array.isArray(node.fills)) return null;
          const solid = node.fills.find(paint => paint.visible !== false && isSolidPaint(paint));
          if (!solid) return null;
          return toRgb(solid.color, solid.opacity);
        }

        function getParentBg(node) {
          let parent = node.parent;
          while (parent) {
            const fill = getSolidFill(parent);
            if (fill) return fill;
            parent = parent.parent;
          }
          return WHITE;
        }

        function getThreshold(node) {
          const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 14;
          const fontStyle = node.fontName && node.fontName !== figma.mixed ? String(node.fontName.style || '') : '';
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && /bold/i.test(fontStyle));
          return isLargeText ? 3 : 4.5;
        }

        const roots = scope === 'all' && Array.isArray(figma.root.children) && figma.root.children.length > 0
          ? figma.root.children
          : [figma.currentPage];

        const failures = [];
        let scanned = 0;

        for (const root of roots) {
          if (!root || typeof root.findAll !== 'function') continue;
          const textNodes = root.findAll(node => node.type === 'TEXT');

          for (const textNode of textNodes) {
            scanned++;
            if (!textNode.visible || !textNode.characters) continue;

            const textRgb = getSolidFill(textNode);
            if (!textRgb) continue;

            const bgRgb = getParentBg(textNode);
            const ratio = getContrast(textRgb, bgRgb);
            const threshold = getThreshold(textNode);

            if (ratio < threshold) {
              failures.push({
                id: textNode.id,
                page: root.name || 'Untitled Page',
                name: textNode.name,
                text: textNode.characters,
                ratio: ratio.toFixed(2),
                threshold,
                textColor: textRgb.hex,
                bgHex: bgRgb.hex
              });
            }
          }
        }

        return { scope, scanned, failures };
      `;

      const audit = await ctx.eval(code);
      spinner?.stop();

      const failures = audit?.failures || [];
      const scanned = audit?.scanned || 0;
      const scopeLabel = (audit?.scope || scope) === 'all' ? 'document' : 'current page';
      const payload = {
        scope: audit?.scope || scope,
        scopeLabel,
        scanned,
        failureCount: failures.length,
        failures,
        pass: failures.length === 0,
      };

      if (failures.length > 0) {
        process.exitCode = 1;
        ctx.output(payload, () => {
          ctx.logError(`Found ${failures.length} accessibility failure(s) in the ${scopeLabel}.`);
          console.log('');
          failures.forEach(f => {
            console.log(chalk.red(`  [FAILED] ${chalk.bold(f.name)}`));
            console.log(chalk.gray(`    Page: ${f.page}`));
            console.log(chalk.gray(`    Text: "${f.text.substring(0, 30)}${f.text.length > 30 ? '...' : ''}"`));
            console.log(chalk.gray(`    Ratio: ${f.ratio}:1 (WCAG Target: ${f.threshold}:1)`));
            console.log(chalk.gray(`    Colors: ${f.textColor} on ${f.bgHex}`));
            console.log('');
          });
        });
      } else {
        ctx.output(payload, () => {
          ctx.logSuccess(`Accessibility audit complete for the ${scopeLabel}: scanned ${scanned} text node(s), no contrast failures found.`);
        });
      }
    } catch (err) {
      spinner?.fail('Audit failed');
      ctx.logError(err.message);
    }
  }
}

export default [new AuditA11yCommand()];
