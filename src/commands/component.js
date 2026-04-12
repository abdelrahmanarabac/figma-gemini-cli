import { Command } from '../cli/command.js';
import chalk from 'chalk';

// ── Helpers ──────────────────────────────────────────────────────────────

const VALID_PROP_TYPES = ['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP'];

function isValidPropType(type) {
  return VALID_PROP_TYPES.includes(String(type).toUpperCase());
}

function formatComponentTree(data, indent = 0) {
  const pad = '  '.repeat(indent);
  let lines = [];
  lines.push(chalk.cyan(`${pad}● ${chalk.bold(data.name)}`) + chalk.gray(`  [${data.id}]`));
  if (data.variants && data.variants.length > 0) {
    data.variants.forEach(v => {
      lines.push(chalk.white(`${pad}  ├─ ${v.name}`) + chalk.gray(`  [${v.id}]`));
      if (v.componentProperties) {
        const propStrs = Object.entries(v.componentProperties)
          .map(([k, pv]) => `${k}=${pv.value || pv.serializedValue}`);
        if (propStrs.length > 0) {
          lines.push(chalk.gray(`${pad}  │    Props: ${propStrs.join(', ')}`));
        }
      }
    });
  }
  if (data.properties && Object.keys(data.properties).length > 0) {
    lines.push(chalk.gray(`${pad}  Properties:`));
    Object.entries(data.properties).forEach(([key, def]) => {
      const opts = def.variantOptions ? ` [${def.variantOptions.join(', ')}]` : '';
      lines.push(chalk.gray(`${pad}    • ${key} → ${def.type}${opts} (default: ${def.defaultValue})`));
    });
  }
  return lines.join('\n');
}

// ── Commands ─────────────────────────────────────────────────────────────

class ComponentCreateCommand extends Command {
  name = 'component create [id]';
  description = 'Convert a selected node into a standalone Component';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Creating component...');
    try {
      const result = await ctx.evalOp('node.to_component', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Component "${result.name}" created (${result.id}).`);
      if (!ctx.isJson) {
        console.log(chalk.gray(`  Type: COMPONENT | ID: ${result.id}`));
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to create component: ${err.message}`);
    }
  }
}

class ComponentCreateSetCommand extends Command {
  name = 'component create-set <name> [ids...]';
  description = 'Combine selected nodes into a Component Set (Variants)';
  needsConnection = true;
  options = [
    { flags: '--props <props>', description: 'Property definitions: "Name:Type:Default" or JSON array', defaultValue: undefined },
  ];

  async execute(ctx, options, name, ...ids) {
    let targetIds = ids.flat().map(s => String(s).trim()).filter(Boolean);
    if (targetIds.length === 0) {
      const result = await ctx.evalOp('node.selection');
      targetIds = result.map(n => n.id);
    }

    if (targetIds.length === 0) {
      ctx.logError('No nodes selected or IDs provided.');
      return;
    }

    // Parse --props: "State:VARIANT:Default,Size:VARIANT:Medium" or JSON array
    let properties = [];
    if (options.props) {
      try {
        properties = JSON.parse(options.props);
      } catch {
        properties = options.props.split(',').map(p => {
          const [propName, propType, defaultValue] = p.split(':').map(s => s.trim());
          return { name: propName, type: propType || 'VARIANT', defaultValue };
        }).filter(p => p.name && p.type);
      }
    } else {
      // Auto-detect: use plain names as "State" property values
      properties = [{ name: 'State', type: 'VARIANT' }];
    }

    const spinner = ctx.startSpinner(`Creating Component Set "${name}" from ${targetIds.length} node(s)...`);
    try {
      const result = await ctx.command('component.create_set', { name, childrenIds: targetIds, properties });
      const { data } = result;
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Component Set "${data.name}" created with ${data.variantCount || targetIds.length} variant(s).`);
      if (!ctx.isJson) {
        console.log(chalk.gray(`  ID: ${data.id}`));
        if (data.properties && data.properties.length > 0) {
          console.log(chalk.gray(`  Properties: ${data.properties.join(', ')}`));
        }
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to create Component Set: ${err.message}`);
    }
  }
}

class ComponentInspectPropCommand extends Command {
  name = 'component inspect <id>';
  description = 'List all properties and variants on a Component Set';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Inspecting component properties...');
    try {
      const { data } = await ctx.command('component.inspect', { id });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Component Set: ${data.name} (${data.id})`);

      if (ctx.isJson) {
        ctx.output(data);
        return;
      }

      console.log(formatComponentTree(data));

      if (!data.properties || Object.keys(data.properties).length === 0) {
        console.log(chalk.gray('  No properties defined.'));
      }
      if (!data.variants || data.variants.length === 0) {
        console.log(chalk.gray('  No variants found.'));
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to inspect component: ${err.message}`);
    }
  }
}

