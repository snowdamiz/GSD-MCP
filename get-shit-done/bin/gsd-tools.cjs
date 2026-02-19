#!/usr/bin/env node

/**
 * GSD Tools — CLI utility for GSD workflow operations
 * Refactored to use gsd-core.js
 */

const path = require('path');
const fs = require('fs');
const gsd = require('../lib/gsd-core.js');

// ─── CLI Helpers ─────────────────────────────────────────────────────────────

function parseIncludeFlag(args) {
  const includeIndex = args.indexOf('--include');
  if (includeIndex === -1) return new Set();
  const includeValue = args[includeIndex + 1];
  if (!includeValue) return new Set();
  return new Set(includeValue.split(',').map(s => s.trim()));
}

function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
    // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `gsd-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ─── CLI Router ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];
  const cwd = process.cwd();

  if (!command) {
    error('Usage: gsd-tools <command> [args] [--raw]');
  }

  try {
    switch (command) {
      case 'state': {
        const subcommand = args[1];
        if (subcommand === 'update') {
          const res = gsd.updateState(cwd, args[2], args[3]);
          output(res, raw);
        } else if (subcommand === 'get') {
          const res = gsd.getState(cwd, args[2]);
          output(res, raw, res[args[2]] || res.content);
        } else if (subcommand === 'patch') {
          const patches = {};
          for (let i = 2; i < args.length; i += 2) {
            const key = args[i].replace(/^--/, '');
            const value = args[i + 1];
            if (key && value !== undefined) patches[key] = value;
          }
          const res = gsd.patchState(cwd, patches);
          output(res, raw, res.updated.length > 0 ? 'true' : 'false');
        } else if (subcommand === 'advance-plan') {
          const res = gsd.advancePlan(cwd);
          output(res, raw, res.advanced ? 'true' : 'false');
        } else if (subcommand === 'record-metric') {
          const phaseIdx = args.indexOf('--phase');
          const planIdx = args.indexOf('--plan');
          const durationIdx = args.indexOf('--duration');
          const tasksIdx = args.indexOf('--tasks');
          const filesIdx = args.indexOf('--files');
          const res = gsd.recordMetric(cwd, {
            phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
            plan: planIdx !== -1 ? args[planIdx + 1] : null,
            duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
            tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
            files: filesIdx !== -1 ? args[filesIdx + 1] : null,
          });
          output(res, raw, res.recorded ? 'true' : 'false');
        } else if (subcommand === 'update-progress') {
          const res = gsd.updateProgress(cwd);
          output(res, raw, res.bar);
        } else if (subcommand === 'add-decision') {
          const phaseIdx = args.indexOf('--phase');
          const summaryIdx = args.indexOf('--summary');
          const rationaleIdx = args.indexOf('--rationale');
          const res = gsd.addDecision(cwd, {
            phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
            summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
            rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : '',
          });
          output(res, raw, res.added ? 'true' : 'false');
        } else if (subcommand === 'add-blocker') {
          const textIdx = args.indexOf('--text');
          const res = gsd.addBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null);
          output(res, raw, res.added ? 'true' : 'false');
        } else if (subcommand === 'resolve-blocker') {
          const textIdx = args.indexOf('--text');
          const res = gsd.resolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null);
          output(res, raw, res.resolved ? 'true' : 'false');
        } else if (subcommand === 'record-session') {
          const stoppedIdx = args.indexOf('--stopped-at');
          const resumeIdx = args.indexOf('--resume-file');
          const res = gsd.recordSession(cwd, {
            stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
            resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : 'None',
          });
          output(res, raw, res.recorded ? 'true' : 'false');
        } else {
          const res = gsd.stateLoad(cwd);
          if (raw) {
            const c = res.config;
            const lines = [
              `model_profile=${c.model_profile}`,
              `commit_docs=${c.commit_docs}`,
              `branching_strategy=${c.branching_strategy}`,
              `phase_branch_template=${c.phase_branch_template}`,
              `milestone_branch_template=${c.milestone_branch_template}`,
              `parallelization=${c.parallelization}`,
              `research=${c.research}`,
              `plan_checker=${c.plan_checker}`,
              `verifier=${c.verifier}`,
              `config_exists=${res.config_exists}`,
              `roadmap_exists=${res.roadmap_exists}`,
              `state_exists=${res.state_exists}`,
            ];
            process.stdout.write(lines.join('\n'));
            process.exit(0);
          }
          output(res);
        }
        break;
      }

      case 'resolve-model': {
        const res = gsd.resolveModel(cwd, args[1]);
        output(res, raw, res.model);
        break;
      }

      case 'find-phase': {
        const res = gsd.findPhase(cwd, args[1]);
        output(res, raw, res.directory);
        break;
      }

      case 'commit': {
        const amend = args.includes('--amend');
        const message = args[1];
        const filesIndex = args.indexOf('--files');
        const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
        const res = gsd.commit(cwd, message, files, amend);
        output(res, raw, res.hash || 'committed');
        break;
      }

      case 'verify-summary': {
        const countIndex = args.indexOf('--check-count');
        const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
        const res = gsd.verifySummary(cwd, args[1], checkCount);
        output(res, raw, res.passed ? 'passed' : 'failed');
        break;
      }

      case 'template': {
        if (args[1] === 'select') {
          const res = gsd.templateSelect(cwd, args[2]);
          output(res, raw, res.template);
        } else if (args[1] === 'fill') {
          const fieldsIdx = args.indexOf('--fields');
          const res = gsd.templateFill(cwd, args[2], {
            phase: args[args.indexOf('--phase') + 1],
            plan: args.indexOf('--plan') !== -1 ? args[args.indexOf('--plan') + 1] : null,
            name: args.indexOf('--name') !== -1 ? args[args.indexOf('--name') + 1] : null,
            type: args.indexOf('--type') !== -1 ? args[args.indexOf('--type') + 1] : 'execute',
            wave: args.indexOf('--wave') !== -1 ? args[args.indexOf('--wave') + 1] : '1',
            fields: fieldsIdx !== -1 ? JSON.parse(args[fieldsIdx + 1]) : {},
          });
          output(res, raw, res.path);
        }
        break;
      }

      case 'generate-slug': {
        const res = gsd.generateSlug(args[1]);
        output(res, raw, res.slug);
        break;
      }

      case 'current-timestamp': {
        const res = gsd.currentTimestamp(args[1] || 'full');
        output(res, raw, res.timestamp);
        break;
      }

      case 'list-todos': {
        const res = gsd.listTodos(cwd, args[1]);
        output(res, raw, res.count.toString());
        break;
      }

      case 'verify-path-exists': {
        const res = gsd.verifyPathExists(cwd, args[1]);
        output(res, raw, res.exists ? 'true' : 'false');
        break;
      }

      case 'config-ensure-section': {
        const res = gsd.configEnsureSection(cwd);
        output(res, raw, res.created ? 'created' : 'exists');
        break;
      }

      case 'config-set': {
        const res = gsd.configSet(cwd, args[1], args[2]);
        output(res, raw, `${res.key}=${res.value}`);
        break;
      }

      case 'config-get': {
        const res = gsd.configGet(cwd, args[1]);
        output(res, raw, String(res));
        break;
      }

      case 'history-digest': {
        const res = gsd.historyDigest(cwd);
        output(res, raw);
        break;
      }

      case 'phases': {
        if (args[1] === 'list') {
          const typeIndex = args.indexOf('--type');
          const phaseIndex = args.indexOf('--phase');
          const res = gsd.listPhases(cwd, {
            type: typeIndex !== -1 ? args[typeIndex + 1] : null,
            phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
            includeArchived: args.includes('--include-archived'),
          });
          if (typeIndex !== -1) output(res, raw, res.files.join('\n'));
          else output(res, raw, res.directories.join('\n'));
        }
        break;
      }

      case 'roadmap': {
        if (args[1] === 'get-phase') {
          const res = gsd.roadmapGetPhase(cwd, args[2]);
          output(res, raw, res.section || '');
        } else if (args[1] === 'analyze') {
          const res = gsd.roadmapAnalyze(cwd);
          output(res, raw);
        } else if (args[1] === 'update-plan-progress') {
          const res = gsd.roadmapUpdatePlanProgress(cwd, args[2]);
          output(res, raw, res.updated ? 'updated' : 'failed');
        }
        break;
      }

      case 'requirements': {
        if (args[1] === 'mark-complete') {
          const res = gsd.requirementsMarkComplete(cwd, args.slice(2));
          output(res, raw, `${res.marked_complete.length} completed`);
        }
        break;
      }

      case 'phase': {
        if (args[1] === 'next-decimal') {
          const res = gsd.phaseNextDecimal(cwd, args[2]);
          output(res, raw, res.next);
        } else if (args[1] === 'add') {
          const res = gsd.phaseAdd(cwd, args.slice(2).join(' '));
          output(res, raw, res.padded);
        } else if (args[1] === 'insert') {
          const res = gsd.phaseInsert(cwd, args[2], args.slice(3).join(' '));
          output(res, raw, res.phase_number);
        } else if (args[1] === 'remove') {
          const res = gsd.phaseRemove(cwd, args[2], { force: args.includes('--force') });
          output(res, raw);
        } else if (args[1] === 'complete') {
          const res = gsd.phaseComplete(cwd, args[2]);
          output(res, raw);
        }
        break;
      }

      case 'milestone': {
        if (args[1] === 'complete') {
          const nameIndex = args.indexOf('--name');
          let name = null;
          if (nameIndex !== -1) name = args[nameIndex + 1]; // Simplified arg parsing for rewrite
          const res = gsd.milestoneComplete(cwd, args[2], { name, archivePhases: args.includes('--archive-phases') });
          output(res, raw);
        }
        break;
      }

      case 'validate': {
        if (args[1] === 'consistency') {
          const res = gsd.validateConsistency(cwd);
          output(res, raw, res.passed ? 'passed' : 'failed');
        } else if (args[1] === 'health') {
          const res = gsd.validateHealth(cwd, { repair: args.includes('--repair') });
          output(res, raw);
        }
        break;
      }

      case 'progress': {
        const res = gsd.progressRender(cwd, args[1] || 'json');
        output(res, raw, res.bar || res.rendered);
        break;
      }

      case 'todo': {
        if (args[1] === 'complete') {
          const res = gsd.todoComplete(cwd, args[2]);
          output(res, raw, 'completed');
        }
        break;
      }

      case 'scaffold': {
        const phaseIndex = args.indexOf('--phase');
        const nameIndex = args.indexOf('--name');
        const res = gsd.scaffold(cwd, args[1], {
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
          name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null,
        });
        output(res, raw, res.path);
        break;
      }

      case 'init': {
        const workflow = args[1];
        const includes = parseIncludeFlag(args);
        let res;
        switch (workflow) {
          case 'execute-phase': res = gsd.initExecutePhase(cwd, args[2], includes); break;
          case 'plan-phase': res = gsd.initPlanPhase(cwd, args[2], includes); break;
          case 'new-project': res = gsd.initNewProject(cwd); break;
          case 'new-milestone': res = gsd.initNewMilestone(cwd); break;
          case 'quick': res = gsd.initQuick(cwd, args.slice(2).join(' ')); break;
          case 'resume': res = gsd.initResume(cwd); break;
          case 'verify-work': res = gsd.initVerifyWork(cwd, args[2]); break;
          case 'phase-op': res = gsd.initPhaseOp(cwd, args[2]); break;
          case 'todos': res = gsd.initTodos(cwd, args[2]); break;
          case 'milestone-op': res = gsd.initMilestoneOp(cwd); break;
          case 'map-codebase': res = gsd.initMapCodebase(cwd); break;
          case 'progress': res = gsd.initProgress(cwd, includes); break;
          default: error(`Unknown init workflow: ${workflow}`);
        }
        output(res, raw);
        break;
      }

      case 'phase-plan-index': {
        const res = gsd.phasePlanIndex(cwd, args[1]);
        output(res, raw);
        break;
      }

      case 'state-snapshot': {
        const res = gsd.stateSnapshot(cwd);
        output(res, raw);
        break;
      }

      case 'summary-extract': {
        const fieldsIndex = args.indexOf('--fields');
        const res = gsd.summaryExtract(cwd, args[1], fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null);
        output(res, raw);
        break;
      }

      case 'websearch': {
        const limitIdx = args.indexOf('--limit');
        const freshnessIdx = args.indexOf('--freshness');
        const res = await gsd.webSearch(args[1], {
          limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
          freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null,
        });
        output(res, raw);
        break;
      }

      default:
        error(`Unknown command: ${command}`);
    }
  } catch (err) {
    error(err.message);
  }
}

main();
