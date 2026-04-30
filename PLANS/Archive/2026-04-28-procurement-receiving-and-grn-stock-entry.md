# PLAN: Procurement Receiving Alignment And GRN Stock Entry
**Status**: COMPLETED
**Created**: 2026-04-28
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Align PO Receiving with the procurement-chain schema by adding `ProcurementCode` to `POReceivings`, then add a Warehouse-side GRN Stock Entry module that posts finalized GRN quantities into `StockMovements`.

This plan has two execution tracks:

1. Schema/data alignment: make `POReceivings` carry `ProcurementCode` like the other procurement workflow headers.
2. New module: create GRN Stock Entry under Warehouse, reusing the existing Direct Stock Entry stock movement path.

## Context
Current procurement resources generally carry `ProcurementCode` on header rows: `PurchaseRequisitions`, `RFQs`, `RFQSuppliers`, `SupplierQuotations`, `PurchaseOrders`, `GoodsReceipts`, and `POFulfillments`.

`POReceivings` is the gap. It currently links only to `PurchaseOrderCode`, so procurement context is derived as:

`POReceiving -> PurchaseOrder -> Procurement`

That derivation works, but it is inconsistent with the rest of the procurement workflow and forces extra resource loading for reporting, filtering, debugging, and downstream stock/GRN flows. The existing GRN payload builder already checks `receiving.ProcurementCode` before falling back to the purchase order, which indicates the field belongs on the POR header.

The existing Direct Stock Entry workflow already owns the stock movement write path:

- `FRONTENT/src/pages/Operations/StockMovements/DirectEntryPage.vue`
- `FRONTENT/src/components/Operations/StockMovements/StockEntryGrid.vue`
- `FRONTENT/src/composables/operations/stock/useStockMovements.js`
- `GAS/syncAppResources.gs` menu/resource config for `StockMovements`
- `GAS/stockMovements.gs` post-create hook updates `WarehouseStorages`

GRN Stock Entry should reuse that path instead of creating a separate backend stock posting contract. A GRN is eligible when there is no existing `StockMovements` row where `ReferenceType === 'GRN'` and `ReferenceCode === GoodsReceipt.Code`.

## Pre-Conditions
- [ ] Required docs reviewed: `Documents/ARCHITECTURE RULES.md`, `Documents/FRONTENT_README.md`, `Documents/GAS_API_CAPABILITIES.md`, and the Direct Stock Entry section of `Documents/MODULE_WORKFLOWS.md`.
- [ ] The cache-aware resource loading refactor is in place so GRN, stock movement, warehouse, SKU, and storage reads do not bypass IndexedDB.
- [ ] The GoodsReceipts and GoodsReceiptItems resources have current `APP.Resources` metadata and sheet headers.
- [ ] `StockMovements` accepts `WarehouseCode`, `StorageName`, `ReferenceType`, `ReferenceCode`, `SKU`, and `QtyChange`.
- [ ] Existing live `POReceivings` rows can be backfilled from `PurchaseOrders.ProcurementCode`.

## Steps

### Step 1: Add ProcurementCode To POReceivings Schema
- [ ] Add `ProcurementCode` to the `POReceivings` operation sheet schema immediately after `Code`.
- [ ] Add column width metadata for `ProcurementCode`.
- [ ] Keep `POReceivingItems` unchanged; child rows should continue linking through `POReceivingCode`.

**Files**: `GAS/setupOperationSheets.gs`
**Pattern**: `PurchaseOrders`, `GoodsReceipts`, and other procurement-chain headers.
**Rule**: Procurement workflow header resources should carry `ProcurementCode` directly.

### Step 2: Add ProcurementCode To APP.Resources Metadata
- [ ] Add `ProcurementCode` to `POReceivings.RequiredHeaders`.
- [ ] Confirm `POReceivings.ParentResource` remains `PurchaseOrders`.
- [ ] Do not add a new custom endpoint or PostAction.

**Files**: `GAS/syncAppResources.gs`
**Pattern**: Existing resource config rows for `PurchaseOrders` and `GoodsReceipts`.
**Rule**: `APP.Resources` must match the actual sheet schema and frontend payload contract.

### Step 3: Update POR Frontend Payload And State
- [ ] Add `ProcurementCode` to the default/header form model.
- [ ] When a purchase order is selected, copy `selectedPurchaseOrder.ProcurementCode` into the POR form.
- [ ] Include `ProcurementCode` in `buildHeaderRecord()`.
- [ ] Include `ProcurementCode` in `canonicalReceivingSnapshot()` so dirty-state checks remain correct.
- [ ] Keep the existing GRN payload fallback, but expect `receiving.ProcurementCode` to be populated after this change.

**Files**: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`, `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
**Pattern**: Existing PO create/RFQ/SQ payload propagation of `ProcurementCode`.
**Rule**: POR draft save must persist procurement context without relying on a frontend join at read time.

