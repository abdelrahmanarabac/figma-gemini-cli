import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const GEMINI_MD_PATH = join(process.cwd(), 'GEMINI.md');

const ERROR_PATTERNS = [
  {
    id: 'powershell-ampersand',
    regex: /'&&' is not a valid statement separator|The token '&&' is not a valid statement separator/i,
    title: 'Known CLI Issue: PowerShell `&&` Operator',
    problem: 'Windows PowerShell does not support `&&` command chaining like Bash.',
    solution: 'Use separate commands instead:\n\n```powershell\ncommand1\ncommand2\n```\n\nOr run the CLI inside **Git Bash / WSL / modern PowerShell**.'
  }
];

/**
 * Detects common error patterns and updates GEMINI.md with troubleshooting info if missing.
 * @param {string} errorMessage 
 */
export function detectAndDocumentError(errorMessage) {
  if (!errorMessage) return;

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.regex.test(errorMessage)) {
      updateGeminiMd(pattern);
    }
  }
}

function updateGeminiMd(pattern) {
  if (!existsSync(GEMINI_MD_PATH)) return;

  try {
    let content = readFileSync(GEMINI_MD_PATH, 'utf8');

    // Check if already documented
    if (content.includes(pattern.title)) {
      return;
    }

    const entry = `\n## ${pattern.title}\n\nProblem:\n${pattern.problem}\n\nSolution:\n${pattern.solution}\n`;

    // Append to the end of the file or after a specific section
    content += entry;

    writeFileSync(GEMINI_MD_PATH, content, 'utf8');
  } catch (err) {
    // Fail silently to not disrupt the main CLI flow
  }
}
