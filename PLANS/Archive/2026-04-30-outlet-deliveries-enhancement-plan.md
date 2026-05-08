# PLAN: Outlet Deliveries Enhancement — Schedule-Then-Deliver Workflow

**Status**: COMPLETED
**Created**: 2026-04-30
**Created By**: Brain Agent (kilo-auto)
**Executed By**: Build Agent (Kilo Code GPT-5.5)

## Objective

Transform `OutletDeliveries` from a simple confirmed-delivery-event resource into a two-stage schedule-then-deliver document. When an `OutletRestocks` record is approved, the delivery team creates an OD from it. OD starts as `SCHEDULED` (deducting warehouse stock), then moves to `DELIVERED` (adding outlet stock) or `CANCELLED` (reversing warehouse stock). This eliminates the current dropdown-based restock selection, replaces it with card-based selection, and introduces batch-driven scheduling, delivery, and cancellation with proper stock ledger entries.

## Context

### Current State
- `OutletDeliveries` is a flat confirmed-delivery event with `DeliveryDate`, `DeliveredByUserCode`, `DeliveredItemsJSON`, and `Progress = CONFIRMED`.
- Delivery creation uses a dropdown to select an approved ORS, then fills delivery quantities per storage allocation.
- Post-delivery creates `OutletMovements` with `ReferenceType = RestockDelivery` and `ReferenceCode = deliveryCode`, then updates ORS progress.
- `OutletStorages` is keyed by `OutletCode + StorageName + SKU` with audit columns.
- `StockMovements` does not have an `OutletRestock` reference type.

### Target State
- OD becomes a schedule-first document: `SCHEDULED` → `DELIVERED` or `CANCELLED`.
- Scheduling creates OD + negative `StockMovements` (warehouse deduction) in one batch.
- Delivery uses `executeAction`/batch to move OD to `DELIVERED` + positive `OutletMovements` (outlet stock addition).
- Cancellation reverses warehouse stock via `StockMovements` with `ReferenceType = OutletDeliveryCancel`.
- `OutletStorages` becomes SKU-only balance: `Code`, `OutletCode`, `SKU`, `Quantity` — no `StorageName`, no audit columns.
- `OutletMovements` retains `Code` as primary column.
- Card-based ORS selection on OD add page, not dropdown.
- Scheduled group expanded by default on index; only one group expanded at a time.

### Key Architecture Constraints
- All API/IDB calls stay in services only ([`Documents/ARCHITECTURE RULES.md`](Documents/ARCHITECTURE%20RULES.md)).
- Business workflow belongs in composables, not pages or services.
- Pages remain thin.
- Use `useWorkflowStore` for batch orchestration.
- `executeAction`, `update`, `create` return affected resource data — avoid immediate same-resource `get` after writes.
- Before any `action:get`, apply last-sync scope 1/10th logic.
- Use batch requests for scheduling, delivery, and cancellation.

## Pre-Conditions

- [ ] APP spreadsheet access available for sheet structure changes.
- [ ] GAS deployment access available for `clasp push`.
- [x] Existing outlet operation composables, pages, and services reviewed.
- [x] `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md` reviewed for current outlet workflow.
- [x] `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/Constants.gs` reviewed.
- [x] Frontend outlet composables reviewed: `useOutletDeliveries.js`, `outletOperationsBatch.js`, `outletOperationsMeta.js`, `outletRestockPayload.js`, `outletStockLogic.js`.
- [x] Frontend outlet pages reviewed: `OutletDeliveries/AddPage.vue`, `IndexPage.vue`, `ViewPage.vue`.

## Steps

### Step 1: AppOptions and Constants Updates

Add new app option values and reference types to `GAS/Constants.gs`:

- [ ] Add `OutletDeliveryProgress` to `APP_OPTIONS_SEED` with values: `['SCHEDULED', 'DELIVERED', 'CANCELLED']`.
- [ ] Add `OutletRestock` to `StockMovementReferenceType` array (append to existing `['GRN', 'DirectEntry', 'StockAdjustment']`).
- [ ] Add `OutletDeliveryCancel` to `StockMovementReferenceType` array.
- [ ] Add `Deliver` and `Cancel` additional actions to the `OutletDeliveries` resource config in `GAS/syncAppResources.gs` (see Step 3 for action config details).

**Files**: `GAS/Constants.gs`, `GAS/syncAppResources.gs`

### Step 2: OutletStorages Schema Change

Change `OutletStorages` from storage-level to SKU-only balance:

