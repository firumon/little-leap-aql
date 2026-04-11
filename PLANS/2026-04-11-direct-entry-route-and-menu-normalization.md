# PLAN: Direct Entry Route and Menu Normalization
**Status**: IN_PROGRESS
**Created**: 2026-04-11
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (GitHub Copilot)

## Objective
Normalize the stock-entry navigation and naming model so the current direct-entry workflow is clean, explicit, and production-ready as the baseline for future stock modes. This includes removing query-string menu routes, adopting a clean route taxonomy under `StockMovements`, renaming the current "Manual Stock Entry" workflow to "Direct Entry" / "Direct Stock Entry", and updating sidebar dedupe so intentional aliases are preserved.

## Context
- Current `StockMovements` menu config in `GAS/syncAppResources.gs` mixes:
  - duplicate route aliases for `/operations/manage-stock`
  - query-string mode routes such as `?referenceType=GRN`
  - inconsistent labels (`Stock`, `Stock Entry`, `Manual Stock Entry`)
- The current page implementation is already a dedicated direct-entry flow:
  - `FRONTENT/src/pages/Warehouse/ManageStockPage.vue` hardcodes the page title to "Manual Stock Entry"
  - `FRONTENT/src/components/Warehouse/StockEntryGrid.vue` submits `referenceType: 'DirectEntry'`
  - `FRONTENT/src/composables/useStockMovements.js` defaults to `DirectEntry`
- Query-string routes are no longer aligned with the intended architecture. Future workflows such as stock adjustment or GRN will get their own clean routes later, but are not being implemented in this task.
- Sidebar rendering currently deduplicates by route only in `FRONTENT/src/layouts/MainLayout/MainLayout.vue`, which suppresses valid aliases that intentionally share the same route.

## Pre-Conditions
- [ ] Required source docs were reviewed.
- [ ] Current direct-entry implementation was inspected in frontend, GAS menu config, and docs.
- [ ] User confirmed that backward compatibility is not required and only the direct-entry flow should remain active for now.

## Steps

### Step 1: Normalize `StockMovements` menu metadata to direct-entry only
- [ ] Edit `GAS/syncAppResources.gs` and refactor the `StockMovements.Menu` array.
- [ ] Remove all query-string routes from `StockMovements` menus.
- [ ] Remove all mode placeholder menus that are not yet implemented:
  - `Stock Adjustment`
  - `GRN Stock Entry`
  - `Stock Transfer Out`
  - `Stock Transfer In`
  - `Product Dispatch`
- [ ] Replace the current `/operations/manage-stock` aliases with clean route(s) under the `StockMovements` namespace.
- [ ] Keep only the menu entries that reflect the current implemented workflows:
  - ledger/list route for `Stock Movements`
  - direct-entry route for the editable stock-entry workflow
- [ ] Normalize menu labels, page titles, and descriptions so they use one consistent direct-entry vocabulary.
**Files**: `GAS/syncAppResources.gs`
**Pattern**: Continue using `Menu: JSON.stringify([...])` arrays on the `StockMovements` resource entry.
**Rule**: No query-string routes remain in active menu config after this task.

### Step 2: Refactor frontend routes to clean `StockMovements` path taxonomy
- [ ] Update `FRONTENT/src/router/routes.js` so the current direct-entry workflow uses a clean path such as `/operations/stock-movements/direct-entry`.
- [ ] Remove the old `/operations/manage-stock` route from active routing.
- [ ] Keep the stock ledger/list route unchanged unless a path cleanup is strictly necessary.
- [ ] Verify the route continues to point to the current page component until a later page-file rename is intentionally performed.
**Files**: `FRONTENT/src/router/routes.js`
**Pattern**: Explicit route entries in the router, matched by `ui.menus[*].route`.
**Rule**: Route strings in frontend router and `APP.Resources.Menu` must match exactly.

### Step 3: Rename the current workflow from "Manual Stock Entry" to direct-entry terminology
- [ ] Update the current page title, captions, and any visible UX copy from `Manual Stock Entry` / `Stock Entry` / `Manage Stock` to the chosen direct-entry wording.
- [ ] Keep the backend transaction value as `ReferenceType: 'DirectEntry'`.
- [ ] Align component/composable descriptions and comments with the new terminology.
- [ ] Decide and apply one user-facing label consistently. Recommended baseline:
  - menu/page title: `Direct Stock Entry`
  - route slug: `direct-entry`
  - backend value: `DirectEntry`
**Files**: `FRONTENT/src/pages/Warehouse/ManageStockPage.vue`, `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`, `FRONTENT/src/composables/useStockMovements.js`, `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`
**Pattern**: Keep the current implementation behavior; this is a naming and routing normalization pass, not a new workflow.
**Rule**: User-facing vocabulary and route vocabulary must no longer mix `Manual`, `Manage`, and `Direct` for the same workflow.

