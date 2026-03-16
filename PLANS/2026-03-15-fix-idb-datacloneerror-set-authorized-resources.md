# PLAN: Fix IDB DataCloneError in setAuthorizedResources
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Build Agent (Codex GPT-5)

## Objective
Prevent IndexedDB `DataCloneError` in `setAuthorizedResources` by ensuring only plain serializable values are written to `resource-meta`.

## Context
- Console error: `DataCloneError: Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned`.
- `setAuthorizedResources` currently writes `resource.headers` and `resource.permissions` directly.
- `resources.value` in Pinia is reactive; nested arrays/objects can be proxies and fail structured clone.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Sanitize fields before IDB put
- [x] Normalize `headers` to plain string array.
- [x] Normalize `permissions` to plain object/primitive clone-safe shape.
- [x] Keep existing fallback behavior for other metadata fields.
**Files**: `FRONTENT/src/utils/db.js`
**Pattern**: Small helper functions local to db util.
**Rule**: IndexedDB writes must use structured-clone-safe values only.

### Step 2: Validate and close plan
- [x] Verify `setAuthorizedResources` no longer writes raw reactive structures.
- [x] Mark acceptance and progress updates.
**Files**: `PLANS/2026-03-15-fix-idb-datacloneerror-set-authorized-resources.md`
**Pattern**: Scope fix to IDB write path.
**Rule**: No behavior regression in metadata persistence.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-fix-idb-datacloneerror-set-authorized-resources.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] `setAuthorizedResources` stores clone-safe plain values in IndexedDB.
- [ ] Login flow no longer throws `DataCloneError` from this call path.
- [x] Existing metadata (`headers`, permissions, file info, sync cursor) remains persisted.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/utils/db.js`
- `PLANS/2026-03-15-fix-idb-datacloneerror-set-authorized-resources.md`

### Validation Performed
- [x] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] Re-login and verify no IDB DataCloneError appears in browser console.
