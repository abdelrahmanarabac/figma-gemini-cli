/**
 * Sanitizer Utilities
 */

/**
 * Extracts and cleans JSX from an AI response.
 * - Strips Markdown code blocks (```jsx, ```).
 * - Removes single-line and multi-line comments.
 * - Normalizes whitespace and removes trailing/leading junk.
 * 
 * @param {string} payload - Raw text from the AI.
 * @returns {string} Sanitized JSX string.
 */
export function sanitizeGeminiPayload(payload) {
    if (!payload || typeof payload !== 'string') {
        throw new Error('Empty or invalid AI payload');
    }

    let jsx = payload.trim();

    // 1. Extract content from Markdown code blocks if present
    const codeBlockMatch = jsx.match(/```(?:jsx|tsx|html|javascript|js)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
        jsx = codeBlockMatch[1].trim();
    }

    // 2. Remove single-line comments (// ...)
    jsx = jsx.replace(/\/\/.*$/gm, '');

    // 3. Remove multi-line comments (/* ... */)
    jsx = jsx.replace(/\/\*[\s\S]*?\*\//g, '');

    // 4. Remove leading/trailing non-JSX characters (like "Here is your design:")
    // We look for the first < and last >
    const firstTag = jsx.indexOf('<');
    const lastTag = jsx.lastIndexOf('>');
    
    if (firstTag !== -1 && lastTag !== -1 && lastTag > firstTag) {
        jsx = jsx.slice(firstTag, lastTag + 1);
    } else if (firstTag === -1) {
        throw new Error('No JSX tags found in AI output');
    }

    // 5. Normalization
    jsx = jsx.replace(/\n\s*\n/g, '\n'); // Remove extra blank lines
    
    return jsx.trim();
}
