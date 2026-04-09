import { Command } from '../cli/command.js';
import { existsSync } from 'fs';
import { mkdir, writeFile, copyFile, rename, rm, stat } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';

/* ──────────────────────────────────────────────
   SafeFileWriter — atomic file writes with rollback
   ────────────────────────────────────────────── */
class SafeFileWriter {
    constructor(rootDir) {
        this.rootDir = resolve(rootDir);
        this.tmpDir = join(this.rootDir, '.tmp');
        this.backupDir = join(this.rootDir, '.backup');
        this.staged = new Map();
        this.backedUp = [];
    }

    add(filePath, content) {
        const resolved = resolve(this.rootDir, filePath);
        this.staged.set(resolved, content);
    }

    async commit() {
        if (this.staged.size === 0) return;
        try {
            await mkdir(this.tmpDir, { recursive: true });
            await mkdir(this.backupDir, { recursive: true });

            for (const filePath of this.staged.keys()) {
                if (existsSync(filePath)) {
                    const rel = relative(this.rootDir, filePath);
                    const backupPath = join(this.backupDir, rel);
                    await mkdir(dirname(backupPath), { recursive: true });
                    await copyFile(filePath, backupPath);
                    this.backedUp.push({ original: filePath, backup: backupPath });
                }
            }

            const tmpFiles = [];
            for (const [filePath, content] of this.staged) {
                const rel = relative(this.rootDir, filePath);
                const tmpPath = join(this.tmpDir, rel);
                await mkdir(dirname(tmpPath), { recursive: true });
                await writeFile(tmpPath, content, typeof content === 'string' ? 'utf8' : undefined);
                tmpFiles.push({ tmpPath, finalPath: filePath });
            }

            for (const { tmpPath } of tmpFiles) {
                const s = await stat(tmpPath);
                if (s.size === 0) throw new Error(`Validation failed: ${tmpPath} is empty`);
            }

            for (const { tmpPath, finalPath } of tmpFiles) {
                await mkdir(dirname(finalPath), { recursive: true });
                try { await rename(tmpPath, finalPath); } catch { await copyFile(tmpPath, finalPath); await rm(tmpPath); }
            }

            await rm(this.tmpDir, { recursive: true, force: true });
            this.staged.clear();
        } catch (err) {
            await this.rollback();
            throw err;
        }
    }

    async rollback() {
        for (const { original, backup } of this.backedUp) {
            try { await mkdir(dirname(original), { recursive: true }); await copyFile(backup, original); } catch { /* best effort */ }
        }
        await rm(this.tmpDir, { recursive: true, force: true }).catch(() => { });
        await rm(this.backupDir, { recursive: true, force: true }).catch(() => { });
        this.backedUp = [];
        this.staged.clear();
    }
}

/* ──────────────────────────────────────────────
   Value Resolution Helpers
   ────────────────────────────────────────────── */

function toHex(n) { return Math.round(n * 255).toString(16).padStart(2, '0'); }

function rgbaToHex(r, g, b, a = 1) {
    const hex = toHex(r) + toHex(g) + toHex(b);
    return a < 1 ? `#${hex}${toHex(a)}` : `#${hex}`;
}

/**
 * Get the primary value from a variable (first mode's value).
 * Also resolves aliases by following VARIABLE_ALIAS references.
 */
function getPrimaryValue(v, variables, depth = 0) {
    if (depth > 10) return null;
    const modes = Object.entries(v.valuesByMode || {});
    if (modes.length === 0) return null;
    let value = modes[0][1];

    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
        const target = variables.find(x => x.id === value.id);
        if (target) return getPrimaryValue(target, variables, depth + 1);
        return null;
    }

    return value;
}

/**
 * Get the alias target variable name for a variable (if it's an alias).
 */
function getAliasTarget(v, variables) {
    const modes = Object.entries(v.valuesByMode || {});
    if (modes.length === 0) return null;
    const value = modes[0][1];
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
        return variables.find(x => x.id === value.id);
    }
    return null;
}

/* ──────────────────────────────────────────────
   Format Generators
   ────────────────────────────────────────────── */

function formatJSON(data) {
    return JSON.stringify(data, null, 2);
}

/**
 * W3C Design Tokens Community Group (DTCG) format
 * https://design-tokens.github.io/community-group/format/
 */
