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

### Rules for Grouping:
1. **Strict 1-to-1 Feature-to-Group Mapping**: Identify every distinct feature/subtask completed in the session and create a separate group for each one. Do NOT bundle distinct subtasks under a broad bucket.
2. **Unified Code + Docs per Feature**: Include both implementation edits AND corresponding documentation/registry updates for that specific feature in the exact same commit. Do NOT split docs into a separate commit away from the code they describe.
3. **No Monolithic or Broad-Bucket Commits**: Never combine multiple distinct features (e.g. 2 different resources or 3 different doc updates) into one group just because they were done in the same session.
4. **Multi-Feature File Hunk Staging**: If a single file contains changes for multiple features (e.g. `REGISTRY.md` or `custom.scss`), stage ONLY the specific lines/hunks belonging to that feature for its commit, leaving remaining edits for subsequent commits.

---

## 3. Phase 3: Interactive Group Listing, Re-Grouping & User Confirmation

> **"COMMIT ALL" FAST PATH**: If the user's initial prompt explicitly instructed to **commit all** (e.g. "commit all", "commit all changes", "commit everything"), **SKIP Phase 3 listing** and immediately proceed to **Phase 4 Execution**, committing all prepared groups in their natural sequence.
>
> Otherwise, present all identified commit groups to the user in a numbered list and await user instructions.

### Presentation Format:
For each grouped atomic unit, list:
- **Number**: `[1]`, `[2]`, `[3]`, etc.
- **Title**: A clear, concise title for human reading and understanding.
- **Affected Files**: Explicit file paths included in this commit group.
- **Commit Message**: Proposed conventional commit message (`<type>(<scope>): <precise message>`).

#### Example Output:
```markdown
### Committable Change Groups

#### [1] Agent Startup & Header Update
- **Files**:
  - `AGENTS.md`
  - `CLAUDE.md`
- **Commit Message**: `docs(nexus): update GitNexus MCP tool syntax and analyze command in agent headers`

#### [2] GitNexus Skill Specifications
- **Files**:
  - `.claude/skills/gitnexus/SKILL.md`
  - `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`
- **Commit Message**: `docs(skills): update GitNexus skill definitions for new MCP tool signatures`

#### [3] Auth Composable Registration
- **Files**:
  - `FRONTENT/src/composables/useAuth.js`
  - `FRONTENT/src/composables/REGISTRY.md`
- **Commit Message**: `docs(composables): register useAuth in composables registry`

---
Please reply with the numbers in the order you would like them committed (e.g., `1, 3, 2` or `all` or `1, 2` to skip some, or `1+2, 3` to merge groups into a single commit).
```

### Handling User Response:
1. **Order / Selection Provided** (e.g., `1, 3, 2` or `all` or `1, 2`):
   - Proceed directly to **Phase 4 Execution** in the exact requested sequence.
2. **Merged Groups with `+` Syntax** (e.g., `1+2, 3` or `1+3, 2, 4`):
   - Combine the specified groups (e.g., `1` and `2`) into a single atomic commit containing all files from those groups.
   - Synthesize a new unified conventional commit message covering the combined scope.
   - Proceed directly to **Phase 4 Execution** in the specified sequence.
3. **Regrouping / Relisting with Instructions**:
   - If the user responds with specific feedback to regroup (e.g., "split group 2 into X and Y", "merge 1 and 3 without committing yet"):
   - Re-analyze diffs, reconstruct the groups according to the user's instructions, and re-present the numbered list for confirmation.
4. **Regrouping / Relisting without Specific Instructions**:
   - If the user requests to regroup/relist without details (e.g., "regroup", "try another grouping"):
   - Re-evaluate using alternative logical criteria (e.g., by architectural layer, domain scope, or finer granularity) and re-present the revised numbered list for confirmation.

---

## 4. Phase 4: Execution Checklist

Once confirmation or the "commit all" fast-path is triggered:

1. **Execute in Specified Order**:
   - For each group to be committed, in the determined sequence:
     1. Stage ONLY the files/hunks belonging to that group: `git add <file1> <file2>`.
     2. Verify staged status with `git status`.
     3. **GitNexus Check (Recommended)**: Run `gitnexus_detect_changes()` in the terminal to verify that staged changes only affect expected symbols and execution flows. Skip if not installed or index is stale.
     4. Commit with the proposed message: `git commit -m "<type>(<scope>): <precise message>"`.
2. **Verify Workspace Cleanliness**:
   - Run `git status` and verify all selected groups are committed and only unselected or excluded files remain unstaged/untracked.
3. **Push to Remote (If requested / confirmed by user)**:
   - Identify the target branch. Default to **`main`** unless the user specifies a different branch.
   - Push commits: `git push origin <branch-name>` (e.g., `git push origin main`).
4. **Final Report**:
   - List each committed group with its number, commit message, and abbreviated commit hash.
   - Confirm final workspace status.

---

## 5. Guardrails (DOs and DO NOTs)

- **DO NOT** execute commits before presenting the numbered groups and receiving user confirmation, UNLESS the initial prompt explicitly requested to commit all.
- **DO NOT** use `git add .` or `git add -A` when multiple subtasks are modified.
- **DO NOT** lump multiple distinct subtasks into one monolithic commit.
- **DO NOT** artificially split documentation edits into separate commits away from the code/formulas they describe.
- **DO NOT** commit secrets, private environment variables, or lockfiles unless requested.
- **DO** keep each subtask change self-contained (code + docs + formulas together).
- **DO** honor the user's requested commit order and selection strictly.
- **DO** regenerate and re-present the group list whenever regrouping/relisting is requested.
- **DO** report the exact commit history and breakdown clearly after completion.
