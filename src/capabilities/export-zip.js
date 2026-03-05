import { Command } from '../cli/command.js';
import { SafeFileWriter } from '../utils/safe-file-writer.js';
import { createWriteStream } from 'fs';
import { mkdir, readFile, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { createGzip } from 'zlib';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

class ExportZipCommand extends Command {
    name = 'export-zip';
    description = 'Export design system as zip with themes, tokens, and metadata';
    needsConnection = true;
    options = [
        { flags: '-o, --output <dir>', description: 'Output directory', defaultValue: 'dist' },
    ];

    async execute(ctx, opts) {
        const outDir = resolve(opts.output || 'dist');

        // Step 1: Read variables and collections from Figma
        ctx.log('Reading design tokens from Figma...');
        const raw = await ctx.eval(`(async () => {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();

      const cols = collections.map(c => ({
        id: c.id,
        name: c.name,
        modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
        variableIds: c.variableIds
      }));

      const vars = variables.map(v => {
        const values = {};
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (val && typeof val === 'object' && 'r' in val) {
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            values[modeId] = '#' + toHex(val.r) + toHex(val.g) + toHex(val.b);
          } else if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
            values[modeId] = { alias: val.id };
          } else {
            values[modeId] = val;
          }
        }
        return {
          id: v.id,
          name: v.name,
          type: v.resolvedType,
          collectionId: v.variableCollectionId,
          values
        };
      });

      return JSON.stringify({ collections: cols, variables: vars });
    })()`);

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            ctx.logError('Failed to parse Figma response');
            return;
        }

        if (!data.variables || data.variables.length === 0) {
            ctx.logWarning('No variables found in current file');
            return;
        }

        // Step 2: Build JSON files in memory
        const metadata = {
            exportedAt: new Date().toISOString(),
            source: 'figma-ds-cli',
            collections: data.collections.length,
            variables: data.variables.length,
        };

        // Build tokens: group by collection
        const tokens = {};
        for (const v of data.variables) {
            const col = data.collections.find(c => c.id === v.collectionId);
            const colName = col ? col.name : 'unknown';
            if (!tokens[colName]) tokens[colName] = {};
            tokens[colName][v.name] = { type: v.type, values: v.values };
        }

        // Build themes: group by mode
        const themes = {};
        for (const col of data.collections) {
            for (const mode of col.modes) {
                const themeName = `${col.name}/${mode.name}`;
                themes[themeName] = {};
                const colVars = data.variables.filter(v => v.collectionId === col.id);
                for (const v of colVars) {
                    themes[themeName][v.name] = v.values[mode.modeId] ?? null;
                }
            }
        }

        // Step 3: Write via SafeFileWriter
        const writer = new SafeFileWriter(outDir);
        writer.add('themes.json', JSON.stringify(themes, null, 2));
        writer.add('tokens.json', JSON.stringify(tokens, null, 2));
        writer.add('metadata.json', JSON.stringify(metadata, null, 2));

        ctx.log('Writing files to ' + outDir + '...');
        await writer.commit();
        ctx.logSuccess('Created themes.json, tokens.json, metadata.json');

        // Step 4: Create gzipped tar-like archive (single concatenated gzip of JSON bundle)
        // Using a simple self-contained JSON bundle gzip since Node has no built-in zip
        const bundle = JSON.stringify({
            'themes.json': themes,
            'tokens.json': tokens,
            'metadata.json': metadata,
        });
        const zipPath = join(outDir, 'design-system.json.gz');
        await mkdir(outDir, { recursive: true });
        const gzip = createGzip();
        const source = Readable.from([bundle]);
        const dest = createWriteStream(zipPath);
        await pipeline(source, gzip, dest);

        ctx.logSuccess(`Created ${zipPath}`);
        ctx.logSuccess(`Exported ${data.variables.length} variables from ${data.collections.length} collections`);
    }
}

export default [new ExportZipCommand()];