function generateW3CDTCG(data) {
    const { collections, variables, modes } = data;

    const groups = {};
    for (const v of variables) {
        const parts = v.name.split('/');
        let target = groups;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i].replace(/[^a-zA-Z0-9]/g, '_');
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        const tokenName = parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, '_');

        const modeEntries = Object.entries(v.valuesByMode || {});
        let value = modeEntries.length > 0 ? modeEntries[0][1] : undefined;

        const token = { $type: v.type.toLowerCase() };

        if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
            const aliasTarget = variables.find(x => x.id === value.id);
            if (aliasTarget) {
                token.$value = `{${aliasTarget.name.replace(/\//g, '.')}}`;
            }
        } else if (typeof value === 'object' && value !== null && 'r' in value) {
            token.$value = rgbaToHex(value.r, value.g, value.b, value.a);
        } else if (typeof value === 'number') {
            token.$value = value;
        } else {
            token.$value = value;
        }

        // Per-mode values
        if (modeEntries.length > 1) {
            token.$extensions = { 'mode': {} };
            for (const [modeId, mv] of modeEntries.slice(1)) {
                const modeName = modes?.find(m => m.modeId === modeId)?.name || modeId;
                if (typeof mv === 'object' && mv !== null && 'r' in mv) {
                    token.$extensions.mode[modeName] = rgbaToHex(mv.r, mv.g, mv.b, mv.a);
                } else if (typeof mv === 'object' && mv.type === 'VARIABLE_ALIAS') {
                    const aliasVar = variables.find(x => x.id === mv.id);
                    token.$extensions.mode[modeName] = aliasVar ? `{${aliasVar.name.replace(/\//g, '.')}}` : mv.id;
                } else {
                    token.$extensions.mode[modeName] = mv;
                }
            }
        }

        target[tokenName] = token;
    }

    return {
        $schema: 'https://raw.githubusercontent.com/design-tokens/community-group/main/schema.json',
        comment: 'Generated by figma-gemini-cli — W3C DTCG format',
        ...groups
    };
}

/**
 * CSS Custom Properties
 */
function generateCSS(data) {
    const { variables } = data;
    const lines = [
        '/**',
        ' * Design Tokens — CSS Custom Properties',
        ' * Generated by figma-gemini-cli',
        ' */',
        '',
        ':root {'
    ];

    for (const v of variables) {
        const propName = `--${v.name.replace(/\//g, '-')}`;
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        let cssValue;
        const aliasTarget = getAliasTarget(v, variables);
        if (aliasTarget) {
            cssValue = `var(--${aliasTarget.name.replace(/\//g, '-')})`;
        } else if (typeof value === 'object' && value !== null && 'r' in value) {
            cssValue = rgbaToHex(value.r, value.g, value.b, value.a);
        } else if (typeof value === 'number') {
            cssValue = `${value / 16}rem`;
        } else {
            cssValue = String(value);
        }

        lines.push(`  ${propName}: ${cssValue};`);
    }

    lines.push('}');
    return lines.join('\n');
}

/**
 * SCSS Variables
 */
function generateSCSS(data) {
    const { variables } = data;
    const lines = [
        '// Design Tokens — SCSS Variables',
        '// Generated by figma-gemini-cli',
        ''
    ];

    for (const v of variables) {
        const propName = `$${v.name.replace(/\//g, '-')}`;
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        let scssValue;
        const aliasTarget = getAliasTarget(v, variables);
        if (aliasTarget) {
            scssValue = `$${aliasTarget.name.replace(/\//g, '-')}`;
        } else if (typeof value === 'object' && value !== null && 'r' in value) {
            scssValue = rgbaToHex(value.r, value.g, value.b, value.a);
        } else if (typeof value === 'number') {
            scssValue = `${value / 16}rem`;
        } else {
            scssValue = String(value);
        }

        lines.push(`${propName}: ${scssValue};`);
    }

    return lines.join('\n');
}

/**
 * Tailwind Config (tailwind.config.js)
 */
