/**
 * Figma CLI Bridge Plugin
 *
 * Safe Mode: Connects to CLI daemon via WebSocket
 * No debug port needed, no patching required.
 */

// Show minimal UI (needed for WebSocket connection)
figma.showUI(__html__, {
  width: 160,
  height: 72,
  position: { x: -9999, y: 9999 }  // Bottom-left (push to far left)
});

// Handle messages from UI (WebSocket bridge)
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'eval') {
    try {
      // Create async function to support await in eval code
      // Auto-return: add 'return' for expressions that should return a value
      let code = msg.code.trim();

      // Don't add return if code already starts with return
      if (!code.startsWith('return ')) {
        // Add return for: simple expressions, IIFEs, arrow IIFEs
        const isSimpleExpr = !code.includes(';');
        const isIIFE = code.startsWith('(function') || code.startsWith('(async function');
        const isArrowIIFE = code.startsWith('(() =>') || code.startsWith('(async () =>');

        if (isSimpleExpr || isIIFE || isArrowIIFE) {
          code = `return ${code}`;
        } else {
          // Multi-statement code: add return to the last statement
          // Find last statement and add return before it
          const lastSemicolon = code.lastIndexOf(';');
          if (lastSemicolon !== -1) {
            const beforeLast = code.substring(0, lastSemicolon + 1);
            const lastStmt = code.substring(lastSemicolon + 1).trim();
            if (lastStmt && !lastStmt.startsWith('return ')) {
              code = beforeLast + ' return ' + lastStmt;
            }
          }
        }
      }
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('figma', `return (async () => { ${code} })()`);
      const result = await fn(figma);

      // Send result back to UI -> WebSocket -> CLI
      figma.ui.postMessage({
        type: 'result',
        id: msg.id,
        result: result
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'result',
        id: msg.id,
        error: error.message
      });
    }
  }

  if (msg.type === 'connected') {
    figma.notify('✓ Figma DS CLI connected', { timeout: 2000 });
  }

  if (msg.type === 'disconnected') {
    figma.notify('Figma DS CLI disconnected', { timeout: 2000 });
  }

  if (msg.type === 'error') {
    figma.notify('Figma DS CLI: ' + msg.message, { error: true });
  }
};

// Keep plugin alive
figma.on('close', () => {
  // Plugin closed
});

console.log('Figma DS CLI plugin started');
