# PLAN: Remove Resource-Specific Store Functions and Fix Scope-Named Service Exports
**Status**: COMPLETED
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
- `workflow.js` had `submitStockMovementsBatch()` hardcoding `resource: 'StockMovements'`.
- Several service functions and aliases carried `Master` in their name despite being fully generic.
- `useStockMovements.js` composable is the right boundary — it now owns the full dispatch logic.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Add Architecture Rule
- [x] Add rule to `Documents/ARCHITECTURE RULES.md` banning resource/scope-specific functions in stores and services.

### Step 2: Remove `submitStockMovementsBatch` from `workflow.js`
- [x] Deleted `submitStockMovementsBatch` function body.
- [x] Updated import from `bulkMasterRecords` → `bulkRecords`.
- [x] Removed from return object.

### Step 3: Update `useStockMovements.js` to own the full dispatch
- [x] Replaced `workflowStore.submitStockMovementsBatch(movementRecords)` with `workflowStore.runBatchRequests([...])`.
- [x] Composable now assembles the StockMovements batch request internally.

### Step 4: Rename generic CRUD functions in `ResourceCrudService.js`
- [x] `createMasterRecord` → `createRecord`
- [x] `updateMasterRecord` → `updateRecord`
- [x] `bulkMasterRecords` → `bulkRecords`

### Step 5: Update `ResourceRecordsService.js`
- [x] Renamed import aliases to match new names.
- [x] Renamed exported functions `createRecord`, `updateRecord`, `bulkRecords`.
- [x] Removed `queueMasterResourceSync`, `flushMasterSyncQueue`, `syncAllMasterResources` transitional aliases.

### Step 6: Remove `syncMasterResourcesBatch` alias from `ResourceFetchService.js`
- [x] Removed alias export.
- [x] Replaced internal self-reference with direct `syncResourcesBatch` call.

### Step 7: Remove master-scoped aliases from `ResourceSyncQueueService.js`
- [x] Removed `flushMasterSyncQueue` and `queueMasterResourceSync` from returned object.

### Step 8: Update consumers of renamed names
- [x] `workflow.js` import updated to `bulkRecords`.

### Step 9: Validate all changed files
- [x] `get_errors` run on all touched files — no blocking errors.
- [x] Final grep scan confirms zero remaining `*Master*` or resource-specific fn names across all src files.

## Documentation Updates Required
- [x] `Documents/ARCHITECTURE RULES.md` — new rule §13 added
- [x] `Documents/CONTEXT_HANDOFF.md` — current state updated

## Acceptance Criteria
- [x] `workflow.js` has zero resource/scope-specific functions.
- [x] `useStockMovements.js` owns all StockMovements dispatch logic directly.
- [x] No function or export named `*Master*` remains in any service.
- [x] All callers use generic canonical names.
- [x] Final grep on src returns zero results for all removed names.

## Post-Execution Notes

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed
- [x] Step 8 completed
- [x] Step 9 completed

### Deviations / Decisions
None.

### Files Actually Changed
- `PLANS/2026-04-21-remove-resource-specific-store-fns-and-fix-naming.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/stores/workflow.js`
- `FRONTENT/src/composables/operations/stock/useStockMovements.js`
- `FRONTENT/src/services/ResourceCrudService.js`
- `FRONTENT/src/services/ResourceRecordsService.js`
- `FRONTENT/src/services/ResourceFetchService.js`
- `FRONTENT/src/services/ResourceSyncQueueService.js`

### Validation Performed
- [x] `get_errors` on all changed frontend files — no blocking errors
- [x] Final grep scan: zero remaining `submitStockMovementsBatch/createMasterRecord/updateMasterRecord/bulkMasterRecords/syncMasterResourcesBatch/syncAllMasterResources/queueMasterResourceSync/flushMasterSyncQueue`

### Manual Actions Required
- No GAS changes; no Web App redeployment needed.
