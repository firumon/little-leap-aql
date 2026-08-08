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

## 2. Phase 2: Mandatory Granular Subtask Grouping of Changes

> **CRITICAL RULE**: Group commits strictly on the basis of **Granular Subtasks / Work Units**.
> Each commit MUST be a self-contained, atomic unit for one specific subtask or sub-feature, containing the implementation code (setup scripts, components, composables, GAS functions) **AND** its corresponding documentation/template updates (sheet structures, report formulas, component docs) together.
>
> **Task Isolation Rule**: If a session accomplishes multiple distinct subtasks or sub-features (even if part of the same overall directive or session), you MUST split them into **separate atomic commits for each distinct subtask**. Never lump multiple distinct subtasks into a single monolithic commit.

### Example Scenario (Multi-Subtask Session Breakdown):

In a session implementing database additions, UI components, and backend stamp logic:

* **Subtask 1: Database Schema Expansion**:
  - Code/Setup: `GAS/setupOperationSheets.gs`, `GAS/setupMasterSheets.gs`, `GAS/syncAppResources.gs` (headers & UIFields)
  - Sheet Formulas: Report formula templates (`ConsumptionInvoice.md`, `OutletVisitHistory.md`, etc.) & `Sheet Formulas/Views/Outlet.md`
  - Docs: `OPERATION_SHEET_STRUCTURE.md`, `MASTER_SHEET_STRUCTURE.md`
  → Commit 1: `feat(schema): add RespondDate, DueDate, and InvoiceDueDays sheet columns`

* **Subtask 2: UI Field Type Component Registration**:
  - Components: `FRONTENT/src/components/_fields/datetime/{Add,Edit,View}.vue`
  - Resolvers & Mapping: `useFieldResolver.js`, `useFormFields.js`
  - Docs: `FRONTENT/src/components/_fields/README.md`, `RESOURCE_COLUMNS_GUIDE.md`
  → Commit 2: `feat(fields): register datetime field component and resolver aliases`

* **Subtask 3: Backend Workflow Stamp Formatting**:
  - GAS Logic: `sheetHelpers.gs`, `resourceApi.gs`, `warehouseTransfers.gs`, `actionTargets.gs`
  - Docs: `AQL_ACTION_SYSTEM.md`
  → Commit 3: `feat(backend): format workflow stamps with user name and 24h datetime`

| Commit Type | Scope / Category | Example Subtask Commit Group |
|---|---|---|
| `feat` | Database schema addition | `feat(schema): add RespondDate, DueDate, and InvoiceDueDays sheet columns` |
| `feat` | UI Component / Field system | `feat(fields): register datetime field component and resolver aliases` |
| `feat` | Backend GAS logic | `feat(backend): format workflow stamps with user name and 24h datetime` |
| `fix` | Bug fix with doc updates | `fix(ui): correct textarea field binding and update dialog docs` |
| `refactor` | Code refactoring + updated specs | `refactor(pages): streamline form state resolution and update spec docs` |
| `docs` | System prompt or protocol update | `docs(macp): update MACP discussion and simple english rules` |

### Rules for Grouping:
1. **Granular Subtask Grouping**: Identify every distinct subtask completed in the session and group files strictly by subtask.
2. **Unified Code + Docs per Subtask**: Include both code changes AND corresponding documentation/formula updates for that subtask in the exact same commit. Do NOT split docs into a separate commit.
3. **No Monolithic Commits**: Never combine multiple distinct subtasks into a single commit just because they were done in the same session.
4. **Multi-Subtask File Hunk Staging**: If a single file contains changes for multiple subtasks (e.g. `syncAppResources.gs` having schema UIFields edits AND action stamp config edits), stage ONLY the specific lines/hunks belonging to that subtask for its commit (via selective file staging or patch staging), leaving remaining edits for the next subtask commit.

---

## 3. Step-by-Step Commit & Push Checklist

1. **Construct the Granular Subtask Grouping Plan**:
   - Categorize changed files and hunks into distinct subtasks BEFORE running `git add`.
2. **Stage & Commit Subtask by Subtask**:
   - For each subtask group:
     1. Stage ONLY the files/hunks for that subtask (code + docs + formulas): `git add <file1> <file2>`.
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

- **DO NOT** use `git add .` or `git add -A` when multiple subtasks are modified.
- **DO NOT** lump multiple distinct subtasks into one monolithic commit.
- **DO NOT** artificially split documentation edits into separate commits away from the code/formulas they describe.
- **DO NOT** commit secrets, private environment variables, or lockfiles unless requested.
- **DO** keep each subtask change self-contained (code + docs + formulas together).
- **DO** report the exact commit history and breakdown clearly after completion.

