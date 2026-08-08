# Initialization: Git Commit & Push Operations

> **Scope boundary**: This document covers git operations only (commit, push, branch management). It does not require loading any other init prompt. Self-contained.

Use this instruction when the user asks to commit changes, push commits, or manage branches.

---

## 1. Phase 1: Status & Diff Review

Before staging or committing anything:
1. **Check Workspace Status**: Run `git status` to see all modified, untracked, and deleted files.
2. **Review Diffs**: Run targeted `git diff` or `git diff --stat` commands to understand the scope, domain, and nature of each changed file.
3. **Filter Out Junk & Secrets**:
   - Ensure no API keys, tokens, or credentials are staged.
   - Ignore build outputs (`dist/`, `.quasar/`), local temp folders, or `node_modules/`.
   - Respect user exclusions (e.g., exclude paths explicitly requested by the user).

---

## 2. Phase 2: Mandatory Feature-Based Grouping of Changes

> **CRITICAL RULE**: Group commits strictly on the basis of **Feature / Work Unit**.
> Each commit must be a self-contained unit for one specific feature or task, containing the code changes (composables, components, schemas) **AND** its corresponding documentation updates (canonical docs, registries, prompts) together.
>
> NEVER split a single feature into "code commit" vs "docs commit". Documentation edits belong in the exact same commit as the feature code they describe.
>
> **Task Isolation Rule**: If a session completes multiple distinct features or tasks, you MUST create **separate atomic commits for each distinct task/feature**. Never combine two distinct tasks into a single commit.

### Example Scenarios:

* **Scenario A (Code + Docs for 2 Features)**:
  - Task 1: Refactoring `useAdditionalActions` into a modular pipeline → Commit 1: `feat(actions): add modular request pipeline` (includes pipeline code + action docs + registry).
  - Task 2: Adding `includeAdditionalAction` to `usePageState` → Commit 2: `feat(pagestate): integrate additional actions into pageState batching` (includes pageState code + pageState docs).

* **Scenario B (Documentation / Prompt Updates for 2 Features)**:
  - Task 1: Updating MACP protocol rules in `MACP.md` → Commit 1: `docs(macp): update MACP simple english & pre-directive discussion rules`.
  - Task 2: Updating Git commit rules in `git_operations.md` → Commit 2: `docs(git): enforce feature-based commit grouping`.

| Commit Type | Scope / Category | Example Feature Group |
|---|---|---|
| `feat` | Complete feature implementation (code + docs) | `feat(actions): add modular request pipeline (pipeline code + action docs + registry)` |
| `feat` | Subsystem integration (code + docs) | `feat(pagestate): integrate additional actions into pageState batching (pageState code + pageState docs)` |
| `fix` | Bug fix with doc updates | `fix(ui): correct textarea field binding and update dialog docs` |
| `refactor` | Code refactoring + updated specs | `refactor(pages): streamline form state resolution and update spec docs` |
| `docs` | System prompt or protocol update | `docs(macp): update MACP discussion and simple english rules` |

### Rules for Grouping:
1. **Feature-First Grouping**: Group files by the **feature/task** they belong to. Code, tests, and documentation for a specific feature MUST be committed together in one atomic commit.
2. **Task Isolation**: If multiple separate tasks/features were implemented in one session, split them into separate commits per task/feature.
3. **No Artificial File-Type Splitting**: Do NOT artificially split docs into a separate commit from the feature code they describe. Keep the feature and its docs unified.
4. **No Combining Unrelated Tasks**: Never combine two distinct tasks/features into one single commit, even if both are doc files or both are code files. Each task gets its own commit.
5. **Multi-Feature File Hunk Staging**: If a single file contains modifications belonging to multiple distinct features/tasks, stage ONLY the specific lines/hunks belonging to that feature for its commit (e.g., via patch/hunk staging `git add -p` or selective staging), leaving the remaining edits in that same file to be staged in their respective feature commit.

---

## 3. Step-by-Step Commit & Push Checklist

1. **Construct the Feature Grouping Plan**:
   - Categorize changed files by feature/task (combining code + docs for each feature) BEFORE running `git add`.
2. **Stage & Commit Feature by Feature**:
   - For each feature group:
     1. Stage ONLY the files for that feature (code + docs): `git add <file1> <file2>`.
     2. Verify staged status with `git status`.
     3. **GitNexus Check (Recommended)**: Before committing, run `gitnexus_detect_changes()` in the terminal to verify that your staged changes only affect expected symbols and execution flows. If GitNexus is not installed or the index is stale, skip this check.
     4. Commit with a precise, descriptive message: `git commit -m "<type>(<scope>): <precise message>"`.
3. **Verify Workspace Cleanliness**:
   - Run `git status` and verify all intended files are committed and only user-excluded files remain untracked/unstaged.
4. **Push to Remote (If requested / applicable)**:
   - Identify the target branch. Default to **`main`** unless the user specifies a different branch.
   - Push all commits: `git push origin <branch-name>` (e.g., `git push origin main`).
5. **Final Report**:
   - List each committed group, its commit message, and its abbreviated commit hash.
   - Confirm workspace status.

---

## 4. Guardrails (DOs and DO NOTs)

- **DO NOT** use `git add .` or `git add -A` when multiple unrelated features/tasks are modified.
- **DO NOT** artificially split documentation edits into separate commits away from the feature code they describe.
- **DO NOT** commit secrets, private environment variables, or lockfiles unless requested.
- **DO** keep each feature change self-contained (code + docs + tests together).
- **DO** report the exact commit history and breakdown clearly after completion.
