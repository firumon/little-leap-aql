# Initialization: Git Commit & Push Operations

Use this instruction when the user asks to commit changes, push commits, or manage branches.

---

## 1. Phase 1: Status & Diff Review

Before staging or committing anything:
1. **Check Workspace Status**: Run `git status` to see all modified, untracked, and deleted files.
2. **Review Diffs**: Run targeted `git diff` commands to understand the scope and nature of the changes. Keep diff analysis brief and check full diffs only when necessary.
3. **Filter Out Junk & Secrets**:
   - Ensure no API keys, tokens, or credentials are staged.
   - Ignore build outputs (`dist/`, `.quasar/`), local temp folders, or `node_modules/`.

---

## 2. Phase 2: Logical Grouping of Changes

Do not create one giant commit unless all changes are strictly part of a single, coherent change. Split changes into logical groups based on their nature:

| Commit Type | Description |
|---|---|
| `feat` | New feature implementations |
| `fix` | Bug fixes and hotfixes |
| `refactor` | Code restructuring without behavior changes |
| `docs` | Documentation edits, READMEs, or inline comment updates |
| `chore` | Build tasks, package.json updates, dependency changes |
| `config` | Configurations, `.env` templates, clasp settings |
| `test` | Adding or updating unit/e2e tests |
| `style` | Formatting, spacing, alignment, lint corrections |

---

## 3. Step-by-Step Commit & Push Checklist

1. **Stage & Verify Changes**:
   - Stage only the files for the first logical group: `git add <file1> <file2>`.
   - **GitNexus Check (Recommended)**: Before committing, run `gitnexus_detect_changes()` in the terminal to verify that your changes only affect expected symbols and execution flows. If GitNexus is not installed or the index is stale, skip this check and proceed — it is advisory, not blocking.
   - Commit the group with a clear, structured message: `git commit -m "<type>: <summary>"` (e.g., `git commit -m "feat: add outlet visit postponement workflow"`).
   - Repeat this for all other logical groups.
2. **Verify Workspace Cleanliness**:
   - Run `git status` and verify that the working tree is clean.
3. **Push to Remote**:
   - Identify the target branch. Default to **`main`** unless the user specifies a different branch.
   - Push all commits: `git push origin <branch-name>` (e.g., `git push origin main`).
   - **Branching**: If the user specifies a feature branch, push to that branch. Otherwise, default to `main`. Do not create new branches without user instruction.
4. **Final Report**:
   - List each committed group, its commit message, and its abbreviated commit hash.
   - Confirm that the workspace is now clean and synchronized with the remote branch.

---

## 4. Guardrails (DOs and DO NOTs)

- **DO NOT** make one giant commit for multiple unrelated features, fixes, and docs.
- **DO NOT** commit secrets, private environment variables, or lockfiles unless requested.
- **DO** verify that `.gitignore` excludes the staged files before committing — do not commit files that are meant to be ignored.
- **DO** verify that the user's local changes build correctly (if major changes were made) before pushing.
- **DO** report the exact error message and git status if the push fails (e.g., due to out-of-sync remote changes).
