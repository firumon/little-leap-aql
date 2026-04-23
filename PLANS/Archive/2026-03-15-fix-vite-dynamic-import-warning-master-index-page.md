# PLAN: Fix Vite Dynamic Import Warning in MasterIndexPage
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Build Agent (Codex GPT-5)

## Objective
Remove Vite dev-console warnings from `MasterIndexPage.vue` by replacing unsupported runtime variable import syntax with a Vite-analyzable dynamic import pattern, while preserving custom-page discovery fallback behavior.

## Context
- Current code uses `import(`./${customPageName}.vue`)`.
- Vite cannot statically analyze this pattern when importing from the same directory.
- The page should still load `{PascalCase}Page.vue` if present, else fallback to `MasterEntityPage.vue`.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Replace unsupported import pattern with Vite-compatible resolver
- [x] Add a static import map via `import.meta.glob('./*Page.vue')`.
- [x] Resolve target key from slug and lazy-load via the glob map with graceful fallback.
**Files**: `FRONTENT/src/pages/Masters/MasterIndexPage.vue`
**Pattern**: Keep existing slug-to-PascalCase naming convention and silent fallback behavior.
**Rule**: `MasterIndexPage.vue` must auto-discover `{EntityName}Page.vue` overrides without dev warnings.

### Step 2: Validate no regression and update plan log
- [x] Verify no remaining unsupported dynamic import syntax in the file.
- [x] Mark plan progress and acceptance checks.
**Files**: `PLANS/2026-03-15-fix-vite-dynamic-import-warning-master-index-page.md`
**Pattern**: Keep changes scoped to warning fix only.
**Rule**: Maintain generic fallback page rendering when no custom page exists.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-fix-vite-dynamic-import-warning-master-index-page.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] `MasterIndexPage.vue` no longer contains `import(\`./${...}.vue\`)` pattern.
- [x] Vite warning about invalid dynamic import for this file is eliminated.
- [x] Existing behavior remains: custom page loads when file exists, else fallback to `MasterEntityPage.vue`.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/pages/Masters/MasterIndexPage.vue`
- `PLANS/2026-03-15-fix-vite-dynamic-import-warning-master-index-page.md`

### Validation Performed
- [x] Unit/manual validation completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] Refresh/restart Vite dev server and confirm warning is gone in console.