### Step 4: Update sidebar dedupe to preserve valid aliases
- [ ] Edit the sidebar tree builder in `FRONTENT/src/layouts/MainLayout/MainLayout.vue`.
- [ ] Replace the current route-only dedupe key with a composite key based on `groupPath + label + route`.
- [ ] Ensure intentional cross-group aliases are preserved when they differ by group or label.
- [ ] Keep exact duplicate menu entries suppressed.
**Files**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
**Pattern**: Existing sidebar group-tree construction from `auth.resources[*].ui.menus`.
**Rule**: Dedupe must not suppress a valid menu item solely because another item uses the same route.

### Step 5: Review route guard and resource-page title assumptions after route cleanup
- [ ] Verify `FRONTENT/src/router/index.js` behavior after removing query-string menu routes.
- [ ] Confirm `to.path`-based matching is acceptable once all active menu routes are clean paths.
- [ ] Review `FRONTENT/src/pages/Masters/ResourcePageShell.vue` for any assumptions based on first-match route titles if multiple aliases still point to one resource.
- [ ] Apply minimal fixes only if needed for the new direct-entry route structure.
**Files**: `FRONTENT/src/router/index.js`, `FRONTENT/src/pages/Masters/ResourcePageShell.vue`
**Pattern**: Route access is derived from `resource.ui.menus`.
**Rule**: The route guard must work with clean path routes and must not depend on query strings.

### Step 6: Align documentation with the new baseline
- [ ] Update `Documents/MODULE_WORKFLOWS.md` section 5 from `Manual Stock Entry` to the new direct-entry name and route.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` sidebar group examples and direct-entry section to match the new menu structure and route.
- [ ] Update `Documents/LOGIN_RESPONSE.md` wherever examples or references imply old stock-entry labels/routes or deprecated mode-menu behavior.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with a dated note describing:
  - direct-entry route normalization
  - query-string route removal
  - removal of unimplemented stock-mode menus
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if its menu examples still reference the old `/operations/manage-stock` convention.
**Files**: `Documents/MODULE_WORKFLOWS.md`, `Documents/AQL_MENU_ADMIN_GUIDE.md`, `Documents/LOGIN_RESPONSE.md`, `Documents/CONTEXT_HANDOFF.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`
**Pattern**: Doc updates must ship in the same task as the behavior change.
**Rule**: No active doc should describe `/operations/manage-stock` or query-string stock mode routes after this task.

### Step 7: Deploy metadata changes and verify end-to-end behavior
- [ ] If `GAS/syncAppResources.gs` changes, run `npm run gas:push`.
- [ ] Instruct the user to run `AQL > Setup & Refactor > Sync APP.Resources from Code`.
- [ ] Instruct the user to re-login so the fresh authorized resource payload is loaded.
- [ ] Verify the sidebar shows only the intended active `StockMovements` entries.
- [ ] Verify the direct-entry page opens from its new clean route and still submits `ReferenceType: 'DirectEntry'`.
- [ ] Verify no query-string stock mode menu remains visible.
**Files**: Terminal + APP spreadsheet manual sync
**Pattern**: GAS metadata changes must be pushed via `clasp` and then synced into the APP sheet.
**Rule**: APP sheet metadata and frontend auth payload must be refreshed after menu changes.

## Documentation Updates Required
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with the direct-entry name/route normalization.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` with the new sidebar map and direct-entry instructions.
- [ ] Update `Documents/LOGIN_RESPONSE.md` if examples or references use the old route/labels.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` because this changes the baseline navigation architecture.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if its route example still uses `/operations/manage-stock`.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` for renamed workflow terminology.

## Acceptance Criteria
- [ ] Sidebar dedupe uses `groupPath + label + route` semantics rather than route-only suppression.
- [ ] No active `StockMovements` menu route contains a query string.
- [ ] The current editable stock-entry workflow is reachable only through its clean direct-entry route.
- [ ] All current user-facing references to this workflow use the new direct-entry terminology consistently.
- [ ] Unimplemented stock-mode menu entries are removed from the active UI and metadata.
- [ ] Route guard behavior works correctly without query-string dependence.
- [ ] GAS metadata changes are pushed and APP.Resources can be refreshed from code.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [ ] Step 1 completed
- [ ] Step 2 completed
- [ ] Step 3 completed
- [ ] Step 4 completed
- [ ] Step 5 completed
- [ ] Step 6 completed
- [ ] Step 7 completed

### Deviations / Decisions
- [ ] `[?]` Final user-facing label chosen for the workflow (`Direct Entry` vs `Direct Stock Entry`)
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `FRONTENT/src/router/routes.js`
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `FRONTENT/src/pages/Warehouse/ManageStockPage.vue`
- `FRONTENT/src/components/Warehouse/StockEntryGrid.vue`
- `FRONTENT/src/composables/useStockMovements.js`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/CONTEXT_HANDOFF.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `PLANS/2026-04-11-direct-entry-route-and-menu-normalization.md`

### Validation Performed
- [ ] Frontend route/menu validation completed
- [ ] GAS push completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] Run `AQL 🚀 > Setup & Refactor > Sync APP.Resources from Code`
- [ ] Re-login in the frontend app to refresh authorized resource metadata
