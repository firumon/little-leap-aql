# PLAN: Manage Stock UX Fix + Menu Taxonomy Refactor
**Status**: COMPLETED
**Created**: 2026-04-06
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Fix Manage Stock runtime issues and UX friction, then refactor menu grouping/labels from strict scope-resource naming to business-relevant navigation.

## Context
- User reported runtime error on warehouse selection: `Unsupported master resource: WarehouseStorages`.
- Current Manage Stock step asks storage location before SKU selection; user wants storage per SKU row.
- User wants menu structure by relevance (e.g., Product, Warehouse, Procurement) with action-style labels.
- Relevant module docs: `Documents/MODULE_WORKFLOWS.md` section 5.

## Pre-Conditions
- [x] Required source docs reviewed (`MODULE_WORKFLOWS`, startup protocols).
- [x] Existing Manage Stock files and menu registry reviewed.
- [x] Scope of change confirmed from user examples.

## Steps

### Step 1: Fix Manage Stock data loading strategy and scope handling
- [x] Remove blocking/forced storage sync in `useStockMovements` and switch to cache-first sync behavior.
- [x] Ensure storage fetch calls target operation scope to avoid `Unsupported master resource` path when metadata is stale/missing.
- [x] Keep error handling non-intrusive for background loads.
**Files**: `FRONTENT/src/composables/useStockMovements.js`
**Pattern**: Reuse existing `callGasApi('get', { scope: 'operation', resource: ... })` contract.
**Rule**: Avoid UI-blocking/global loading for background stock context hydration where cached data exists.

### Step 2: Refactor Manage Stock context and row model (storage per SKU)
- [x] Remove context-level "Storage Location" field from step 1.
- [x] Add per-row storage field in stock movement grid row.
- [x] Update current qty resolver and submit payload to read row-level storage.
- [x] Keep movement type + warehouse + optional reference code at context level.
**Files**: `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue`, `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`, `FRONTENT/src/components/Warehouse/StockMovementRow.vue`, `FRONTENT/src/pages/Warehouse/ManageStockPage.vue`
**Pattern**: Preserve current two-step flow and bi-directional ?/New Qty behavior.
**Rule**: `StorageName` must be captured per submitted row.

### Step 3: Refactor menu taxonomy in resource config
- [x] Update menu groups/labels in `GAS/syncAppResources.gs` to business-relevant naming:
  - Products -> `Product` group with label `Manage Products`.
  - Warehouses -> `Warehouse` group with label `Manage Warehouses`.
  - StockMovements -> add `Manage Stock` under both `Product` and `Warehouse` groups.
  - Shipments -> move into `Procurement` group sequence.
- [x] Keep existing routes intact.
**Files**: `GAS/syncAppResources.gs`
**Pattern**: Continue using `Menu: JSON.stringify([...])` multi-item arrays.
**Rule**: No route contract changes; only menu taxonomy/ordering changes.

### Step 4: Update docs/registries and deploy GAS
- [x] Update Manage Stock workflow section in module docs.
- [x] Update AQL menu admin guide for new menu grouping/naming.
- [x] Update frontend component/composable registries for Manage Stock API/prop changes.
- [x] Update context handoff with dated change entry.
- [x] Run `npm run gas:push`.
**Files**: `Documents/MODULE_WORKFLOWS.md`, `Documents/AQL_MENU_ADMIN_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`, `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`
**Rule**: Docs must reflect behavior and admin configuration surface in same task.

## Documentation Updates Required
- [x] Update `Documents/MODULE_WORKFLOWS.md` with new Manage Stock row-level storage workflow.
- [x] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` for revised menu grouping/naming.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with dated implementation note.
- [x] Update `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` for modified APIs.

## Acceptance Criteria
- [ ] Selecting warehouse no longer triggers `Unsupported master resource: WarehouseStorages` alert.
- [ ] Manage Stock step 1 no longer asks storage; storage is set per SKU row in grid.
- [ ] Submit writes `StorageName` from each row and succeeds for mixed locations in one batch.
- [ ] Menu tree reflects Product/Warehouse/Procurement relevance mapping with updated labels.
- [ ] GAS push succeeds.

## Post-Execution Notes (Build Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/composables/useStockMovements.js`
- `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue`
- `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`
- `FRONTENT/src/components/Warehouse/StockMovementRow.vue`
- `FRONTENT/src/pages/Warehouse/ManageStockPage.vue`
- `GAS/syncAppResources.gs`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [x] Frontend build passes
- [ ] Manual behavior checks completed
- [x] GAS push completed

### Manual Actions Required
- [ ] Run `AQL ?? > Setup & Refactor > Sync APP.Resources from Code` in APP sheet.
- [ ] Re-login frontend to refresh authorized `resources` payload.

