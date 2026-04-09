import { Command } from '../cli/command.js';
import chalk from 'chalk';
import { sendCommand } from '../transport/bridge.js';
import { join } from 'path';
import { homedir } from 'os';
import { readFileSync, writeFileSync } from 'fs';

const CLIPBOARD_FILE = join(homedir(), '.figma-cli', 'clipboard.json');

function saveClipboard(data) {
  try { writeFileSync(CLIPBOARD_FILE, JSON.stringify(data)); } catch(e) {}
}

function loadClipboard() {
  try { return JSON.parse(readFileSync(CLIPBOARD_FILE, 'utf8')); } catch(e) { return null; }
}

class NodeCopyCommand extends Command {
  name = 'copy <nodeId>';
  description = 'Capture a node for cross-file transfer';
  needsConnection = true;

  async execute(ctx, options, nodeId) {
    const spinner = ctx.startSpinner('Capturing node ' + nodeId + '...');
    try {
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.inspect', { id: nodeId });

      if (!result || !result.data) {
        spinner.fail('Node not found');
        return;
      }

      // Save the full inspect data (includes raw properties)
      saveClipboard(result.data);
      spinner.succeed('Captured "' + (result.data.props.name || 'node') + '" with all properties.');
    } catch (err) {
      spinner.fail('Copy failed');
      ctx.logError(err.message);
    }
  }
}

class NodePasteCommand extends Command {
  name = 'paste';
  description = 'Paste captured node onto active file';
  needsConnection = true;

  async execute(ctx) {
    const clip = loadClipboard();
    if (!clip || !clip.props) {
      console.log(chalk.yellow('\n  Nothing captured. Use "copy <nodeId>" first.\n'));
      return;
    }
    const spinner = ctx.startSpinner('Pasting "' + (clip.props.name || 'node') + '"...');
    try {
      const { sendCommand } = await import('../transport/bridge.js');
      const result = await sendCommand('node.paste', { data: clip });
      if (result.error) {
        spinner.fail(result.error);
        return;
      }
      spinner.succeed('Pasted "' + (result.name || clip.props.name || 'node') + '" to active file.');
    } catch (err) {
      spinner.fail('Paste failed');
      ctx.logError(err.message);
    }
  }
}

function serializeToJSX(node) {
  if (!node) return '';
  const name = (node.name || 'Frame').replace(/[^a-zA-Z0-9_-]/g, '_');
  const type = node.type || 'FRAME';
  const tag = type === 'TEXT' ? 'Text' : type === 'RECTANGLE' ? 'Rectangle' : type === 'ELLIPSE' ? 'Ellipse' : 'Frame';
  const attrs = [];

  if (node.width) attrs.push('w={' + Math.round(node.width) + '}');
  if (node.height) attrs.push('h={' + Math.round(node.height) + '}');
  if (node.x) attrs.push('x={' + Math.round(node.x) + '}');
  if (node.y) attrs.push('y={' + Math.round(node.y) + '}');

  // Auto Layout
  if (node.layoutMode === 'HORIZONTAL') attrs.push("flex={row}");
  if (node.layoutMode === 'VERTICAL') attrs.push("flex={col}");
  if (node.itemSpacing) attrs.push('gap={' + node.itemSpacing + '}');

  // Fills
  if (node.fills && node.fills.length > 0) {
    const solid = node.fills.find(function(f) { return f.type === 'SOLID' && f.color; });
    if (solid) {
      const hex = '#' + Math.round(solid.color.r * 255).toString(16).padStart(2,'0') +
                  Math.round(solid.color.g * 255).toString(16).padStart(2,'0') +
                  Math.round(solid.color.b * 255).toString(16).padStart(2,'0');
      attrs.push("bg={" + hex + "}");
    }
  }

  // Border radius
  if (node.cornerRadius && node.cornerRadius > 0) {
    attrs.push('rounded={' + node.cornerRadius + '}');
  }

  // Padding
  if (node.paddingLeft !== undefined && node.paddingTop !== undefined) {
    if (node.paddingLeft === node.paddingRight && node.paddingLeft === node.paddingTop && node.paddingLeft === node.paddingBottom) {
      if (node.paddingLeft > 0) attrs.push('p={' + node.paddingLeft + '}');
    } else {
      if (node.paddingTop > 0) attrs.push('pt={' + node.paddingTop + '}');
      if (node.paddingBottom > 0) attrs.push('pb={' + node.paddingBottom + '}');
      if (node.paddingLeft > 0) attrs.push('pl={' + node.paddingLeft + '}');
      if (node.paddingRight > 0) attrs.push('pr={' + node.paddingRight + '}');
    }
  }

  // Text properties
  if (tag === 'Text') {
    if (node.fontSize) attrs.push('size={' + node.fontSize + '}');
    if (node.fontName && node.fontName.style) attrs.push("weight={" + node.fontName.style.toLowerCase().replace(' ', '') + "}");
  }

  let content = '';
  if (tag === 'Text' && node.characters) {
    content = node.characters;
  }

  let inner = '';
  if (node.children && node.children.length > 0 && tag !== 'Text') {
    inner = '\n' + node.children.map(function(child) {
      return '  ' + serializeToJSX(child);
    }).join('\n') + '\n';
  }

  return '<' + tag + ' name={' + name + '} ' + attrs.join(' ') + '>' + content + inner + '</' + tag + '>';
}

export default [new NodeCopyCommand(), new NodePasteCommand()];

