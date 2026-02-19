# GSD MCP Usage Guide for OpenAI Codex

This guide documents how to reliably trigger "Get Shit Done" (GSD) workflows and commands within the OpenAI Codex app.

## Core Workflows (Prompts)

The most reliable way to use GSD is through **Prompts**. These act as templates that guide the agent through a complex process.

**How to trigger:** Type the "Trigger Phrase" in the chat. You can also explicitly ask "Run the [Prompt Name] prompt".

| Prompt Name | Trigger Phrase | Description | Arguments |
| :--- | :--- | :--- | :--- |
| `gsd_new_project` | "Initialize a new project" | Starts the full project setup: questioning → research → requirements → roadmap. | `auto` (optional): Run in auto mode. |
| `gsd_plan_phase` | "Plan phase [N]" | Researches and creates atomic plans for a specific phase. | `phase`: Phase number (e.g., "1"). |
| `gsd_discuss_phase` | "Discuss phase [N]" | Captures your implementation preferences before planning. | `phase`: Phase number. |
| `gsd_execute_phase` | "Execute phase [N]" | Runs the planned tasks for a phase in waves. | `phase`: Phase number. |
| `gsd_verify_work` | "Verify work for phase [N]" | Walks you through manual User Acceptance Testing (UAT). | `phase`: Phase number. |
| `gsd_quick` | "Quick task: [Description]" | Performs a quick, atomic task without full phase planning. | `task`: Description of what to do. |

**Example:**
> "Plan phase 1"
> "Quick task: update the README"

---

## Atomic Tools (Direct Commands)

These tools perform specific actions. The agent will often call these automatically during a workflow, but you can invoke them directly.

**How to trigger:** Give a direct instruction matching the description.

| Tool Name | Trigger Phrase Example | Description |
| :--- | :--- | :--- |
| `gsd_init_project` | "Initialize the GSD structure here" | Creates .planning/ directory and detects codebase. |
| `gsd_get_state` | "Read the project state" | Reads the current status from STATE.md. |
| `gsd_update_state` | "Update state: set Current Phase to 2" | Updates fields in STATE.md. |
| `gsd_add_phase` | "Add a phase called 'User Auth'" | Adds a new phase to the roadmap. |
| `gsd_complete_phase` | "Mark phase 1 as complete" | Updates roadmap and state to show completion. |
| `gsd_get_phase_plan` | "Get the plan for phase 1" | Lists status of plans in a phase. |
| `gsd_log_work` | "Log 30min of work on phase 1" | Records metrics to STATE.md. |
| `gsd_commit_work` | "Commit the changes" | Git commit using GSD conventions. |
| `gsd_validate_project` | "Check project health" | Runs diagnostics on the .planning/ folder. |
| `gsd_map_codebase` | "Map the codebase" | Runs codebase mapping workflow (for brownfield). |
| `gsd_todo_complete` | "Complete todo: fix-bug.md" | Marks a todo item as complete. |
| `gsd_list_todos` | "List pending todos" | Lists all pending todos. |
| `gsd_scaffold` | "Scaffold context for phase 2" | Creates templates (context, uat, etc.). |
| `gsd_websearch` | "Search for 'react patterns'" | Uses configured web search (Brave). |
| `gsd_history_digest` | "Show project history" | Summarizes all phase summaries. |
| `gsd_milestone_complete` | "Complete milestone v1.0" | Archives current milestone and updates history. |

---

## Best Practices for Codex

1.  **Be Specific with Phases**: Always mention the phase number (e.g., "Plan **phase 1**", not just "Plan phase").
2.  **Use "Run prompt" for ambiguity**: If Codex tries to just "talk" instead of doing the work, be explicit:
    *   *"Run the gsd_plan_phase prompt for phase 1"*
3.  **Check State**: If the agent seems lost, type:
    *   *"Read project state"*
    *   This forces it to load your `STATE.md` and re-orient itself.
4.  **Files as Resources**: You can ask Codex to read GSD resources directly:
    *   *"Read the project roadmap"* (Loads `gsd://current/roadmap`)
    *   *"Read the config"* (Loads `gsd://current/config`)

## Troubleshooting

*   **"I don't have that tool"**: Ensure the MCP server is connected (Green dot in Codex settings) and the **Working Directory** path is correct in the configuration.
*   **"Path not found"**: The MCP server relies on `process.cwd()`. If you moved the project or set the wrong Working Directory in Codex, it won't find your files.