class ComponentAddPropCommand extends Command {
  name = 'component add-prop <id> <name> <type> [default]';
  description = 'Add a property definition to a Component Set (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP)';
  needsConnection = true;

  async execute(ctx, options, id, name, type, defaultValue) {
    if (!isValidPropType(type)) {
      ctx.logError(`Invalid type "${type}". Must be one of: ${VALID_PROP_TYPES.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    const spinner = ctx.startSpinner(`Adding property "${name}" (${type})...`);
    try {
      const { data } = await ctx.command('component.add_property', {
        id,
        name,
        type: type.toUpperCase(),
        defaultValue: defaultValue || undefined,
      });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Property "${data.propertyName}" (${type.toUpperCase()}) added successfully.`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to add property: ${err.message}`);
    }
  }
}

class ComponentSetPropCommand extends Command {
  name = 'component set-prop <id> <propertyName> <value>';
  description = 'Set a variant name by assigning a property value (e.g., State=Hover)';
  needsConnection = true;

  async execute(ctx, options, id, propertyName, value) {
    const spinner = ctx.startSpinner(`Setting ${propertyName}=${value}...`);
    try {
      const { data } = await ctx.command('component.set_property', {
        id,
        propertyName,
        value,
      });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Variant updated: ${data.name}`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to set property: ${err.message}`);
    }
  }
}

class ComponentEditPropCommand extends Command {
  name = 'component edit-prop <id> <oldName> <newName>';
  description = 'Rename a property on a Component Set';
  needsConnection = true;

  async execute(ctx, options, id, oldName, newName) {
    const spinner = ctx.startSpinner(`Renaming property "${oldName}" → "${newName}"...`);
    try {
      const { data } = await ctx.command('component.rename_property', {
        id,
        oldName,
        newName,
      });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Property renamed to: ${data.propertyName}`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to rename property: ${err.message}`);
    }
  }
}

class ComponentDeletePropCommand extends Command {
  name = 'component delete-prop <id> <name>';
  description = 'Delete a property from a Component Set (removes from all variant names)';
  needsConnection = true;

  async execute(ctx, options, id, name) {
    const spinner = ctx.startSpinner(`Deleting property "${name}"...`);
    try {
      const { data } = await ctx.command('component.delete_property', { id, name });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Property "${data.deleted}" deleted.`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to delete property: ${err.message}`);
    }
  }
}

class ComponentUpdateTextCommand extends Command {
  name = 'component update-text <id> <text>';
  description = 'Fill empty text nodes across all variants in a Component Set';
  needsConnection = true;

  async execute(ctx, options, id, text) {
    if (!text || text.trim().length === 0) {
      ctx.logError('Text argument cannot be empty.');
      process.exitCode = 1;
      return;
    }

    const spinner = ctx.startSpinner('Updating text in all variants...');
    try {
      const { data } = await ctx.command('component.update_text', { id, text });
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Updated ${data.updated} text node(s) across ${data.totalVariants} variant(s).`);
      if (data.updated === 0) {
        console.log(chalk.yellow('  No empty text nodes found — variants unchanged.'));
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to update text: ${err.message}`);
    }
  }
}

class ComponentListCommand extends Command {
  name = 'component list';
  description = 'List all component sets in the current file';
  needsConnection = true;

  async execute(ctx, options) {
    const spinner = ctx.startSpinner('Scanning component sets...');
    try {
      const inventory = await ctx.evalOp('inventory.scan');
      const componentSets = (inventory.components || []).filter(c => c.type === 'COMPONENT_SET');
      const components = (inventory.components || []).filter(c => c.type === 'COMPONENT');

      if (componentSets.length === 0 && components.length === 0) {
        spinner.warn('No components found in current file.');
        return;
      }

      if (ctx.isJson) {
        ctx.output({ componentSets, standaloneComponents: components });
        return;
      }

      spinner.succeed(`Found ${componentSets.length} set(s), ${components.length} standalone component(s).`);

      if (componentSets.length > 0) {
        console.log(chalk.cyan('\n  Component Sets:'));
        componentSets.forEach(cs => {
          console.log(chalk.white(`    ● ${chalk.bold(cs.name)}`) + chalk.gray(`  [${cs.id}]`));
        });
      }

      if (components.length > 0) {
        console.log(chalk.cyan('\n  Standalone Components:'));
        components.forEach(c => {
          console.log(chalk.white(`    ● ${c.name}`) + chalk.gray(`  [${c.id}]`));
        });
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to list components: ${err.message}`);
    }
  }
}

