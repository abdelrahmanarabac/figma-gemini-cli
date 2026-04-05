import { checkHealth } from '../transport/bridge.js';

export async function ensurePluginConnection(ctx, wait = false) {
  const check = async () => {
    try {
      const health = await checkHealth();
      return health.status === 'ok' && health.plugin;
    } catch {
      return false;
    }
  };

  if (wait) {
    let spinner;
    if (!ctx.isJson) spinner = ctx.startSpinner('Waiting for Figma plugin connection...');
    for (let i = 0; i < 30; i++) {
      if (await check()) {
        if (spinner) spinner.succeed('Connected to Figma plugin.');
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (spinner) spinner.fail('Connection timeout.');
    ctx.logError('Timed out waiting for Figma plugin to connect.');
    return false;
  }

  if (await check()) {
    return true;
  }

  ctx.logError('Not connected to Figma. Open the FigCli plugin and run "figma-gemini-cli connect".');
  return false;
}
