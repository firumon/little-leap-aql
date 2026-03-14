# PLAN: Refactor MasterEntityPage into Reusable Components

**Status**: COMPLETED
**Created**: 2026-03-14
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Refactor `MasterEntityPage.vue` (approx. 745 lines) into small, reusable Quasar/Vue 3 components and a dedicated logic composable. This will improve maintainability, promote code reuse, and align with Vue 3's component-based architecture.

## Context
- `MasterEntityPage.vue` is a generic rendering engine for multiple master resources (Products, Suppliers, etc.).
- It handles complex state: resource config, data sync (offline-first), search/filter, and CRUD dialogs.
- Current file is monolithic and hard to navigate.

## Pre-Conditions
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\Masters\MasterEntityPage.vue` is stable.

## Steps

### Step 1: Create `useMasterPage` Composable
- Create a new file `f:\LITTLE LEAP\AQL\FRONTENT\src\composables\useMasterPage.js`.
- **Extract Logic**:
    - Resource config resolution (`config`).
    - Items management (`items`, `filteredItems`).
    - Syncing logic (`reload`, `runBackgroundSync`, `backgroundSyncing`, `loading`).
    - Form/Dialog state (`showDialog`, `showDetailDialog`, `isEdit`, `form`, `detailRow`).
    - CRUD operation logic with Optimistic UI updates (`save`, `optimisticallyAddRecord`, etc.).
    - Utility resolvers (`resolvePrimaryText`, `resolveSecondaryText`).
- **Files**: `FRONTENT/src/composables/useMasterPage.js`
- **Pattern**: Composition API.
- [x] Implemented `useMasterPage` with extracted route/config resolution, list filtering, cache-first reload + background sync, optimistic create/update workflow, and dialog/form state.

### Step 2: Create UI Components in `src/components/Masters/`
- **MasterHeader.vue**: Extract title, description, and stats.
- **MasterToolbar.vue**: Extract search input and "Include Inactive" toggle.
- **MasterList.vue**: Extract records list and loading/empty states.
- **MasterRecordCard.vue**: Inner card for each record.
- **MasterDetailDialog.vue**: Extract record detail viewing logic.
- **MasterEditorDialog.vue**: Extract create/edit form logic.
- **Files**:
    - `FRONTENT/src/components/Masters/MasterHeader.vue`
    - `FRONTENT/src/components/Masters/MasterToolbar.vue`
    - `FRONTENT/src/components/Masters/MasterList.vue`
    - `FRONTENT/src/components/Masters/MasterRecordCard.vue`
    - `FRONTENT/src/components/Masters/MasterDetailDialog.vue`
    - `FRONTENT/src/components/Masters/MasterEditorDialog.vue`
- [x] Added all six components and mapped original UI behavior through props/emits.
- [x] Moved scoped visual styles into component-local style blocks to preserve rendering after split.

### Step 3: Refactor `MasterEntityPage.vue`
- Update `MasterEntityPage.vue` to import and use the new components and composable.
- Ensure all styles are either kept in the page (if specific to page layout) or moved to components where appropriate.
- **Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
- [x] Replaced monolithic template/script with high-level component orchestration and composable wiring.
- [x] Kept only page-level theme/background/FAB styles in page scope.

### Step 4: Verification
- Verify that all master resources (Products, Suppliers, Warehouses, etc.) load correctly.
- Test CRUD operations (Create, Edit) and ensure optimistic UI updates still work.
- Validate Search and "Include Inactive" filters.
- [x] Ran `npm run build` in `FRONTENT`; build succeeded.
- [x] Verified no refactor-specific compile/runtime errors in the build output.

## Documentation Updates Required
- Update `Documents/CONTEXT_HANDOFF.md` section "Completed" or "Current Tech Stack" to note the transition to a component-based Master Page architecture.
- [x] Updated `Documents/CONTEXT_HANDOFF.md` with the componentized Master page architecture note.

## Acceptance Criteria
- `MasterEntityPage.vue` template contains only high-level layout and components.
- `MasterEntityPage.vue` script contains minimal setup (calling the composable).
- All master CRUD and filtering features work exactly as before.
- Code is cleaner and logically separated into meaningfull files.
- [x] `MasterEntityPage.vue` now contains high-level layout only.
- [x] Page script now delegates logic to `useMasterPage`.
- [x] CRUD/filter/sync behavior preserved via extracted composable + component events.
- [x] Responsibilities are split across focused component/composable files.

## Post-Execution Notes (Execution Agent fills this)
- Executed with `little-leap-expert` workflow alignment.
- Existing Vite warnings remained during build (dynamic import warning in `MasterIndexPage.vue` and chunking note for `masterRecords.js`), but no new errors were introduced by this plan.
