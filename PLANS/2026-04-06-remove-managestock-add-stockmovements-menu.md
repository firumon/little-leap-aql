# PLAN: Remove ManageStock Resource & Add "Manage Stock" Menu to StockMovements
**Status**: IN_PROGRESS
**Created**: 2026-04-06
**Created By**: Brain Agent (Claude Sonnet 4.6)
**Executed By**: Build Agent (Codex | IN_PROGRESS)

## Objective
Remove the `ManageStock` functional resource entirely. Instead, add a second menu item ("Manage Stock") to the `StockMovements` resource's Menu array, so that `StockMovements` exposes two sidebar entries:
1. "Stock Movements" — the standard CRUD list page (existing).
2. "Manage Stock" — the wizard page for recording stock changes (existing frontend, currently routed via ManageStock).

This plan relies on **Plan 1** (`2026-04-06-menu-column-object-to-array.md`) being completed first, since it requires the Menu column to be in JSON Array format.

## Context
- `ManageStock` was created as a functional resource in the previous plan (`2026-04-05-warehouse-manage-stock-and-login-response-doc.md`). This was a design mistake.
- The correct approach: `StockMovements` resource should own both menu entries. The "Manage Stock" wizard page already exists in the frontend.
- The frontend Warehouse files (page, components, composable) should be **kept** — they are correctly built and functional. Only the routing and resource binding changes.
- `GAS/stockMovements.gs` (the `applyStockMovementToWarehouseStorages` hook) must be **kept** — it is the critical WarehouseStorages sync mechanism used by `handleMasterCreateRecord` in `GAS/masterApi.gs`.

**Key document references:**
- `PLANS/2026-04-06-menu-column-object-to-array.md` (prerequisite — must be COMPLETED)
- `Documents/MODULE_WORKFLOWS.md` (section 5: Manage Stock)
- `Documents/AQL_MENU_ADMIN_GUIDE.md` (section 9: Warehouse > Manage Stock)
- `Documents/LOGIN_RESPONSE.md`

## Pre-Conditions
- [ ] Plan 1 (`2026-04-06-menu-column-object-to-array.md`) is COMPLETED. Menu column is now JSON Array.
- [ ] `clasp push` access is available.
- [ ] Frontend dev server can be started for testing.

## Steps

### Step 1: Remove ManageStock from `syncAppResources.gs`
- [ ] Open `GAS/syncAppResources.gs`.
- [ ] Find the ManageStock resource entry (currently around lines 689-723, but line numbers may have shifted after Plan 1). It looks like:
  ```javascript
  {
      Name: 'ManageStock',
      Scope: 'operation',
      ...
      Functional: 'TRUE',
      ...
  },
  ```
- [ ] Delete the entire object (including the trailing comma). Remove the full block from `{` to `},`.
- [ ] Do NOT modify any other resource entry in this step.

**Files**: `GAS/syncAppResources.gs`
**Rule**: Only delete the ManageStock entry. Do not touch anything else.

---

### Step 2: Add Second Menu Item to StockMovements in `syncAppResources.gs`
- [ ] In the same file, find the `StockMovements` resource entry (currently around lines 632-657, but may have shifted).
- [ ] Its `Menu` field (after Plan 1) should look like:
  ```javascript
  Menu: JSON.stringify([{ group: 'Operations', order: 6, label: 'Stock Movements', icon: 'swap_horiz', route: '/operations/stock-movements', pageTitle: 'Stock Movements', pageDescription: 'Global ledger of inventory flows', show: true }]),
  ```
- [ ] Add a second menu item object to the array:
  ```javascript
  Menu: JSON.stringify([
      { group: 'Operations', order: 6, label: 'Stock Movements', icon: 'swap_horiz', route: '/operations/stock-movements', pageTitle: 'Stock Movements', pageDescription: 'Global ledger of inventory flows', show: true },
      { group: 'Warehouse', order: 1, label: 'Manage Stock', icon: 'inventory', route: '/operations/manage-stock', pageTitle: 'Manage Stock', pageDescription: 'Add, adjust, or directly enter stock movements', show: true }
  ]),
  ```
- [ ] Do NOT change any other field of the StockMovements entry.

**Files**: `GAS/syncAppResources.gs`
**Rule**: The second menu item must have `group: 'Warehouse'` and `order: 1` so it appears at the top of the Warehouse group. The `route` must be `/operations/manage-stock` (matching the existing frontend route).

---

### Step 3: Update Frontend Route Meta — `routes.js`
- [ ] Open `FRONTENT/src/router/routes.js`.
- [ ] Find the manage-stock route (currently around lines 48-51):
  ```javascript
  {
    path: '/operations/manage-stock',
    component: () => import('pages/Warehouse/ManageStockPage.vue'),
    meta: { scope: 'operation', requiresAuth: true }
  },
  ```
- [ ] This route is still valid and should **stay as-is**. The route guard in `router/index.js` will now find `StockMovements` resource (because its `menus` array includes a menu item with `route: '/operations/manage-stock'`), and access will be evaluated against `StockMovements` permissions.
- [ ] **No code change needed in this step.** This is a verification step — confirm the route exists and is correct.

