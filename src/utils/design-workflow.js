import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.figma-cli');
export const WORKFLOW_PATH = join(CONFIG_DIR, 'current_workflow.json');

export function loadWorkflow() {
  if (!existsSync(WORKFLOW_PATH)) return null;

  try {
    return JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveWorkflow(data) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(WORKFLOW_PATH, JSON.stringify(data, null, 2));
}

export function isWorkflowActiveForCwd(workflow, cwd = process.cwd()) {
  if (!workflow?.projectDir) return false;
  const workflowDir = resolve(workflow.projectDir);
  const currentDir = resolve(cwd);
  return currentDir === workflowDir || currentDir.startsWith(`${workflowDir}\\`) || currentDir.startsWith(`${workflowDir}/`);
}

export function pickWorkflowScreen(workflow, requestedScreen = null) {
  const screens = Array.isArray(workflow?.architecture?.screens) ? workflow.architecture.screens : [];
  if (requestedScreen) {
    const match = screens.find(screen => screen.toLowerCase() === requestedScreen.toLowerCase());
    return match || requestedScreen;
  }
  if (screens.length === 0) return null;
  return screens.find(screen => /dashboard|overview/i.test(screen)) || screens[0];
}

export function buildWorkflowGenerationBrief(workflow, options = {}) {
  const discovery = workflow?.discovery || {};
  const architecture = workflow?.architecture || {};
  const tokens = workflow?.tokens || {};
  const screen = pickWorkflowScreen(workflow, options.screen);
  const lines = [];

  lines.push(
    `Create a high-fidelity ${screen ? `${screen} ` : ''}screen for a ${discovery.productType || 'digital product'}.`
  );

  if (discovery.goal) {
    lines.push(`Primary goal: ${discovery.goal}.`);
  }
  if (discovery.audience) {
    lines.push(`Target audience: ${discovery.audience}.`);
  }
  if (Array.isArray(discovery.platforms) && discovery.platforms.length > 0) {
    lines.push(`Target platforms: ${discovery.platforms.join(', ')}.`);
  }
  if (Array.isArray(discovery.features) && discovery.features.length > 0) {
    lines.push(`Key features to reflect: ${discovery.features.join(', ')}.`);
  }
  if (discovery.aesthetic) {
    lines.push(`Visual direction: ${discovery.aesthetic}.`);
  }
  if (architecture.navigation) {
    lines.push(`Use ${architecture.navigation} as the navigation pattern.`);
  }
  if (tokens.palette) {
    lines.push(`Visual palette preference: ${tokens.palette}.`);
  }
  if (tokens.roundness !== undefined) {
    lines.push(`Use a ${tokens.roundness}px corner radius system as the default shape language.`);
  }
  if (tokens.darkMode) {
    lines.push('Keep the output ready for dark mode.');
  }
  if (options.description) {
    lines.push(`Additional request: ${options.description}.`);
  }

  return lines.join(' ');
}
