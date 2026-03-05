import chalk from 'chalk';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getApiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error(chalk.red('\n✗ GEMINI_API_KEY not set.\n'));
        console.log(chalk.gray('  Get a free key: https://aistudio.google.com/apikey'));
        console.log(chalk.gray('  Then: set GEMINI_API_KEY=your_key_here\n'));
        process.exit(1);
    }
    return key;
}

async function callGemini(body) {
    const key = getApiKey();
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
}

/**
 * Calls Gemini with function calling to get mutation updates.
 * Returns: { updates: [...] } or throws.
 */
export async function mutate(systemPrompt, designJSX, userPrompt, toolSchema) {
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
            role: 'user',
            parts: [{ text: `Current design:\n${designJSX}\n\nTask: ${userPrompt}` }]
        }],
        tools: [{
            function_declarations: [{
                name: toolSchema.name,
                description: toolSchema.description,
                parameters: toolSchema.parameters
            }]
        }],
        tool_config: { function_calling_config: { mode: 'ANY' } }
    };

    const result = await callGemini(body);
    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Find function call part
    const fnCall = parts.find(p => p.functionCall);
    if (!fnCall) {
        // Check if model returned text (e.g. error message)
        const textPart = parts.find(p => p.text);
        if (textPart) {
            throw new Error('AI could not mutate: ' + textPart.text.slice(0, 200));
        }
        throw new Error('AI returned no function call. Response may be empty.');
    }

    return fnCall.functionCall.args;
}

/**
 * Calls Gemini to generate a redesigned Figma JSX.
 * Returns: JSX string like '<Frame ...>...</Frame>'
 */
export async function redesign(context, userPrompt) {
    const systemPrompt = `You are a Figma design generator. You output Figma JSX that can be rendered.

JSX SYNTAX RULES:
- <Frame> for containers, <Text> for text
- Layout: flex="row" or flex="col", gap={N}, p={N}, px={N}, py={N}
- Size: w={N}, h={N}, w="fill", h="fill"
- Alignment: justify="center|start|end", items="center|start|end"
- Style: bg="#hex", rounded={N}, opacity={N}, stroke="#hex", strokeWidth={N}
- Text: <Text size={N} weight="bold|medium|semibold" color="#hex" w="fill">content</Text>
- Growth: grow={1} to fill remaining space
- ALL text that might wrap MUST have w="fill"
- Parent frames of text MUST have w="fill" or fixed width + flex

RULES:
1. Output ONLY the JSX. No markdown, no explanation, no code fences.
2. Create a complete, visually rich design — not a skeleton.
3. Use dark modern aesthetic by default unless prompted otherwise.
4. Use shapes (small frames) as icon placeholders, NOT emojis.
5. The root frame MUST have a fixed width matching the original context.`;

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
            role: 'user',
            parts: [{
                text: `Original frame: "${context.name}" (${context.width}x${context.height})

Redesign request: ${userPrompt}

Generate a complete alternative Figma JSX design. Output ONLY the JSX, nothing else.`
            }]
        }],
        generationConfig: { temperature: 0.8 }
    };

    const result = await callGemini(body);
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('AI returned empty response for redesign.');
    }

    // Strip markdown code fences if model added them
    return text.replace(/^```(?:jsx|xml|html)?\n?/m, '').replace(/\n?```$/m, '').trim();
}
