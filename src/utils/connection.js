import { checkHealth } from '../transport/bridge.js';

export async function ensurePluginConnection(ctx) {
  const health = await checkHealth();
  if (health.status === 'ok' && health.plugin) {
    return true;
  }

  ctx.logError('Not connected to Figma. Open the FigCli plugin and run "figma-gemini-cli connect".');
  return false;
}