### Step 4: Backfill Existing POReceivings
- [ ] Add or use a targeted GAS utility to backfill blank `POReceivings.ProcurementCode` from matching `PurchaseOrders.ProcurementCode`.
- [ ] Match by `POReceivings.PurchaseOrderCode === PurchaseOrders.Code`.
- [ ] Skip rows that already have `ProcurementCode`.
- [ ] Log counts for updated, skipped, and unmatched rows.
- [ ] Run setup/sync/cache-clear manually after deployment: Operation setup, APP resource sync, Clear All App Caches.

**Files**: Prefer existing GAS setup/maintenance area; do not create a runtime workflow endpoint unless necessary.
**Pattern**: Existing setup/refactor helpers.
**Rule**: Existing POR rows must become queryable by procurement without manual sheet editing.

### Step 5: Update Documentation For POR Schema
- [ ] Update operation/procurement sheet docs to list `POReceivings.ProcurementCode`.
- [ ] Update module workflow notes to state POR stores direct procurement context.
- [ ] Update resource/column notes if they describe POReceiving columns.

**Files**: `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/PROCUREMENT_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`
**Pattern**: Existing PO Receiving / Goods Receipts documentation.
**Rule**: Sheet setup, APP.Resources, frontend payload, and docs must stay aligned.

### Step 6: Add GRN Stock Entry Resource Menu Entry
- [ ] Add a Warehouse menu item immediately after Direct Stock Entry.
- [ ] Use route `/operations/stock-movements/grn-entry`.
- [ ] Use label `GRN Stock Entry`.
- [ ] Require write access because the page creates `StockMovements`.

**Files**: `GAS/syncAppResources.gs`
**Pattern**: Existing `Direct Stock Entry` resource menu config.
**Rule**: Menu order under Warehouse must place GRN Stock Entry directly after Direct Stock Entry.

### Step 7: Add GRN Stock Entry Page Shell
- [ ] Add the page under the existing StockMovements operations page folder.
- [ ] Keep the page thin: page owns only high-level step selection and renders reusable components.
- [ ] First step selects Warehouse.
- [ ] Second step selects eligible GRN for the selected warehouse.
- [ ] Third step displays item allocations and submit action.

**Files**: `FRONTENT/src/pages/Operations/StockMovements/GrnEntryPage.vue`
**Pattern**: `DirectEntryPage.vue`
**Rule**: Use Quasar components and avoid page-level business logic.

### Step 8: Add GRN Stock Entry Composable
- [ ] Create a composable for loading warehouses, eligible GRNs, GRN items, stock movements, storages, SKUs, and products.
- [ ] Reuse `useStockMovements()` for warehouse/storage helpers and final `submitBatch()`.
- [ ] Filter eligible GRNs by excluding any GRN whose `Code` already appears in `StockMovements` with `ReferenceType='GRN'` and matching `ReferenceCode`.
- [ ] Prefer cache-aware resource loading through the canonical store/data path.

**Files**: `FRONTENT/src/composables/operations/stock/useGrnStockEntry.js`
**Pattern**: `useStockMovements.js` plus POR/GRN composable structure.
**Rule**: Do not call GAS directly from the page or component.

### Step 9: Add Mobile-Friendly Allocation Component
- [ ] Create an allocation grid/card component for selected GRN items.
- [ ] Display each GRN item with SKU, product label when available, GRN quantity, allocated quantity, and remaining quantity.
- [ ] Allow multiple allocation rows per GRN item.
- [ ] Use `q-select` for storage names, matching Direct Stock Entry behavior.
- [ ] Show current stock for the selected warehouse + storage + SKU when storage is selected.
- [ ] Keep mobile layout compact and avoid bloated table-only UX.

**Files**: `FRONTENT/src/components/Operations/StockMovements/GrnStockEntryGrid.vue`
**Pattern**: `StockEntryGrid.vue`
**Rule**: Storage selection should reuse the same behavior users already see in Direct Stock Entry.

### Step 10: Enforce Quantity Allocation Rules
- [ ] Total allocation quantity per GRN item must always equal the GRN item quantity.
- [ ] If a user reduces one allocation row quantity, immediately insert or update a row below for the remaining quantity.
- [ ] If a user increases a row, reduce following rows for the same item without allowing negative quantities.
- [ ] Disable submit when any item total does not equal the GRN quantity.
- [ ] Convert blank storage to `_default` only at submit time.
- [ ] Display `_default` as a friendly blank/default label in the UI.

**Files**: `FRONTENT/src/composables/operations/stock/useGrnStockEntry.js`, `FRONTENT/src/components/Operations/StockMovements/GrnStockEntryGrid.vue`
**Pattern**: POR item quantity derivation and Direct Stock Entry storage UX.
**Rule**: No GRN quantity may be dropped or left unposted.

