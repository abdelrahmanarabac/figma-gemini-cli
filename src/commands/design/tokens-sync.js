import { Command } from '../../cli/command.js';
import chalk from 'chalk';
import { checkHealth, sendCommand } from '../../transport/bridge.js';

/**
 * Design Tokens Sync — Figma-to-Figma Direct Sync
 *
 * Transfers design tokens between connected Figma files without local intermediaries.
 * Uses the daemon's multi-file routing to read from source and write to target.
 */

class DesignTokensSyncCommand extends Command {
  name = 'design tokens-sync';
  description = 'Sync design tokens directly between connected Figma files';
  needsConnection = true;
  options = [
    { flags: '--from <fileId|name>', description: 'Source file ID or name (default: current active file)' },
    { flags: '--to <fileId|name>', description: 'Target file ID or name (default: current active file)' },
    { flags: '--collection <name>', description: 'Sync only this collection' },
    { flags: '--dry-run', description: 'Preview what would be synced', defaultValue: false },
    { flags: '--merge', description: 'Merge into existing tokens instead of overwriting', defaultValue: false },
    { flags: '--force', description: 'Overwrite existing tokens without confirmation', defaultValue: false },
  ];

  async execute(ctx, opts) {
    const spinner = ctx.startSpinner('Discovering connected files...');

    try {
      // Get connected files
      const health = await checkHealth();
      const connectedFiles = health.connectedFiles || [];

      if (connectedFiles.length === 0) {
        spinner.fail('No Figma files connected. Open files in Figma and connect via the plugin.');
        return;
      }

      // Resolve source file
      let sourceFile = connectedFiles.find(f => health.activeFile === f.id);
      if (opts.from) {
        sourceFile = connectedFiles.find(f =>
          f.id === opts.from || f.name.toLowerCase() === opts.from.toLowerCase()
        );
        if (!sourceFile) {
          spinner.fail(`Source file "${opts.from}" not found.`);
          return;
        }
      }

      // Resolve target file
      let targetFile = connectedFiles.find(f => health.activeFile === f.id);
      if (opts.to) {
        targetFile = connectedFiles.find(f =>
          f.id === opts.to || f.name.toLowerCase() === opts.to.toLowerCase()
        );
        if (!targetFile) {
          spinner.fail(`Target file "${opts.to}" not found.`);
          return;
        }
      }

      if (sourceFile.id === targetFile.id) {
        spinner.warn('Source and target are the same file. Nothing to sync.');
        return;
      }

      spinner.text = `Reading tokens from "${sourceFile.name}"...`;

      // Switch to source file and wait
      await sendCommand('_switch', { fileId: sourceFile.id });
      await this.waitForSwitch(1500);

      // Read tokens from source
      const sourceTokens = await ctx.evalOp('variables.list');
      const sourceCollections = sourceTokens?.collections || [];
      const sourceVariables = sourceTokens?.variables || [];

      if (sourceVariables.length === 0) {
        spinner.warn(`No tokens found in "${sourceFile.name}".`);
        ctx.log(chalk.gray(`  Debug: collections=${sourceCollections.length}, vars=${sourceVariables.length}`));
        return;
      }

      // Filter by collection if specified
      let collectionsToSync = sourceCollections;
      if (opts.collection) {
        collectionsToSync = sourceCollections.filter(c =>
          c.name.toLowerCase() === opts.collection.toLowerCase() || c.id === opts.collection
        );
        if (collectionsToSync.length === 0) {
          spinner.warn(`Collection "${opts.collection}" not found in source file.`);
          return;
        }
      }

      const varsToSync = sourceVariables.filter(v =>
        collectionsToSync.some(c => c.id === (v.collectionId || v.variableCollectionId))
      );

      if (varsToSync.length === 0) {
        spinner.warn('No variables to sync after filtering.');
        ctx.log(chalk.gray(`  Source vars: ${sourceVariables.length}, Cols to sync: ${collectionsToSync.map(c => c.name).join(', ')}`));
        if (sourceVariables.length > 0) {
          ctx.log(chalk.gray(`  First var collectionId: ${sourceVariables[0].variableCollectionId}`));
          ctx.log(chalk.gray(`  First col ID: ${collectionsToSync[0]?.id}`));
        }
        return;
      }

      // Dry run
      if (opts.dryRun) {
        spinner.stop();
        ctx.log(chalk.cyan(`\n  [DRY RUN] ${sourceFile.name} → ${targetFile.name}\n`));
        ctx.log(chalk.white(`  Collections: ${collectionsToSync.length}`));
        ctx.log(chalk.white(`  Variables:   ${varsToSync.length}\n`));

        for (const col of collectionsToSync) {
          const colVars = varsToSync.filter(v => (v.collectionId || v.variableCollectionId) === col.id);
          ctx.log(chalk.gray(`  📦 ${col.name} (${colVars.length} variables)`));
          for (const v of colVars.slice(0, 5)) {
            const value = this.formatValue(v);
            ctx.log(chalk.gray(`     • ${v.name} = ${value}`));
          }
          if (colVars.length > 5) {
            ctx.log(chalk.gray(`     ... and ${colVars.length - 5} more`));
          }
        }
        ctx.log('');
        return;
      }

      // Confirmation
      if (!opts.force) {
        spinner.stop();
        ctx.log(chalk.yellow(`\n  Sync: ${chalk.bold(sourceFile.name)} → ${chalk.bold(targetFile.name)}`));
        ctx.log(chalk.white(`  Collections: ${collectionsToSync.length} | Variables: ${varsToSync.length}\n`));
      }

      // Switch to target file
      spinner.text = `Switching to "${targetFile.name}"...`;
      await sendCommand('_switch', { fileId: targetFile.id });
      await this.waitForSwitch(1500);

      spinner.text = 'Syncing tokens to target file...';

      // Get existing state in target
      const existing = await ctx.evalOp('variables.list');
      const existingCollections = existing?.collections || [];
      const existingVariables = existing?.variables || [];

      const results = {
        collectionsCreated: 0,
        variablesCreated: 0,
        variablesUpdated: 0,
        variablesSkipped: 0,
        errors: [],
      };

      for (const srcCol of collectionsToSync) {
        // Find or create collection in target
        let targetCol = existingCollections.find(c => c.name === srcCol.name);

        if (!targetCol) {
          if (opts.merge) {
            results.variablesSkipped += varsToSync.filter(v => v.variableCollectionId === srcCol.id).length;
            continue;
          }

          const createResult = await ctx.evalOp('collection.create', { name: srcCol.name });
          if (createResult.success) {
            targetCol = { id: createResult.id, name: srcCol.name };
            results.collectionsCreated++;
          } else {
            results.errors.push({ type: 'collection', name: srcCol.name, error: createResult.error });
            continue;
          }
        }

        // Sync variables
        const srcVars = varsToSync.filter(v => (v.collectionId || v.variableCollectionId) === srcCol.id);

        for (const srcVar of srcVars) {
          const existingVar = existingVariables.find(v =>
            v.name === srcVar.name && (v.collectionId || v.variableCollectionId) === targetCol.id
          );

          if (existingVar) {
            if (opts.merge) {
              results.variablesSkipped++;
              continue;
            }
            results.variablesSkipped++;
          } else {
            // Create new variable
            let value = this.extractPrimaryValue(srcVar);
            let isAlias = this.isAliasValue(srcVar);
            const varType = srcVar.resolvedType || srcVar.type;

            // For aliases: resolve by NAME not ID (IDs differ between files)
            if (isAlias) {
              const aliasVarName = this.getAliasTargetName(srcVar, sourceVariables);
              if (aliasVarName) {
                value = aliasVarName;
              } else {
                isAlias = false;
                value = this.extractPrimaryValue(srcVar);
              }
            } else if (varType === 'COLOR' && value && typeof value === 'object' && 'r' in value) {
              // Convert RGBA object to hex string for the plugin
              value = this.rgbaToHex(value);
            }

            const createResult = await ctx.evalOp('variables.create', {
              name: srcVar.name,
              type: varType,
              value,
              collectionRef: targetCol.id,
              isAlias,
            });

            if (createResult.success) {
              results.variablesCreated++;
            } else {
              results.errors.push({ type: 'variable', name: srcVar.name, error: createResult.error });
            }
          }
        }
      }

      // Summary
      const hasErrors = results.errors.length > 0;

      if (hasErrors) {
        spinner.warn(`Sync completed with ${results.errors.length} error(s)`);
      } else {
        spinner.succeed(`Synced: ${sourceFile.name} → ${targetFile.name}`);
      }

      ctx.log(chalk.cyan('\n  Sync Results:\n'));
      ctx.log(chalk.white(`    Collections created: ${results.collectionsCreated}`));
      ctx.log(chalk.white(`    Variables created:   ${results.variablesCreated}`));
      ctx.log(chalk.white(`    Variables skipped:   ${results.variablesSkipped}`));

      if (results.errors.length > 0) {
        ctx.log(chalk.red(`\n  Errors (${results.errors.length}):\n`));
        for (const err of results.errors) {
          ctx.log(chalk.red(`    • [${err.type}] ${err.name}: ${err.error}`));
        }
      }

      ctx.log('');
    } catch (err) {
      spinner.fail('Token sync failed');
      ctx.logError(err.message);
    }
  }

