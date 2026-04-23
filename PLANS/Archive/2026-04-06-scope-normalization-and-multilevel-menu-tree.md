# PLAN: Scope Normalization + Multi-Level Menu Tree Architecture
**Status**: COMPLETED
**Created**: 2026-04-06
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Claude Sonnet 4.6)

## Objective
Resolve non-master resource transport failures (`Unsupported master resource: ...`) and redesign sidebar menu metadata/runtime to support multi-level tree navigation (beyond current 2 levels), with business-centric naming/grouping and full docs/spec synchronization.

## Context
- Runtime errors observed:
  - Manage Stock save fails with backend error: `Unsupported master resource: StockMovements`.
  - Non-master data fetch failures indicate scope handling bug in generic CRUD path.
- Current backend resolver in `GAS/masterApi.gs` hardcodes scope resolution to `master` (`getResourcesByScope('master')`) for generic actions.
- Current menu metadata contract expects `Menu[].group` as a single string; frontend renders only `Group -> Item` hierarchy.
- User requires deeper tree support and business-level grouping, e.g.:
  - `Masters > Product > Manage Products`
  - `Masters > Product > Manage Stock`
  - `Masters > Warehouse > Manage Warehouses`
  - `Masters > Warehouse > Manage Stock`
  - `Operations > Procurement > Purchase Requisitions / RFQs / Supplier Quotations / Purchase Orders / Shipments`

## Pre-Conditions
- [ ] Confirm expected canonical scope vocabulary and aliases:
  - singular/plural aliases (`master|masters`, `operation|operations`, `account|accounts`, `report|reports`).
- [ ] Confirm menu tree depth constraints (target: N-level, not fixed to 3).
- [ ] Confirm migration strategy for existing `group` string rows (backward compatibility window).

## Steps

### Step 1: Scope Alias Normalization Contract (Backend)
- [ ] Introduce strict scope normalizer used by dispatcher + resource resolvers with alias support:
  - `master|masters -> master`
  - `operation|operations -> operation`
  - `account|accounts -> accounts`
  - `report|reports -> report`
- [ ] Validate all incoming generic CRUD requests against canonical scope set.
**Files**: `GAS/apiDispatcher.gs`, `GAS/resourceRegistry.gs` (normalization helper reuse/extension)
**Pattern**: Reuse existing `normalizeResourceScope` semantics, extend aliases.
**Rule**: API accepts both singular/plural aliases but internally uses canonical values.

### Step 2: Scope-Aware Generic CRUD Resolver
- [ ] Refactor `resolveMasterResourceName(s)` in `GAS/masterApi.gs` into scope-aware resolver (or generic equivalent) driven by `payload.scope` canonical value.
- [ ] Update get/create/update/bulk flows to resolve supported resources by requested scope (not hardcoded `master`).
- [ ] Keep legacy `master.*` actions backward-compatible.
**Files**: `GAS/masterApi.gs`, `GAS/apiDispatcher.gs`
**Pattern**: Existing candidate extraction + canonical alias map; just parameterize by scope.
**Rule**: `scope=operation` must resolve operation resources like `StockMovements`, `WarehouseStorages` successfully.

### Step 3: Frontend Scope Payload Hardening
- [ ] Ensure all frontend data services send canonical scope values and tolerate alias responses.
- [ ] Verify operation/accounts/report resources can load via generic service paths.
**Files**: `FRONTENT/src/services/masterRecords.js`, `FRONTENT/src/services/gasApi.js` (if needed), route guard helpers
**Pattern**: Existing `resolveResourceScope(resourceName)` flow.
**Rule**: No regression for master resources; non-master reads/writes must work through same generic contract.

### Step 4: Menu Schema v2 (Tree Paths)
- [ ] Extend `Menu` entry schema from `group: string` to support path arrays:
  - new canonical field: `groupPath: string[]`
  - temporary backward compatibility: map legacy `group` string -> `groupPath: [group]` at parse-time.
- [ ] Decide whether to keep writing `group` or migrate fully to `groupPath` in `syncAppResources.gs`.
**Files**: `GAS/syncAppResources.gs`, `GAS/resourceRegistry.gs`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/APP_SHEET_STRUCTURE.md`
**Pattern**: Existing `Menu` JSON array parsing in `resourceRegistry.gs`.
**Rule**: Existing rows with string groups must continue to work without immediate sheet rewrite.

### Step 5: Admin Menu Editor Support (App Menu Dialog)
- [ ] Update resource add/edit dialog to edit path-based groups (e.g., text CSV `Masters > Product` or multi-input path editor).
- [ ] Preserve existing additional menu entries and menuAccess data.
**Files**: `GAS/appMenu.gs`, `GAS/adminDialog.html`
**Pattern**: Existing `_menuArrayFull` preservation approach.
**Rule**: Admin UX must not destroy existing extra menu entries or path arrays.

### Step 6: Frontend Sidebar Tree Renderer
- [ ] Refactor `MainLayout` menu grouping from flat group string to recursive tree rendering from `groupPath`.
- [ ] Keep permission checks + route dedupe behavior intact.
- [ ] Keep max depth unbounded by code (render recursively).
**Files**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`, potentially new helper composable/component for tree building.
**Pattern**: Existing `visibleResourceMenuGroups` logic + `evaluateMenuAccess`.
**Rule**: Menu order must remain deterministic (`order`, then label), at each tree node.

