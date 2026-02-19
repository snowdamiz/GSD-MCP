<div align="center">

# GSD MCP Server

**Access [Get Shit Done](https://github.com/glittercowboy/get-shit-done) workflows from any MCP-compatible client.**

**Cursor, Windsurf, Claude Desktop, Cline, OpenAI Codex — anything that speaks MCP.**

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/5JJgD5svVS)

</div>

---

## What This Is

GSD is a context engineering and spec-driven development system. It orchestrates AI agents through structured workflows: question → research → plan → execute → verify. Each step runs in fresh context to prevent quality degradation.

This project is the **MCP server** for GSD. It exposes every GSD workflow as a tool that any MCP client can call. When an agent calls a tool, it gets back the full workflow instructions — the same ones that power the [main GSD project](https://github.com/glittercowboy/get-shit-done).

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/snowdamiz/GSD-MCP.git
cd GSD-MCP
npm install
```

### 2. Add to your MCP client

The config file location depends on your client:

| Client | Config file |
|--------|-------------|
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline | VS Code settings |

Add the server entry:

```json
{
  "mcpServers": {
    "gsd": {
      "command": "node",
      "args": ["/absolute/path/to/GSD-MCP/src/mcp-server/index.js"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

Replace the paths with your actual locations. The `cwd` should point to the project you want to manage with GSD.

### 3. Verify

Restart your MCP client. You should see GSD tools available. Try asking your agent: *"Map my codebase"* or *"Initialize a new project"*.

---

## How It Works

```
You: "Plan phase 1"
         │
         ▼
MCP client calls gsd_plan_phase tool with {phase: "1"}
         │
         ▼
Tool returns full workflow markdown (14k chars)
  - Step 1: Load project state
  - Step 2: Resolve researcher model
  - Step 3: Spawn gsd-phase-researcher agent
  - Step 4: Spawn gsd-planner agent
  - Step 5: Spawn gsd-plan-checker agent
  - Step 6: Loop until plans pass verification
         │
         ▼
Agent follows the workflow step by step
```

The MCP server doesn't execute workflows itself — it returns the instructions. Your MCP client's agent reads them and follows along, calling bash commands, reading files, and making decisions as the workflow directs.

---

## Workflow Tools

30 tools that mirror the full GSD workflow system. Each returns step-by-step instructions for the agent to follow.

### Core Workflow

| Tool | Description |
|------|-------------|
| `gsd_new_project` | Full initialization: questions → research → requirements → roadmap |
| `gsd_discuss_phase` | Capture implementation decisions before planning |
| `gsd_plan_phase` | Research + plan + verify for a phase |
| `gsd_execute_phase` | Execute all plans in parallel waves |
| `gsd_verify_work` | Manual user acceptance testing |
| `gsd_quick` | Ad-hoc task with GSD guarantees |

### Brownfield

| Tool | Description |
|------|-------------|
| `gsd_map_codebase` | Analyze existing codebase with parallel mapper agents |

### Milestones

| Tool | Description |
|------|-------------|
| `gsd_new_milestone` | Start next version cycle |
| `gsd_audit_milestone` | Verify milestone definition of done |
| `gsd_complete_milestone` | Archive milestone and tag release |
| `gsd_plan_milestone_gaps` | Create phases to close audit gaps |

### Phase Management

| Tool | Description |
|------|-------------|
| `gsd_research_phase` | Deep research without planning |
| `gsd_add_phase` | Append phase to roadmap |
| `gsd_insert_phase` | Insert urgent work between phases |
| `gsd_remove_phase` | Remove future phase, renumber |
| `gsd_list_phase_assumptions` | See the agent's intended approach |

### Session

| Tool | Description |
|------|-------------|
| `gsd_progress` | Where am I? What's next? |
| `gsd_pause_work` | Create handoff when stopping mid-phase |
| `gsd_resume_work` | Restore from last session |
| `gsd_debug` | Systematic debugging with persistent state |

### Utilities

| Tool | Description |
|------|-------------|
| `gsd_settings` | Configure workflow settings and model profiles |
| `gsd_set_profile` | Switch model profile (quality/balanced/budget) |
| `gsd_health` | Diagnose and repair project health |
| `gsd_cleanup` | Archive old plans |
| `gsd_update` | Update GSD to latest version |
| `gsd_reapply_patches` | Reapply local mods after update |
| `gsd_add_todo` | Capture idea for later |
| `gsd_check_todos` | List pending todos |
| `gsd_help` | Show help and documentation |
| `gsd_join_discord` | Get Discord invite link |

---

## Utility Tools

16 atomic tools for direct operations. These perform actions immediately rather than returning workflow instructions. Agents use these during workflow execution.

| Tool | Description |
|------|-------------|
| `gsd_init_project` | Detect project state, return initialization metadata |
| `gsd_get_state` | Read STATE.md (optionally a specific section) |
| `gsd_update_state` | Update a field in STATE.md |
| `gsd_add_phase_atomic` | Add phase to roadmap (direct, no workflow) |
| `gsd_complete_phase` | Mark phase complete in roadmap |
| `gsd_get_phase_plan` | Get plan index and status for a phase |
| `gsd_log_work` | Log work metrics to STATE.md |
| `gsd_commit_work` | Git commit using GSD conventions |
| `gsd_validate_project` | Run health checks on .planning/ |
| `gsd_todo_complete` | Mark a todo item as complete |
| `gsd_list_todos` | List pending todos |
| `gsd_scaffold` | Create templates (context, UAT, verification) |
| `gsd_websearch` | Web search via Brave API |
| `gsd_history_digest` | Summarize all phase summaries |
| `gsd_list_phases` | List all phases in the project |
| `gsd_milestone_complete` | Archive current milestone (direct) |

---

## Resources

Read project files directly via MCP resource URIs:

| URI | Content |
|-----|---------|
| `gsd://current/state` | `.planning/STATE.md` |
| `gsd://current/roadmap` | `.planning/ROADMAP.md` |
| `gsd://current/requirements` | `.planning/REQUIREMENTS.md` |
| `gsd://current/config` | `.planning/config.json` |

---

## Typical Usage

### New project on existing codebase

```
1. "Map my codebase"              → gsd_map_codebase
2. "Initialize a new project"     → gsd_new_project
3. "Discuss phase 1"              → gsd_discuss_phase
4. "Plan phase 1"                 → gsd_plan_phase
5. "Execute phase 1"              → gsd_execute_phase
6. "Verify phase 1"               → gsd_verify_work
7. Repeat for each phase...
8. "Complete the milestone"       → gsd_complete_milestone
```

### Quick task

```
"Quick task: add dark mode toggle" → gsd_quick
```

### Resume after a break

```
"Resume work" → gsd_resume_work
```

---

## Configuration

GSD stores project settings in `.planning/config.json`, created during project initialization.

### Model Profiles

Control which model each agent uses. Balance quality vs token cost.

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

Switch with `gsd_set_profile`.

### Workflow Agents

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.research` | `true` | Research domain before planning |
| `workflow.plan_check` | `true` | Verify plans before execution |
| `workflow.verifier` | `true` | Confirm deliverables after execution |
| `workflow.auto_advance` | `false` | Auto-chain discuss → plan → execute |

---

## Credits

Built on top of [Get Shit Done](https://github.com/glittercowboy/get-shit-done) by TÂCHES.

## License

MIT License. See [LICENSE](LICENSE) for details.
