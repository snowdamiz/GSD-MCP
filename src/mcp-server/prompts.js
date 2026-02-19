const path = require('path');
const gsd = require('../../get-shit-done/lib/gsd-core.js');
const { z } = require('zod');

// ─── GSD root for include resolution ───
const GSD_ROOT = path.resolve(__dirname, '../../get-shit-done');

function resolveIncludes(content) {
  return content.replace(/@~\/\.claude\/get-shit-done\/([\w\-\/]+\.md)/g, (match, relPath) => {
    const fullPath = path.join(GSD_ROOT, relPath);
    const included = gsd.safeReadFile(fullPath);
    return included || match;
  });
}

const PROMPTS = [
  // ─── Core Workflows ───
  {
    name: 'gsd_new_project',
    description: 'Workflow to initialize a new project (questioning -> research -> requirements -> roadmap)',
    arguments: [
      { name: 'auto', description: 'Run in auto mode (requires idea document)', required: false }
    ],
    file: 'new-project.md',
  },
  {
    name: 'gsd_plan_phase',
    description: 'Workflow to plan a specific phase (research -> plan -> verify)',
    arguments: [
      { name: 'phase', description: 'The phase number to plan', required: true }
    ],
    file: 'plan-phase.md',
  },
  {
    name: 'gsd_execute_phase',
    description: 'Workflow to execute a planned phase (waves of tasks)',
    arguments: [
      { name: 'phase', description: 'The phase number to execute', required: true }
    ],
    file: 'execute-phase.md',
  },
  {
    name: 'gsd_discuss_phase',
    description: 'Workflow to discuss implementation details before planning a phase',
    arguments: [
      { name: 'phase', description: 'The phase number to discuss', required: true }
    ],
    file: 'discuss-phase.md',
  },
  {
    name: 'gsd_verify_work',
    description: 'Workflow to manually verify completed work (UAT)',
    arguments: [
      { name: 'phase', description: 'The phase number to verify', required: true }
    ],
    file: 'verify-work.md',
  },
  {
    name: 'gsd_quick',
    description: 'Workflow for quick, ad-hoc tasks without full phase planning',
    arguments: [
      { name: 'task', description: 'Description of the task to perform', required: true }
    ],
    file: 'quick.md',
  },
  {
    name: 'gsd_map_codebase',
    description: 'Workflow to analyze existing codebase with parallel mapper agents',
    arguments: [
      { name: 'area', description: 'Specific area to focus on (e.g., "api", "auth")', required: false }
    ],
    file: 'map-codebase.md',
  },

  // ─── Milestone & Roadmap Workflows ───
  {
    name: 'gsd_new_milestone',
    description: 'Start a new milestone cycle (requirements -> roadmap)',
    arguments: [
      { name: 'name', description: 'Name of the milestone', required: false }
    ],
    file: 'new-milestone.md',
  },
  {
    name: 'gsd_audit_milestone',
    description: 'Verify the current milestone has achieved its definition of done',
    arguments: [],
    file: 'audit-milestone.md',
  },
  {
    name: 'gsd_plan_milestone_gaps',
    description: 'Plan phases to address gaps identified in a milestone audit',
    arguments: [],
    file: 'plan-milestone-gaps.md',
  },
  {
    name: 'gsd_complete_milestone',
    description: 'Workflow to archive completed milestone and prepare for next version',
    arguments: [
      { name: 'version', description: 'Version string (e.g., "1.0", "v2.0")', required: true }
    ],
    file: 'complete-milestone.md',
  },

  // ─── Phase Management Workflows ───
  {
    name: 'gsd_research_phase',
    description: 'Run deep research for a phase without planning tasks',
    arguments: [
      { name: 'phase', description: 'The phase number to research', required: true }
    ],
    file: 'research-phase.md',
  },
  {
    name: 'gsd_insert_phase',
    description: 'Insert a new phase into the existing roadmap',
    arguments: [
      { name: 'after_phase', description: 'Insert after this phase number', required: true },
      { name: 'description', description: 'Description of the new phase', required: true }
    ],
    file: 'insert-phase.md',
  },
  {
    name: 'gsd_remove_phase',
    description: 'Remove a phase from the roadmap and renumber subsequent phases',
    arguments: [
      { name: 'phase', description: 'The phase number to remove', required: true }
    ],
    file: 'remove-phase.md',
  },
  {
    name: 'gsd_add_phase',
    description: 'Workflow to add a new phase to the end of the current milestone',
    arguments: [
      { name: 'description', description: 'Description of the new phase', required: true }
    ],
    file: 'add-phase.md',
  },
  {
    name: 'gsd_list_phase_assumptions',
    description: 'List assumptions made during phase planning',
    arguments: [
      { name: 'phase', description: 'The phase number', required: true }
    ],
    file: 'list-phase-assumptions.md',
  },

  // ─── Session & Maintenance Workflows ───
  {
    name: 'gsd_debug',
    description: 'Systematic debugging workflow with persistent state',
    arguments: [
      { name: 'issue', description: 'Description of the issue to debug', required: false }
    ],
    file: 'debug.md',
  },
  {
    name: 'gsd_progress',
    description: 'Check project progress, show context, and route to next action',
    arguments: [],
    file: 'progress.md',
  },
  {
    name: 'gsd_pause_work',
    description: 'Create a handoff summary when stopping work mid-phase',
    arguments: [],
    file: 'pause-work.md',
  },
  {
    name: 'gsd_resume_work',
    description: 'Restore context from the last session',
    arguments: [],
    file: 'resume-project.md',
  },
  {
    name: 'gsd_health',
    description: 'Diagnose and repair project health issues',
    arguments: [
      { name: 'repair', description: 'Attempt auto-repair', required: false }
    ],
    file: 'health.md',
  },
  {
    name: 'gsd_cleanup',
    description: 'Archive old plans and clean up the workspace',
    arguments: [],
    file: 'cleanup.md',
  },
  {
    name: 'gsd_update',
    description: 'Update GSD to the latest version',
    arguments: [],
    file: 'update.md',
  },
  {
    name: 'gsd_reapply_patches',
    description: 'Reapply local modifications after a GSD update',
    arguments: [],
    file: 'reapply-patches.md',
  },
  {
    name: 'gsd_settings',
    description: 'Configure GSD workflow settings and model profiles',
    arguments: [],
    file: 'settings.md',
  },
  {
    name: 'gsd_set_profile',
    description: 'Switch the active model profile (quality/balanced/budget)',
    arguments: [
      { name: 'profile', description: 'Profile name', required: true }
    ],
    file: 'set-profile.md',
  },
  
  // ─── Todos ───
  {
    name: 'gsd_add_todo',
    description: 'Capture a task or idea for later',
    arguments: [
      { name: 'description', description: 'The task description', required: true }
    ],
    file: 'add-todo.md',
  },
  {
    name: 'gsd_check_todos',
    description: 'Review and manage pending todos',
    arguments: [],
    file: 'check-todos.md',
  },
  
  // ─── Info ───
  {
    name: 'gsd_help',
    description: 'Show GSD help and documentation',
    arguments: [],
    file: 'help.md',
  },
  {
    name: 'gsd_join_discord',
    description: 'Get the invitation link for the GSD Discord community',
    arguments: [],
    file: 'join-discord.md',
  },
];

async function getPrompt(name, args, cwd) {
  const promptDef = PROMPTS.find(p => p.name === name);
  if (!promptDef) throw new Error(`Prompt ${name} not found`);

  const workflowPath = path.join(cwd, 'get-shit-done', 'workflows', promptDef.file);
  
  let content = gsd.safeReadFile(workflowPath);
  if (!content) {
    // Try resolving relative to this file (if run from inside node_modules or src)
    // Adjust path to point to the root of the repo/package
    const relPath = path.resolve(__dirname, '../../get-shit-done/workflows', promptDef.file);
    content = gsd.safeReadFile(relPath);
  }
  
  if (!content) throw new Error(`Workflow file ${promptDef.file} not found`);

  content = resolveIncludes(content);

  let prefix = '';
  if (args) {
    prefix = `<arguments>\n${JSON.stringify(args, null, 2)}\n</arguments>\n\n`;
  }

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prefix + content,
        },
      },
    ],
  };
}

module.exports = { PROMPTS, getPrompt };