class ComponentDetachCommand extends Command {
  name = 'component detach <id>';
  description = 'Convert a component or component set back to regular frames';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Detaching component...');
    try {
      const result = await ctx.evalOp('component.detach', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Detached ${result.count} frame(s) from component.`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to detach: ${err.message}`);
    }
  }
}

class ComponentRenameCommand extends Command {
  name = 'component rename <id> <newName>';
  description = 'Rename a component or component set';
  needsConnection = true;

  async execute(ctx, options, id, newName) {
    const spinner = ctx.startSpinner(`Renaming to "${newName}"...`);
    try {
      const result = await ctx.evalOp('node.rename', { id, name: newName });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Renamed to "${result.name}" (${result.id}).`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to rename: ${err.message}`);
    }
  }
}

class ComponentDeleteCommand extends Command {
  name = 'component delete <id>';
  description = 'Delete a component or component set';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Deleting component...');
    try {
      const result = await ctx.evalOp('node.delete', { id });
      if (result.error) throw new Error(result.error);
      spinner.succeed(`Component deleted.`);
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to delete: ${err.message}`);
    }
  }
}

class ComponentFindCommand extends Command {
  name = 'component find <pattern>';
  description = 'Find components by name pattern';
  needsConnection = true;

  async execute(ctx, options, pattern) {
    const spinner = ctx.startSpinner(`Finding components matching "${pattern}"...`);
    try {
      const inventory = await ctx.evalOp('inventory.scan');
      const allComponents = (inventory.components || []);
      const matched = allComponents.filter(c =>
        c.name.toLowerCase().includes(pattern.toLowerCase())
      );

      if (matched.length === 0) {
        spinner.warn(`No components matching "${pattern}".`);
        return;
      }

      spinner.succeed(`Found ${matched.length} component(s) matching "${pattern}".`);

      if (ctx.isJson) {
        ctx.output({ pattern, count: matched.length, components: matched });
        return;
      }

      matched.forEach(c => {
        const type = c.type === 'COMPONENT_SET' ? chalk.magenta('SET ') : chalk.gray('CMP ');
        const count = c.variantCount ? chalk.gray(` (${c.variantCount} variants)`) : '';
        console.log(chalk.white(`  ${type}${c.name}`) + chalk.gray(`  [${c.id}]${count}`));
      });
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to find: ${err.message}`);
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────

class ComponentAddVariantCommand extends Command {
  name = 'component add-variant <id> <variantName> [props...]';
  description = 'Add a variant to a component or component set (auto-creates Component Set if needed)';
  needsConnection = true;

  async execute(ctx, options, id, variantName, ...props) {
    const spinner = ctx.startSpinner(`Adding variant "${variantName}"...`);
    try {
      // First check if target is a component or component set
      const nodeResult = await ctx.command('get', { id });
      const node = nodeResult && nodeResult.data ? nodeResult.data : null;
      const isComponentSet = node && node.type === 'COMPONENT_SET';

      const cmdName = isComponentSet ? 'component.add_variant_to_set' : 'component.add_variant';
      const result = await ctx.command(cmdName, {
        id,
        variantName,
        properties: props.length > 0 ? props.join(',') : undefined,
      });
      const { data } = result;
      if (data.error) throw new Error(data.error);
      spinner.succeed(`Variant "${variantName}" added. "${data.name}" (${data.id})`);
      if (!ctx.isJson) {
        console.log(chalk.gray(`  Variants: ${data.variantCount}`));
        if (data.variants) {
          data.variants.forEach(v => {
            console.log(chalk.gray(`    • ${v.name}`));
          });
        }
      }
    } catch (err) {
      process.exitCode = 1;
      spinner.fail(`Failed to add variant: ${err.message}`);
    }
  }
}

export default [
  new ComponentCreateCommand(),
  new ComponentAddVariantCommand(),
  new ComponentListCommand(),
  new ComponentCreateSetCommand(),
  new ComponentInspectPropCommand(),
  new ComponentAddPropCommand(),
  new ComponentSetPropCommand(),
  new ComponentEditPropCommand(),
  new ComponentDeletePropCommand(),
  new ComponentUpdateTextCommand(),
  new ComponentDetachCommand(),
  new ComponentRenameCommand(),
  new ComponentDeleteCommand(),
  new ComponentFindCommand(),
];
