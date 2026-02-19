<purpose>
Display the complete GSD command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
# GSD Command Reference

**GSD** (Get Shit Done) creates hierarchical project plans optimized for solo agentic development with Claude Code.

## Quick Start

1. `gsd_new_project` tool - Initialize project (includes research, requirements, roadmap)
2. `gsd_plan_phase` tool with `{ "phase": "1" }` - Create detailed plan for first phase
3. `gsd_execute_phase` tool with `{ "phase": "1" }` - Execute the phase

## Staying Updated

GSD evolves fast. Update periodically:

```bash
npx get-shit-done-cc@latest
```

## Core Workflow

```
gsd_new_project → gsd_plan_phase → gsd_execute_phase → repeat
```

### Project Initialization

**`gsd_new_project` tool**
Initialize new project through unified flow.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown and success criteria

Creates all `.planning/` artifacts:
- `PROJECT.md` — vision and requirements
- `config.json` — workflow mode (interactive/yolo)
- `research/` — domain research (if selected)
- `REQUIREMENTS.md` — scoped requirements with REQ-IDs
- `ROADMAP.md` — phases mapped to requirements
- `STATE.md` — project memory

Usage: Use the `gsd_new_project` tool

**`gsd_map_codebase` tool**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates `.planning/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `gsd_new_project` on existing codebases

Usage: Use the `gsd_map_codebase` tool

### Phase Planning

**`gsd_discuss_phase` tool**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: Use the `gsd_discuss_phase` tool with `{ "phase": "2" }`

**`gsd_research_phase` tool**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates RESEARCH.md with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: Use the `gsd_research_phase` tool with `{ "phase": "3" }`

**`gsd_list_phase_assumptions` tool**
See what Claude is planning to do before it starts.

- Shows Claude's intended approach for a phase
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: Use the `gsd_list_phase_assumptions` tool with `{ "phase": "3" }`

**`gsd_plan_phase` tool**
Create detailed execution plan for a specific phase.

- Generates `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (XX-01, XX-02, etc.)

Usage: Use the `gsd_plan_phase` tool with `{ "phase": "1" }`
Result: Creates `.planning/phases/01-foundation/01-01-PLAN.md`

### Execution

**`gsd_execute_phase` tool**
Execute all plans in a phase.

- Groups plans by wave (from frontmatter), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates REQUIREMENTS.md, ROADMAP.md, STATE.md

Usage: Use the `gsd_execute_phase` tool with `{ "phase": "5" }`

### Quick Mode

**`gsd_quick` tool**
Execute small, ad-hoc tasks with GSD guarantees but skip optional agents.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md tracking (not ROADMAP.md)

Use when you know exactly what to do and the task is small enough to not need research or verification.

Usage: Use the `gsd_quick` tool
Result: Creates `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`

### Roadmap Management

**`gsd_add_phase` tool**
Add new phase to end of current milestone.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates phase directory structure

Usage: Use the `gsd_add_phase` tool with `{ "description": "Add admin dashboard" }`

**`gsd_insert_phase` tool**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase (e.g., 7.1 between 7 and 8)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: Use the `gsd_insert_phase` tool with `{ "after": 7, "description": "Fix critical auth bug" }`
Result: Creates Phase 7.1

**`gsd_remove_phase` tool**
Remove a future phase and renumber subsequent phases.

- Deletes phase directory and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: Use the `gsd_remove_phase` tool with `{ "phase": "17" }`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`gsd_new_milestone` tool**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Mirrors `gsd_new_project` flow for brownfield projects (existing PROJECT.md).

Usage: Use the `gsd_new_milestone` tool with `{ "name": "v2.0 Features" }`

**`gsd_complete_milestone` tool**
Archive completed milestone and prepare for next version.

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Creates git tag for the release
- Prepares workspace for next version

Usage: Use the `gsd_complete_milestone` tool with `{ "version": "1.0.0" }`

### Progress Tracking

**`gsd_progress` tool**
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: Use the `gsd_progress` tool

### Session Management

**`gsd_resume_work` tool**
Resume work from previous session with full context restoration.

- Reads STATE.md for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: Use the `gsd_resume_work` tool

**`gsd_pause_work` tool**
Create context handoff when pausing work mid-phase.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: Use the `gsd_pause_work` tool

### Debugging

**`gsd_debug` tool**
Systematic debugging with persistent state across context resets.

- Gathers symptoms through adaptive questioning
- Creates `.planning/debug/[slug].md` to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives context resets — run `gsd_debug` with no args to resume
- Archives resolved issues to `.planning/debug/resolved/`

Usage: Use the `gsd_debug` tool with `{ "issue": "login button doesn't work" }`
Usage: Use the `gsd_debug` tool (resume active session)

### Todo Management

**`gsd_add_todo` tool**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo file in `.planning/todos/pending/`
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates STATE.md todo count

