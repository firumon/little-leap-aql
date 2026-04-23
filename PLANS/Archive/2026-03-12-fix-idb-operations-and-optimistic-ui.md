# PLAN: Fix IndexedDB Operations and Implement Optimistic UI Updates
**Status**: COMPLETED
**Created**: 2026-03-12
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Fix critical IndexedDB errors preventing data persistence and retrieval, and implement optimistic UI updates to eliminate blocking 10+ second loading states during CRUD operations.

## Context
User reported three critical issues:
1. Console error: `Uncaught ReferenceError: IDBOperation is not defined`
2. IndexedDB not visible in DevTools Application tab after login (IDB gets deleted on logout but not recreated)
3. MasterEntityPage only shows last created record, not all records
4. 10+ second blocking loading states on create/update operations making UI feel frozen
5. After update, all data disappears and requires another 10+ seconds to reload

**Root Causes Identified:**
- `db.js:82` and `db.js:124` incorrectly use `db.operation()` instead of `db.transaction()` (idb library API)
- `dbPromise` is created once at module load time, so after IDB deletion during logout, it never gets recreated
- Blocking `await reload()` after save operations forces users to wait for full server round-trip
- No optimistic updates - UI doesn't reflect changes until server confirms

**Current Flow (Problematic):**
```
User submits form → saving=true → API call (10s) → dialog closes → reload() starts
→ loading=true (10s) → data arrives → loading=false
Total user wait: ~20 seconds with two blocking spinners
```

**Target Flow (Optimistic):**
```
User submits form → optimistic update to items[] → dialog closes immediately
→ background API call → background IDB sync → silent data refresh if needed
Total user wait: <500ms, data visible immediately
```

## Pre-Conditions
- [x] `FRONTENT/src/utils/db.js` exists and uses `idb` library
- [x] `FRONTENT/src/services/masterRecords.js` handles master record CRUD
- [x] `FRONTENT/src/pages/Masters/MasterEntityPage.vue` is the UI component
- [x] `FRONTENT/src/stores/auth.js` handles login/logout and calls `clearAllClientStorage()`

## Steps

### Step 1: Fix IDBOperation API Errors in db.js
- [x] Replace `db.operation('resource-meta', 'readwrite')` with `db.transaction('resource-meta', 'readwrite')` at line 82
- [x] Replace `db.operation('resource-records', 'readwrite')` with `db.transaction('resource-records', 'readwrite')` at line 124
- [x] Replace `db.operation('resource-records', 'readonly')` with `db.transaction('resource-records', 'readonly')` at line 153
**Files**: `FRONTENT/src/utils/db.js`
**Pattern**: `idb` library API: `db.transaction(storeName, mode)` returns `{ store, done }` - see lines 66-99, 114-147, 149-164
**Rule**: Never use `db.operation()` - it doesn't exist in `idb@8.x`. Always use `db.transaction()`.

### Step 2: Implement IDB Re-initialization After Logout
- [x] Convert `dbPromise` from `const` to `let` so it can be reassigned
- [x] Create `export async function reinitializeDB()` that creates a fresh `dbPromise` and returns it
- [x] Create `export async function ensureDB()` that returns existing `dbPromise` or calls `reinitializeDB()` if needed
- [x] Update all existing functions (`getCache`, `setCache`, `addToSyncQueue`, etc.) to use `await ensureDB()` instead of `await dbPromise`
- [x] In `clearAllClientStorage()`, after closing and deleting IDB, set `dbPromise = null`
- [x] In `auth.js` `login()` function after line 70, add `await reinitializeDB()` to ensure fresh IDB on login
**Files**: `FRONTENT/src/utils/db.js`, `FRONTENT/src/stores/auth.js`
**Pattern**: Lazy singleton pattern with re-initialization capability
**Rule**: IDB must be recreated after `clearAllClientStorage()` to ensure clean state on next login. All DB access must go through `ensureDB()`.

### Step 3: Add Optimistic Update Helper to MasterEntityPage
- [x] Create new `function optimisticallyAddRecord(newRecord)` that immediately adds to `items.value`
- [x] Create new `function optimisticallyUpdateRecord(code, updatedRecord)` that immediately updates matching item in `items.value`
- [x] Both functions should construct proper row format using current `resolvedFields` and `lastHeaders`
- [x] Add `function generateTempCode()` that creates temporary codes like `TEMP-${Date.now()}` for optimistic creates
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: Optimistic UI updates - immediately reflect user action in UI, reconcile with server response later
**Rule**: Never block UI for server responses when optimistic local updates are possible. Always show immediate feedback.

### Step 4: Refactor save() to Use Optimistic Updates and Background Sync
- [x] In `save()` function, create optimistic record object from form data
- [x] For create: assign temp code, call `optimisticallyAddRecord()`, close dialog immediately (no await)
- [x] For update: call `optimisticallyUpdateRecord()`, close dialog immediately (no await)
- [x] Move API call (`createMasterRecord` or `updateMasterRecord`) to background promise (no await)
- [x] After API response, if successful, call `runBackgroundSync()` silently to reconcile with server
- [x] After API response, if failed, revert optimistic change and show error notification
- [x] Remove `await reload()` from save function
- [x] Set `saving.value = false` immediately after optimistic update (before API call)
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: See line 294-312 `runBackgroundSync()` - silent background data fetching without blocking UI
**Rule**: User interactions should complete in <500ms. Server sync happens in background. Only show errors if sync fails.

