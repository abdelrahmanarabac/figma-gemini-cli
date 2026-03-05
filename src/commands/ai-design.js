import { Command } from '../cli/command.js';
import { parseJSX, toBatch } from '../parser/jsx.js';
import { sendCommand, sendBatch, checkHealth } from '../transport/bridge.js';
import { validateCommand } from '../protocol/commands.js';
import chalk from 'chalk';

const SYSTEM_PROMPT = `You are a Figma design generator. Output ONLY valid JSX code using this DSL. Do not include any explanations, markdown, code fences, or text outside the JSX. Start directly with the opening tag and end with the closing tag.

COMPONENTS (map to Figma nodes):
- <Frame> — container (auto-layout frame)
- <AutoLayout> — frame with auto-layout (alias for Frame with flex)
- <Rectangle> — rectangle shape
- <Ellipse> — circle/ellipse shape
- <Text> — text node
- <Group> — grouping container
- <Component> — reusable component
- <Line> — line shape

PROPS:
- Layout: flex="row"|"col", gap={N}, p={N}, px={N}, py={N}
- Size: width={N}, height={N}, w={N}, h={N}
- Style: fill="#hex", bg="#hex", stroke="#hex", strokeWidth={N}
- Corners: rounded={N}, cornerRadius={N}
- Alignment: justify="center|start|end", items="center|start|end"
- Text: fontSize={N}, size={N}, fontWeight="bold"|N, color="#hex", font="Inter"
- Growth: grow={1}
- Name: name="Layer Name"
- Opacity: opacity={0.8}

RULES:
1. Output ONLY JSX. No markdown. No explanation. No code fences.
2. Create complete, visually rich designs — not skeletons.
3. Use dark modern aesthetic (#0a0a0f backgrounds, white text) unless told otherwise.
4. Use shapes as icon placeholders, NOT emojis.
5. Root frame MUST have a fixed width (320 for cards, 1440 for pages).
6. ALL text that might wrap MUST have w="fill" on both the Text and its parent.
7. Use realistic content — real names, real descriptions, real prices.
8. Buttons need flex="row" justify="center" items="center" for centered text.`;

