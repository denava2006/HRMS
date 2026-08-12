## AI Workflow

Before implementing any task:

1. Understand the request fully before changing code.
2. Inspect the relevant implementation inside:
   - `integration/hrms`
   - `integration/pos`
   - shared application code under `src`
3. Identify reusable business logic, services, hooks, utilities, database queries, components, and existing patterns before creating new implementations.
4. Reuse existing implementations whenever appropriate instead of duplicating logic.
5. Build new UI using the existing shared design system and current visual patterns.
6. Preserve existing colors, spacing conventions, typography, and layout unless the task explicitly requires a redesign.
7. Keep changes modular, focused, and limited to files relevant to the current task.
8. Avoid unrelated refactors, formatting changes, renames, or architectural changes.
9. Explain major architectural decisions before performing large-scale refactors.
10. Preserve backward compatibility between POS and HRMS whenever possible.
11. FMS is currently under development and is not part of the active integration unless explicitly requested.
12. Do not build, modify, or assume FMS functionality unless the task specifically requires it.

### Agent Responsibilities

Claude Code is the primary implementation agent by default.

Codex is primarily used for:
- code review
- bug detection
- security review
- architecture review
- Playwright/test failure analysis
- backup implementation when Claude is unavailable, reaches usage limits, or explicitly hands off the task

Only one AI agent may actively modify the working tree at a time.

Claude and Codex must never edit the same files simultaneously.

When one agent is actively implementing, the other agent should remain read-only unless a handoff has been explicitly performed.

# AI RULES

- Claude and Codex must never edit the same working tree simultaneously.
- Only one AI agent may be the active writer at a time.
- The other agent may perform read-only review.
- AI agents must never commit or push.
- The user owns all commits and pushes.
- Before taking over, every agent must read PROJECT_CONTEXT.md and AI_HANDOFF.md.
- Before editing, inspect git status and git diff.
- After editing, update AI_HANDOFF.md.

# Claude Skills

Use installed Claude Skills whenever applicable.

Priority

1. UI/UX Design
2. React
3. TypeScript
4. Tailwind CSS
5. shadcn/ui
6. Supabase
7. PostgreSQL
8. Documentation
9. Refactoring
10. Performance Optimization

Always prioritize skill-based solutions over generic generation.

### Git Rules

AI agents may modify local files but must not commit or push.

Only the user is responsible for:
- staging files
- creating commits
- pushing to GitHub
- merging branches

Before editing, inspect the current Git state.

After editing:
1. List all modified files.
2. Explain the purpose of each modification.
3. Report any new or deleted files.
4. Report whether the working tree contains unrelated changes.

Do not:
- run `git commit`
- run `git push`
- force push
- reset the repository
- delete branches
- rewrite Git history
- discard unrelated user changes

### Review Workflow

After Claude completes a substantial implementation, Codex should review the current Git diff.

Codex review should focus on:
- correctness
- regressions
- TypeScript issues
- security
- authentication
- authorization
- RLS
- database safety
- race conditions
- data integrity
- POS/HRMS module boundaries
- duplicated logic
- future FMS compatibility
- test coverage

Review findings should be written to `CODEX_FINDINGS.md` or copied into `AI_HANDOFF.md`.

Each finding should be classified as:
- confirmed
- false positive
- already fixed
- deferred

Do not automatically modify production code based only on a review finding.

### Completion Requirements

Before reporting a task as complete:

1. Verify the requested behavior.
2. Check the current Git diff.
3. Run relevant tests.
4. Ensure no unrelated files were changed.
5. Update `AI_HANDOFF.md` if another agent may continue the work.
6. List modified files.
7. Explain any remaining risks or unresolved issues.
8. Stop without committing or pushing.


## Critical AI Rules

- Only one AI agent may modify files at a time.
- Claude is the primary implementer; Codex is the primary reviewer and backup implementer.
- Read `PROJECT_CONTEXT.md` and `AI_HANDOFF.md` before taking over a task.
- Inspect `git status` and `git diff` before editing.
- Never commit or push; the user controls Git.
- Never reset or wipe the database.
- Preserve POS and HRMS behavior.
- Do not implement FMS unless explicitly requested.
- Verify review findings before fixing them.
- Run relevant tests before declaring work complete.
### Context / Token Limit Rule
When the active AI agent reaches approximately 90% context or usage:

1. Stop starting new implementation work immediately.
2. Do not begin another feature, refactor, or large bug fix.
3. Finish only the current safe atomic operation if stopping midway would leave the code in an invalid state.
4. Update `AI_HANDOFF.md` with the complete current state.
5. Include:
   - current task
   - completed work
   - unfinished work
   - exact files modified
   - important decisions
   - known issues
   - review findings
   - tests already run
   - Playwright results/failures
   - current git status
   - exact next steps for the receiving agent
6. Do not commit or push.
7. Stop after the handoff is complete.

This rule applies to both Claude and Codex.

The receiving agent must read `PROJECT_CONTEXT.md` and `AI_HANDOFF.md`, then inspect `git status` and `git diff` before continuing.