import { Command } from '../cli/command.js';
import chalk from 'chalk';

class ComponentCreateSetCommand extends Command {
  name = 'component create-set <name> [ids...]';
  description = 'Combine selected nodes into a Component Set (Variants)';
  needsConnection = true;

  async execute(ctx, options, name, ...ids) {
    // Commander passes `ids` as a flat array when using [ids...]
    // But if called programmatically it might be nested, so flatten & clean
    let targetIds = ids.flat().map(s => String(s).trim()).filter(Boolean);
    if (!targetIds || targetIds.length === 0) {
      const result = await ctx.evalOp('node.selection');
      targetIds = result.map(n => n.id);
    }

    if (!targetIds || targetIds.length === 0) {
      ctx.logError('No nodes selected or IDs provided.');
      return;
    }

    const spinner = ctx.startSpinner(`Creating Component Set "${name}"...`);
    try {
      const result = await ctx.command('component.create_set', { name, childrenIds: targetIds });
      const { data } = result;
      spinner.succeed(`Component Set "${data.name}" created (${data.id}).`);
      if (!ctx.isJson) {
        console.log(chalk.gray('Full Result:'), JSON.stringify(result, null, 2));
      }
    } catch (err) {
      spinner.fail(`Failed to create Component Set: ${err.message}`);
    }
  }
}

class ComponentAddPropCommand extends Command {
  name = 'component add-prop <id> <name> <type> <default>';
  description = 'Add a property definition to a Component Set';
  needsConnection = true;

  async execute(ctx, options, id, name, type, defaultValue) {
    const spinner = ctx.startSpinner(`Adding property "${name}" to component...`);
    try {
      const { data } = await ctx.command('component.add_property', {
        id,
        name,
        type: type.toUpperCase(),
        defaultValue
      });
      spinner.succeed(`Property "${data.propertyName}" added successfully.`);
    } catch (err) {
      spinner.fail(`Failed to add property: ${err.message}`);
    }
  }
}

class ComponentSetPropCommand extends Command {
  name = 'component set-prop <id> <name> <value>';
  description = 'Set a property value for a specific component variant';
  needsConnection = true;

  async execute(ctx, options, id, name, value) {
    const spinner = ctx.startSpinner(`Setting property "${name}=${value}"...`);
    try {
      const { data } = await ctx.command('component.set_property', {
        id,
        propertyName: name,
        value
      });
      spinner.succeed(`Variant renamed to: ${data.name}`);
    } catch (err) {
      spinner.fail(`Failed to set property: ${err.message}`);
    }
  }
}

class ComponentInspectPropCommand extends Command {
  name = 'component inspect <id>';
  description = 'List all properties on a Component Set with internal keys';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Inspecting component properties...');
    try {
      const { data } = await ctx.command('component.inspect', { id });
      spinner.succeed(`Component Set: ${data.name} (${data.id})`);
      if (!ctx.isJson) {
        const entries = Object.entries(data.properties);
        if (entries.length === 0) {
          console.log(chalk.gray('  No properties defined.'));
        } else {
          entries.forEach(([key, def]) => {
            const opts = def.variantOptions ? ` [${def.variantOptions.join(', ')}]` : '';
            console.log(chalk.white(`  • ${chalk.bold(key)} → ${def.type}${opts} (default: ${def.defaultValue})`));
          });
        }
        if (data.variants && data.variants.length > 0) {
          console.log(chalk.cyan('\n  Variants:'));
          data.variants.forEach((v) => {
            console.log(chalk.white(`    • ${chalk.bold(v.id)} — ${v.name}`));
            if (v.componentProperties) {
              const propStrs = Object.entries(v.componentProperties).map(([k, pv]) => `${k}=${pv.value || pv.serializedValue}`);
              console.log(chalk.gray(`      Props: ${propStrs.join(', ')}`));
            }
          });
        }
      }
    } catch (err) {
      spinner.fail(`Failed to inspect component: ${err.message}`);
    }
  }
}

class ComponentUpdateTextCommand extends Command {
  name = 'component update-text <id> <text>';
  description = 'Update empty text nodes across all variants in a Component Set';
  needsConnection = true;

  async execute(ctx, options, id, text) {
    const spinner = ctx.startSpinner('Updating text in all variants...');
    try {
      const { data } = await ctx.command('component.update_text', { id, text });
      spinner.succeed(`Updated ${data.updated} text node(s) across ${data.totalVariants} variants.`);
    } catch (err) {
      spinner.fail(`Failed to update text: ${err.message}`);
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
        newName
      });
      spinner.succeed(`Property renamed to: ${data.propertyName}`);
    } catch (err) {
      spinner.fail(`Failed to rename property: ${err.message}`);
    }
  }
}

class ComponentDeletePropCommand extends Command {
  name = 'component delete-prop <id> <name>';
  description = 'Delete a property from a Component Set';
  needsConnection = true;

  async execute(ctx, options, id, name) {
    const spinner = ctx.startSpinner(`Deleting property "${name}"...`);
    try {
      const { data } = await ctx.command('component.delete_property', { id, name });
      spinner.succeed(`Property "${data.deleted}" deleted.`);
    } catch (err) {
      spinner.fail(`Failed to delete property: ${err.message}`);
    }
  }
}

class ComponentCreateCommand extends Command {
  name = 'component create [id]';
  description = 'Convert a node into a Component';
  needsConnection = true;

  async execute(ctx, options, id) {
    const spinner = ctx.startSpinner('Creating component...');
    try {
      const { data } = await ctx.command('node.to_component', { id });
      spinner.succeed(`Component "${data.name}" created (${data.id}).`);
    } catch (err) {
      spinner.fail(`Failed to create component: ${err.message}`);
    }
  }
}

export default [
  new ComponentCreateCommand(),
  new ComponentCreateSetCommand(),
  new ComponentAddPropCommand(),
  new ComponentSetPropCommand(),
  new ComponentInspectPropCommand(),
  new ComponentUpdateTextCommand(),
  new ComponentEditPropCommand(),
  new ComponentDeletePropCommand()
];