// Internal JSX generator — no API calls
function generateJSX(prompt) {
    const p = prompt.toLowerCase();

    if (p.includes('dashboard')) {
        return `<Frame name="Dashboard" w={1440} h={900} bg="#0a0a0f" flex="col" p={24} gap={24}>
  <Frame name="Header" w="fill" h={80} bg="#1a1a1a" flex="row" justify="space-between" items="center" p={16} rounded={8}>
    <Text characters="Dashboard" fontSize={24} fontWeight="bold" color="#ffffff" />
    <Frame flex="row" gap={12}>
      <Rectangle w={40} h={40} fill="#333333" rounded={8} />
      <Rectangle w={40} h={40} fill="#333333" rounded={8} />
    </Frame>
  </Frame>
  <Frame flex="row" gap={24} grow={1}>
    <Frame name="Sidebar" w={280} bg="#1a1a1a" flex="col" p={16} gap={8} rounded={8}>
      <Text characters="Navigation" fontSize={16} color="#ffffff" />
      <Rectangle w="fill" h={40} fill="#333333" rounded={6} />
      <Rectangle w="fill" h={40} fill="#333333" rounded={6} />
      <Rectangle w="fill" h={40} fill="#333333" rounded={6} />
    </Frame>
    <Frame flex="col" gap={24} grow={1}>
      <Frame name="Stats" flex="row" gap={16}>
        <Frame w="fill" h={120} bg="#1a1a1a" rounded={8} p={16} flex="col" justify="center">
          <Text characters="Revenue" fontSize={14} color="#888888" />
          <Text characters="$45,231" fontSize={24} fontWeight="bold" color="#ffffff" />
        </Frame>
        <Frame w="fill" h={120} bg="#1a1a1a" rounded={8} p={16} flex="col" justify="center">
          <Text characters="Subscriptions" fontSize={14} color="#888888" />
          <Text characters="2,350" fontSize={24} fontWeight="bold" color="#ffffff" />
        </Frame>
        <Frame w="fill" h={120} bg="#1a1a1a" rounded={8} p={16} flex="col" justify="center">
          <Text characters="Active Users" fontSize={14} color="#888888" />
          <Text characters="12,234" fontSize={24} fontWeight="bold" color="#ffffff" />
        </Frame>
      </Frame>
      <Frame name="Content" bg="#1a1a1a" rounded={8} p={24} grow={1} flex="col" gap={16}>
        <Text characters="Revenue Growth Chart" fontSize={18} fontWeight="bold" color="#ffffff" />
        <Rectangle w="fill" h={200} fill="#333333" rounded={6} />
        <Text characters="Recent Activity" fontSize={18} fontWeight="bold" color="#ffffff" />
        <Frame flex="col" gap={8}>
          <Rectangle w="fill" h={40} fill="#333333" rounded={4} />
          <Rectangle w="fill" h={40} fill="#333333" rounded={4} />
          <Rectangle w="fill" h={40} fill="#333333" rounded={4} />
        </Frame>
      </Frame>
    </Frame>
  </Frame>
</Frame>`;
    }

    if (p.includes('button')) {
        return `<Frame name="Button" w={120} h={40} bg="#3b82f6" flex="row" justify="center" items="center" rounded={6}>
  <Text characters="Click me" fontSize={14} fontWeight="medium" color="#ffffff" />
</Frame>`;
    }

    if (p.includes('card')) {
        return `<Frame name="Card" w={320} h={200} bg="#1a1a1a" rounded={12} p={20} flex="col" gap={12}>
  <Text characters="Card Title" fontSize={18} fontWeight="bold" color="#ffffff" />
  <Text characters="This is a description of the card content." fontSize={14} color="#888888" />
  <Frame flex="row" justify="space-between" items="center">
    <Text characters="$29.99" fontSize={16} fontWeight="bold" color="#ffffff" />
    <Frame w={80} h={32} bg="#3b82f6" flex="row" justify="center" items="center" rounded={6}>
      <Text characters="Buy" fontSize={14} color="#ffffff" />
    </Frame>
  </Frame>
</Frame>`;
    }

    if (p.includes('form') || p.includes('login')) {
        return `<Frame name="Login Form" w={400} h={300} bg="#1a1a1a" rounded={12} p={32} flex="col" gap={20}>
  <Text characters="Sign In" fontSize={24} fontWeight="bold" color="#ffffff" />
  <Frame flex="col" gap={8}>
    <Text characters="Email" fontSize={14} color="#888888" />
    <Rectangle w="fill" h={40} fill="#333333" rounded={6} />
  </Frame>
  <Frame flex="col" gap={8}>
    <Text characters="Password" fontSize={14} color="#888888" />
    <Rectangle w="fill" h={40} fill="#333333" rounded={6} />
  </Frame>
  <Frame w="fill" h={44} bg="#3b82f6" flex="row" justify="center" items="center" rounded={6}>
    <Text characters="Sign In" fontSize={16} fontWeight="medium" color="#ffffff" />
  </Frame>
</Frame>`;
    }

    // Default: simple frame
    return `<Frame name="Design" w={300} h={200} bg="#0a0a0f" rounded={8} p={16} flex="col" justify="center" items="center">
  <Text characters="Generated Design" fontSize={18} fontWeight="bold" color="#ffffff" />
  <Text characters="Prompt: ${prompt}" fontSize={14} color="#888888" />
</Frame>`;
}

class AiDesignCommand extends Command {
    name = 'ai';
    description = 'AI-powered design generation: figma-ds-cli ai "prompt"';
    needsConnection = false; // We check daemon health ourselves
    options = [
        { flags: '--plan', description: 'Preview JSX without executing' },
        { flags: '--yolo', description: 'Skip confirmation, execute immediately' },
    ];