**Files**: `FRONTENT/src/router/routes.js` (verify only)
**Rule**: The route path `/operations/manage-stock` must match the menu item's `route` value exactly.

---

### Step 4: Verify Frontend Warehouse Files Are Untouched
- [ ] Confirm these files exist and are NOT modified:
  - `FRONTENT/src/pages/Warehouse/ManageStockPage.vue`
  - `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue`
  - `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`
  - `FRONTENT/src/components/Warehouse/StockMovementRow.vue`
  - `FRONTENT/src/composables/useStockMovements.js`
- [ ] These files create records in the `StockMovements` resource via `callGasApi` with `resource: 'StockMovements'`. They do NOT reference `ManageStock` as a resource name in any API call. **No changes needed.**

**Files**: 5 files listed above (verify only, do not modify)
**Rule**: The Manage Stock wizard writes to `StockMovements` — this is correct and must remain.

---

### Step 5: Verify GAS Backend Files Are Untouched
- [ ] Confirm these files/functions are NOT modified:
  - `GAS/stockMovements.gs` — contains `applyStockMovementToWarehouseStorages()`. Must stay.
  - `GAS/masterApi.gs` — contains the post-insert hook for `StockMovements` that calls `applyStockMovementToWarehouseStorages()`. Must stay.
  - `GAS/masterApi.gs` — contains `rowArrayToObject()` helper. Must stay.
- [ ] **No changes needed.** This is a verification step.

**Files**: `GAS/stockMovements.gs`, `GAS/masterApi.gs` (verify only)
**Rule**: The WarehouseStorages sync hook is resource-logic, not ManageStock-specific. It must be preserved.

---

### Step 6: Deploy GAS Changes
- [ ] Run `cd GAS && clasp push --force` to deploy the backend changes (ManageStock removal + StockMovements menu array update).
- [ ] Verify no push errors.

**Files**: Terminal command
**Rule**: Must use `--force` flag.

---

### Step 7: Sync APP.Resources Sheet & Remove ManageStock Row
- [ ] Instruct user to open the APP spreadsheet.
- [ ] Instruct user to run `AQL > Setup & Refactor > Sync APP.Resources from Code`.
- [ ] After sync, the `StockMovements` row should now have the two-item Menu array.
- [ ] **Manual user action:** Find and DELETE the `ManageStock` row from the `APP.Resources` sheet. The sync script adds/updates rows but does not delete removed resources. The user must manually delete this row.
- [ ] Verify: After deletion, there should be NO row with `Name = ManageStock` in `APP.Resources`.

**Rule**: User must manually delete the ManageStock row from the sheet. This is critical — if left, it becomes an orphan resource that may cause auth confusion.

---

### Step 8: Clean Up RolePermissions
- [ ] Instruct user to check `APP.RolePermissions` sheet for any rows referencing `ManageStock`.
- [ ] If any permissions rows exist for `ManageStock`, delete them.
- [ ] If users had `ManageStock` in their role permissions, they now need `StockMovements` permissions instead (specifically `canRead` on `StockMovements` to see both menu items, unless the "Manage Stock" menu item has a custom `menuAccess` requiring `canWrite`).

**Rule**: Orphan permission entries should be cleaned up to avoid confusion.

---

### Step 9: Update Documentation — `Documents/MODULE_WORKFLOWS.md`
- [ ] Open `Documents/MODULE_WORKFLOWS.md`.
- [ ] Find section 5 (Manage Stock workflow). Update to reflect:
  - "Manage Stock" is a menu entry under the `StockMovements` resource (not a separate `ManageStock` resource).
  - Permission is controlled via `StockMovements` resource permissions (not `ManageStock`).
  - Remove any reference to `ManageStock` as a functional resource.

**Files**: `Documents/MODULE_WORKFLOWS.md`

---

### Step 10: Update Documentation — `Documents/AQL_MENU_ADMIN_GUIDE.md`
- [ ] Open `Documents/AQL_MENU_ADMIN_GUIDE.md`.
- [ ] Update section 9 (Warehouse > Manage Stock):
  - Change "Required permission" from `canRead on ManageStock resource` to `canRead on StockMovements resource`.
  - Change "To grant/revoke access" instructions: update `APP.RolePermissions` for `StockMovements` (not `ManageStock`).
  - Remove any mention of `ManageStock` as a functional resource.

**Files**: `Documents/AQL_MENU_ADMIN_GUIDE.md`

---

### Step 11: Update Documentation — `Documents/LOGIN_RESPONSE.md`
- [ ] Open `Documents/LOGIN_RESPONSE.md`.
- [ ] If there are examples showing `ManageStock` as a resource entry, replace with `StockMovements` having a two-item `menus` array.
- [ ] Ensure the example payload shows `entry.ui.menus` (array) format (should already be done by Plan 1, but verify ManageStock is not referenced).

**Files**: `Documents/LOGIN_RESPONSE.md`

---