- [ ] Update `GAS/setupOperationSheets.gs` — `OUTLET_STORAGES` schema:
  - Remove `StorageName` from headers.
  - Remove `concat(commonAuditColumns)` — no audit columns.
  - Headers become: `['Code', 'OutletCode', 'SKU', 'Quantity']`.
  - Remove `StorageName: '_default'` from defaults.
  - Keep `Quantity: 0` default.
  - Update column widths accordingly.

- [ ] Update `GAS/syncAppResources.gs` — `OutletStorages` resource config:
  - Update `RequiredHeaders` to reflect new columns.
  - Remove any `StorageName` references from UIFields if present.

- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — change `OutletStorages` description from `OutletCode + StorageName + SKU` key to `OutletCode + SKU` key. Remove `StorageName` references.

- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` — update `OutletStorages` row in the outlet operation columns table.

- [ ] Update `Documents/MODULE_WORKFLOWS.md` — update any outlet storage workflow references that mention `StorageName`.

**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`

### Step 3: OutletDeliveries Resource Config Update

Update `OutletDeliveries` in `GAS/syncAppResources.gs`:

- [ ] Change `AdditionalActions` to include:
  ```json
  [
    {
      "action": "Deliver",
      "label": "Deliver",
      "icon": "local_shipping",
      "color": "positive",
      "kind": "mutate",
      "confirm": true,
      "column": "Progress",
      "columnValue": "DELIVERED",
      "columnValueOptions": [],
      "fields": [],
      "visibleWhen": { "column": "Progress", "op": "eq", "value": "SCHEDULED" }
    },
    {
      "action": "Cancel",
      "label": "Cancel",
      "icon": "cancel",
      "color": "negative",
      "kind": "mutate",
      "confirm": true,
      "column": "Progress",
      "columnValue": "CANCELLED",
      "columnValueOptions": [],
      "fields": [
        { "name": "Comment", "label": "Cancellation Comment", "type": "textarea", "required": false }
      ],
      "visibleWhen": { "column": "Progress", "op": "eq", "value": "SCHEDULED" }
    }
  ]
  ```

- [ ] Update `DefaultValues` to: `{"Status":"Active","Progress":"SCHEDULED"}`.

- [ ] Update `UIFields` JSON to reflect new columns: `ScheduledAt`, `DeliveredAt`, `CancelledAt`, `ScheduledBy`, `DeliveredBy`, `CancelledBy`, `ItemsJSON`, `WarehouseCode`, `OutletRestockCode`, `OutletCode`, `Progress`, `Status`, `AccessRegion`, `Remarks`.

**Files**: `GAS/syncAppResources.gs`

### Step 4: OutletDeliveries Sheet Schema Update

Update `GAS/setupOperationSheets.gs` — `OUTLET_DELIVERIES` schema:

- [ ] Replace current headers with new schema:
  ```javascript
  headers: [
    'Code', 'OutletRestockCode', 'OutletCode', 'WarehouseCode',
    'ScheduledAt', 'DeliveredAt', 'CancelledAt',
    'ScheduledBy', 'DeliveredBy', 'CancelledBy',
    'ItemsJSON', 'Progress',
    'ProgressDeliveredAt', 'ProgressDeliveredBy', 'ProgressDeliveredComment',
    'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
    'Remarks', 'Status', 'AccessRegion'
  ].concat(commonAuditColumns)
  ```
- [ ] Update defaults: `{ Status: 'Active', Progress: 'SCHEDULED' }`.
- [ ] Update progressValidation: `APP_OPTIONS_SEED.OutletDeliveryProgress`.
- [ ] Update columnWidths for new columns.
- [ ] Remove old columns: `DeliveryDate`, `DeliveredByUserCode`, `DeliveredItemsJSON`, `ProgressConfirmedAt`, `ProgressConfirmedBy`, `ProgressConfirmedComment`.

**Files**: `GAS/setupOperationSheets.gs`

### Step 5: OutletMovements Schema Update

Update `GAS/setupOperationSheets.gs` — `OUTLET_MOVEMENTS` schema:

- [ ] Ensure `Code` is the first header column (it already is).
- [ ] Add `Date` column if not already present as a movement date field. Current schema has `MovementDate` — confirm this is the auto-fill date field. If `Date` is preferred, add it; otherwise keep `MovementDate`.
- [ ] Ensure `ReferenceType` validation includes `RestockDelivery` (already in `APP_OPTIONS_SEED.OutletMovementReferenceType`).
- [ ] No structural changes needed beyond confirming `Code` is primary.