### Step 11: Submit GRN StockMovements
- [ ] Build one movement row per allocation row.
- [ ] Use `ReferenceType='GRN'`.
- [ ] Use `ReferenceCode=<GoodsReceipt.Code>`.
- [ ] Use positive `QtyChange` values matching allocation quantities.
- [ ] Use selected warehouse code for every movement row.
- [ ] Submit through `useStockMovements().submitBatch()`.
- [ ] After success, refresh `StockMovements`, `WarehouseStorages`, `GoodsReceipts`, and `GoodsReceiptItems` through write-refresh/force-refresh flow.

**Files**: `FRONTENT/src/composables/operations/stock/useGrnStockEntry.js`
**Pattern**: Direct Stock Entry `submitBatch()`.
**Rule**: Existing stock movement backend hook remains the only stock summary mutation path.

### Step 12: Registries And Documentation
- [ ] Add the new component to `FRONTENT/src/components/REGISTRY.md`.
- [ ] Add the new composable to `FRONTENT/src/composables/REGISTRY.md`.
- [ ] Document the GRN Stock Entry workflow in `Documents/MODULE_WORKFLOWS.md`.
- [ ] Mention manual GAS push/sync steps in final Build output, but do not run `npm run build` or `clasp push` unless explicitly requested.

**Files**: `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`, `Documents/MODULE_WORKFLOWS.md`
**Pattern**: Existing Direct Stock Entry docs and registry entries.
**Rule**: Reusable frontend files must be registered.

## Documentation Updates Required
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` for `POReceivings.ProcurementCode`.
- [ ] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` for `POReceivings.ProcurementCode`.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if it describes POReceiving columns.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with both POR procurement-code alignment and the GRN Stock Entry workflow.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` for the GRN allocation grid component.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` for the GRN stock entry composable.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if this becomes an active execution handoff.

## Acceptance Criteria
- [ ] `POReceivings` sheet includes `ProcurementCode`.
- [ ] `APP.Resources` for `POReceivings` requires `ProcurementCode`.
- [ ] New POR drafts persist `ProcurementCode` from the selected purchase order.
- [ ] Existing POR rows can be backfilled from matching purchase orders.
- [ ] GRN creation still works and can use `receiving.ProcurementCode`.
- [ ] Warehouse menu shows GRN Stock Entry immediately after Direct Stock Entry.
- [ ] Page lists only GRNs without existing `StockMovements.ReferenceType='GRN'` + matching `ReferenceCode`.
- [ ] Selecting a GRN displays all GRN items.
- [ ] Every item quantity is fully allocated before submit.
- [ ] Multiple storage allocations per item are supported.
- [ ] Blank storage submits as `_default`.
- [ ] Selected storage displays current stock for that SKU/location.
- [ ] Submit creates StockMovements and updates WarehouseStorages through the existing backend hook.
- [ ] Submitted GRNs no longer appear in the eligible GRN list after refresh.
- [ ] No broad build or clasp push is run unless the user explicitly approves it.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed
- [x] Step 8 completed
- [x] Step 9 completed
- [x] Step 10 completed
- [x] Step 11 completed
- [x] Step 12 completed

### Deviations / Decisions
- [x] `[?]` Decision: Added the `backfillPOReceivingProcurementCodes()` utility to `GAS/setupOperationSheets.gs` so it stays with operation schema maintenance instead of creating a runtime endpoint.
- [x] `[?]` Decision: GRN eligibility is warehouse-scoped through `PurchaseOrders.ShipToWarehouseCode` because `GoodsReceipts` does not store `WarehouseCode`.
- [x] `[!]` Issue/blocker: No frontend lint script exists in `FRONTENT/package.json`; broad build and clasp push were not run per this plan.

### Files Actually Changed
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`
- `FRONTENT/src/composables/operations/stock/useGrnStockEntry.js`
- `FRONTENT/src/components/Operations/StockMovements/GrnStockEntryGrid.vue`
- `FRONTENT/src/pages/Operations/StockMovements/GrnEntryPage.vue`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/2026-04-28-procurement-receiving-and-grn-stock-entry.md`

### Validation Performed
- [x] `node --check FRONTENT/src/composables/operations/stock/useGrnStockEntry.js`
- [x] `node --check FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`
- [x] Targeted `rg` checks for GRN route/component/composable/schema wiring
- [x] `git diff --check` on changed files; only CRLF normalization warnings were reported

### Manual Actions Required
- [ ] Run APP resource sync/cache clear if resource metadata or menu config changes are deployed.
- [ ] Run operation setup/backfill after the `POReceivings.ProcurementCode` schema change is deployed.
- [ ] Run `backfillPOReceivingProcurementCodes()` after `setupOperationSheets()` adds the new column.