function generateTailwind(data) {
    const { collections, variables } = data;
    const colors = {};
    const spacing = {};
    const borderRadius = {};
    const fontSize = {};

    for (const v of variables) {
        const col = collections.find(c => c.id === v.variableCollectionId);
        const colName = col ? col.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'default';
        const key = v.name.split('/').pop().replace(/[^a-zA-Z0-9]/g, '-');

        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        if (colName.includes('color') || (typeof value === 'object' && value !== null && 'r' in value)) {
            const colorGroup = colors[colName] || {};
            if (typeof value === 'object' && 'r' in value) {
                colorGroup[key] = rgbaToHex(value.r, value.g, value.b, value.a);
            }
            colors[colName] = colorGroup;
        } else if (colName.includes('spacing') || colName.includes('space')) {
            if (typeof value === 'number') spacing[key] = `${value}px`;
        } else if (colName.includes('radius') || colName.includes('rounded')) {
            if (typeof value === 'number') borderRadius[key] = `${value}px`;
        } else if (colName.includes('font') || colName.includes('type') || colName.includes('text')) {
            if (typeof value === 'object' && value !== null && 'fontSize' in value) {
                fontSize[key] = { fontSize: `${value.fontSize}px`, lineHeight: value.lineHeightPx ? `${value.lineHeightPx}px` : undefined };
            }
        }
    }

    const parts = [
        '/**',
        ' * Design Tokens — Tailwind CSS Config',
        ' * Generated by figma-gemini-cli',
        ' */',
        '',
        '/** @type {import(\'tailwindcss\').Config} */',
        'module.exports = {'
    ];

    if (Object.keys(colors).length > 0) {
        parts.push('  colors: ' + JSON.stringify(colors, null, 4) + ',');
    }
    if (Object.keys(spacing).length > 0) {
        parts.push('  spacing: ' + JSON.stringify(spacing, null, 4) + ',');
    }
    if (Object.keys(borderRadius).length > 0) {
        parts.push('  borderRadius: ' + JSON.stringify(borderRadius, null, 4) + ',');
    }
    if (Object.keys(fontSize).length > 0) {
        parts.push('  fontSize: ' + JSON.stringify(fontSize, null, 4) + ',');
    }

    parts.push('};');
    return parts.join('\n');
}

/**
 * Tailwind CSS v4 (CSS-based config)
 */
function generateTailwindCSS4(data) {
    const { variables } = data;
    const lines = [
        '/**',
        ' * Design Tokens — Tailwind CSS v4',
        ' * Generated by figma-gemini-cli',
        ' *',
        ' * Import in your CSS: @import "./tokens.css";',
        ' */',
        '',
        '@theme {'
    ];

    for (const v of variables) {
        const propName = `--${v.name.replace(/\//g, '-')}`;
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        let cssValue;
        if (typeof value === 'object' && value !== null && 'r' in value) {
            cssValue = rgbaToHex(value.r, value.g, value.b, value.a);
        } else if (typeof value === 'number') {
            cssValue = `${value}px`;
        } else {
            cssValue = String(value);
        }

        lines.push(`  ${propName}: ${cssValue};`);
    }

    lines.push('}');
    return lines.join('\n');
}

/**
 * TypeScript Definitions
 */
function generateTypeScript(data) {
    const { collections, variables } = data;
    const lines = [
        '/**',
        ' * Design Tokens — TypeScript Definitions',
        ' * Generated by figma-gemini-cli',
        ' */',
        '',
        'export interface DesignTokens {'
    ];

    // Group by collection
    const byCollection = {};
    for (const v of variables) {
        const col = collections.find(c => c.id === v.variableCollectionId);
        const colName = col ? col.name : 'Global';
        if (!byCollection[colName]) byCollection[colName] = [];
        byCollection[colName].push(v);
    }

    for (const [colName, vars] of Object.entries(byCollection)) {
        lines.push(`  ${colName.replace(/[^a-zA-Z0-9]/g, '')}: {`);

        for (const v of vars) {
            let tsType = 'unknown';
            if (v.type === 'COLOR') tsType = 'string';
            else if (v.type === 'FLOAT') tsType = 'number';
            else if (v.type === 'STRING') tsType = 'string';
            else if (v.type === 'BOOLEAN') tsType = 'boolean';

            lines.push(`    '${v.name}': ${tsType};`);
        }

        lines.push('  };');
    }

    lines.push('}');
    lines.push('');
    lines.push('export declare const tokens: DesignTokens;');
    return lines.join('\n');
}

/**
 * JSON (flat key-value, engineering-friendly)
 */
function generateFlatJSON(data) {
    const { variables } = data;
    const result = {};

    for (const v of variables) {
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        if (typeof value === 'object' && value !== null && 'r' in value) {
            result[v.name] = rgbaToHex(value.r, value.g, value.b, value.a);
        } else {
            result[v.name] = value;
        }
    }

    return result;
}

/**
 * Android XML (res/values/colors.xml style)
 */
function generateAndroid(data) {
    const { variables } = data;
    const lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!--',
        '  Design Tokens — Android Resources',
        '  Generated by figma-gemini-cli',
        '  Place in: app/src/main/res/values/tokens.xml',
        '-->',
        '<resources>'
    ];

    for (const v of variables) {
        const nameAttr = v.name.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        if (typeof value === 'object' && value !== null && 'r' in value) {
            const alpha = Math.round((value.a ?? 1) * 255).toString(16).padStart(2, '0');
            const r = Math.round(value.r * 255).toString(16).padStart(2, '0');
            const g = Math.round(value.g * 255).toString(16).padStart(2, '0');
            const b = Math.round(value.b * 255).toString(16).padStart(2, '0');
            const hexVal = `#${alpha}${r}${g}${b}`;

            if ((value.a ?? 1) >= 1) {
                lines.push(`  <color name="${nameAttr}">${hexVal.substring(1)}</color>`);
            } else {
                lines.push(`  <color name="${nameAttr}">${hexVal}</color>`);
            }
        } else if (typeof value === 'number') {
            const dp = Math.round(value);
            lines.push(`  <dimen name="${nameAttr}">${dp}dp</dimen>`);
        }
    }

    lines.push('</resources>');
    return lines.join('\n');
}