**Files**: `GAS/setupOperationSheets.gs`, `GAS/Constants.gs`

### Step 6: StockMovements Validation Update

- [ ] Update `GAS/setupOperationSheets.gs` — `STOCK_MOVEMENTS` schema:
  - Update `referenceTypeValidation` to use updated `APP_OPTIONS_SEED.StockMovementReferenceType` which now includes `OutletRestock` and `OutletDeliveryCancel`.

**Files**: `GAS/setupOperationSheets.gs`, `GAS/Constants.gs`

### Step 7: Frontend Meta and Constants Updates

Update `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`:

- [ ] Add `OutletDeliveryProgress` order array:
  ```javascript
  export const DELIVERY_PROGRESS_ORDER = ['SCHEDULED', 'DELIVERED', 'CANCELLED', 'OTHER']
  ```
- [ ] Add `SCHEDULED`, `DELIVERED`, `CANCELLED` to `META` object:
  ```javascript
  SCHEDULED: ['Scheduled', 'warning'],
  DELIVERED: ['Delivered', 'positive'],
  CANCELLED: ['Cancelled', 'negative']
  ```
- [ ] Add new reference type constant:
  ```javascript
  export const STOCK_MOVEMENT_REFERENCE_TYPES = {
    outletRestock: 'OutletRestock',
    outletDeliveryCancel: 'OutletDeliveryCancel'
  }
  ```
- [ ] Update `sortTime` to handle `ScheduledAt` and `DeliveredAt` fields.

**Files**: `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`

### Step 8: Frontend Batch Request Updates

Update `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`:

- [ ] Add new action configs:
  ```javascript
  export const OUTLET_ACTIONS = {
    // ... existing actions ...
    scheduleDelivery: { action: 'Schedule', column: 'Progress', columnValue: 'SCHEDULED' },
    deliverRestock: { action: 'Deliver', column: 'Progress', columnValue: 'DELIVERED' },
    cancelDelivery: { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' }
  }
  ```

**Files**: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`

### Step 9: Frontend Payload Composable — Scheduling

Create new scheduling payload builder in `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`:

- [ ] Create `buildScheduleDeliveryBatchRequests(restock, restockItems, warehouseCode, itemsJSON)`:
  - Creates OD record with:
    - `OutletRestockCode = restock.Code`
    - `OutletCode = restock.OutletCode`
    - `WarehouseCode = warehouseCode`
    - `ScheduledAt = current ISO timestamp`
    - `ScheduledBy = current user readable name`
    - `ItemsJSON = JSON string of [{ sku, storage, qty }]`
    - `Progress = 'SCHEDULED'`
    - `Status = 'Active'`
    - `AccessRegion = restock.AccessRegion`
  - Creates `StockMovements` records (one per item in ItemsJSON):
    - `WarehouseCode = warehouseCode`
    - `StorageName = item.storage`
    - `SKU = item.sku`
    - `QtyChange = -item.qty` (negative for deduction)
    - `ReferenceType = 'OutletRestock'`
    - `ReferenceCode = restock.Code`
    - `Status = 'Active'`
  - Returns batch array: `[createRequest, bulkMovementsRequest]`.
  - The create response will contain the OD code — use it directly, do not `get` OD after creation.

- [ ] Create `buildDeliverDeliveryBatchRequests(odCode, od, itemsJSON)`:
  - Creates `executeAction` request to move OD to `DELIVERED`.
  - Creates `OutletMovements` records (aggregated by SKU across all storages):
    - `OutletCode = od.OutletCode`
    - `MovementDate = current date/time`
    - `SKU = aggregated SKU`
    - `QtyChange = total qty for that SKU`
    - `ReferenceType = 'RestockDelivery'`
    - `ReferenceCode = od.Code`
    - `Status = 'Active'`
    - `AccessRegion = od.AccessRegion`
  - Updates ORS progress to `DELIVERED` or `PARTIALLY_DELIVERED` based on fulfillment.
  - Returns batch array: `[executeActionRequest, bulkMovementsRequest, updateRestockRequest]`.
  - Do not `get` OD or ORS after executeAction/update — use returned deltas.

- [ ] Create `buildCancelDeliveryBatchRequests(odCode, od, itemsJSON)`:
  - Creates `executeAction` request to move OD to `CANCELLED`.
  - Creates reversing `StockMovements` records (positive qty):
    - `WarehouseCode = od.WarehouseCode`
    - `StorageName = item.storage`
    - `SKU = item.sku`
    - `QtyChange = +item.qty` (positive for reversal)
    - `ReferenceType = 'OutletDeliveryCancel'`
    - `ReferenceCode = od.Code`
    - `Status = 'Active'`
  - Returns batch array: `[executeActionRequest, bulkMovementsRequest]`.
  - Do not `get` OD after cancellation — use returned deltas.

**Files**: `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`

### Step 10: Frontend Stock Logic Updates

Update `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`:

- [ ] Update `currentOutletStockQty` to work without `StorageName` — match by `OutletCode + SKU` only.
- [ ] Add `parseItemsJSON(value)` helper to parse `ItemsJSON` from OD records.
- [ ] Add `aggregateItemsBySku(itemsJSON)` helper to aggregate delivery items by SKU for outlet movements.
- [ ] Add `buildStockMovementsFromItems(warehouseCode, itemsJSON, referenceType, referenceCode, sign)` helper to generate stock movement records from ItemsJSON.
- [ ] Add `buildOutletMovementsFromItems(outletCode, itemsJSON, referenceType, referenceCode)` helper to generate aggregated outlet movement records.
- [ ] Keep existing `validateDelivery` but adapt it for the new scheduling flow — validation now checks that ORS is `APPROVED` or `PARTIALLY_DELIVERED` and that ItemsJSON is valid.

**Files**: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`

