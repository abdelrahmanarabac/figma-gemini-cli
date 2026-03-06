/**
 * Sanitizer — Cleans AI output before sending to Figma.
 * Strips markdown fences, validates JSX shape.
 */

export function sanitizeGeminiPayload(rawOutput) {
    if (!rawOutput || typeof rawOutput !== 'string') {
        throw new Error('Invalid payload received from AI');
    }

    // 1. Remove Markdown code blocks if they exist
    let cleanJsx = rawOutput.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '');

    // 2. Trim whitespace
    cleanJsx = cleanJsx.trim();

    // 3. Validate: must start with a JSX tag
    if (!cleanJsx.startsWith('<')) {
        throw new Error('Payload does not start with a valid JSX tag. Sanitization failed.');
    }

    return cleanJsx;
}
