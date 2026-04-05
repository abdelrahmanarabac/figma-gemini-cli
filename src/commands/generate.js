import { Command } from '../cli/command.js';
import { ensurePluginConnection } from '../utils/connection.js';
import { resolveGenerationPreferences } from '../utils/config.js';
import inquirer from 'inquirer';

export async function runGenerate(ctx, options, description) {
  let spinner;
  if (!ctx.isJson) {
    spinner = ctx.startSpinner(`Planning UI for: "${description}"...`);
  }

  try {
    const runtimeConfig = ctx.config.load({ cwd: process.cwd() });
    const dryRun = Boolean(options.dryRun || options.dryrun);
    const mode = runtimeConfig.theme?.mode && options.mode === 'Light'
      ? runtimeConfig.theme.mode
      : options.mode;

    if (options.wait && !dryRun) {
      const connected = await ensurePluginConnection(ctx, true);
      if (!connected) {
        process.exitCode = 1;
        return;
      }
    }

    // ── MoE Pipeline ──────────────────────────────
    const agents = await ctx.getAgents();
    const orchestrator = agents.orchestrator;
    const planner = agents.experts.workflowPlanner;

    const intent = orchestrator.parseIntent(description, { mode });
    const plannerTask = {
      id: `preflight-${Date.now()}`,
      type: intent.action,
      description,
      input: { intent },
      dependencies: [],
    };
    const plannerResult = await planner.execute(ctx, plannerTask, { intent });
    const inventory = plannerResult.data?.inventory || {};
    const preflight = plannerResult.data?.preflight || {};
    const workflow = options.forceGenerate
      ? { route: 'generate', reason: 'Generation route was enforced by the calling command.' }
      : (preflight.workflow || { route: 'generate', reason: 'The request is generation-oriented.' });

    if (workflow.route !== 'generate') {
      process.exitCode = 1;
      ctx.logError(`This request should not go through generate: ${workflow.reason}`, {
        status: 'error',
        description,
        route: workflow.route,
        recommendedCommand: workflow.recommendedCommand,
        inventory: {
          tokenCollections: inventory.tokenSummary?.collectionCount || 0,
          components: inventory.componentSummary?.count || 0,
          textStyles: inventory.styleSummary?.count || 0,
        },
      });
      return;
    }

    const preferences = resolveGenerationPreferences(options, runtimeConfig, inventory);

    if (!ctx.isJson && ctx.isInteractive && options.interactive && preflight.needsConfirmation) {
      if (spinner) { spinner.stop(); }
      const promptQuestions = [];

      if (inventory.tokenSummary?.collectionCount) {
        promptQuestions.push({
          type: 'confirm',
          name: 'useExistingTokens',
          message: `Found ${inventory.tokenSummary.collectionCount} token collections. Reuse them during generation?`,
          default: preferences.useExistingTokens,
        });
      } else {
        promptQuestions.push({
          type: 'confirm',
          name: 'createMissingTokens',
          message: 'No reusable token collections were found. Create missing token scaffolds if needed?',
          default: preferences.createMissingTokens,
        });
      }

      if (inventory.componentSummary?.count) {
        promptQuestions.push({
          type: 'confirm',
          name: 'useExistingComponents',
          message: `Found ${inventory.componentSummary.count} local components. Prefer matching and reusing them?`,
          default: preferences.useExistingComponents,
        });
      }

      if (promptQuestions.length > 0) {
        const answers = await inquirer.prompt(promptQuestions);
        Object.assign(preferences, answers);
      }
      if (spinner) { spinner.start(); }
    }

    if (spinner) { spinner.text = 'Synthesizing with Mix-of-Experts pipeline...'; }

    const pipelineResult = await orchestrator.execute(ctx, description, {
      mode,
      inventory,
      preferences,
      runtimeConfig,
    });

    if (options.verbose && !ctx.isJson) {
      orchestrator.printTrace();
    }

    // ── Extract Results ───────────────────────────

    const builderResult = pipelineResult.results?.builder;
    const guardianResult = pipelineResult.results?.guardian;
    const a11yResult = pipelineResult.results?.a11y;
    const plannerData = pipelineResult.results?.['workflow-planner']?.data || plannerResult.data || {};
    const tokenResult = pipelineResult.results?.['token-expert'];
    const guardianReport = guardianResult?.data?.report || null;
    const a11yReport = a11yResult?.data?.a11y || null;
    const templateUsed = builderResult?.data?.templateUsed || pipelineResult.pipelineData?.templateUsed;
    const patternUsed = builderResult?.data?.patternUsed || pipelineResult.pipelineData?.patternUsed || null;
    const reusedComponents = builderResult?.data?.reusedComponents || [];
    const tokenStrategy = tokenResult?.data?.tokenStrategy || null;

    if (!ctx.isJson && guardianReport) {
      const report = guardianReport;
      if (report.violations && report.violations.length > 0) {
        ctx.logWarning(`Guardian: ${report.stats?.warnings || 0} warnings, ${report.stats?.errors || 0} errors`);
        if (options.verbose) {
          report.violations.forEach(v => {
            const icon = v.severity === 'error' ? '❌' : v.severity === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`  ${icon} [${v.ruleId}] ${v.nodeName}: ${v.message}`);
          });
        }
      } else if (spinner) {
        spinner.text = 'Guardian: All rules passed ✓';
      }
    }

    if (!ctx.isJson && a11yReport && spinner) {
      spinner.text = a11yReport.pass
        ? `A11y: Score ${a11yReport.score}/100 ✓`
        : `A11y: Score ${a11yReport.score}/100 — ${(a11yReport.issues || []).length} issues`;
    }

    if (spinner) { spinner.text = 'Rendering to Figma canvas...'; }

    const jsx = pipelineResult.pipelineData?.jsx || builderResult?.data?.jsx;

    if (builderResult?.errors?.length) {
      if (spinner) { spinner.fail('MoE pipeline failed.'); }
      process.exitCode = 1;
      if (!ctx.isJson) {
        builderResult.errors.forEach(error => ctx.logError(`  [builder] ${error}`));
      } else {
        ctx.logError('MoE pipeline failed.', {
          status: 'error',
          description,
          mode,
          duration: pipelineResult.duration,
          dryRun,
          builderErrors: builderResult.errors,
          guardian: guardianReport,
          a11y: a11yReport,
        });
      }
      return;
    }

    if (!jsx) {
      if (spinner) { spinner.fail('No JSX generated by the pipeline.'); }
      process.exitCode = 1;
      ctx.logError('No JSX generated by the pipeline', {
        status: 'error',
        description,
        mode,
        duration: pipelineResult.duration,
        dryRun,
        guardian: guardianReport,
        a11y: a11yReport,
      });
      return;
    }

    if (options.verbose && !ctx.isJson) {
      console.log('\n--- Synthesized JSX ---');
      console.log(jsx.trim());
      console.log('------------------------\n');
    }

    const payload = {
      status: 'success',
      description,
      mode,
      duration: pipelineResult.duration,
      dryRun,
      patternUsed,
      templateUsed,
      workflow,
      config: {
        global: runtimeConfig.paths?.global || null,
        project: runtimeConfig.paths?.project || null,
      },
      preflight: {
        recommendations: plannerData.preflight?.recommendations || preflight.recommendations || [],
        inventory: {
          tokenCollections: inventory.tokenSummary?.collectionCount || 0,
          tokenVariables: inventory.tokenSummary?.variableCount || 0,
          components: inventory.componentSummary?.count || 0,
          textStyles: inventory.styleSummary?.count || 0,
        },
        preferences,
      },
      tokenStrategy,
      reusedComponents,
      guardian: guardianReport,
      a11y: a11yReport,
      jsx,
      trace: options.verbose ? pipelineResult.trace : undefined,
    };

    if (guardianReport?.stats?.errors > 0) {
      if (spinner) { spinner.fail(`Generation blocked by Guardian with ${guardianReport.stats.errors} error(s).`); }
      process.exitCode = 1;
      const blockingViolations = guardianReport.violations.filter(v => v.severity === 'error');
      if (!ctx.isJson) {
        blockingViolations.forEach(v => ctx.logError(`  [${v.ruleId}] ${v.nodeName}: ${v.message}`));
      } else {
        ctx.logError(`Generation blocked by Guardian with ${guardianReport.stats.errors} error(s).`, {
          ...payload,
          status: 'error',
          blockingViolations,
        });
      }
      return;
    }

    if (dryRun) {
      if (!ctx.isJson) {
        if (inventory.tokenSummary?.collectionCount > 0) {
          ctx.logSuccess(`Preflight: found ${inventory.tokenSummary.collectionCount} token collections (${tokenStrategy || 'raw-fallback'})`);
        }
        if (inventory.componentSummary?.count > 0) {
          if (reusedComponents.length > 0) {
            ctx.logSuccess(`Preflight: reused ${reusedComponents.length} existing component match(es)`);
          } else {
            ctx.logWarning(`Preflight: found ${inventory.componentSummary.count} local components, but no exact reusable match was selected`);
          }
        }
      }
      ctx.logSuccess('Dry-run complete. Pipeline finished without rendering.', {
        ...payload,
        rendered: false,
      });
      return;
    }

    const connected = await ensurePluginConnection(ctx, Boolean(options.wait));
    if (!connected) {
      process.exitCode = 1;
      return;
    }

    const result = await ctx.render(jsx);
    if (result && result.error) {
      ctx.logError(`Render failed: ${result.error}`, {
        ...payload,
        status: 'error',
        rendered: false,
        renderError: result.error,
      });
    } else {
      if (!ctx.isJson) {
        if (inventory.tokenSummary?.collectionCount > 0) {
          ctx.logSuccess(`Generation used token strategy: ${tokenStrategy || 'raw-fallback'}`);
        }
        if (inventory.componentSummary?.count > 0) {
          if (reusedComponents.length > 0) {
            ctx.logSuccess(`Reused ${reusedComponents.length} existing component match(es).`);
          } else {
            ctx.logWarning(`Found ${inventory.componentSummary.count} local components. No exact reusable match was applied in this pass.`);
          }
        }
        if (spinner) { spinner.succeed('Synthesized successfully.'); }
      }

      if (ctx.isJson) {
        ctx._printJson(payload);
      } else {
        const generationLabel = patternUsed
          ? ` (pattern: ${patternUsed})`
          : templateUsed
            ? ` (template: ${templateUsed})`
            : '';
        ctx.logSuccess(`UI Generated Successfully.${generationLabel} — ${pipelineResult.duration}ms`, {
          ...payload,
          rendered: true,
        });
      }
    }
  } catch (err) {
    ctx.logError(`Generation error: ${err.message}`);
  }
}