/**
 * iOS Swift (SwiftUI Color extensions)
 */
function generateSwiftUI(data) {
    const { variables } = data;
    const lines = [
        '//',
        '// Design Tokens — SwiftUI Colors',
        '// Generated by figma-gemini-cli',
        '//',
        '',
        'import SwiftUI',
        '',
        'extension Color {'
    ];

    for (const v of variables) {
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;
        if (typeof value !== 'object' || value === null || !('r' in value)) continue;

        const propName = v.name.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
        const r = (value.r ?? 0).toFixed(3);
        const g = (value.g ?? 0).toFixed(3);
        const b = (value.b ?? 0).toFixed(3);
        const a = (value.a ?? 1).toFixed(3);

        lines.push(`  static let ${propName} = Color(red: ${r}, green: ${g}, blue: ${b}, opacity: ${a})`);
    }

    lines.push('}');
    return lines.join('\n');
}

/**
 * Flutter Dart (Material color swatches)
 */
function generateFlutter(data) {
    const { collections, variables } = data;
    const lines = [
        '//',
        '// Design Tokens — Flutter Colors',
        '// Generated by figma-gemini-cli',
        '//',
        '',
        'import \'package:flutter/material.dart\';',
        '',
        'class AppColors {'
    ];

    for (const v of variables) {
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;
        if (typeof value !== 'object' || value === null || !('r' in value)) continue;

        const propName = v.name.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
        const r = Math.round(value.r * 255);
        const g = Math.round(value.g * 255);
        const b = Math.round(value.b * 255);
        const a = Math.round((value.a ?? 1) * 255);

        const colorValue = (a < 255)
            ? `Color(0x${a.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')})`
            : `Color(0xFF${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')})`;

        lines.push(`  static const ${propName} = ${colorValue};`);
    }

    lines.push('}');
    return lines.join('\n');
}

/**
 * React Native (JavaScript object with hex values)
 */
function generateReactNative(data) {
    const { variables } = data;
    const colors = {};
    const spacing = {};
    const typography = {};

    for (const v of variables) {
        const value = getPrimaryValue(v, variables);
        if (value === null || value === undefined) continue;

        const parts = v.name.split('/');
        const key = parts.length > 1 ? parts[parts.length - 1] : v.name;

        if (typeof value === 'object' && value !== null && 'r' in value) {
            colors[key] = rgbaToHex(value.r, value.g, value.b, value.a);
        } else if (typeof value === 'number') {
            if (key.match(/font|size|heading|caption|body/i)) {
                typography[key] = value;
            } else {
                spacing[key] = value;
            }
        }
    }

    const lines = [
        '/**',
        ' * Design Tokens — React Native',
        ' * Generated by figma-gemini-cli',
        ' */',
        '',
        'export const colors = ' + JSON.stringify(colors, null, 2) + ';',
        '',
        'export const spacing = ' + JSON.stringify(spacing, null, 2) + ';',
        '',
        'export const typography = ' + JSON.stringify(typography, null, 2) + ';',
        '',
        'export const tokens = { colors, spacing, typography };',
        '',
        'export default tokens;'
    ];

    return lines.join('\n');
}

/* ──────────────────────────────────────────────
   Format Registry
   ────────────────────────────────────────────── */

const FORMAT_REGISTRY = {
    'json': { fn: (d) => formatJSON(generateFlatJSON(d)), ext: 'json', desc: 'Flat JSON key-value pairs' },
    'w3c-dtcg': { fn: generateW3CDTCG, ext: 'json', desc: 'W3C Design Tokens Community Group format' },
    'css': { fn: generateCSS, ext: 'css', desc: 'CSS Custom Properties (:root)' },
    'scss': { fn: generateSCSS, ext: 'scss', desc: 'SCSS Variables ($var-name)' },
    'tailwind': { fn: generateTailwind, ext: 'js', desc: 'Tailwind CSS v3 config (module.exports)' },
    'tailwind-v4': { fn: generateTailwindCSS4, ext: 'css', desc: 'Tailwind CSS v4 @theme block' },
    'typescript': { fn: generateTypeScript, ext: 'ts', desc: 'TypeScript interface definitions' },
    'android': { fn: generateAndroid, ext: 'xml', desc: 'Android XML resources (colors.xml / dimens.xml)' },
    'swiftui': { fn: generateSwiftUI, ext: 'swift', desc: 'SwiftUI Color extensions' },
    'flutter': { fn: generateFlutter, ext: 'dart', desc: 'Flutter Dart color constants' },
    'react-native': { fn: generateReactNative, ext: 'js', desc: 'React Native styles object' },
};

