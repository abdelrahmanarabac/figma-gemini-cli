import { Command } from '../cli/command.js';
import chalk from 'chalk';
import ora from 'ora';

class TemplateDashboardCommand extends Command {
    name = 'template dashboard';
    description = 'Generate a dashboard UI template';

    // Commands in this file require a connection to Figma
    needsConnection = true;

    async execute(ctx, opts, type) {
        if (type !== 'dashboard') {
            console.log(chalk.red(`Unknown template: ${type || 'none'}`));
            console.log(chalk.gray('Available templates: dashboard'));
            return;
        }

        const spinner = ora('Creating Dashboard template...').start();

        const components = [
            {
                name: 'Dashboard / Header',
                jsx: `<Frame name="Dashboard / Header" w={345} flex="row" items="center" px={0} py={8} justify="between"> <Frame w={48} h={48} bg="#FFFFFF" rounded={24} flex="row" justify="center" items="center" stroke="#E6D0A8" strokeWidth={1}> <Frame w={20} h={20} rounded={10} stroke="#4D3612" strokeWidth={2} /> </Frame> <Frame flex="col" items="end" gap={4}> <Text size={12} color="#996D24">صباح الخير</Text> <Text size={18} weight="bold" color="#4D3612">المستخدم</Text> </Frame> </Frame>`,
                bindings: []
            },
            {
                name: 'Dashboard / Hero Card',
                jsx: `<Frame name="Dashboard / Hero Card" w={345} bg="#4D3612" rounded={32} p={28} flex="col" gap={24}> <Frame w={289} flex="row" justify="between" items="center"> <Frame flex="row" items="center" gap={8} bg="#73521B" px={12} py={6} rounded={12}> <Frame w={8} h={8} rounded={4} bg="#BF882D" /> <Text size={12} color="#F2E8D5">ديترويت</Text> </Frame> <Text size={12} color="#E6D0A8">11 شعبان 1447</Text> </Frame> <Frame flex="col" gap={8} items="center" w={289}> <Text size={16} color="#E6D0A8">متبقي على صلاة العصر</Text> <Text size={48} weight="bold" color="#FFFFFF">02:15:43</Text> </Frame> </Frame>`,
                bindings: [{ type: 'fill', var: 'surface/brand' }]
            },
            {
                name: 'Dashboard / Prayer Item',
                jsx: `<Frame name="Dashboard / Prayer Item" w={64} h={80} bg="#FFFFFF" rounded={20} py={16} flex="col" items="center" gap={8}> <Text size={12} color="#996D24">العصر</Text> <Text size={14} weight="bold" color="#4D3612">03:45</Text> </Frame>`,
                bindings: [{ type: 'fill', var: 'surface/card' }]
            },
            {
                name: 'Dashboard / Task Card',
                jsx: `<Frame name="Dashboard / Task Card" w={160} h={120} bg="#FFFFFF" rounded={24} p={16} flex="col" gap={12}> <Frame w={40} h={40} rounded={20} bg="#F9F6F0" flex="row" justify="center" items="center"> <Frame w={16} h={16} rounded={4} stroke="#BF882D" strokeWidth={2} /> </Frame> <Text size={14} weight="bold" color="#4D3612">ورد اليوم</Text> <Text size={12} color="#996D24">سورة الملك</Text> </Frame>`,
                bindings: [{ type: 'fill', var: 'surface/card' }]
            }
        ];

        try {
            let createdCount = 0;
            for (const comp of components) {
                spinner.text = `Creating ${comp.name}...`;

                // Strip unnecessary spaces between JSX tags to avoid 'Invalid node child of type "string"'
                const flatJsx = comp.jsx.replace(/\\r?\\n/g, ' ').replace(/\\s+/g, ' ').replace(/>\\s+</g, '><').trim();

                let result;
                try {
                    // 1. Render frame natively via CDP
                    result = await ctx.render(flatJsx);
                } catch (renderError) {
                    throw new Error(`Render failed for ${comp.name}: ${renderError.message}`);
                }

                if (!result || !result.id) {
                    throw new Error(`Rendered component ${comp.name} successfully but got no node ID.`);
                }

                const nodeId = result.id;

                // 2. Convert to component and bind variables using native Figma eval
                const bindingsJson = JSON.stringify(comp.bindings);
                const code = `(async () => {
                    const node = await figma.getNodeByIdAsync("${nodeId}");
                    if (!node) return "Node not found for ${nodeId}";

                    // Convert to Component
                    const component = figma.createComponent();
                    component.x = node.x;
                    component.y = node.y;
                    component.resize(node.width, node.height);
                    component.name = node.name;
                    component.fills = node.fills;
                    component.strokes = node.strokes;
                    component.strokeWeight = node.strokeWeight;
                    component.cornerRadius = node.cornerRadius;
                    component.clipsContent = node.clipsContent;
                    
                    // Auto-layout properties
                    if (node.layoutMode !== "NONE") {
                        component.layoutMode = node.layoutMode;
                        component.primaryAxisSizingMode = node.primaryAxisSizingMode;
                        component.counterAxisSizingMode = node.counterAxisSizingMode;
                        component.primaryAxisAlignItems = node.primaryAxisAlignItems;
                        component.counterAxisAlignItems = node.counterAxisAlignItems;
                        component.paddingLeft = node.paddingLeft;
                        component.paddingRight = node.paddingRight;
                        component.paddingTop = node.paddingTop;
                        component.paddingBottom = node.paddingBottom;
                        component.itemSpacing = node.itemSpacing;
                    }

                    // Move children
                    while(node.children.length > 0) {
                        component.appendChild(node.children[0]);
                    }

                    // Delete original frame
                    node.remove();
                    
                    // Bind semantic variables
                    const bindings = ${bindingsJson};
                    if (bindings && bindings.length > 0) {
                        const vars = await figma.variables.getLocalVariablesAsync();
                        for (const b of bindings) {
                            // Find variable by name, either exactly or ending with name (e.g. if scoped)
                            const targetVar = vars.find(v => v.name === b.var || v.name.endsWith('/' + b.var));
                            if (targetVar) {
                                if (b.type === 'fill' || b.type === 'fills') {
                                    component.setBoundVariable('fills', targetVar.id);
                                } else if (b.type === 'stroke' || b.type === 'strokes') {
                                    component.setBoundVariable('strokes', targetVar.id);
                                }
                            }
                        }
                    }
                    return "Success";
                })()`;

                let evalResult;
                try {
                    evalResult = await ctx.eval(code);
                } catch (evalError) {
                    throw new Error(`Eval failed for ${comp.name}: ${evalError.message}`);
                }

                if (evalResult !== "Success") {
                    throw new Error(`Failed to convert ${comp.name} to component: ${evalResult}`);
                }

                createdCount++;
            }

            spinner.succeed(`Successfully created ${createdCount} dashboard components`);

        } catch (error) {
            spinner.fail(`Failed to create dashboard template: ${error.message}`);
            ctx.logError(error.message);
            console.error(error.stack);
        }
    }
}

export default [
    new TemplateDashboardCommand()
];