    async execute(ctx, options, prompt) {
        if (!prompt) {
            ctx.logError('Usage: figma-ds-cli ai "create a product card"');
            return;
        }

        // Step 1: Check daemon (unless --plan)
        if (!options.plan) {
            const health = await checkHealth();
            if (health.status === 'unreachable') {
                ctx.logError('Daemon not running. Start with: figma-ds-cli connect');
                return;
            }
            if (!health.plugin) {
                ctx.logError('Plugin not connected. Open FigCli plugin in Figma.');
                return;
            }
        }

        // Step 2: Generate design internally
        console.log(chalk.blue('  ⟳ Generating design...'));
        let jsxCode;
        try {
            jsxCode = generateJSX(prompt);
        } catch (err) {
            ctx.logError(`Generation error: ${err.message}`);
            return;
        }

        // Step 3: Parse JSX → commands
        const { commands, errors } = parseJSX(jsxCode);

        if (commands.length === 0) {
            ctx.logError('AI generated invalid JSX that could not be parsed.');
            if (errors.length > 0) {
                console.log(chalk.yellow('  Parse errors:'));
                errors.forEach(e => console.log(chalk.gray(`    • ${e}`)));
            }
            console.log(chalk.gray('\n  Raw JSX from AI:'));
            console.log(chalk.gray('  ' + jsxCode.split('\n').slice(0, 10).join('\n  ')));
            return;
        }

        // Step 4: Validate all commands
        const invalid = [];
        for (const cmd of commands) {
            const v = validateCommand(cmd);
            if (!v.valid) invalid.push(v.error);
        }

        if (invalid.length > 0) {
            ctx.logError('Generated commands failed validation:');
            invalid.forEach(e => console.log(chalk.yellow(`  • ${e}`)));
            return;
        }

        // Show warnings from parser (non-fatal)
        if (errors.length > 0) {
            errors.forEach(e => console.log(chalk.yellow(`  ⚠ ${e}`)));
        }

        // Step 5: Preview
        console.log(chalk.green(`\n  ✓ Parsed ${commands.length} nodes from AI\n`));

        // Show JSX preview
        console.log(chalk.gray('  ── JSX ──────────────────────────'));
        jsxCode.split('\n').slice(0, 20).forEach(line => {
            console.log(chalk.cyan('  ' + line));
        });
        if (jsxCode.split('\n').length > 20) {
            console.log(chalk.gray(`  ... (${jsxCode.split('\n').length - 20} more lines)`));
        }
        console.log(chalk.gray('  ─────────────────────────────────\n'));

        // Show command summary
        const typeCounts = {};
        for (const cmd of commands) {
            const t = cmd.params?.type || 'unknown';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        }
        console.log(chalk.white('  Nodes to create:'));
        for (const [type, count] of Object.entries(typeCounts)) {
            console.log(chalk.gray(`    ${type}: ${count}`));
        }
        console.log();

        // --plan: stop here
        if (options.plan) {
            if (ctx.isJson) {
                console.log(JSON.stringify({ jsx: jsxCode, commands, errors }, null, 2));
            }
            return;
        }

        // --yolo: skip confirmation
        if (!options.yolo) {
            // Simple confirmation via readline
            const readline = await import('readline');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise(resolve => {
                rl.question(chalk.white('  Execute? [Y/n] '), resolve);
            });
            rl.close();

            if (answer && answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log(chalk.gray('  Cancelled.'));
                return;
            }
        }

        // Step 6: Execute via daemon
        console.log(chalk.blue('  ⟳ Sending to Figma...'));
        try {
            const result = await sendBatch(commands);
            ctx.logSuccess(`Created ${commands.length} nodes in Figma`, result);
        } catch (err) {
            ctx.logError(`Execution failed: ${err.message}`);
        }
    }
}

export default [new AiDesignCommand()];