/* ──────────────────────────────────────────────
   Export Command
   ────────────────────────────────────────────── */

class ExportCommand extends Command {
    name = 'export';
    description = 'Export design tokens to multiple formats (JSON, CSS, SCSS, Tailwind, TypeScript, Android, SwiftUI, Flutter, React Native)';
    needsConnection = true;
    options = [
        { flags: '-o, --output <dir>', description: 'Output directory', defaultValue: 'dist' },
        { flags: '-f, --format <format>', description: `Output format: ${Object.keys(FORMAT_REGISTRY).join(', ')}`, defaultValue: 'json' },
        { flags: '--all', description: 'Export to ALL supported formats simultaneously', defaultValue: false },
        { flags: '--collection <name>', description: 'Export only from a specific collection', defaultValue: null },
        { flags: '--list-formats', description: 'List all supported formats and exit', defaultValue: false },
    ];

    async execute(ctx, opts) {
        // List formats mode
        if (opts.listFormats) {
            ctx.log('\n  Supported Export Formats:\n');
            for (const [key, fmt] of Object.entries(FORMAT_REGISTRY)) {
                ctx.log(`    ${key.padEnd(16)} ${fmt.desc}`);
            }
            ctx.log('');
            return;
        }

        const outDir = resolve(opts.output || 'dist');

        // Read variables and collections from Figma
        ctx.log('Reading design tokens from Figma...');
        let data;
        try {
            data = await ctx.evalOp('variables.list');
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
        } catch (err) {
            ctx.logError(`Failed to read variables: ${err.message}`);
            return;
        }

        if (!data.variables || data.variables.length === 0) {
            ctx.logWarning('No variables found in current file');
            return;
        }

        // Filter by collection if specified
        let variables = data.variables;
        let collections = data.collections || [];

        if (opts.collection) {
            const matchedCol = collections.find(c =>
                c.name.toLowerCase() === opts.collection.toLowerCase() ||
                c.id === opts.collection
            );
            if (!matchedCol) {
                ctx.logWarning(`Collection "${opts.collection}" not found. Available: ${collections.map(c => c.name).join(', ') || 'none'}`);
                return;
            }
            variables = variables.filter(v => v.variableCollectionId === matchedCol.id);
            collections = [matchedCol];
        }

        const exportData = {
            collections,
            variables,
            modes: collections.flatMap(c => c.modes || []),
        };

        // Determine which formats to generate
        let formatsToExport = [];
        if (opts.all) {
            formatsToExport = Object.keys(FORMAT_REGISTRY);
        } else {
            const fmt = opts.format || 'json';
            if (!FORMAT_REGISTRY[fmt]) {
                ctx.logError(`Unknown format: "${fmt}". Run with --list-formats to see options.`);
                return;
            }
            formatsToExport = [fmt];
        }

        // Generate and write files
        const writer = new SafeFileWriter(outDir);
        const filesCreated = [];

        for (const fmtKey of formatsToExport) {
            const fmt = FORMAT_REGISTRY[fmtKey];
            try {
                const content = fmt.fn(exportData);
                const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

                const colSuffix = opts.collection ? `-${opts.collection.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : '';
                const fileName = fmtKey === 'json'
                    ? `tokens${colSuffix}.${fmt.ext}`
                    : `tokens-${fmtKey}${colSuffix}.${fmt.ext}`;

                writer.add(fileName, contentStr);
                filesCreated.push(fileName);
            } catch (err) {
                ctx.logWarning(`Failed to generate ${fmtKey}: ${err.message}`);
            }
        }

        if (filesCreated.length === 0) {
            ctx.logError('No files were generated');
            return;
        }

        ctx.log(`Writing ${filesCreated.length} file(s) to ${outDir}...`);
        await writer.commit();

        ctx.logSuccess('Exported design tokens:');
        for (const f of filesCreated) {
            ctx.log(`    ✓ ${f}`);
        }
        ctx.logSuccess(`${variables.length} variables from ${collections.length} collection(s)`);
    }
}

export default [new ExportCommand()];