### Step 11: Frontend Composable — useOutletDeliveries Rewrite

Rewrite `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`:

- [ ] Replace current dropdown-based restock selection with card-based selection.
- [ ] `eligibleRestocks` computed: filter `APPROVED` and `PARTIALLY_DELIVERED` ORS records that do not already have a `SCHEDULED` OD (check existing ODs by `OutletRestockCode`).
- [ ] `selectRestock(code)` — when a restock card is selected:
  - Load restock items with their `StorageAllocationJSON`.
  - Build `ItemsJSON` from storage allocations: `[{ sku, storage, qty }]`.
  - Show items for reference only (read-only grid).
- [ ] `scheduleDelivery()` — batch create OD + stock movements:
  - Use `buildScheduleDeliveryBatchRequests`.
  - Execute via `workflowStore.runBatchRequests`.
  - Navigate to view page using returned OD code from create response.
  - Do not `get` OD after creation.
- [ ] `deliverDelivery(code)` — batch execute action + outlet movements:
  - Use `buildDeliverDeliveryBatchRequests`.
  - Execute via `workflowStore.runBatchRequests`.
  - Do not `get` OD after delivery.
- [ ] `cancelDelivery(code)` — batch execute action + stock reversal:
  - Use `buildCancelDeliveryBatchRequests`.
  - Execute via `workflowStore.runBatchRequests`.
  - Do not `get` OD after cancellation.
- [ ] Remove old `saveDelivery`, `selectRestock` (dropdown version), `buildDeliveryCreateRequest`, `buildDeliveryPostRequests` usage.

