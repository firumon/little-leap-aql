# PLAN: Global Eager Sync for Master Resources
**Status**: COMPLETED
**Created**: 2026-03-13
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Implement an "Eager Sync" mechanism that fetches all authorized master resources in a single batch immediately after a successful login. This eliminates the 10-second "per-page" latency by pre-populating the IndexedDB cache in the background.

## Context
- Current behavior: `MasterEntityPage.vue` triggers `fetchMasterRecords` on mount, causing a blocking GAS call (~10s) for every new page visit.
- Proposed behavior: A "Global Sync" process starts immediately after `authStore.login()` completes, using existing `handleMasterGetMultiRecords` in GAS.
- References: `FRONTENT/src/services/masterRecords.js`, `FRONTENT/src/stores/auth.js`, `GAS/masterApi.gs`.

## Pre-Conditions
- [x] Brain Agent research on `masterRecords.js` and `auth.gs` completed.
- [x] Architecture supports `getMulti` action in `masterApi.gs`.

## Steps

### Step 1: Implement `syncAllMasterResources` Service
- Create/Export a new function `syncAllMasterResources()` in `FRONTENT/src/services/masterRecords.js`.
- Logic:
    1. Extract all resources with `scope: "master"` from `authStore.authorizedResources`.
    2. Collect their current `lastSyncAt` (cursors) from IndexedDB `resource-meta`.
    3. Call GAS `action: "getMulti"` with the list of master resources and their cursors.
    4. Upon success, iterate through the result keys and call `upsertResourceRows` and `setResourceMeta` for each resource.
**Files**: `FRONTENT/src/services/masterRecords.js`
**Pattern**: Mimic `fetchMasterRecords` logic but for a batch payload.

### Step 2: Update Auth Store to Trigger Eager Sync
- Update `FRONTENT/src/stores/auth.js` (or the component that handles login success).
- After a successful `login` response is processed and the state is hydrated, call `syncAllMasterResources()` without awaiting it (background execution).
- Add a property `isGlobalSyncing: boolean` to the Auth store to track if the background process is running (useful for global UI loaders).
**Files**: `FRONTENT/src/stores/auth.js`
**Pattern**: Post-login hydration side-effect.

### Step 3: Optimize GAS `getMulti` Handler
- Ensure `GAS/masterApi.gs` `handleMasterGetMultiRecords` is robust enough for batch requests.
- Verify that it properly respects individual `lastUpdatedAt` cursors passed in the batch payload.
**Files**: `GAS/masterApi.gs`
**Rule**: Enforce `AccessRegion` filtering even in multi-record fetch.

## Documentation Updates Required
- [x] Update `Documents/ARCHITECTURE.md` to include the "Eager Background Sync" workflow.
- [x] Update `Documents/CONTEXT_HANDOFF.md` to note that local cache is pre-populated post-login.

## Acceptance Criteria
- [x] After login, a single network request to GAS is fired containing multiple master resources.
- [x] Navigating to a master page (e.g., Products, Warehouses) immediately after this sync shows data instantly from cache.
- [x] The sync happens in the background without blocking the user from the dashboard.
- [x] Incremental sync (cursors) still works correctly in the batch payload.

## Post-Execution Notes (Execution Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed

### Deviations / Decisions
- [x] `[Decision]` Extended `getMulti` payload support to accept per-resource cursors via `lastUpdatedAtByResource` (also tolerant of `resourceCursors`/`cursors`) while keeping backward compatibility with global `lastUpdatedAt`.
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/services/masterRecords.js`
- `FRONTENT/src/stores/auth.js`
- `GAS/masterApi.gs`
- `Documents/ARCHITECTURE.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] Unit/manual validation completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] Copy updated GAS file `GAS/masterApi.gs` to APP Apps Script project and redeploy Web App.
