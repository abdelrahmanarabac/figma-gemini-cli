import { execSync } from 'child_process';

/**
 * Gemini AI Client
 * 
 * Uses the locally installed 'gemini' CLI to perform generations.
 * This ensures we use the user's existing authentication and configuration.
 */

export async function generateDesign(prompt) {
    // We wrap the prompt to ensure it generates high-fidelity JSX
    const systemPrompt = `Act as a Senior UI Designer. Generate 100% Figma-compatible JSX for the following request: "${prompt}".
Rules:
1. Use only supported components: <Frame>, <Text>, <Rectangle>, <Ellipse>, <Line>, <SVG>.
2. Use professional aesthetics: rounded={12}, p={24}, gap={16}.
3. ALL Frames MUST have w and h values (e.g., w={1440} h={1024}).
4. Use valid CSS-like colors (e.g., bg={#ffffff}).
5. Always wrap values in curly braces {}.
6. ICONS: Use <SVG /> for ALL icons. Provide valid XML in content={}. Default icons to w={24} h={24}.
7. Output ONLY the JSX code block. No explanation.`;

    try {
        // Execute 'gemini' CLI
        const command = `gemini "${systemPrompt.replace(/"/g, '\\"')}"`;
        const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        
        if (!output) {
            throw new Error('Gemini CLI returned empty output');
        }

        return output;
    } catch (err) {
        if (err.stderr) {
            throw new Error(`Gemini CLI Error: ${err.stderr}`);
        }
        throw new Error(`AI generation failed: ${err.message}`);
    }
}
