
const { z } = require('zod');
const gsd = require('../../get-shit-done/lib/gsd-core.js');


const { TOOLS_EXTRA, WORKFLOW_TOOLS } = require('./tools-extra.js');

const TOOLS = [
  {
    name: 'gsd_init_project',
    description: 'Detect project state and return initialization metadata (models, brownfield detection, existing code). For the full project creation workflow, use gsd_new_project instead.',
    inputSchema: z.object({}),
    handler: async (args, cwd) => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(gsd.initNewProject(cwd), null, 2),
          },
        ],
      };
    },
  },
  {
    name: 'gsd_get_state',
    description: 'Read the current project state from .planning/STATE.md. Can optionally request a specific section.',
    inputSchema: z.object({
      section: z.string().optional().describe('Specific section to read (e.g., "Current Phase", "Decisions")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.getState(cwd, args.section);
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
    name: 'gsd_update_state',
    description: 'Update a specific field in .planning/STATE.md.',
    inputSchema: z.object({
      field: z.string().describe('The field name to update (e.g., "Current Phase")'),
      value: z.string().describe('The new value for the field'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.updateState(cwd, args.field, args.value);
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
    name: 'gsd_add_phase_atomic',
    description: 'Add a new phase to the roadmap and create its directory (atomic operation). For the full guided workflow, use gsd_add_phase instead.',
    inputSchema: z.object({
      description: z.string().describe('Description/Name of the new phase'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phaseAdd(cwd, args.description);
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
    name: 'gsd_complete_phase',
    description: 'Mark a phase as complete in the roadmap and update state.',
    inputSchema: z.object({
      phase: z.string().describe('The phase number to complete (e.g., "1", "02", "3.1")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phaseComplete(cwd, args.phase);
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
    name: 'gsd_get_phase_plan',
    description: 'Get the plan index and status for a specific phase.',
    inputSchema: z.object({
      phase: z.string().describe('The phase number (e.g., "1")'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.phasePlanIndex(cwd, args.phase);
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
    name: 'gsd_log_work',
    description: 'Log work metrics (duration, tasks completed) to STATE.md.',
    inputSchema: z.object({
      phase: z.string(),
      plan: z.string(),
      duration: z.string().describe('Duration string (e.g., "45min")'),
      tasks: z.string().optional().describe('Number of tasks completed'),
      files: z.string().optional().describe('Number of files modified'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.recordMetric(cwd, args);
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
    name: 'gsd_commit_work',
    description: 'Commit changes to git using GSD conventions.',
    inputSchema: z.object({
      message: z.string().describe('Commit message'),
      files: z.array(z.string()).optional().describe('List of files to commit. Defaults to .planning/ directory if omitted.'),
      amend: z.boolean().optional().describe('Whether to amend the previous commit'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.commit(cwd, args.message, args.files, args.amend);
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
    name: 'gsd_validate_project',
    description: 'Run health checks on the project configuration and .planning directory.',
    inputSchema: z.object({
      repair: z.boolean().optional().describe('Attempt to auto-repair issues'),
    }),
    handler: async (args, cwd) => {
      const result = gsd.validateHealth(cwd, { repair: args.repair });
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
];

module.exports = { TOOLS: [...TOOLS, ...TOOLS_EXTRA, ...WORKFLOW_TOOLS] };
