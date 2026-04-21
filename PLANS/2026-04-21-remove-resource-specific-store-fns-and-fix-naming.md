# PLAN: Remove Resource-Specific Store Functions and Fix Scope-Named Service Exports
**Status**: IN_PROGRESS
**Created**: 2026-04-21
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex)

## Objective
Eliminate all resource/scope-specific function names from stores and services.
- Stores and services must be fully generic; resource-specific logic lives exclusively in composables.
- Remove `submitStockMovementsBatch` from `workflow.js` and fold its logic into `useStockMovements.js`.
- Rename all `*Master*`-scoped exports in services to their generic equivalents.
- Remove all transitional `Master*` alias exports.

## Context
- Architecture Rules enforce that stores/services must be generic, resource-specific logic belongs in composables.
- `workflow.js` has `submitStockMovementsBatch()` hardcoding `resource: 'StockMovements'`.
- Several service functions and aliases carry `Master` in their name despite being fully generic.
- `useStockMovements.js` composable is already the right boundary — it should own the full dispatch logic.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Add Architecture Rule
- [ ] Add rule to `Documents/ARCHITECTURE RULES.md` banning resource/scope-specific functions in stores and services.
**Files**: `Documents/ARCHITECTURE RULES.md`

### Step 2: Remove `submitStockMovementsBatch` from `workflow.js`
- [ ] Delete `submitStockMovementsBatch` function body.
- [ ] Remove its import exports.
- [ ] Update `workflow.js` return object.
**Files**: `FRONTENT/src/stores/workflow.js`

### Step 3: Update `useStockMovements.js` to own the full dispatch
- [ ] Replace `workflowStore.submitStockMovementsBatch(movementRecords)` call.
- [ ] Use generic `workflowStore.runBatchRequests([...])` directly with the StockMovements request struct.
**Files**: `FRONTENT/src/composables/operations/stock/useStockMovements.js`

### Step 4: Rename generic CRUD functions in `ResourceCrudService.js`
- [ ] `createMasterRecord` → `createRecord`
- [ ] `updateMasterRecord` → `updateRecord`
- [ ] `bulkMasterRecords` → `bulkRecords`
**Files**: `FRONTENT/src/services/ResourceCrudService.js`

### Step 5: Update `ResourceRecordsService.js`
- [ ] Rename import aliases to match new names.
- [ ] Rename exported functions `createMasterRecord → createRecord`, `updateMasterRecord → updateRecord`, `bulkMasterRecords → bulkRecords`.
- [ ] Remove `queueMasterResourceSync`, `flushMasterSyncQueue`, `syncAllMasterResources` transitional aliases.
**Files**: `FRONTENT/src/services/ResourceRecordsService.js`

### Step 6: Remove `syncMasterResourcesBatch` alias from `ResourceFetchService.js`
- [ ] Remove `export const syncMasterResourcesBatch = syncResourcesBatch`.
- [ ] Replace its self-referencing internal usage with `syncResourcesBatch` directly.
**Files**: `FRONTENT/src/services/ResourceFetchService.js`

### Step 7: Remove master-scoped aliases from `ResourceSyncQueueService.js`
- [ ] Remove `flushMasterSyncQueue` and `queueMasterResourceSync` from the returned object.
**Files**: `FRONTENT/src/services/ResourceSyncQueueService.js`

### Step 8: Update consumers of renamed names
- [ ] Update `workflow.js` import from `bulkMasterRecords` → `bulkRecords`.
**Files**: `FRONTENT/src/stores/workflow.js`

### Step 9: Validate all changed files
- [ ] Run `get_errors` on all touched files.
- [ ] Update plan to COMPLETED.
**Files**: all above

## Documentation Updates Required
- [x] `Documents/ARCHITECTURE RULES.md` — add explicit rule (done in Step 1)
- [ ] `Documents/CONTEXT_HANDOFF.md` — note generic service naming now enforced

## Acceptance Criteria
- [ ] `workflow.js` has zero resource/scope-specific functions.
- [ ] `useStockMovements.js` owns all StockMovements dispatch logic directly.
- [ ] No function or export named `*Master*` remains in any service (except for legacy-import aliases that are never referenced anywhere).
- [ ] All callers (`workflow.js`, `sync.js`, etc.) use generic canonical names.
- [ ] No new callers of removed names exist anywhere in src.

## Post-Execution Notes

### Progress Log
- [ ] Step 1 completed
- [ ] Step 2 completed
- [ ] Step 3 completed
- [ ] Step 4 completed
- [ ] Step 5 completed
- [ ] Step 6 completed
- [ ] Step 7 completed
- [ ] Step 8 completed
- [ ] Step 9 completed

### Deviations / Decisions

### Files Actually Changed
- `PLANS/2026-04-21-remove-resource-specific-store-fns-and-fix-naming.md`

### Validation Performed

### Manual Actions Required
- No GAS changes; no Web App redeployment needed.

