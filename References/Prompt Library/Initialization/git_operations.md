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

## 2. Phase 2: Mandatory Logical Grouping of Changes

> **CRITICAL RULE**: NEVER make one single monolithic commit when multiple distinct features, modules, components, documentation files, or backend scripts are modified together. You MUST categorize all changed files into separate, atomic, single-topic commits with precise messages.

Before executing `git add`, analyze all changed files and split them into distinct logical groups based on domain, scope, and feature area:

| Commit Type | Scope / Category | Example Group |
|---|---|---|
| `feat` | New feature implementation or core subsystem addition | `feat(tokens): add list view dynamic date and user tokens` |
| `fix` | Bug fixes, reactivity fixes, or prop corrections in specific components | `fix(ui): adjust textarea field props and action dialog handling` |
| `refactor` | Structural refactoring of pages, composables, or views | `refactor(pages): update purchase requisition and outlet payment pages` |
| `docs` | Documentation edits, READMEs, or architectural guides | `docs: update list switcher and resource columns documentation` |
| `config` / `prompt` | Prompt library updates, AGENTS.md, or system init prompts | `docs(prompts): add list view tokens init prompt and update AGENTS.md` |
| `gas` / `backend` | Google Apps Script backend changes | `feat(gas): update appMenu and listViewsManager GAS scripts` |

### Rules for Grouping:
1. **One Domain per Commit**: Do not mix backend GAS files, frontend composables, page components, and documentation in the same commit unless they are inextricably tied to a single 1-2 file change.
2. **Feature Isolation**: Separate reusable utility/core updates from individual page/component consumption edits.
3. **Doc & Prompt Isolation**: Commit system documentation, initialization prompts, and `AGENTS.md` separately from application code changes when possible.

---

## 3. Step-by-Step Commit & Push Checklist

1. **Construct the Grouping Plan**:
   - List each group of files and its intended commit message BEFORE running `git add`.
2. **Stage & Commit Group by Group**:
   - For each group:
     1. Stage ONLY the files in that specific group: `git add <file1> <file2>`.
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

- **DO NOT** use `git add .` or `git add -A` when multiple unrelated files/directories are modified.
- **DO NOT** combine independent features, UI fixes, backend GAS updates, and doc edits into one commit.
- **DO NOT** commit secrets, private environment variables, or lockfiles unless requested.
- **DO** verify that `.gitignore` excludes staged files and respect all user-specified file exclusions.
- **DO** report the exact commit history and breakdown clearly after completion.