export class GenerateCommand extends Command {
  name = 'generate <description>';
  description = 'Synthesize a high-fidelity Figma UI from a description using MoE agent pipeline';
  needsConnection = false;

  constructor() {
    super();
    this.options = [
      { flags: '-v, --verbose', description: 'Show full MoE pipeline trace' },
      { flags: '--mode <mode>', description: 'Theme mode: Light or Dark', defaultValue: 'Light' },
      { flags: '--dry-run', description: 'Show pipeline results without rendering' },
      { flags: '-i, --interactive', description: 'Prompt for preflight decisions' },
      { flags: '--use-existing-tokens', description: 'Prefer reusing tokens already found in the file' },
      { flags: '--no-use-existing-tokens', description: 'Do not reuse existing tokens from the file' },
      { flags: '--use-existing-components', description: 'Prefer reusing matching local components' },
      { flags: '--no-use-existing-components', description: 'Do not reuse existing local components' },
      { flags: '--create-missing-tokens', description: 'Generate missing token scaffolds when reusable tokens are not enough' },
      { flags: '--no-create-missing-tokens', description: 'Do not generate missing token scaffolds' },
      { flags: '-w, --wait', description: 'Wait up to 30s for the Figma plugin to connect' }
    ];
  }

  async execute(ctx, options, description) {
    await runGenerate(ctx, options, description);
  }
}

export default new GenerateCommand();
