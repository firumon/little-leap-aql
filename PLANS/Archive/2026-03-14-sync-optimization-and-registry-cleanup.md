# PLAN: Sync Optimization and Registry Cleanup

**Status**: COMPLETED
**Created**: 2026-03-14
**Created By**: Brain Agent
**Executed By**: Build Agent (Codex GPT-5)

## Objective
1. **Performance**: Implement an early-exit check in the Master API to skip sheet scans when no data has changed since the last sync.
2. **Cleanup**: Remove the obsolete `SkipColumns` column from the `APP.Resources` metadata sheet and all associated code to maintain a clean registry.

## Context
- The current `getMulti` sync opens every resource sheet and scans all rows, causing high latency (~10s) even when data is up-to-date.
- `SkipColumns` is a relic of an older architecture and is no longer used by the registry or the frontend.
- `lastDataUpdatedAt` will store Unix epoch milliseconds (e.g., `1710420000000`).

## Pre-Conditions
- [ ] User has backed up the `APP` Google Sheet (recommended for schema changes).
- [x] Backend is using Unix epoch milliseconds for audit timestamps (confirmed).

## Steps

### Step 1: Registry Schema Update (GAS)
- [x] Update code-level registry defaults to add `LastDataUpdatedAt` and remove `SkipColumns`.
- **Files**: 
    - `GAS/setupAppSheets.gs`: Remove `'SkipColumns'` from `headers` and add `'LastDataUpdatedAt'`. Update `columnWidths`.
    - `GAS/syncAppResources.gs`: Update the `APP_RESOURCES_CODE_CONFIG` array. Remove `SkipColumns` property from all objects and add `LastDataUpdatedAt: 0`.
    - `GAS/resourceRegistry.gs`: Update `getResourceConfig(resourceName)` to read `lastDataUpdatedAt: Number(readOptionalCell(row, registry.idx.LastDataUpdatedAt, 0))`.

### Step 2: Write-side Sync Cursor Update (GAS)
- [x] Implement a helper to update the timestamp in `APP.Resources` whenever a resource's data is modified.
- **Files**:
    - `GAS/resourceRegistry.gs`: Add `updateResourceSyncCursor(resourceName)` which find the resource row in the `Resources` sheet and sets the `LastDataUpdatedAt` cell to `Date.now()`.
    - `GAS/masterApi.gs`: Call `updateResourceSyncCursor(resourceName)` at the end of `handleMasterCreateRecord` and `handleMasterUpdateRecord` success blocks.

### Step 3: Read-side Early Exit Optimization (GAS)
- [x] Update the `get` handler to compare the client's cursor with the registry's last update timestamp.
- **Files**:
    - `GAS/masterApi.gs`: In `handleMasterGetRecords`, after parsing `lastUpdatedAt`, add a check:
      ```javascript
      if (lastUpdatedAt && resource.config.lastDataUpdatedAt && lastUpdatedAt >= resource.config.lastDataUpdatedAt) {
        return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, headers);
      }
      ```
**Pattern**: Use numeric comparison for Unix timestamps.

### Step 4: Documentation
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md`:
    - Remove `SkipColumns`.
    - Add `LastDataUpdatedAt` (Source of truth for delta sync optimization).
- [x] Update `Documents/CONTEXT_HANDOFF.md`:
    - Update required columns list in section 7.
    - Note the new sync optimization logic.

### Step 5: Sheet Deployment & Sync
- [ ] **Action**: User must run `setupAppSheets()` then `syncAppResourcesFromCode(true)` from the AQL menu in the APP sheet to apply the schema changes.

## Acceptance Criteria
- [x] Codebase removes `SkipColumns` wiring and introduces `LastDataUpdatedAt` in setup/config/registry parsing.
- [x] Creating/Updating records now calls `updateResourceSyncCursor(resourceName)` after successful writes.
- [x] `handleMasterGetRecords` now exits early when client cursor is current, before row scanning.
- [ ] Runtime verification in live APP sheet (schema migration + create/update + delta fetch checks) is pending manual execution.

## Post-Execution Notes (Build Agent fills this)
- Updated GAS files: `setupAppSheets.gs`, `syncAppResources.gs`, `resourceRegistry.gs`, `masterApi.gs`.
- Updated docs: `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`.
- Manual deployment still required in Google Apps Script / Google Sheets environment.
