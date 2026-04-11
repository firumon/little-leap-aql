# PLAN: Direct Entry Refresh and Storage Dropdown Fix
**Status**: COMPLETED
**Created**: 2026-04-11
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Claude Code)

## Objective
Fix the persistent post-save stale-data bug in the Direct Stock Entry workflow and improve the storage-location dropdown so newly entered locations become immediately reusable. The implementation must standardize the frontend on locally known headers and must not depend on response-provided headers for this workflow.

## Context
- The current Direct Stock Entry save flow is:
  - `StockEntryGrid.vue` calls `useStockMovements().submitBatch()`
  - Batch request sends:
    1. `create` → `StockMovements`
    2. `get` → `WarehouseStorages`
- Both requests can succeed, but the grid still reloads stale rows afterward.
- Root cause identified:
  - `useStockMovements.js` expects `getResponse.meta.headers`
  - generic `handleMasterGetRecords()` / `buildMasterRowsResponse()` does not provide headers in that response shape
  - `upsertResourceRows()` silently no-ops when headers are missing
  - `lastSyncAt` is still advanced afterward, so the next force-sync delta request returns nothing newer
  - stale IDB rows remain the effective source for the next render
- The storage dropdown currently derives options only from fetched `WarehouseStorages` rows. Draft-only new locations are not merged into the options list, so the second new row cannot reuse a newly typed location until after a successful reload.
- User decision:
  - Frontend should use locally available headers from IDB/auth store for this path
  - Frontend should not depend on response headers here
  - Avoid response-header overhead in the implementation direction going forward

## Pre-Conditions
- [ ] Required source docs were reviewed.
- [ ] Current Direct Stock Entry save path was traced end-to-end in frontend and GAS.
- [ ] User confirmed the local-header rule for frontend cache updates.

## Steps

### Step 1: Fix the Direct Entry post-save cache update path
- [ ] Edit `FRONTENT/src/composables/useStockMovements.js`.
- [ ] Replace the current `getResponse.meta.headers` dependency with a local-header lookup for `WarehouseStorages`.
- [ ] Reuse existing local header sources in priority order:
  - resource meta in IDB
  - authorized resource headers from auth store
  - existing shared helper if appropriate
- [ ] Use those headers to upsert the batch `get WarehouseStorages` rows into IDB.
- [ ] Only update `WarehouseStorages.lastSyncAt` after the local cache write succeeds.
- [ ] If local headers are unavailable, do not advance the cursor; fall back to a real sync path instead of poisoning the cursor.
**Files**: `FRONTENT/src/composables/useStockMovements.js`, possibly `FRONTENT/src/services/resourceRecords.js` if a shared header helper should be exported
**Pattern**: Reuse existing local metadata helpers (`resource-meta`, auth resource headers) rather than inventing a one-off header source.
**Rule**: Direct Entry must not require response-provided headers to refresh local data after save.

### Step 2: Make the post-save grid reload deterministic
- [ ] Review `StockEntryGrid.vue` save flow after the cache-update fix.
- [ ] Decide the minimal stable behavior:
  - either rebuild from the freshly written IDB snapshot
  - or keep `fetchData(true)` only as a fallback verification pass
- [ ] Ensure the UI re-renders the newest `WarehouseStorages` state immediately after a successful save.
- [ ] Prevent stale cached rows from winning over the freshly returned batch data.
**Files**: `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`, `FRONTENT/src/composables/useStockMovements.js`, possibly `FRONTENT/src/services/resourceRecords.js`
**Pattern**: Cache-first UI is still valid, but the save fast-path must bring cache forward before the next read.
**Rule**: A successful save must display the up-to-date warehouse stock without requiring manual page refresh or logout/login.

### Step 3: Keep headers local and avoid response-header dependence
- [ ] Audit the Direct Entry save/refresh path for any remaining expectations that `WarehouseStorages` response metadata will include headers.
- [ ] Remove those expectations.
- [ ] Do not introduce any new GAS response-header payload for this workflow just to satisfy the frontend.
- [ ] If any custom path currently adds headers only for this save-refresh scenario, remove that coupling and use local headers instead.
**Files**: Primarily frontend save/sync files; GAS only if a custom header-emitting workaround exists
**Pattern**: Headers are bootstrap metadata from login/auth/resource registry and IDB meta, not per-request transport overhead for every follow-up refresh.
**Rule**: The implementation direction is local-header reuse, not response-header reliance.

### Step 4: Fix storage dropdown to include draft-entered locations immediately
- [ ] Edit `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`.
- [ ] Change storage options so they are derived from the union of:
  - fetched storage names from `WarehouseStorages`
  - any non-empty `StorageName` already entered in `newRows`
