import chalk from 'chalk';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(body) {
    const key = process.env.GEMINI_API_KEY;
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
 * Calls Gemini with strict system instruction to generate raw JSX for a design prompt.
 * Returns: raw string from Gemini (must be sanitized before use).
 */
export async function generateDesign(prompt) {
    const systemPrompt = `Role: You are a highly specialized headless UI rendering engine for Figma. Your sole purpose is to translate design requirements into syntactically perfect JSX representing Figma nodes.

Constraints (CRITICAL):
1. ZERO Natural Language: You must NEVER output conversational text, greetings, explanations, or thoughts. No "Here is the code" or "Sure!".
2. ZERO Markdown Formatting: Do NOT wrap your output in markdown code blocks. Output the raw text only.
3. ZERO CLI Commands: Do not output shell or terminal commands.
4. Root Node: Your output MUST always have a single root node, typically <Frame> or <Component>.

JSX DSL:
- <Frame> container, <Text> text, <Rectangle> shape, <Ellipse> circle, <Component> reusable
- <SVG content="<svg>...</svg>"> vector graphic (use for icons)
- Layout: flex="row"|"col", gap={N}, p={N}, px={N}, py={N}
- Size: w={N}, h={N}, w="fill", h="fill"
- Style: bg="#hex", rounded={N}, opacity={N}, stroke="#hex", strokeWidth={N}
- Text: <Text size={N} weight="bold" color="#hex" w="fill">content</Text>
- Alignment: justify="center|start|end", items="center|start|end"
- Growth: grow={1}
- Name: name="Layer Name"

Rules:
1. Output ONLY JSX. Nothing else.
2. Create complete, visually rich designs — not skeletons.
3. Use dark modern aesthetic (#0a0a0f backgrounds, white text) unless told otherwise.
4. Use <SVG> for icons, falling back to shapes only if necessary.
5. Root frame MUST have a fixed width (320 for cards, 1440 for pages).
6. ALL text that might wrap MUST have w="fill" on both the Text and its parent.
7. Use realistic content — real names, real descriptions, real prices.
8. Buttons need flex="row" justify="center" items="center" for centered text.`;

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        generationConfig: { temperature: 0.7 }
    };

    const result = await callGemini(body);
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('AI returned empty response.');
    }

    return text;
}
