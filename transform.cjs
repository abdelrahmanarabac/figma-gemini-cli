const fs = require('fs');
let code = fs.readFileSync('src/index.js', 'utf8');

// 1. Fix getFigmaPath (from previous fix)
code = code.replace(
  /function getFigmaPath\(\) \{[\s\S]*?return join\(localAppData, 'Figma', 'Figma\\.exe'\);\n  \} else \{/,
  `function getFigmaPath() {
  if (IS_MAC) {
    return '/Applications/Figma.app/Contents/MacOS/Figma';
  } else if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const figmaDir = join(localAppData, 'Figma');
    try {
      const folders = require('fs').readdirSync(figmaDir).filter(f => f.startsWith('app-'));
      if (folders.length > 0) {
        const latest = folders.sort().reverse()[0];
        return join(figmaDir, latest, 'Figma.exe');
      }
    } catch {}
    return join(figmaDir, 'Figma.exe');
  } else {`
);

// 2. Fix checkDependencies call in status
code = code.replace(
  /if \(!config\.patched && !checkDependencies\(true\)\) \{/,
  'if (!config.patched) {'
);

// 3. Update FigmaClient import
code = code.replace(
  /import \{ FigmaClient \} from '\.\/figma-client\.js';/,
  "import { FigmaClient } from './core/figma-client.js';"
);

code = code.replace(
  /await import\('\.\/figma-client\.js'\);/,
  "await import('./core/figma-client.js');"
);

// 4. Transform figmaUse to async
code = code.replace(/function figmaUse\(args, options = \{\}\) \{/, 'async function figmaUse(args, options = {}) {');

// 5. Replace figmaEvalSync with await figmaEval
code = code.replace(/figmaEvalSync\(/g, 'await figmaEval(');

// 6. Make getNextFreeX / getNextFreeY async
code = code.replace(/function getNextFreeX/g, 'async function getNextFreeX');
code = code.replace(/function getNextFreeY/g, 'async function getNextFreeY');
code = code.replace(/getNextFreeX\(/g, 'await getNextFreeX(');
code = code.replace(/getNextFreeY\(/g, 'await getNextFreeY(');
code = code.replace(/async function await getNextFreeX/g, 'async function getNextFreeX');
code = code.replace(/async function await getNextFreeY/g, 'async function getNextFreeY');

// 7. Make action handlers async where figmaEval or figmaUse are used inside
code = code.replace(/\.action\(\(.*?\) => \{/g, (match) => {
  return match.replace('.action((', '.action(async (');
});

// 8. Delete the old figmaEvalSync definition
const startIdx = code.indexOf('// Sync wrapper for figmaEval');
if (startIdx !== -1) {
  const endMarker = '  return null;\\n}\\n';
  const endIdx = code.indexOf(endMarker, startIdx);
  if (endIdx !== -1) {
    code = code.substring(0, startIdx) + code.substring(endIdx + endMarker.length);
  }
}

fs.writeFileSync('src/index.js', code);
console.log('Transform complete');