### Step 12: Update Documentation — `Documents/CONTEXT_HANDOFF.md`
- [ ] Add a dated entry (2026-04-06) documenting:
  - `ManageStock` functional resource removed.
  - `StockMovements` now has two menu items: "Stock Movements" (list) and "Manage Stock" (wizard).
  - Access controlled via `StockMovements` permissions.

**Files**: `Documents/CONTEXT_HANDOFF.md`

---

### Step 13: Update Component & Composable Registries
- [ ] Open `FRONTENT/src/components/REGISTRY.md`.
- [ ] The 3 Warehouse component entries (`ManageStockContextStep`, `ManageStockEditGrid`, `StockMovementRow`) should remain but update their description to note they serve the `StockMovements` resource (not `ManageStock`).
- [ ] Open `FRONTENT/src/composables/REGISTRY.md`.
- [ ] The `useStockMovements` entry should remain. Update description if it mentions `ManageStock`.

**Files**: `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`

---

### Step 14: Final Verification
- [ ] **Search check:** Run a grep across the entire codebase for the string `ManageStock` (case-sensitive). The only acceptable remaining references should be:
  - This plan file itself
  - Git history (not in working tree)
  - Possibly the completed plan file from the previous implementation (`PLANS/2026-04-05-...`)
  - No GAS `.gs` files should reference it.
  - No frontend `.vue`, `.js` files should reference it.
  - No active documentation should reference it (only completed plan files).
- [ ] Instruct user to:
  1. Re-login in the frontend app.
  2. Verify the sidebar shows "Stock Movements" under Operations group AND "Manage Stock" under Warehouse group.
  3. Click "Manage Stock" — verify the wizard page loads and functions correctly.
  4. Click "Stock Movements" — verify the standard list page loads.
  5. Submit a stock movement via the wizard and verify the StockMovements list page shows the new record.
  6. Verify WarehouseStorages is updated automatically.

**Rule**: Zero references to `ManageStock` should exist in active code or documentation (only in completed plan files and git history).

## Documentation Updates Required
- [x] Update `Documents/MODULE_WORKFLOWS.md` with ManageStock removal and StockMovements dual-menu setup.
- [x] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` with corrected permission references.
- [x] Update `Documents/LOGIN_RESPONSE.md` to remove ManageStock examples.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with dated entry.
- [x] Update `FRONTENT/src/components/REGISTRY.md` descriptions.
- [x] Update `FRONTENT/src/composables/REGISTRY.md` descriptions.

## Acceptance Criteria
- [x] No `ManageStock` resource entry exists in `syncAppResources.gs`.
- [ ] No `ManageStock` row exists in `APP.Resources` sheet (user-verified).
- [x] `StockMovements` resource has a two-item Menu array in `syncAppResources.gs`.
- [ ] Sidebar shows "Stock Movements" (Operations group) and "Manage Stock" (Warehouse group).
- [ ] Both menu items navigate to their correct pages.
- [ ] "Manage Stock" wizard successfully creates `StockMovements` records.
- [ ] `WarehouseStorages` auto-update hook still works correctly.
- [ ] No orphan `ManageStock` references in code or active documentation.
- [x] `clasp push` succeeds without errors.
- [ ] Users with `StockMovements` `canRead` permission can see both menu items.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed (remove ManageStock from syncAppResources)
- [x] Step 2 completed (add second menu to StockMovements)
- [x] Step 3 completed (verify route — no change needed)
- [x] Step 4 completed (verify frontend files — no change needed)
- [x] Step 5 completed (verify GAS files — no change needed)
- [x] Step 6 completed (clasp push)
- [ ] Step 7 completed (user: sync + delete ManageStock row)
- [ ] Step 8 completed (user: clean RolePermissions)
- [x] Step 9 completed (MODULE_WORKFLOWS.md)
- [x] Step 10 completed (AQL_MENU_ADMIN_GUIDE.md)
- [x] Step 11 completed (LOGIN_RESPONSE.md)
- [x] Step 12 completed (CONTEXT_HANDOFF.md)
- [x] Step 13 completed (REGISTRY.md files)
- [ ] Step 14 completed (grep check + user verification)

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [x] `[!]` Issue/blocker: Step 14 grep target needs interpretation. `ManageStock` still appears in component/page file names (`ManageStockPage.vue`, etc.) by design (Step 4 says keep untouched). Resource identifier `'ManageStock'` was removed from GAS metadata and permission docs.

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [ ] Grep for `ManageStock` shows zero hits in active code/docs
- [x] clasp push succeeded
- [ ] Sidebar shows both menu items
- [ ] Wizard page functional
- [ ] WarehouseStorages hook works

### Manual Actions Required
- [ ] User: Run `AQL > Setup & Refactor > Sync APP.Resources from Code`
- [ ] User: Delete `ManageStock` row from `APP.Resources` sheet
- [ ] User: Check and clean `APP.RolePermissions` for ManageStock entries
- [ ] User: Re-login and verify sidebar shows both StockMovements menu items
- [ ] User: Test the Manage Stock wizard end-to-end
