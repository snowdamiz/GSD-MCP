<purpose>

Start a new milestone cycle for an existing project. Loads project context, gathers milestone goals (from MILESTONE-CONTEXT.md or conversation), updates PROJECT.md and STATE.md, optionally runs parallel research, defines scoped requirements with REQ-IDs, spawns the roadmapper to create phased execution plan, and commits all artifacts. Brownfield equivalent of new-project.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (from the `gsd_discuss_phase` tool or manual creation)

## 2. Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:**
- Use features and scope from discuss-milestone
- Present summary for confirmation

**If no context file:**
- Present what shipped in last milestone
- Ask: "What do you want to build next?"
- Use prompt_user to explore features, priorities, constraints, scope

## 3. Determine Milestone Version

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 → v1.1, or v2.0 for major)
- Confirm with user

## 4. Update PROJECT.md

Add/update:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

Update Active requirements section and "Last updated" footer.

## 5. Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section from previous milestone.

## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

Call the `gsd_commit_work` tool with `{ "message": "docs: start milestone v[X.Y] [Name]", "files": ".planning/PROJECT.md .planning/STATE.md" }`.

## 7. Load Context and Resolve Models

Call the `gsd_init_new_milestone` tool. Parse the returned JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

## 8. Research Decision

<prompt_user>
  <question header="Research">Research the domain ecosystem for new features before defining requirements?</question>
  <option label="Research first (Recommended)">Discover patterns, features, architecture for NEW capabilities</option>
  <option label="Skip research">Go straight to requirements</option>
</prompt_user>

**Persist choice to config** (so future `gsd_plan_phase` tool calls honor it):

If "Research first": Call the `gsd_config_set` tool with `{ "key": "workflow.research", "value": "true" }`.

If "Skip research": Call the `gsd_config_set` tool with `{ "key": "workflow.research", "value": "false" }`.

**If "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

```bash
mkdir -p .planning/research
```

Spawn 4 parallel gsd-project-researcher agents. Each uses this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
<delegate>
  <agent type="gsd-project-researcher" model="{researcher_model}">{DIMENSION} research</agent>
  <prompt>
    <research_type>Project Research — {DIMENSION} for [new features].</research_type>

    <milestone_context>
    SUBSEQUENT MILESTONE — Adding [target features] to existing app.
    {EXISTING_CONTEXT}
    Focus ONLY on what's needed for the NEW features.
    </milestone_context>

    <question>{QUESTION}</question>

    <project_context>[PROJECT.md summary]</project_context>

    <downstream_consumer>{CONSUMER}</downstream_consumer>

    <quality_gate>{GATES}</quality_gate>

    <output>
    Write to: .planning/research/{FILE}
    Use template: ~/.claude/get-shit-done/templates/research-project/{FILE}
    </output>
  </prompt>
</delegate>
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 complete, spawn synthesizer:

```
<delegate>
  <agent type="gsd-research-synthesizer" model="{synthesizer_model}">Synthesize research</agent>
  <prompt>
    Synthesize research outputs into SUMMARY.md.

    Read: .planning/research/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

    Write to: .planning/research/SUMMARY.md
    Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
    Commit after writing.
  </prompt>
</delegate>
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**If "Skip research":** Continue to Step 9.

## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md: core value, current milestone goals, validated requirements (what exists).

**If research exists:** Read FEATURES.md, extract feature categories.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Gather requirements through conversation. Ask: "What are the main things users need to do with [new features]?" Clarify, probe for related capabilities, group into categories.

**Scope each category** via prompt_user (multiSelect: true, header max 12 chars):

<prompt_user>
  <question header="[Category]">Which [category] features are in this milestone?</question>
  <option label="[Feature 1]">[brief description]</option>
  <option label="[Feature 2]">[brief description]</option>
  <option label="None for this milestone">Defer entire category</option>
</prompt_user>

Track: Selected → this milestone. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via prompt_user:

<prompt_user>
  <question header="Additions">Any requirements research missed?</question>
  <option label="No, research covered it">Proceed</option>
  <option label="Yes, let me add some">Capture additions</option>
</prompt_user>

**Generate REQUIREMENTS.md:**
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, NOTIF-02). Continue numbering from existing.

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Present FULL requirements list for confirmation:

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**

Call the `gsd_commit_work` tool with `{ "message": "docs: define milestone v[X.Y] requirements", "files": ".planning/REQUIREMENTS.md" }`.

## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**Starting phase number:** Read MILESTONES.md for last phase number. Continue from there (v1.0 ended at phase 5 → v1.1 starts at phase 6).

```
<delegate>
  <agent type="gsd-roadmapper" model="{roadmapper_model}">Create roadmap</agent>
  <prompt>
    <planning_context>
    @.planning/PROJECT.md
    @.planning/REQUIREMENTS.md
    @.planning/research/SUMMARY.md (if exists)
    @.planning/config.json
    @.planning/MILESTONES.md
    </planning_context>

    <instructions>
    Create roadmap for milestone v[X.Y]:
    1. Start phase numbering from [N]
    2. Derive phases from THIS MILESTONE's requirements only
    3. Map every requirement to exactly one phase
    4. Derive 2-5 success criteria per phase (observable user behaviors)
    5. Validate 100% coverage
    6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
    7. Return ROADMAP CREATED with summary

    Write files first, then return.
    </instructions>
  </prompt>
</delegate>
```

**Handle return:**

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`:** Read ROADMAP.md, present inline:

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

**Ask for approval** via prompt_user:

<prompt_user>
  <question header="Roadmap">Does this roadmap structure work for you?</question>
  <option label="Approve">Commit and continue</option>
  <option label="Adjust phases">Tell me what to change</option>
  <option label="Review full file">Show raw ROADMAP.md</option>
</prompt_user>

**If "Adjust":** Get notes, re-spawn roadmapper with revision context, loop until approved.
**If "Review":** Display raw ROADMAP.md, re-ask.

**Commit roadmap** (after approval):

Call the `gsd_commit_work` tool with `{ "message": "docs: create milestone v[X.Y] roadmap ([N] phases)", "files": ".planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md" }`.

## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

Call the `gsd_discuss_phase` tool with `{ "phase": "[N]" }` — gather context and clarify approach

<sub>Start a fresh conversation for best results</sub>

Also: Call the `gsd_plan_phase` tool with `{ "phase": "[N]" }` — skip discussion, plan directly
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research completed (if selected) — 4 parallel agents, milestone-aware
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] gsd-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made (if planning docs committed)
- [ ] User knows next step: Call the `gsd_discuss_phase` tool with `{ "phase": "[N]" }`

**Atomic commits:** Each phase commits its artifacts immediately.
</success_criteria>
</output>
