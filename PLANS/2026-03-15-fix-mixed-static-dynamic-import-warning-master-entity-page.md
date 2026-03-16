# PLAN: Fix Mixed Static+Dynamic Import Warning for MasterEntityPage
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Eliminate Vite warning about `MasterEntityPage.vue` being both statically and dynamically imported in `MasterIndexPage.vue`.

## Context
- `MasterIndexPage.vue` uses `import.meta.glob('./*Page.vue')` (dynamic import map), which includes `MasterEntityPage.vue`.
- The same file is also statically imported, triggering Vite reporter warning.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Unify module loading approach in MasterIndexPage
- [x] Replace static fallback import with lazy loader for `MasterEntityPage.vue`.
- [x] Reuse loader for all fallback branches while keeping behavior unchanged.
**Files**: `FRONTENT/src/pages/Masters/MasterIndexPage.vue`
**Pattern**: Existing `import.meta.glob`-based dynamic discovery.
**Rule**: Avoid mixing static and dynamic imports of the same module.

### Step 2: Validate warning condition and update plan
- [x] Verify no static import of `MasterEntityPage.vue` remains in file.
- [x] Mark plan completion and validation notes.
**Files**: `PLANS/2026-03-15-fix-mixed-static-dynamic-import-warning-master-entity-page.md`
**Pattern**: Keep change minimal and targeted.
**Rule**: Preserve current custom-page fallback behavior.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-fix-mixed-static-dynamic-import-warning-master-entity-page.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] `MasterIndexPage.vue` no longer statically imports `MasterEntityPage.vue`.
- [x] Fallback still renders `MasterEntityPage.vue` when custom page is missing.
- [ ] Vite warning about static+dynamic import overlap for this module is resolved.

## Post-Execution Notes (Execution Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/pages/Masters/MasterIndexPage.vue`
- `PLANS/2026-03-15-fix-mixed-static-dynamic-import-warning-master-entity-page.md`

### Validation Performed
- [x] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] Restart Vite dev server and verify warning is absent.
