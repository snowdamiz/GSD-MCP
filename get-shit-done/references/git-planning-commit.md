# Git Planning Commit

Commit planning artifacts using the `gsd_commit_work` tool, which automatically checks `commit_docs` config and gitignore status.

## Commit via Tool

Always call the `gsd_commit_work` tool for `.planning/` files -- it handles `commit_docs` and gitignore checks automatically.

Pass the commit message and files list:
- `message`: `"docs({scope}): {description}"`
- `files`: list of files to commit (e.g., `.planning/STATE.md .planning/ROADMAP.md`)

The tool will return `skipped` (with reason) if `commit_docs` is `false` or `.planning/` is gitignored. No manual conditional checks needed.

## Amend previous commit

To fold `.planning/` file changes into the previous commit, call the `gsd_commit_work` tool with the `--amend` flag and the files list.

## Commit Message Patterns

| Command | Scope | Example |
|---------|-------|---------|
| plan-phase | phase | `docs(phase-03): create authentication plans` |
| execute-phase | phase | `docs(phase-03): complete authentication phase` |
| new-milestone | milestone | `docs: start milestone v1.1` |
| remove-phase | chore | `chore: remove phase 17 (dashboard)` |
| insert-phase | phase | `docs: insert phase 16.1 (critical fix)` |
| add-phase | phase | `docs: add phase 07 (settings page)` |

## When to Skip

- `commit_docs: false` in config
- `.planning/` is gitignored
- No changes to commit (check with `git status --porcelain .planning/`)