**Files**: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`

### Step 12: Frontend Add Page — Card Selection UI

Rewrite `FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`:

- [ ] Replace `q-select` dropdown with card-based ORS selection:
  - Use `q-card` with `q-card-section` for each eligible restock.
  - Each card shows: outlet name, ORS code, approved date, item count summary.
  - Clicking a card selects it (visual highlight/border).
  - Only one card selectable at a time.
- [ ] After card selection, show reference item grid:
  - Use `OutletItemGrid` in read-only mode.
  - Show: product name, variants, storage location, quantity.
  - No editing — items are for physical packing reference.
- [ ] Add warehouse selection dropdown (required for scheduling).
- [ ] Submit button triggers `scheduleDelivery()`.
- [ ] Keep page thin — all logic in composable.

**Files**: `FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`

### Step 13: Frontend Index Page — Grouped by Progress

Rewrite `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`:

- [ ] Group ODs by `Progress` value: `SCHEDULED`, `DELIVERED`, `CANCELLED`.
- [ ] `SCHEDULED` group has highest priority — listed first.
- [ ] `SCHEDULED` group expanded by default.
- [ ] Only one group expanded at a time — clicking a group header collapses others.
- [ ] Use `q-expansion-item` for each group.
- [ ] Each OD row shows: code, outlet name, ORS code, scheduled date, items summary, progress chip.
- [ ] Click row navigates to view page.
- [ ] Search filters across all groups.
- [ ] Keep page thin.

**Files**: `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`

### Step 14: Frontend View Page — Actions and Details

Rewrite `FRONTENT/src/pages/Operations/OutletDeliveries/ViewPage.vue`:

- [ ] Show OD header with: code, outlet name, ORS code, warehouse, progress chip.
- [ ] Show date fields: `ScheduledAt`, `DeliveredAt`, `CancelledAt` (only show filled ones).
- [ ] Show user fields: `ScheduledBy`, `DeliveredBy`, `CancelledBy` (only show filled ones).
- [ ] Show `ItemsJSON` as a read-only table/grid:
  - Columns: SKU, storage, qty.
  - Join with SKUs/Products for product name and variants display.
- [ ] Show action buttons based on progress:
  - `SCHEDULED`: Deliver button, Cancel button.
  - `DELIVERED`: Show delivery summary, link to outlet movements if available.
  - `CANCELLED`: Show cancellation summary, link to stock reversal movements.
- [ ] Deliver button calls `deliverDelivery(code)`.
- [ ] Cancel button opens confirmation dialog, then calls `cancelDelivery(code)`.
- [ ] Keep page thin.

**Files**: `FRONTENT/src/pages/Operations/OutletDeliveries/ViewPage.vue`

### Step 15: OutletMovements Post-Write Hook Update

Update the outlet movements post-write hook (wherever `handleOutletMovementsBulkSave` or equivalent exists in GAS):

- [ ] Ensure the hook updates `OutletStorages` using the new `OutletCode + SKU` key (no `StorageName`).
- [ ] The hook should aggregate `QtyChange` by `OutletCode + SKU` and upsert into `OutletStorages`.
- [ ] If the hook currently uses `StorageName`, remove that dimension.

**Files**: GAS file containing outlet movements post-write hook (likely `GAS/resourceApi.gs` or a dedicated hook file)

### Step 16: StockMovements Post-Write Hook — No Change Needed

- [ ] Confirm that `StockMovements` post-write hook already updates `WarehouseStorages` correctly.
- [ ] The new `OutletRestock` and `OutletDeliveryCancel` reference types should flow through the same hook without modification, since the hook is reference-type-agnostic for warehouse stock updates.

**Files**: GAS file containing stock movements post-write hook

### Step 17: Documentation Updates

- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md`:
  - Update `OutletDeliveries` column descriptions.
  - Update `OutletStorages` to `OutletCode + SKU` key, no audit columns.
  - Add `OutletDeliveryProgress` app option reference.
  - Add `OutletRestock` and `OutletDeliveryCancel` to `StockMovements.ReferenceType`.
  - Update `OutletMovements.ReferenceCode` to use `OD.Code`.

- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md`:
  - Update `OutletDeliveries` row with new columns.
  - Update `OutletStorages` row with new columns.
  - Update outlet operation workflow description.

- [ ] Update `Documents/MODULE_WORKFLOWS.md`:
  - Add new section for Outlet Deliveries schedule-then-deliver workflow.
  - Document scheduling flow, delivery flow, and cancellation flow.
  - Document batch request patterns.
  - Document stock movement reference types.

- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture or scope changed.

**Files**: `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`

## Documentation Updates Required

- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with new OD columns, new OutletStorages schema, new reference types.
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` with new OD and OutletStorages sheet structures.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with new OD workflow section.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture changed materially.

## Acceptance Criteria

- [ ] Approved ORS can be scheduled into an OD via card selection.
- [ ] Scheduling creates OD with `Progress = SCHEDULED` and negative `StockMovements` with `ReferenceType = OutletRestock`, `ReferenceCode = ORS.Code`.
- [ ] Scheduled OD appears on index page with `SCHEDULED` group expanded by default.
- [ ] Only one progress group expanded at a time on index page.
- [ ] Delivering a scheduled OD moves it to `DELIVERED` and creates positive `OutletMovements` with `ReferenceType = RestockDelivery`, `ReferenceCode = OD.Code`.
- [ ] `OutletStorages` is updated correctly via the post-write hook using `OutletCode + SKU` key.
- [ ] Cancelling a scheduled OD moves it to `CANCELLED` and creates reversing positive `StockMovements` with `ReferenceType = OutletDeliveryCancel`, `ReferenceCode = OD.Code`.
- [ ] No redundant `get` requests after `create`, `update`, or `executeAction` — batch responses are used directly.
- [ ] Any required `action:get` follows last-sync scope 1/10th logic.
- [ ] OD add page shows card-based ORS selection, not dropdown.
- [ ] OD add page shows items as read-only reference grid after card selection.
- [ ] OD view page shows appropriate actions based on progress state.
- [ ] `OutletStorages` has columns: `Code`, `OutletCode`, `SKU`, `Quantity` — no `StorageName`, no audit columns.
- [ ] `AppOptions` includes `OutletDeliveryProgress` with `SCHEDULED`, `DELIVERED`, `CANCELLED`.
- [ ] `StockMovements` validation accepts `OutletRestock` and `OutletDeliveryCancel` reference types.
- [ ] All docs updated to reflect new schema and workflow.
- [ ] No regression in existing outlet operations (visits, restocks, consumption).

