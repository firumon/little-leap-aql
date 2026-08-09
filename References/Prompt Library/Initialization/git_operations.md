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

## 2. Phase 2: Mandatory Hyper-Granular Atomic Commits (Single-Feature Grouping)

> **CRITICAL RULE**: Group commits strictly on the basis of **Single-Feature Atomic Units**.
> Each commit MUST be a hyper-granular, self-contained atomic unit for **EXACTLY ONE single feature, component, or subtask**. Never bundle multiple features or subtasks into a single broad domain bucket.
>
> **Atomic Single-Feature Isolation Rule**:
> * **Strict 1 Feature = 1 Commit**: If a session touches 3 distinct items (e.g., updating agent startup routing, updating skill specs, and registering a composable), you MUST create 3 separate atomic commit groups — NOT 1 combined "docs" or "codebase" group.
> * **Unified Code + Docs per Feature**: Every atomic commit includes the implementation code (components, composables, setup scripts) **AND** its corresponding documentation/template updates (sheet structures, component docs, registries) for that exact feature together.

### Example Scenario (Multi-Feature Breakdown):

In a session updating instructions, auth composables, component relocations, and custom UI pages:

* **Group 1: Agent Startup Instructions Update**:
  - Files: `AGENTS.md`, `CLAUDE.md`
  → Commit 1: `docs(nexus): update GitNexus MCP tool syntax and analyze command in agent headers`

* **Group 2: GitNexus Skill Specifications**:
  - Files: `.claude/skills/gitnexus/*.md`
  → Commit 2: `docs(skills): update GitNexus skill definitions for new MCP tool signatures`

* **Group 3: Auth Composable Registry**:
  - Files: `useAuth.js`, `FRONTENT/src/composables/REGISTRY.md`
  → Commit 3: `docs(composables): register useAuth in composables registry`

* **Group 4: Component Relocation**:
  - Files: `AqlGroupedList.vue` (moved to `app/`), `WarehouseTransfers/AddPage.vue`, `FRONTENT/src/components/REGISTRY.md`
  → Commit 4: `refactor(components): relocate AqlGroupedList to components/app/`

| Commit Type | Scope / Category | Example Atomic Single-Feature Commit Group |
|---|---|---|
| `feat` | Single UI Component | `feat(fields): enable select search filtering dynamically for 15+ options` |
| `feat` | Single Resource Custom UI | `feat(consumptions): add custom UI pages, boards, and wizard for OutletConsumptions` |
| `refactor` | Single Page Refactor | `refactor(restocks): streamline OutletRestocks AddPage into thin Page wrapper` |
| `docs` | Specific Protocol / Doc | `docs(nexus): update GitNexus MCP tool syntax in agent headers` |
| `docs` | Registry Update | `docs(composables): register useAuth in composables registry` |
| `style` | Specific CSS Utility Set | `style(ui): add subtle card gradient utilities and update custom UI spacing guide` |

### Rules for Grouping:
1. **Strict 1-to-1 Feature-to-Group Mapping**: Identify every distinct feature/subtask completed in the session and create a separate group for each one. Do NOT bundle distinct subtasks under a broad bucket.
2. **Unified Code + Docs per Feature**: Include both implementation edits AND corresponding documentation/registry updates for that specific feature in the exact same commit. Do NOT split docs into a separate commit away from the code they describe.
3. **No Monolithic or Broad-Bucket Commits**: Never combine multiple distinct features (e.g. 2 different resources or 3 different doc updates) into one group just because they were done in the same session.
4. **Multi-Feature File Hunk Staging**: If a single file contains changes for multiple features (e.g. `REGISTRY.md` or `custom.scss`), stage ONLY the specific lines/hunks belonging to that feature for its commit, leaving remaining edits for subsequent commits.

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