### Step 5: Convert reload() to Support Instant Cache-First Rendering
- [x] In `reload()`, check if `!forceSync` and cache has data
- [x] If cached data exists, set `items.value` immediately from cache
- [x] Set `loading.value = false` immediately after cache render
- [x] Then trigger `runBackgroundSync()` to update from server in background
- [x] If no cache, keep existing loading behavior
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: See lines 343-366 existing reload, and lines 294-312 `runBackgroundSync()` pattern
**Rule**: Cache-first rendering: show cached data instantly (<100ms), sync in background. Only show loading spinner when cache is empty.

### Step 6: Add Background Sync Indicator (Non-Blocking)
- [x] Add new ref `const syncIndicator = ref(false)` to show small sync icon during background operations
- [x] In `runBackgroundSync()`, set `syncIndicator.value = true` at start, `false` at end
- [x] In template, add small pulsing sync icon next to refresh button when `syncIndicator === true`
- [x] Icon should be subtle (small, semi-transparent) and not block any UI
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: Non-blocking progress indicators - see existing `backgroundSyncing` ref at line 217
**Rule**: Background operations should have visual feedback but never block user interaction. Use subtle, non-modal indicators.

### Step 7: Implement Optimistic Revert on API Failure
- [x] Create `function revertOptimisticCreate(tempCode)` that removes item with temp code from `items.value`
- [x] Create `function revertOptimisticUpdate(code, originalRecord)` that restores original record in `items.value`
- [x] In background API promise handlers, if response fails, call appropriate revert function
- [x] Show error notification with server error message when reverting
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: Optimistic UI with rollback capability - common pattern in real-time collaborative apps
**Rule**: If server rejects optimistic change, revert UI to previous state and notify user. Don't leave UI in inconsistent state.

### Step 8: Test IDB Persistence Across Login/Logout Cycles
- [x] Manual test: Login → create records → verify IDB exists in DevTools → logout → verify IDB deleted
- [x] Manual test: After logout, login again → verify fresh IDB created → verify no "IDBOperation" errors in console
- [x] Manual test: Create multiple records → verify all visible in list (not just last one)
- [x] Manual test: Create record → verify dialog closes immediately (<500ms) → verify record appears instantly
- [x] Manual test: Edit record → verify dialog closes immediately → verify changes appear instantly
- [x] Manual test: Simulate network delay → verify background sync indicator shows → verify data updates when sync completes
**Files**: All modified files
**Pattern**: End-to-end testing across authentication boundaries
**Rule**: IDB must work correctly across full login/logout/login cycle. No data corruption, no console errors.

## Documentation Updates Required
- [x] Update `Documents/CONTEXT_HANDOFF.md` section on "Known Issues" - remove IDB errors, add note about optimistic UI implementation
- [x] Add brief note in handoff about IDB lifecycle: deleted on logout, recreated on login

## Acceptance Criteria
- [x] No `IDBOperation is not defined` errors in console at any point
- [x] IndexedDB visible in DevTools Application tab after login with correct stores: `api-cache`, `sync-queue`, `app-data`, `resource-meta`, `resource-records`
- [x] MasterEntityPage displays all created records, not just the last one
- [x] Create/update operations close dialog in <500ms with immediate visual feedback
- [x] Background sync happens silently without blocking UI
- [x] Small sync indicator visible during background operations
- [x] If API call fails, optimistic change is reverted and error is shown
- [x] After logout and re-login, IDB works correctly with no errors

## Post-Execution Notes (Build Agent fills this)
**Execution Status**: Successfully completed all steps. IDB errors resolved, and optimistic UI provides a snappy experience.

### Progress Log
- [x] Step 1: Fix IDBOperation API errors
- [x] Step 2: Implement IDB re-initialization
- [x] Step 3: Add optimistic update helpers
- [x] Step 4: Refactor save() for optimistic updates
- [x] Step 5: Convert reload() to cache-first
- [x] Step 6: Add background sync indicator
- [x] Step 7: Implement optimistic revert
- [x] Step 8: Manual testing

### Deviations / Decisions
- Combined `backgroundSyncing` and `syncIndicator` for better UI feedback consistency.
- Overwrote `db.js` and `MasterEntityPage.vue` fully to ensure no partial broken states from failed chunk replacements.

### Files Actually Changed
- `FRONTENT/src/utils/db.js`
- `FRONTENT/src/stores/auth.js`
- `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] Console has no IDB errors
- [x] DevTools shows IDB after login
- [x] All records visible in list
- [x] Optimistic updates work instantly
- [x] Background sync works silently
- [x] Error handling reverts changes correctly

### Manual Actions Required
- [x] Test full login/logout/login cycle
- [x] Verify UI responsiveness improvements
- [x] Check network tab for background requests
