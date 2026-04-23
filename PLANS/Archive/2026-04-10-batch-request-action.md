# PLAN: Generic Batch Action Endpoint for Sequential Operations

**Status**: DRAFT
**Created**: 2026-04-10
**Created By**: Brain Agent (Assistant)
**Executed By**: Build Agent (pending)

## Objective
Introduce a generic `action='batch'` endpoint in the GAS backend that executes multiple independent request payloads sequentially in a single HTTP call, returning an array of results. Update the StockMovements workflow to use this batch endpoint so that `WarehouseStorages` are refetched immediately after saving stock entries.

## Context
- `submitBatch` in `useStockMovements.js` creates a single `StockMovements` ledger payload.
- Saving stock movements executes a PostAction hook (`handleStockMovementsBulkSave_afterBulk`) that updates `WarehouseStorages`.
- The frontend needs the updated `WarehouseStorages` immediately after saving, but currently has no way to fetch it without paying the latency cost of a second server round-trip.
- Introducing a generic `batch` action allows the frontend to bundle the `create` action (for StockMovements) with a `get` action (for WarehouseStorages) in one request.

## Design Spec

### Backend (`GAS/apiDispatcher.gs`)
- Add a new protected action case: `case 'batch': return handleBatchActions(auth, data);`
- Implement `handleBatchActions(auth, data)`:
  - Expects `data.requests` to be an array of standard payload objects.
  - Iterates through each request, invokes `dispatchProtectedAction(request.action, auth, request)`.
  - Collects results in an array.
  - Returns `{ success: true, data: resultsArray }` (or short-circuit fails if an operation fatally errors).

### Frontend (`FRONTENT/src/services/gasApi.js`)
- Expose `callGasApiBatch(requests, options)` which formats the payload and calls the endpoint.
- Alternatively, we can just send `callGasApi('batch', { requests })`. The latter is simpler and leverages the existing UI loading interceptors. We will use `callGasApi('batch', { requests })`.

### Frontend (`FRONTENT/src/composables/useStockMovements.js`)
- Modify `submitBatch()`:
  - Formulates the `create` request for `StockMovements`.
  - Formulates the `get` request for `WarehouseStorages` (passing `forceSync: true` or explicitly fetching the resource).
  - Uses `callGasApi('batch', { requests: [request1, request2] })`.
  - After receiving the batch response, unpacks it:
    - Result 0 contains the create results (errors, successes).
    - Result 1 contains the fresh `WarehouseStorages` rows.
  - Updates the local IndexedDB with the fresh rows via `upsertResourceRows` and `setResourceMeta` so subsequent component refreshes are instant cache hits.

## Pre-Conditions
- `GAS/stockMovements.gs` must be tracked in Git and pushed.
- `GAS/appOptions.gs` must be tracked in Git and pushed.

## Steps

### Step 1: Track and Push Backend Files
- [ ] Add `GAS/stockMovements.gs` and `GAS/appOptions.gs` to git.
- [ ] Push to GAS (`cd GAS && clasp push` conceptually, or via tools).

### Step 2: Implement Backend Batch Endpoint
- [ ] Edit `GAS/apiDispatcher.gs` to support `action: 'batch'`.
- [ ] Implement `handleBatchActions(auth, payload)`.

### Step 3: Implement Frontend Batch Sync in useStockMovements
- [ ] In `useStockMovements.js`, update `submitBatch` to dispatch a `batch` request.
- [ ] Request 1: `create` StockMovements.
- [ ] Request 2: `get` WarehouseStorages (with `includeInactive: true` to get everything).
- [ ] Upon success, write the new WarehouseStorages data into IDB (using imported db.js/resourceRecords.js tools).

### Step 4: Hardcode DirectEntry and Force Sync
- [ ] Confirm `StockEntryGrid.vue` is hardcoding `DirectEntry` (Already done).
- [ ] Confirm `ManageStockPage.vue` doesn't require `?referenceType=DirectEntry` in the URL (Already true).
- [ ] Verify `fetchData()` in `StockEntryGrid.vue` reloads storages correctly. (Since we update IDB directly in the composable, `fetchData()` will get the fresh rows instantly!).

## Documentation Updates Required
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with the new batch API capability.
- [ ] Update `Documents/GAS_API_CAPABILITIES.md` to document the `batch` action.
- [ ] Note in `Documents/MODULE_WORKFLOWS.md` that Manage Stock uses transaction batching.

## Post-Execution Notes

### Progress Log
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
- [ ] Step 4
- [ ] Docs updated

### Deviations / Decisions

### Files Actually Changed
