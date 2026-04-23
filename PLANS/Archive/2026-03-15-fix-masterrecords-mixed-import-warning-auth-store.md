# PLAN: Fix masterRecords Mixed Import Warning from auth Store
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Remove Vite warning by eliminating dynamic import of `masterRecords.js` from `auth.js` where the module is already statically imported in other app entry paths.

## Context
- Warning reports `masterRecords.js` is imported dynamically by `auth.js` and statically by `App.vue`, `useMasterPage.js`, and `products.js`.
- Mixed import modes prevent chunk split and trigger the reporter warning.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Replace dynamic import in auth store with static import
- [x] Add static named import for `syncAllMasterResources` in `auth.js`.
- [x] Replace `import(...).then(...)` block with direct Promise call to keep non-blocking behavior.
**Files**: `FRONTENT/src/stores/auth.js`
**Pattern**: Existing `.catch(...).finally(...)` flow for `isGlobalSyncing`.
**Rule**: Preserve current login behavior while removing mixed import warning.

### Step 2: Validate warning condition and update plan
- [x] Verify no dynamic import of `masterRecords` remains in source.
- [x] Mark progress and acceptance.
**Files**: `PLANS/2026-03-15-fix-masterrecords-mixed-import-warning-auth-store.md`
**Pattern**: Keep fix minimal to import style only.
**Rule**: No functional regression in global sync trigger.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-fix-masterrecords-mixed-import-warning-auth-store.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] `auth.js` no longer dynamically imports `src/services/masterRecords`.
- [x] Global post-login sync still runs in background with error handling.
- [ ] Vite reporter warning for this mixed import is resolved.

## Post-Execution Notes (Execution Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/stores/auth.js`
- `PLANS/2026-03-15-fix-masterrecords-mixed-import-warning-auth-store.md`

### Validation Performed
- [x] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] Restart Vite dev server and confirm warning is gone.
