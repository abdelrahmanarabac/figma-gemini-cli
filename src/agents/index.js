/**
 * Agent System Index — Loads and wires all MoE experts.
 *
 * Creates the Orchestrator, registers all experts,
 * and initializes Design Memory.
 */

import { Orchestrator } from './orchestrator.js';
import { GuardianExpert } from './guardian.js';
import { TokenExpert } from './token-expert.js';
import { AnalyzerExpert } from './analyzer.js';
import { BuilderExpert } from './builder.js';
import { UXWriterExpert } from './ux-writer.js';
import { A11yExpert } from './a11y-expert.js';
import { ResponsiveExpert } from './responsive-expert.js';
import { VisualExpert } from './visual-expert.js';
import { DesignMemory } from '../memory/design-memory.js';

/**
 * Create and return a fully configured Orchestrator
 * with all experts registered and Memory initialized.
 *
 * @returns {{ orchestrator: Orchestrator, memory: DesignMemory, experts: Object }}
 */
export function createAgentSystem() {
  const memory = new DesignMemory();

  const experts = {
    analyzer: new AnalyzerExpert(),
    tokenExpert: new TokenExpert(),
    visual: new VisualExpert(),
    uxWriter: new UXWriterExpert(),
    builder: new BuilderExpert(),
    responsive: new ResponsiveExpert(),
    guardian: new GuardianExpert(),
    a11y: new A11yExpert(),
  };

  const orchestrator = new Orchestrator(Object.values(experts), memory);

  return { orchestrator, memory, experts };
}