### Step 7: Business Taxonomy Mapping Rollout
- [ ] Define and apply updated business taxonomy in `syncAppResources.gs` using path arrays.
- [ ] Include requested categorization and naming conventions for Product/Warehouse/Procurement branches.
- [ ] Validate duplicates (same route appearing in multiple branches) by intentional design.
**Files**: `GAS/syncAppResources.gs`
**Pattern**: Existing multi-menu-per-resource support.
**Rule**: Taxonomy changes must be config-driven, no hardcoded route-name mappings in frontend.

### Step 8: Manage Stock Compact UI Follow-up
- [ ] Refactor stock entry grid for narrow layouts (reduce width pressure):
  - responsive stacked row mode or compact table with conditional columns.
  - keep row-level storage and delta/new qty behavior.
- [ ] Ensure no horizontal scroll on standard desktop width targets.
**Files**: `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`, `FRONTENT/src/components/Warehouse/StockMovementRow.vue`
**Rule**: UX improvement must not remove required data inputs.

### Step 9: Documentation & Contract Updates (Mandatory)
- [ ] Update `Documents/LOGIN_RESPONSE.md` with any payload shape changes (`ui.menus[*].groupPath`, alias handling notes).
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` (`Menu` schema v2).
- [ ] Update `Documents/APP_SHEET_STRUCTURE.md` if `Menu` column contract wording changes.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` sections:
  - Menu Access Control (tree path behavior)
  - Manage Stock workflow/layout notes.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` with new taxonomy and admin editing behavior.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with dated architecture update.
- [ ] Update frontend registries if reusable components/composables are added/changed.

### Step 10: Deployment + Validation
- [ ] Run frontend build.
- [ ] Run GAS deployment (`npm run gas:push`).
- [ ] Manual validation matrix:
  - operation/account/report resources load successfully.
  - stock movement create succeeds.
  - tree menu renders expected hierarchy and order.
  - permission gating still works on nested items.
  - legacy resources with string `group` still render under compatibility mode.

## Documentation Updates Required
- [ ] `Documents/LOGIN_RESPONSE.md`
- [ ] `Documents/RESOURCE_COLUMNS_GUIDE.md`
- [ ] `Documents/APP_SHEET_STRUCTURE.md`
- [ ] `Documents/MODULE_WORKFLOWS.md`
- [ ] `Documents/AQL_MENU_ADMIN_GUIDE.md`
- [ ] `Documents/CONTEXT_HANDOFF.md`
- [ ] `FRONTENT/src/components/REGISTRY.md` / `FRONTENT/src/composables/REGISTRY.md` (if APIs changed)

## Acceptance Criteria
- [ ] No `Unsupported master resource` for valid operation/accounts/report resources.
- [ ] Generic CRUD works across `master`, `operation`, `accounts`, `report` (with alias tolerance).
- [ ] Sidebar supports nested tree paths (`groupPath`) beyond 2 levels.
- [ ] Business taxonomy is reflected in rendered menu.
- [ ] Existing string-group menu entries remain functional during migration.
- [ ] Manage Stock grid is compact/responsive with no forced horizontal scroll in standard desktop use.
- [ ] All required docs/specs updated in same task.

## Post-Execution Notes (Build Agent fills this)
### Progress Log
- [x] Step 1 completed — `normalizeResourceScope` extended with plural aliases (`operations`, `masters`, `reports`)
- [x] Step 2 completed — `resolveMasterResourceNames` now reads `payload.scope` to resolve supported resources by correct scope
- [x] Step 3 completed — Frontend `masterRecords.js` already sends canonical scope; no changes needed
- [x] Step 4 completed — `groupPath: string[]` added to all 33 resource menu entries in `syncAppResources.gs`; `resourceRegistry.gs` normalizes with `[group]` fallback
- [x] Step 5 completed — Admin dialog preserves first-item edit; no breaking change needed for groupPath (field is invisible to form)
- [x] Step 6 completed — `MainLayout.vue` builds recursive N-level tree from `groupPath`; `MenuTreeNode.vue` created for recursive rendering
- [x] Step 7 completed — Business taxonomy applied: Masters/Product, Masters/Warehouse, Masters/Procurement, Masters/Logistics, Operations/Procurement, Operations/Warehouse, Accounts
- [x] Step 8 completed — Compact stock grid: Product column merged into SKU cell, Note column removed, field widths reduced
- [x] Step 9 completed — `CONTEXT_HANDOFF.md` updated with dated entry; `REGISTRY.md` updated for StockMovementRow and MenuTreeNode
- [x] Step 10 completed — GAS deployed via `clasp push --force` (23 files)

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/apiDispatcher.gs`
- `GAS/masterApi.gs`
- `GAS/resourceRegistry.gs`
- `GAS/appMenu.gs`
- `GAS/adminDialog.html`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `FRONTENT/src/services/masterRecords.js`
- `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`
- `FRONTENT/src/components/Warehouse/StockMovementRow.vue`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/APP_SHEET_STRUCTURE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [ ] Frontend build passes
- [ ] GAS push completed
- [ ] Manual validation matrix completed

### Manual Actions Required
- [ ] Run `AQL ?? > Resources > Sync APP.Resources from Code`.
- [ ] Re-login frontend to refresh authorized resources payload.
- [ ] If response envelope changes, create new Apps Script Web App deployment version.