## Post-Execution Notes

*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log

- [x] Step 1: AppOptions and Constants Updates
- [x] Step 2: OutletStorages Schema Change
- [x] Step 3: OutletDeliveries Resource Config Update
- [x] Step 4: OutletDeliveries Sheet Schema Update
- [x] Step 5: OutletMovements Schema Update
- [x] Step 6: StockMovements Validation Update
- [x] Step 7: Frontend Meta and Constants Updates
- [x] Step 8: Frontend Batch Request Updates
- [x] Step 9: Frontend Payload Composable — Scheduling
- [x] Step 10: Frontend Stock Logic Updates
- [x] Step 11: Frontend Composable — useOutletDeliveries Rewrite
- [x] Step 12: Frontend Add Page — Card Selection UI
- [x] Step 13: Frontend Index Page — Grouped by Progress
- [x] Step 14: Frontend View Page — Actions and Details
- [x] Step 15: OutletMovements Post-Write Hook Update
- [x] Step 16: StockMovements Post-Write Hook — No Change Needed
- [x] Step 17: Documentation Updates
- [x] Resume fix: `runBatchRequests` now carries cursors for explicit related resources and merges returned write deltas into existing store rows instead of replacing the resource with delta rows only.
- [x] Resume fix: OD schedule/cancel stock-movement batches now request `WarehouseStorages` cursors, and deliver outlet-movement batches request `OutletStorages` cursors, so post-write hook deltas are preserved without follow-up `get` calls.
- [x] Resume fix: OD view now renders movement reference summaries for delivered and cancelled states instead of leaving movement-link handling as an empty placeholder.
- [x] Resume fix: Outlet consumption posting now uses batch orchestration for outlet movement writes, requests `OutletStorages` cursor deltas, and no longer carries obsolete `StorageName` through SKU-only outlet storage flow.
- [x] Resume cleanup: removed unused outlet `action:get` helper so outlet workflow code has no stale same-resource refresh helper path.
- [x] Resume fix: GAS batch orchestration now resolves same-batch `__PENDING__` reference placeholders from earlier create/composite responses before dispatching later requests, preserving single-batch consumption save + outlet movement posting without follow-up reads.

### Deviations / Decisions

- [x] Decision: Kept `OutletMovements.MovementDate`; no new `Date` column added.
- [x] Decision: Cancellation is allowed only for `SCHEDULED` ODs. Delivered reversal remains out of scope.
- [x] Issue noted: `OutletStorages` schema change from `OutletCode + StorageName + SKU` to `OutletCode + SKU` is breaking. Existing data must be migrated or the sheet must be reset.

### Files Actually Changed

- `GAS/Constants.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `GAS/outletMovements.gs`
- `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`
- `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`
- `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`
- `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`
- `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`
- `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`
- `FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`
- `FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`
- `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`
- `FRONTENT/src/pages/Operations/OutletDeliveries/ViewPage.vue`
- `FRONTENT/src/stores/workflow.js`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed

- [x] Targeted `git diff --check` completed for resumed frontend/plan files; no whitespace errors reported.
- [x] Targeted `node --check` completed for resumed frontend JS files; no syntax errors reported.
- [x] Targeted search confirmed no stale outlet `action:get` or split `uploadBulkRecords` consumption posting path remains. Search command exited non-zero because no matches were found.
- [ ] Unit/manual validation completed
- [ ] Acceptance criteria verified
- [ ] No regression in existing outlet operations verified

### Manual Actions Required

- [ ] Run `setupOperationSheets()` in GAS to apply sheet schema changes.
- [ ] Run `syncAppResources()` in GAS to sync resource metadata.
- [ ] Run `cd GAS && clasp push` or `npm run gas:push` to deploy GAS changes. *(User requested manual execution; Build Agent did not run this.)*
- [ ] If existing `OutletStorages` data has `StorageName` values, decide whether to migrate or reset the sheet.
- [ ] Web App redeployment may be needed if API contract changed (new reference types, new action configs, same-batch `__PENDING__` placeholder support).
