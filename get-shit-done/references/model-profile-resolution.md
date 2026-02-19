# Model Profile Resolution

Resolve model profile once at the start of orchestration, then use it for all delegated agent spawns.

## Resolution Pattern

Call the `gsd_resolve_model` tool to get the resolved model profile. It reads the project config and returns the appropriate model setting.

Default: `balanced` if not set or config missing.

## Lookup Table

@~/.claude/get-shit-done/references/model-profiles.md

Look up the agent in the table for the resolved profile. Pass the model parameter to delegated agent calls:

```xml
<delegate>
  <prompt>...</prompt>
  <subagent_type>gsd-planner</subagent_type>
  <model>{resolved_model}</model>  <!-- "inherit", "sonnet", or "haiku" -->
</delegate>
```

**Note:** Opus-tier agents resolve to `"inherit"` (not `"opus"`). This causes the agent to use the parent session's model, avoiding conflicts with organization policies that may block specific opus versions.

## Usage

1. Call the `gsd_resolve_model` tool once at orchestration start
2. Store the profile value
3. Look up each agent's model from the table when spawning
4. Pass model parameter to each delegated agent call (values: `"inherit"`, `"sonnet"`, `"haiku"`)
