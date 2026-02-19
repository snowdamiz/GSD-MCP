
const path = require('path');
const { z } = require('zod');
const gsd = require('../../get-shit-done/lib/gsd-core.js');
const { PROMPTS } = require('./prompts.js');

function loadWorkflow(name, cwd) {
  const filename = name.endsWith('.md') ? name : name + '.md';
  const workflowPath = path.join(cwd, 'get-shit-done', 'workflows', filename);
  let content = gsd.safeReadFile(workflowPath);
  if (!content) {
    const relPath = path.resolve(__dirname, '../../get-shit-done/workflows', filename);
    content = gsd.safeReadFile(relPath);
  }
  return content;
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
