# MCP Server Migration Plan

## Objective
Convert the existing "Get Shit Done" (GSD) CLI tool, currently operating via slash commands and markdown workflows, into a Model Context Protocol (MCP) server. This will enable standard LLM clients (Claude Desktop, etc.) to interact with GSD functionality natively as Tools, Resources, and Prompts.

## Architecture

### 1. Core Logic Refactoring
The current `get-shit-done/bin/gsd-tools.cjs` is a monolithic script that mixes CLI argument parsing with core business logic.
*   **Action**: Extract the core logic functions (e.g., `cmdStateUpdate`, `cmdPhaseAdd`, `cmdCommit`) into a separate library file (e.g., `get-shit-done/lib/gsd-core.js`).
*   **Result**:
    *   `get-shit-done/bin/gsd-tools.cjs`: Becomes a thin wrapper that imports `gsd-core.js` and handles CLI arguments.
    *   `src/mcp-server`: Imports `gsd-core.js` directly to implement MCP Tools.

### 2. MCP Server Components

#### Tools (Executable Functions)
We will map the atomic operations from `gsd-tools.cjs` to MCP Tools.

| MCP Tool Name | Description | Original Command |
| :--- | :--- | :--- |
| `gsd_init_project` | Initialize a new project structure | `init new-project` |
| `gsd_get_state` | Read specific sections of STATE.md | `state get` |
| `gsd_update_state` | Update fields in STATE.md | `state update` |
| `gsd_add_phase` | Add a new phase to the roadmap | `phase add` |
| `gsd_complete_phase` | Mark a phase as complete | `phase complete` |
| `gsd_get_phase_plan` | Get plan details for a phase | `phase plan-index` |
| `gsd_log_work` | Log work/progress to STATE.md | `state record-metric` |
| `gsd_commit_work` | Commit changes to git with GSD conventions | `commit` |
| `gsd_validate_project` | Run health checks on .planning/ directory | `validate health` |

#### Resources (Read-Only Context)
We will expose the project's state files as MCP Resources, allowing the LLM to read them without explicit file system tools.

| URI Pattern | Content Source | Description |
| :--- | :--- | :--- |
| `gsd://current/state` | `.planning/STATE.md` | The current project state and context. |
| `gsd://current/roadmap` | `.planning/ROADMAP.md` | The high-level project roadmap. |
| `gsd://current/requirements` | `.planning/REQUIREMENTS.md` | The active requirements. |
| `gsd://current/config` | `.planning/config.json` | Project configuration. |
| `gsd://current/phase/{phase_num}/plan` | `.planning/phases/{phase}/PLAN.md` | Specific plan file for a phase. |

#### Prompts (Templates)
We will convert the existing `workflows/*.md` files into MCP Prompts.
*   **Mechanism**: The server will read the markdown files and serve them as prompts.
*   **Arguments**: Prompts will accept arguments (e.g., `phase_number`) to fill in templates.
*   **Mapping**:
    *   `gsd_new_project` -> `get-shit-done/workflows/new-project.md`
    *   `gsd_plan_phase` -> `get-shit-done/workflows/plan-phase.md`
    *   `gsd_execute_phase` -> `get-shit-done/workflows/execute-phase.md`

## Implementation Details

### Tech Stack
*   **Runtime**: Node.js (matches existing project).
*   **SDK**: `@modelcontextprotocol/sdk`.
*   **Language**: TypeScript (for the server) or JavaScript (to match existing codebase). Given the existing codebase is JS (`.cjs`), we will likely stick to JS/JSDoc for consistency unless a build step is added.

### Directory Structure
```
/
├── get-shit-done/
│   ├── lib/
│   │   └── gsd-core.js       # Refactored core logic
│   ├── bin/
│   │   └── gsd-tools.cjs     # CLI wrapper (legacy support)
│   └── workflows/            # Existing workflow definitions
├── src/
│   └── mcp-server/
│       ├── index.js          # MCP Server entry point
│       ├── tools.js          # Tool definitions & handlers
│       ├── resources.js      # Resource definitions & handlers
│       └── prompts.js        # Prompt definitions & handlers
│   └── codex-skill/          # OpenAI Codex Integration
│       ├── manifest.yaml     # Skill Definition
│       └── adapter.js        # Compatibility Layer
└── package.json              # Updated dependencies
```

## Migration Steps

1.  **Dependency Setup**:
    *   Add `@modelcontextprotocol/sdk` to `package.json`.

2.  **Refactor Core Logic**:
    *   Modify `get-shit-done/bin/gsd-tools.cjs`.
    *   Extract functions like `cmdStateUpdate`, `cmdPhaseAdd` to `get-shit-done/lib/gsd-core.js`.
    *   Export these functions.
    *   Update `gsd-tools.cjs` to import them.

3.  **Implement MCP Server**:
    *   Create `src/mcp-server/index.js`.
    *   Setup `McpServer` instance.
    *   Implement `listTools`, `callTool` using `gsd-core.js`.
    *   Implement `listResources`, `readResource` reading from `.planning/`.
    *   Implement `listPrompts`, `getPrompt` reading from `workflows/`.

4.  **OpenAI Codex App Integration**:
    *   Create `src/codex-skill/` directory.
    *   **Skill Manifest**: Define `manifest.yaml` (or equivalent standard) that declares the skill's capabilities.
        *   Map MCP Tools to Codex "Scripts".
        *   Map MCP Prompts to Codex "Instructions".
    *   **Adapter**: Create `adapter.js` if necessary to bridge Codex's execution environment to the GSD core logic.
    *   **Packaging**: Ensure the skill can be imported into the Codex app (e.g., via a folder import or packaging command).

5.  **Testing**:
    *   Verify the CLI (`gsd-tools.cjs`) still works (backward compatibility).
    *   Test the MCP server using the MCP Inspector or Claude Desktop.
    *   Test the Codex Skill by importing the `src/codex-skill/` folder into the Codex app.

6.  **Deployment**:
    *   Add a `start-mcp` script to `package.json`.
    *   Update documentation to explain how to configure the MCP server in Claude Desktop and how to add the Skill to OpenAI Codex.

## Risks & Mitigations
*   **State Management**: The CLI relies on `process.cwd()`. The MCP server runs in a specific directory.
    *   *Mitigation*: The MCP server must be started with the project root as its working directory, or accept a `--cwd` argument/config.
*   **Agent Spawning**: The current workflows spawn sub-agents (e.g., `gsd-project-researcher`).
    *   *Mitigation*: For V1, the MCP server will guide the *user's* LLM to act as the sub-agent (via Prompts) rather than spawning independent processes, or we can use the `run_shell_command` equivalent within the tool to spawn the agent CLI if the environment supports it.
