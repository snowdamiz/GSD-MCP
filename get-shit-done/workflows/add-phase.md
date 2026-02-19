<purpose>
Add a new integer phase to the end of the current milestone in the roadmap. Automatically calculates next phase number, creates phase directory, and updates roadmap structure.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_arguments">
Parse the command arguments:
- All arguments become the phase description
- Example: `gsd_add_phase` tool with `{ "description": "Add authentication" }` → description = "Add authentication"
- Example: `gsd_add_phase` tool with `{ "description": "Fix critical performance issues" }` → description = "Fix critical performance issues"

If no arguments provided:

```
ERROR: Phase description required
Usage: gsd_add_phase tool with { "description": "<text>" }
Example: gsd_add_phase tool with { "description": "Add authentication system" }
```

Exit.
</step>

<step name="init_context">
Load phase operation context:

Call the `gsd_init_phase_op` tool with `{ "phase": "0" }`.

Check `roadmap_exists` from init JSON. If false:
```
ERROR: No roadmap found (.planning/ROADMAP.md)
Run the `gsd_new_project` tool to initialize.
```
Exit.
</step>

<step name="add_phase">
**Delegate the phase addition to gsd-tools:**

Call the `gsd_add_phase_atomic` tool with `{ "description": "${description}" }`.

The tool handles:
- Finding the highest existing integer phase number
- Calculating next phase number (max + 1)
- Generating slug from description
- Creating the phase directory (`.planning/phases/{NN}-{slug}/`)
- Inserting the phase entry into ROADMAP.md with Goal, Depends on, and Plans sections

Extract from result: `phase_number`, `padded`, `name`, `slug`, `directory`.
</step>

<step name="update_project_state">
Update STATE.md to reflect the new phase:

1. Read `.planning/STATE.md`
2. Under "## Accumulated Context" → "### Roadmap Evolution" add entry:
   ```
   - Phase {N} added: {description}
   ```

If "Roadmap Evolution" section doesn't exist, create it.
</step>

<step name="completion">
Present completion summary:

```
Phase {N} added to current milestone:
- Description: {description}
- Directory: .planning/phases/{phase-num}-{slug}/
- Status: Not planned yet

Roadmap updated: .planning/ROADMAP.md

---

## ▶ Next Up

**Phase {N}: {description}**

Use the `gsd_plan_phase` tool with `{ "phase": "{N}" }`

<sub>Start a fresh conversation for best results</sub>

---

**Also available:**
- Use the `gsd_add_phase` tool to add another phase
- Review roadmap

---
```
</step>

</process>

<success_criteria>
- [ ] `gsd_add_phase_atomic` tool executed successfully
- [ ] Phase directory created
- [ ] Roadmap updated with new phase entry
- [ ] STATE.md updated with roadmap evolution note
- [ ] User informed of next steps
</success_criteria>
</output>