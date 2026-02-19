<purpose>
Interactive configuration of GSD workflow agents (research, plan_check, verifier) and model profile selection via multi-question prompt. Updates .planning/config.json with user preferences. Optionally saves settings as global defaults (~/.gsd/defaults.json) for future projects.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

Call the `gsd_config_ensure` tool, then load current config state.

Creates `.planning/config.json` with defaults if missing and loads current config values.
</step>

<step name="read_current">
```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)
</step>

<step name="present_settings">
Present settings to user with current values pre-selected:

<prompt_user>
  <question header="Model">Which model profile for agents?</question>
  <option label="Quality">Opus everywhere except verification (highest cost)</option>
  <option label="Balanced (Recommended)">Opus for planning, Sonnet for execution/verification</option>
  <option label="Budget">Sonnet for writing, Haiku for research/verification (lowest cost)</option>
</prompt_user>

<prompt_user>
  <question header="Research">Spawn Plan Researcher? (researches domain before planning)</question>
  <option label="Yes">Research phase goals before planning</option>
  <option label="No">Skip research, plan directly</option>
</prompt_user>

<prompt_user>
  <question header="Plan Check">Spawn Plan Checker? (verifies plans before execution)</question>
  <option label="Yes">Verify plans meet phase goals</option>
  <option label="No">Skip plan verification</option>
</prompt_user>

<prompt_user>
  <question header="Verifier">Spawn Execution Verifier? (verifies phase completion)</question>
  <option label="Yes">Verify must-haves after execution</option>
  <option label="No">Skip post-execution verification</option>
</prompt_user>

<prompt_user>
  <question header="Auto">Auto-advance pipeline? (discuss → plan → execute automatically)</question>
  <option label="No (Recommended)">Manual fresh conversation between stages</option>
  <option label="Yes">Chain stages via delegated subagents (same isolation)</option>
</prompt_user>

<prompt_user>
  <question header="Branching">Git branching strategy?</question>
  <option label="None (Recommended)">Commit directly to current branch</option>
  <option label="Per Phase">Create branch for each phase (gsd/phase-{N}-{name})</option>
  <option label="Per Milestone">Create branch for entire milestone (gsd/{version}-{name})</option>
</prompt_user>
</step>

<step name="update_config">
Merge new settings into existing config.json:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.planning/config.json`.
</step>

<step name="save_as_defaults">
Ask whether to save these settings as global defaults for future projects:

<prompt_user>
  <question header="Defaults">Save these as default settings for all new projects?</question>
  <option label="Yes">New projects start with these settings (saved to ~/.gsd/defaults.json)</option>
  <option label="No">Only apply to this project</option>
</prompt_user>

If "Yes": write the same config object (minus project-specific fields like `brave_search`) to `~/.gsd/defaults.json`:

```bash
mkdir -p ~/.gsd
```

Write `~/.gsd/defaults.json` with:
```json
{
  "mode": <current>,
  "depth": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>
  }
}
```
</step>

<step name="confirm">
Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Auto-Advance         | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Saved as Defaults    | {Yes/No} |

These settings apply to future `gsd_plan_phase` and `gsd_execute_phase` tool runs.

Quick commands:
- Use the `gsd_set_profile` tool with `{ "profile": "<profile>" }` — switch model profile
- Use the `gsd_plan_phase` tool with --research — force research
- Use the `gsd_plan_phase` tool with --skip-research — skip research
- Use the `gsd_plan_phase` tool with --skip-verify — skip plan check
```
</step>

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 6 settings (profile + 4 workflow toggles + git branching)
- [ ] Config updated with model_profile, workflow, and git sections
- [ ] User offered to save as global defaults (~/.gsd/defaults.json)
- [ ] Changes confirmed to user
</success_criteria>
</output>