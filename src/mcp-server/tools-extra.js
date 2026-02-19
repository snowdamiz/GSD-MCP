
const path = require('path');
const { z } = require('zod');
const gsd = require('../../get-shit-done/lib/gsd-core.js');
const { PROMPTS } = require('./prompts.js');

// ─── GSD root for include resolution ───
const GSD_ROOT = path.resolve(__dirname, '../../get-shit-done');

function resolveIncludes(content) {
  return content.replace(/@~\/\.claude\/get-shit-done\/([\w\-\/]+\.md)/g, (match, relPath) => {
    const fullPath = path.join(GSD_ROOT, relPath);
    const included = gsd.safeReadFile(fullPath);
    return included || match; // preserve original if file not found
  });
}

function loadWorkflow(name, cwd) {
  const filename = name.endsWith('.md') ? name : name + '.md';
  const workflowPath = path.join(cwd, 'get-shit-done', 'workflows', filename);
  let content = gsd.safeReadFile(workflowPath);
  if (!content) {
    const relPath = path.resolve(__dirname, '../../get-shit-done/workflows', filename);
    content = gsd.safeReadFile(relPath);
  }
  if (content) {
    content = resolveIncludes(content);
  }
  return content;
}

// ─── Helper: wrap a sync gsd function as a JSON MCP tool handler ───
function jsonHandler(fn) {
  return async (args, cwd) => ({
    content: [{ type: 'text', text: JSON.stringify(fn(args, cwd), null, 2) }],
  });
}