Usage: Use the `gsd_add_todo` tool (infers from conversation)
Usage: Use the `gsd_add_todo` tool with `{ "description": "Add auth token refresh" }`

**`gsd_check_todos` tool**
List pending todos and select one to work on.

- Lists all pending todos with title, area, age
- Optional area filter (e.g., `{ "area": "api" }`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done/ when work begins

Usage: Use the `gsd_check_todos` tool
Usage: Use the `gsd_check_todos` tool with `{ "area": "api" }`

### User Acceptance Testing

**`gsd_verify_work` tool**
Validate built features through conversational UAT.

- Extracts testable deliverables from SUMMARY.md files
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: Use the `gsd_verify_work` tool with `{ "phase": "3" }`

### Milestone Auditing

**`gsd_audit_milestone` tool**
Audit milestone completion against original intent.

- Reads all phase VERIFICATION.md files
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates MILESTONE-AUDIT.md with gaps and tech debt

Usage: Use the `gsd_audit_milestone` tool

**`gsd_plan_milestone_gaps` tool**
Create phases to close gaps identified by audit.

- Reads MILESTONE-AUDIT.md and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to ROADMAP.md
- Ready for `gsd_plan_phase` on new phases

Usage: Use the `gsd_plan_milestone_gaps` tool

### Configuration

**`gsd_settings` tool**
Configure workflow toggles and model profile interactively.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates `.planning/config.json`

Usage: Use the `gsd_settings` tool

**`gsd_set_profile` tool**
Quick switch model profile for GSD agents.

- `quality` — Opus everywhere except verification
- `balanced` — Opus for planning, Sonnet for execution (default)
- `budget` — Sonnet for writing, Haiku for research/verification

Usage: Use the `gsd_set_profile` tool with `{ "profile": "budget" }`

### Utility Commands

**`gsd_cleanup` tool**
Archive accumulated phase directories from completed milestones.

- Identifies phases from completed milestones still in `.planning/phases/`
- Shows dry-run summary before moving anything
- Moves phase dirs to `.planning/milestones/v{X.Y}-phases/`
- Use after multiple milestones to reduce `.planning/phases/` clutter

Usage: Use the `gsd_cleanup` tool

**`gsd_help` tool**
Show this command reference.

**`gsd_update` tool**
Update GSD to latest version with changelog preview.

- Shows installed vs latest version comparison
- Displays changelog entries for versions you've missed
- Highlights breaking changes
- Confirms before running install
- Better than raw `npx get-shit-done-cc`

Usage: Use the `gsd_update` tool

**`gsd_join_discord` tool**
Join the GSD Discord community.

- Get help, share what you're building, stay updated
- Connect with other GSD users

Usage: Use the `gsd_join_discord` tool

## Files & Structure

```
.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── milestones/
│   ├── v1.0-ROADMAP.md       # Archived roadmap snapshot
│   ├── v1.0-REQUIREMENTS.md  # Archived requirements
│   └── v1.0-phases/          # Archived phase dirs (via gsd_cleanup or --archive-phases)
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

Set during `gsd_new_project`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime by editing `.planning/config.json`

## Planning Configuration

Configure how planning artifacts are managed in `.planning/config.json`:

**`planning.commit_docs`** (default: `true`)
- `true`: Planning artifacts committed to git (standard workflow)
- `false`: Planning artifacts kept local-only, not committed

When `commit_docs: false`:
- Add `.planning/` to your `.gitignore`
- Useful for OSS contributions, client projects, or keeping planning private
- All planning files still work normally, just not tracked in git

**`planning.search_gitignored`** (default: `false`)
- `true`: Add `--no-ignore` to broad ripgrep searches
- Only needed when `.planning/` is gitignored and you want project-wide searches to include it

Example config:
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## Common Workflows

**Starting a new project:**

```
gsd_new_project        # Unified flow: questioning → research → requirements → roadmap
(fresh conversation)
gsd_plan_phase 1       # Create plans for first phase
(fresh conversation)
gsd_execute_phase 1    # Execute all plans in phase
```

**Resuming work after a break:**

```
gsd_progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
gsd_insert_phase 5 "Critical security fix"
gsd_plan_phase 5.1
gsd_execute_phase 5.1
```

**Completing a milestone:**

```
gsd_complete_milestone 1.0.0
(fresh conversation)
gsd_new_milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
gsd_add_todo                    # Capture from conversation context
gsd_add_todo Fix modal z-index  # Capture with explicit description
gsd_check_todos                 # Review and work on todos
gsd_check_todos api             # Filter by area
```

**Debugging an issue:**

```
gsd_debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
(fresh conversation)
gsd_debug                                    # Resume from where you left off
```

## Getting Help

- Read `.planning/PROJECT.md` for project vision
- Read `.planning/STATE.md` for current context
- Check `.planning/ROADMAP.md` for phase status
- Run the `gsd_progress` tool to check where you're up to
</reference>
</output>