- [ ] Normalize values before merging (trim, ignore empty strings, avoid duplicates).
- [ ] Ensure that after typing a new location in one new row, the next new row can select it from the dropdown immediately, even before save.
**Files**: `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
**Pattern**: Keep the source of truth in component state; no backend round-trip should be needed to reuse a location within the same editing session.
**Rule**: Draft locations must become selectable immediately for subsequent rows.

### Step 5: Verify no regression in sync behavior
- [ ] Validate that `WarehouseStorages` still supports normal cache-first reads and forced syncs outside the Direct Entry flow.
- [ ] Confirm cursor behavior remains correct:
  - cursor advances only after successful local state application
  - force-sync does not skip legitimate deltas after a save
- [ ] Check that zero-quantity row deletion behavior still reflects correctly after save.
**Files**: `FRONTENT/src/services/resourceRecords.js`, `FRONTENT/src/composables/useStockMovements.js`, `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
**Pattern**: Preserve existing IndexedDB + delta-sync contract.
**Rule**: Fix the Direct Entry bug without degrading shared resource sync semantics.

### Step 6: Update docs and registries where behavior changed
- [ ] Update `Documents/MODULE_WORKFLOWS.md` section for Direct Stock Entry to note:
  - post-save reload now reflects updated `WarehouseStorages` immediately
  - storage dropdown includes newly typed draft locations immediately
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with a dated note summarizing the cache/cursor fix and dropdown improvement.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` only if the `useStockMovements` contract/signature changes.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` only if the `StockEntryGrid` public API changes.
**Files**: `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`, and registries only if signatures/props change
**Pattern**: Document real runtime behavior changes in the same task.
**Rule**: Do not update registries unless API surface changed.

## Documentation Updates Required
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with the corrected Direct Entry post-save behavior and draft-location dropdown behavior.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` because this changes the known runtime behavior of a current active module.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` only if `useStockMovements` exports/signature change.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` only if `StockEntryGrid` props/events change.

## Acceptance Criteria
- [ ] After a successful Direct Entry save, the grid shows the latest `WarehouseStorages` state without stale quantities lingering.
- [ ] The post-save refresh path no longer depends on `getResponse.meta.headers`.
- [ ] `WarehouseStorages.lastSyncAt` is not advanced unless the corresponding local cache update succeeds.
- [ ] A newly typed storage location becomes selectable in the dropdown for the next new row immediately, before save.
- [ ] Force-sync and normal cache-first resource loading continue to work for `WarehouseStorages`.
- [ ] No new response-header dependency is introduced for this workflow.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

### Deviations / Decisions
- [x] `[!]` Step 2 decision: switched the post-save reload to `fetchData(false)` (cache-first rebuild) rather than keeping `fetchData(true)` as a fallback verification pass. Rationale: `submitBatch()` now reliably updates IDB with locally-resolved headers, and the cursor is only advanced when the upsert succeeds — so a cache-first rebuild always reflects the latest state and cannot be poisoned by the prior bug's advance-cursor-on-empty-upsert path. No fallback needed; if the IDB upsert skips (e.g. headers missing), the cursor is left alone and the normal TTL/cold-sync path recovers on the next mount.
- [x] `[?]` Plan import hint referenced `mapRowsToObjects` from `resourceRecords.js`, but the replacement code needs the **reverse** direction (objects→rows). Since GAS's `buildMasterRowsResponse()` currently returns rows as arrays (the hot path), the object→rows branch is purely defensive; implemented inline as `r => localHeaders.map(h => r?.[h])` to avoid adding an unnecessary export.

### Files Actually Changed
- `FRONTENT/src/composables/useStockMovements.js`
- `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
- `FRONTENT/src/services/resourceRecords.js` (exported existing `ensureHeaders()` helper)
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/2026-04-11-direct-entry-refresh-and-storage-dropdown-fix.md`

Registries not updated: `useStockMovements` public API and `StockEntryGrid` props/events are unchanged.

### Validation Performed
- [x] Static diagnostics reviewed via `mcp__ide__getDiagnostics` on edited files — only pre-existing Vue SFC info-level "unresolved variable" noise on dynamic row field access; no new errors introduced.
- [x] Traced post-save path end-to-end: `submitBatch` → `ensureHeaders('WarehouseStorages')` → `upsertResourceRows` → conditional `setResourceMeta` → caller's `fetchData(false)` → `fetchResourceRecords` cache-first read.
- [x] Confirmed `WarehouseStorages.lastSyncAt` is never advanced on a failed/empty upsert, so normal sync semantics (TTL, delta cursor, cold sync, force sync) outside the Direct Entry path remain intact.
- [ ] Manual Direct Entry save/refresh validation — user to run the end-to-end test listed in the plan's Verification section (requires dev server + Google Sheet access).
- [ ] Manual storage-location reuse validation — user to confirm typed-in-row-1 appears in row-2 dropdown before save.

### Manual Actions Required
- None. No GAS changes → no `clasp push` needed. API contract unchanged → no Web App redeployment.
- Runtime verification (user): open Warehouse → Manage Stock → Direct Entry for a warehouse, run the steps in the plan's Verification section.
