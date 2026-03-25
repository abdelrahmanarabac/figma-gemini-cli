import { Command } from '../cli/command.js';
import { ensurePluginConnection } from '../utils/connection.js';
import inquirer from 'inquirer';

class GenerateCommand extends Command {
  name = 'generate <description>';
  description = 'Synthesize a high-fidelity Figma UI from a description using MoE agent pipeline';
  needsConnection = false;

  constructor() {
    super();
    this.options = [
      { flags: '-v, --verbose', description: 'Show full MoE pipeline trace' },
      { flags: '--mode <mode>', description: 'Theme mode: Light or Dark', defaultValue: 'Light' },
      { flags: '--dry-run', description: 'Show pipeline results without rendering' },
      { flags: '-y, --yes', description: 'Accept preflight defaults without prompting' },
      { flags: '--use-existing-tokens', description: 'Prefer reusing tokens already found in the file' },
      { flags: '--no-use-existing-tokens', description: 'Do not reuse existing tokens from the file' },
      { flags: '--use-existing-components', description: 'Prefer reusing matching local components' },
      { flags: '--no-use-existing-components', description: 'Do not reuse existing local components' },
      { flags: '--create-missing-tokens', description: 'Generate missing token scaffolds when reusable tokens are not enough' },
      { flags: '--no-create-missing-tokens', description: 'Do not generate missing token scaffolds' }
    ];
  }

  async execute(ctx, options, description) {
    if (!ctx.isJson) {
      ctx.logSuccess(`Synthesizing UI for: "${description}"...`);
    }

    try {
      // ── MoE Pipeline ──────────────────────────────
      const agents = await ctx.getAgents();
      const orchestrator = agents.orchestrator;
      const planner = agents.experts.workflowPlanner;

      const intent = orchestrator.parseIntent(description, { mode: options.mode });
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
      const workflow = preflight.workflow || { route: 'generate', reason: 'The request is generation-oriented.' };

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

      const preferences = {
        useExistingTokens: options.useExistingTokens !== undefined
          ? options.useExistingTokens
          : Boolean(inventory.tokenSummary?.collectionCount),
        useExistingComponents: options.useExistingComponents !== undefined
          ? options.useExistingComponents
          : Boolean(inventory.componentSummary?.count),
        createMissingTokens: options.createMissingTokens !== undefined
          ? options.createMissingTokens
          : false,
      };

      if (!ctx.isJson && ctx.isInteractive && !options.yes && preflight.needsConfirmation) {
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
      }

      const pipelineResult = await orchestrator.execute(ctx, description, {
        mode: options.mode,
        inventory,
        preferences,
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
      const reusedComponents = builderResult?.data?.reusedComponents || [];
      const tokenStrategy = tokenResult?.data?.tokenStrategy || null;
      const dryRun = Boolean(options.dryRun || options.dryrun);

      // Show Guardian validation report
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
        } else {
          ctx.logSuccess('Guardian: All rules passed ✓');
        }
      }

      // Show A11y report
      if (!ctx.isJson && a11yReport) {
        const a11y = a11yReport;
        if (a11y.pass) {
          ctx.logSuccess(`A11y: Score ${a11y.score}/100 ✓`);
        } else {
          ctx.logWarning(`A11y: Score ${a11y.score}/100 — ${(a11y.issues || []).length} issues`);
        }
      }

      // ── Render ────────────────────────────────────

      const jsx = pipelineResult.pipelineData?.jsx || builderResult?.data?.jsx;

      if (builderResult?.errors?.length) {
        process.exitCode = 1;
        if (!ctx.isJson) {
          ctx.logError('MoE pipeline failed:');
          builderResult.errors.forEach(error => ctx.logError(`  [builder] ${error}`));
        } else {
          ctx.logError('MoE pipeline failed.', {
            status: 'error',
            description,
            mode: options.mode,
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
        process.exitCode = 1;
        ctx.logError('No JSX generated by the pipeline', {
          status: 'error',
          description,
          mode: options.mode,
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
        mode: options.mode,
        duration: pipelineResult.duration,
        dryRun,
        templateUsed,
        workflow,
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
        process.exitCode = 1;
        const blockingViolations = guardianReport.violations.filter(v => v.severity === 'error');
        if (!ctx.isJson) {
          ctx.logError(`Generation blocked by Guardian with ${guardianReport.stats.errors} error(s).`);
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

      const connected = await ensurePluginConnection(ctx);
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
        }
        ctx.logSuccess(`UI rendered successfully${templateUsed ? ` (template: ${templateUsed})` : ''} — ${pipelineResult.duration}ms`, {
          ...payload,
          rendered: true,
        });
      }
    } catch (err) {
      ctx.logError(`Generation error: ${err.message}`);
    }
  }
}

export default new GenerateCommand();