  // ── Helpers ──────────────────────────────────────

  /**
   * Wait for daemon to process file switch
   */
  waitForSwitch(ms = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format variable value for display
   */
  formatValue(v) {
    const value = this.extractPrimaryValue(v);
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'object' && value.r !== undefined) {
      return this.rgbaToHex(value);
    }
    if (this.isAliasValue(v)) {
      return '(alias)';
    }
    return String(value);
  }

  /**
   * Get primary value from variable
   */
  extractPrimaryValue(v) {
    const modes = Object.entries(v.valuesByMode || {});
    if (modes.length === 0) return null;
    return modes[0][1];
  }

  /**
   * Check if value is an alias
   */
  isAliasValue(v) {
    const value = this.extractPrimaryValue(v);
    return value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS';
  }

  /**
   * Get alias target variable ID
   */
  getAliasTargetId(v) {
    const value = this.extractPrimaryValue(v);
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      return value.id;
    }
    return null;
  }

  /**
   * Get alias target variable NAME (not ID, since IDs differ between files)
   */
  getAliasTargetName(srcVar, allSourceVars) {
    const value = this.extractPrimaryValue(srcVar);
    if (!value || typeof value !== 'object' || value.type !== 'VARIABLE_ALIAS') return null;
    const targetVar = allSourceVars.find(v => v.id === value.id);
    return targetVar ? targetVar.name : null;
  }

  /**
   * Convert RGBA to hex
   */
  rgbaToHex(rgba) {
    if (!rgba || typeof rgba !== 'object' || !('r' in rgba)) return rgba;
    const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    const hex = `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
    return (rgba.a !== undefined && rgba.a < 1) ? `${hex}${toHex(rgba.a)}` : hex;
  }
}

export default new DesignTokensSyncCommand();