const TOOLS_EXTRA = [
  {
    name: 'gsd_map_codebase',
    description: 'Run the full codebase mapping workflow. Returns initialization metadata and complete workflow instructions to spawn 4 parallel mapper agents that analyze the codebase and write documents to .planning/codebase/. Follow the returned workflow step by step.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const init = gsd.initMapCodebase(cwd);
      const workflow = loadWorkflow('map-codebase', cwd);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(init, null, 2),
          },
          {
            type: 'text',
            text: workflow || 'Error: Workflow file map-codebase.md not found',
          },
        ],
      };
    },
  },
  {
    name: 'gsd_todo_complete',
    description: 'Mark a todo item as complete.',
    inputSchema: z.object({
      filename: z.string().describe('The filename of the todo to complete'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.todoComplete(cwd, args.filename);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_list_todos',
    description: 'List pending todos, optionally filtered by area.',
    inputSchema: z.object({
      area: z.string().optional().describe('Filter by area (e.g., "frontend", "backend")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.listTodos(cwd, args.area);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_scaffold',
    description: 'Scaffold GSD templates or directories.',
    inputSchema: z.object({
      type: z.enum(['context', 'uat', 'verification', 'phase-dir']).describe('Type of scaffold to create'),
      phase: z.string().optional().describe('Phase number (required for most types)'),
      name: z.string().optional().describe('Name for the template/directory'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.scaffold(cwd, args.type, { phase: args.phase, name: args.name });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_websearch',
    description: 'Perform a web search using the configured provider (Brave).',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Number of results (default 10)'),
      freshness: z.enum(['day', 'week', 'month']).optional().describe('Filter by freshness'),
    }),
    handler: async (args, cwd) => {
      const result = await gsd.webSearch(args.query, { limit: args.limit, freshness: args.freshness });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_history_digest',
    description: 'Generate a digest of project history from all summaries.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.historyDigest(cwd);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_list_phases',
    description: 'List all phases in the project.',
    inputSchema: z.object({
      type: z.enum(['plans', 'summaries']).optional().describe('Filter file types to list'),
      phase: z.string().optional().describe('Filter by specific phase number'),
      includeArchived: z.boolean().optional().describe('Include archived phases'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.listPhases(cwd, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_milestone_complete',
    description: 'Complete and archive the current milestone.',
    inputSchema: z.object({
      version: z.string().describe('Version string (e.g., "v1.0")'),
      name: z.string().optional().describe('Name of the milestone'),
      archivePhases: z.boolean().optional().describe('Move phase directories to archive'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.milestoneComplete(cwd, args.version, { name: args.name, archivePhases: args.archivePhases });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  },

  // ─── Init Tools (wrap gsd-core init functions) ───

  {
    name: 'gsd_init_execute_phase',
    description: 'Load execution context for a phase: models, config, phase info, plans, branching.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number to execute'),
      includes: z.array(z.string()).optional().describe('Extra content to include: "state", "config", "roadmap"'),
    }),
    handler: async (args, cwd) => {
      const includesSet = args.includes ? new Set(args.includes) : null;
      const result = gsd.initExecutePhase(cwd, args.phase, includesSet);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_plan_phase',
    description: 'Load planning context for a phase: models, config, research status, existing plans.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number to plan'),
      includes: z.array(z.string()).optional().describe('Extra content to include'),
    }),
    handler: async (args, cwd) => {
      const includesSet = args.includes ? new Set(args.includes) : null;
      const result = gsd.initPlanPhase(cwd, args.phase, includesSet);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_progress',
    description: 'Load project progress context: phases, completion status, routing info.',
    inputSchema: z.object({
      includes: z.array(z.string()).optional().describe('Extra content to include'),
    }),
    handler: async (args, cwd) => {
      const includesSet = args.includes ? new Set(args.includes) : null;
      const result = gsd.initProgress(cwd, includesSet);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_new_milestone',
    description: 'Load context for starting a new milestone: current milestone info, models.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.initNewMilestone(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_resume',
    description: 'Load context for resuming a previous session: state/roadmap existence, interrupted agent.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.initResume(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_verify_work',
    description: 'Load context for verifying work on a phase: models, phase info, verification status.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number to verify'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.initVerifyWork(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_phase_op',
    description: 'Load context for phase operations (discuss, research, etc.): config, phase info.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.initPhaseOp(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_todos',
    description: 'Load todo context: pending todos, counts, directory info.',
    inputSchema: z.object({
      area: z.string().optional().describe('Filter by area (e.g., "frontend", "backend")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.initTodos(cwd, args.area);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_milestone_op',
    description: 'Load milestone operation context: phase counts, archived milestones.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.initMilestoneOp(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_init_quick',
    description: 'Load context for a quick task: models, task directory, numbering.',
    inputSchema: z.object({
      description: z.string().optional().describe('Task description for slug generation'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.initQuick(cwd, args.description);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },

  // ─── Config Tools ───

  {
    name: 'gsd_config_get',
    description: 'Read a value from .planning/config.json by dot-separated key path.',
    inputSchema: z.object({
      key: z.string().describe('Dot-separated key path (e.g., "workflow.research")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.configGet(cwd, args.key);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_config_set',
    description: 'Write a value to .planning/config.json by dot-separated key path.',
    inputSchema: z.object({
      key: z.string().describe('Dot-separated key path (e.g., "model_profile")'),
      value: z.string().describe('Value to set (booleans/numbers auto-parsed)'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.configSet(cwd, args.key, args.value);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_config_ensure',
    description: 'Ensure .planning/config.json exists with defaults. Creates if missing.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.configEnsureSection(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },

  // ─── Phase & Roadmap Tools ───

  {
    name: 'gsd_find_phase',
    description: 'Look up a phase by number. Returns directory, plans, summaries, and status.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number (e.g., "1", "03", "2.1")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.findPhase(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_roadmap_get_phase',
    description: 'Extract a phase section from ROADMAP.md: goal, success criteria, full section text.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.roadmapGetPhase(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_roadmap_update_plan_progress',
    description: 'Update plan completion count in ROADMAP.md for a phase.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.roadmapUpdatePlanProgress(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_phase_insert',
    description: 'Insert a decimal phase after an existing phase (e.g., 3.1 after 3).',
    inputSchema: z.object({
      after_phase: z.string().describe('Phase to insert after'),
      description: z.string().describe('Name/description for the new phase'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phaseInsert(cwd, args.after_phase, args.description);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_phase_remove',
    description: 'Remove a phase from the roadmap and delete its directory.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number to remove'),
      force: z.boolean().optional().describe('Force removal even if phase has executed plans'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phaseRemove(cwd, args.phase, { force: args.force });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_phase_next_decimal',
    description: 'Calculate the next available decimal phase number for a base phase.',
    inputSchema: z.object({
      base_phase: z.string().describe('Base phase number (e.g., "3" to get "3.1")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phaseNextDecimal(cwd, args.base_phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },

  // ─── Verification Tools ───

  {
    name: 'gsd_verify_summary',
    description: 'Verify a SUMMARY.md file: check mentioned files exist, check git commits.',
    inputSchema: z.object({
      path: z.string().describe('Relative path to the SUMMARY.md file'),
      check_count: z.number().optional().describe('Number of files to spot-check (default 2)'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.verifySummary(cwd, args.path, args.check_count);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_verify_plan_structure',
    description: 'Verify a PLAN.md file has valid frontmatter and task structure.',
    inputSchema: z.object({
      path: z.string().describe('Relative path to the PLAN.md file'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.verifyPlanStructure(cwd, args.path);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_verify_phase_completeness',
    description: 'Check if all plans in a phase have corresponding summaries.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.verifyPhaseCompleteness(cwd, args.phase);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_verify_artifacts',
    description: 'Verify must_have artifacts from a plan file exist on disk.',
    inputSchema: z.object({
      plan_path: z.string().describe('Relative path to the PLAN.md file'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.verifyArtifacts(cwd, args.plan_path);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_verify_key_links',
    description: 'Verify must_have key_links from a plan file (source contains target reference).',
    inputSchema: z.object({
      plan_path: z.string().describe('Relative path to the PLAN.md file'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.verifyKeyLinks(cwd, args.plan_path);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },

  // ─── State Tools ───

  {
    name: 'gsd_state_patch',
    description: 'Update multiple fields in STATE.md in one call.',
    inputSchema: z.object({
      patches: z.record(z.string(), z.string()).describe('Map of field names to new values'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.patchState(cwd, args.patches);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_state_advance_plan',
    description: 'Increment Current Plan counter in STATE.md (or mark phase complete if last plan).',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.advancePlan(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_state_record_metric',
    description: 'Record a performance metric (duration, tasks, files) to STATE.md.',
    inputSchema: z.object({
      phase: z.string().describe('Phase number'),
      plan: z.string().describe('Plan number'),
      duration: z.string().describe('Duration string (e.g., "45min")'),
      tasks: z.string().optional().describe('Number of tasks completed'),
      files: z.string().optional().describe('Number of files modified'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.recordMetric(cwd, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_state_update_progress',
    description: 'Recalculate and update the Progress bar in STATE.md from plan/summary counts.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.updateProgress(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_state_add_decision',
    description: 'Add a decision entry to the Decisions section of STATE.md.',
    inputSchema: z.object({
      phase: z.string().optional().describe('Phase number for context'),
      summary: z.string().describe('Short decision summary'),
      rationale: z.string().optional().describe('Why this decision was made'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.addDecision(cwd, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_state_record_session',
    description: 'Record session end timestamp and optional resume info in STATE.md.',
    inputSchema: z.object({
      stopped_at: z.string().optional().describe('Description of where work stopped'),
      resume_file: z.string().optional().describe('Path to resume file, or "None"'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.recordSession(cwd, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },

  // ─── Utility Tools ───

  {
    name: 'gsd_resolve_model',
    description: 'Resolve the model to use for a given agent type based on current profile.',
    inputSchema: z.object({
      agent_type: z.string().describe('Agent type (e.g., "gsd-planner", "gsd-executor")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.resolveModel(cwd, args.agent_type);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_generate_slug',
    description: 'Generate a URL-safe slug from text.',
    inputSchema: z.object({
      text: z.string().describe('Text to convert to slug'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.generateSlug(args.text);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_current_timestamp',
    description: 'Get the current timestamp in various formats.',
    inputSchema: z.object({
      format: z.enum(['date', 'filename', 'full']).optional().describe('Format: "date" (YYYY-MM-DD), "filename" (safe for filenames), "full" (ISO 8601)'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.currentTimestamp(args.format);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_milestone_info',
    description: 'Get current milestone version and name from PROJECT.md.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      const result = gsd.getMilestoneInfo(cwd);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_requirements_mark_complete',
    description: 'Mark requirement IDs as complete in REQUIREMENTS.md.',
    inputSchema: z.object({
      req_ids: z.array(z.string()).describe('List of requirement IDs to mark complete'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.requirementsMarkComplete(cwd, args.req_ids);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
  {
    name: 'gsd_summary_extract',
    description: 'Extract specific fields from a SUMMARY.md file.',
    inputSchema: z.object({
      path: z.string().describe('Relative path to the SUMMARY.md file'),
      fields: z.array(z.string()).optional().describe('Fields to extract'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.summaryExtract(cwd, args.path, args.fields);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  },
];

// ─── Generate workflow tools from all prompts ───
// Each prompt becomes a tool that returns the full workflow instructions.
// Skip prompts that already have dedicated tools in TOOLS_EXTRA with custom handling.
const HANDLED_WORKFLOWS = new Set(['gsd_map_codebase']);

const WORKFLOW_TOOLS = PROMPTS
  .filter(p => !HANDLED_WORKFLOWS.has(p.name))
  .map(prompt => {
    const schemaObj = {};
    for (const arg of (prompt.arguments || [])) {
      schemaObj[arg.name] = arg.required
        ? z.string().describe(arg.description)
        : z.string().optional().describe(arg.description);
    }

    return {
      name: prompt.name,
      description: prompt.description + '. Returns full workflow instructions — follow them step by step.',
      inputSchema: z.object(schemaObj),
      handler: async (args, cwd) => {
        const workflow = loadWorkflow(prompt.file, cwd);
        if (!workflow) {
          return {
            content: [{ type: 'text', text: `Error: Workflow file ${prompt.file} not found` }],
          };
        }
        const filteredArgs = Object.fromEntries(
          Object.entries(args).filter(([_, v]) => v !== undefined)
        );
        let prefix = '';
        if (Object.keys(filteredArgs).length > 0) {
          prefix = `<arguments>\n${JSON.stringify(filteredArgs, null, 2)}\n</arguments>\n\n`;
        }
        return {
          content: [{ type: 'text', text: prefix + workflow }],
        };
      },
    };
  });

module.exports = { TOOLS_EXTRA, WORKFLOW_TOOLS, loadWorkflow };
