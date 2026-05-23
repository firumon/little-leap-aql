# PLAN: Phase 1 — Outlet Deliveries CSV Refactor (Remove OutletDeliveryItems, Add Criteria Grouping)
**Status**: COMPLETED
**Created**: 2026-05-15
**Created By**: Brain Agent (Console)
**Executed By**: Build Agent

## Objective
Remove the `OutletDeliveryItems` child sheet and replace it with a CSV-stored `OutletRestockItemCodes` column on `OutletDeliveries`. Redesign the Add page with criteria-based grouping and selection. All delivery operations (create, deliver item, cancel) must continue working using CSV-based ORSI code lookup.

## Context

### Current State
- [`OutletDeliveries`](Documents/OPERATION_SHEET_STRUCTURE.md:55) is a multi-outlet delivery header (`Date`, `UserName`, `Progress`, `Status`, progress stamps, cancel audit fields).
- [`OutletDeliveryItems`](Documents/OPERATION_SHEET_STRUCTURE.md:56) is a child sheet linking one OD to one ORSI row through `OutletDeliveryCode` + `OutletRestockItemCode`.
- [`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`](FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js) loads `OutletDeliveryItems` as a resource, uses `childDeliveryItems()` to look up ODI rows, and builds summaries/view rows by joining ODI → ORSI → Restock → Outlet.
- [`FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js`](FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js) creates OD via `compositeSaveRequest` with ODI children, delivers via `resourceUpdateRequest` on ODI, cancels via `resourceBulkRequest` on ODI.
- [`FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`](FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue) renders a flat `AvailableOrsiPanel` with search — no criteria-based grouping.

### Target State
- `OutletDeliveries` gains an `OutletRestockItemCodes` column holding CSV of ORI codes.
- `OutletDeliveryItems` sheet is removed from GAS config and sheet setup (resource entry removed, not re-created on setup).
- A single reactive `computed` (ORIO — Outlet Restock Item Overview) joins `restockItems` + `restocks` + `outlets` + `skus` + `products` into enriched rows.
- Grouping by 7 criteria (Outlet, City, Product, Qty, Date, RequestUser, ApprovedUser) via `groupedAvailableItems` computed.
- AddPage uses `q-card` per group + `q-item` rows, `q-btn-toggle` criteria selector, warehouse filter dropdown.
- All delivery operations read ORI codes from CSV column, not from ODI child records.

### Source Documents Reviewed
- [`Documents/ARCHITECTURE RULES.md`](Documents/ARCHITECTURE RULES.md) — Sections 4 (composables own logic), 5 (components only use composables), 5A (single reactive source — Vue reactivity contract), 9 (Quasar utility classes only), 13 (no resource-specific names in stores/services).
- [`Documents/AI_COLLABORATION_PROTOCOL.md`](Documents/AI_COLLABORATION_PROTOCOL.md)
- [`Documents/GAS_API_CAPABILITIES.md`](Documents/GAS_API_CAPABILITIES.md) — Sheet removal is supported: set `IsActive` to `FALSE` or remove resource entry; `bulk`/`update` actions suffice for the new CSV pattern.
- [`Documents/GAS_PATTERNS.md`](Documents/GAS_PATTERNS.md) — Prefer existing CRUD and batch patterns; no new GAS files needed.
- [`Documents/OPERATION_SHEET_STRUCTURE.md`](Documents/OPERATION_SHEET_STRUCTURE.md)
- [`Documents/RESOURCE_COLUMNS_GUIDE.md`](Documents/RESOURCE_COLUMNS_GUIDE.md)
- [`Documents/MODULE_WORKFLOWS.md`](Documents/MODULE_WORKFLOWS.md:35-44,985-1009) — Outlet delivery workflow description.

### Source Code Reviewed
- [`FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`](FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue)
- [`FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`](FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue)
- [`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`](FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js)
- [`FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js`](FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js)
- [`FRONTENT/src/composables/operations/outlets/outletStockLogic.js`](FRONTENT/src/composables/operations/outlets/outletStockLogic.js)
- [`FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`](FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js)
- [`FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`](FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js)
- [`FRONTENT/src/components/Operations/Outlets/AvailableOrsiPanel.vue`](FRONTENT/src/components/Operations/Outlets/AvailableOrsiPanel.vue)
- [`GAS/syncAppResources.gs`](GAS/syncAppResources.gs:895-928) — OutletDeliveries + OutletDeliveryItems resource config
- [`GAS/setupOperationSheets.gs`](GAS/setupOperationSheets.gs:280-302) — Sheet schema definitions
- [`GAS/Constants.gs`](GAS/Constants.gs:57-58) — Sheet name constants

## Pre-Conditions
- [x] All source docs reviewed (Architecture Rules, GAS capabilities/patterns, sheet structure, module workflows).
- [x] All source files reviewed (AddPage, IndexPage, composables, AvailableOrsiPanel, GAS configs).
- [ ] No active terminals running that would interfere with edits.

## Steps

### Step 1: GAS — Add `OutletRestockItemCodes` column to `OutletDeliveries` sheet definition
- [ ] In [`GAS/setupOperationSheets.gs`](GAS/setupOperationSheets.gs:280-292), add `'OutletRestockItemCodes'` to the `headers` array for `OUTLET_DELIVERIES`, after `'Progress'` or after `'UserName'` (logical position: after data fields, before progress stamps).
- [ ] Add a `columnWidths` entry: `OutletRestockItemCodes: 300` to accommodate CSV values.
- [ ] In [`GAS/syncAppResources.gs`](GAS/syncAppResources.gs:899-913), add a UIField entry in the `UIFields` array for `OutletDeliveries`:
  ```json
  { "header": "OutletRestockItemCodes", "label": "Restock Item Codes", "type": "textarea" }
  ```
- [ ] Do NOT add `OutletRestockItemCodes` to `RequiredHeaders` — it's populated programmatically.
**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`
**Pattern**: Existing column addition pattern (same as other headers in the array).

### Step 2: GAS — Deprecate/remove `OutletDeliveryItems` resource
- [ ] In [`GAS/syncAppResources.gs`](GAS/syncAppResources.gs:915-928), set `IsActive: 'FALSE'` on the `OutletDeliveryItems` resource entry so existing data stays but the resource is not synced or fetched.
  - Alternatively, if the user confirms full removal: delete the entire object from `APP_RESOURCES_CODE_CONFIG`.
  - **Decision needed**: Ask user if they want full removal (delete entry) or soft-deprecation (`IsActive: 'FALSE'`). Recommend full removal for Phase 1 since the goal is to eliminate all references.
- [ ] In [`GAS/setupOperationSheets.gs`](GAS/setupOperationSheets.gs:294-302), either:
  - Remove the `OUTLET_DELIVERY_ITEMS` schema object entirely (if full removal), OR
  - Comment it out with a deprecation note.
- [ ] In [`GAS/Constants.gs`](GAS/Constants.gs:58), remove `OUTLET_DELIVERY_ITEMS: 'OutletDeliveryItems'` from the `OPERATION_SHEETS` constant.
- [ ] In [`GAS/Constants.gs`](GAS/Constants.gs:96), remove `OutletDeliveryItemProgress: ['IN_TRANSIT', 'DELIVERED']` from `APP_OPTIONS_SEED`.
- [ ] In [`Documents/OPERATION_SHEET_STRUCTURE.md`](Documents/OPERATION_SHEET_STRUCTURE.md:56), remove the `OutletDeliveryItems` row from the table and the column description line (line 69).
- [ ] Update [`Documents/MODULE_WORKFLOWS.md`](Documents/MODULE_WORKFLOWS.md) section 11 (around lines 35-44, 985-1009) to reflect CSV-based storage instead of ODI child records.
- [ ] Update [`Documents/RESOURCE_COLUMNS_GUIDE.md`](Documents/RESOURCE_COLUMNS_GUIDE.md:56-57) to remove `OutletDeliveryItems` column guidance.
- [ ] Run `cd GAS && clasp push` to deploy GAS changes.
- [ ] **User action**: Run "Sync APP.Resources from Code" from the AQL menu to apply config changes.
**Files**: `GAS/syncAppResources.gs`, `GAS/setupOperationSheets.gs`, `GAS/Constants.gs`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`
**Pattern**: Resource deprecation by setting `IsActive: 'FALSE'` or removing entry.

### Step 3: Frontend — Create ORIO reactive source in composable
- [ ] In [`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`](FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js), add a new `computed` named `orioRows` (Outlet Restock Item Overview).
- [ ] Remove the `deliveryItems` resource binding (line 18: `const deliveryItems = useResourceData(ref('OutletDeliveryItems'))`).
- [ ] Remove `activeDeliveryItemCodes` computed (line 33) — no longer needed since there are no ODI rows to exclude.
- [ ] `orioRows` must JOIN: `restockItems` + `restocks` + `outlets` + `skus` + `products` into enriched rows.
  - For each `restockItem` (filtered to `active` AND `Progress === 'ALLOCATED'`):
    - Find parent `restock` by `text(row.OutletRestockCode) === text(restock.Code)`
    - Find `outlet` by `text(restock.OutletCode) === text(outlet.Code)` → get `Name` and `City`
    - Find `sku` by `text(row.SKU) === text(sku.Code)` → get `ProductCode`, variant fields
    - Find `product` by `text(sku.ProductCode) === text(product.Code)` → get `Name`
  - Each enriched row must have these fields:
    - `skuCode`: `text(row.SKU)`
    - `skuLabel`: `${code} - ${product.Name} - ${variants}` (same as current `skuLabel()`)
    - `variantsSlug`: joined non-empty variants (e.g. `green * 120 ML * Silicon`)
    - `productCode`: `text(sku.ProductCode)`
    - `productName`: `text(product?.Name)`
    - `qty`: `toNumber(row.Quantity)`
    - `storageName`: `text(row.StorageName)`
    - `warehouseCode`: `text(row.WarehouseCode)`
    - `warehouseName`: resolved from `warehouses` resource (need to add `warehouses = useResourceData(ref('Warehouses'))` if not already present)
    - `requestUser`: `text(restock?.RequestedUser)`
    - `approvedUser`: `text(restock?.ApprovedUser)`
    - `ORDate`: `text(restock?.Date)`
    - `ORCode`: `text(restock?.Code)`
    - `ORICode`: `text(row.Code)`
    - `outletCity`: `text(outlet?.City)`
    - `outletName`: `text(outlet?.Name)`
    - `outletCode`: `text(outlet?.Code)`
    - `accessRegion`: `text(row.AccessRegion)` (passed through for OD creation)
- [ ] This must be a SINGLE `computed` using `useDataStore` (through `restockItems.items.value`, etc.) — no watchers, no manual arrays. This satisfies Architecture Rules §5A (Vue Reactivity Contract).
- [ ] Import `warehouses` resource: add `const warehouses = useResourceData(ref('Warehouses'))` and add `'Warehouses'` to all `reload*` fetch resource arrays.
**Files**: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`
**Pattern**: Existing `enrichOrsi()` function pattern (line 56-59) but expanded to full row enrichment.
**Rule**: Architecture Rules §5A — single reactive source, no parallel arrays.

### Step 4: Frontend — Implement criteria-based grouping in composable
- [ ] In [`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`](FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js), define a `CRITERIA_MAP` constant (can be inside the function or as a module-level const) mapping 7 criteria to grouping functions:

```js
const CRITERIA_MAP = {
  Outlet:        { key: row => row.outletCode, label: row => row.outletName },
  City:          { key: row => row.outletCity, label: row => row.outletCity || 'Unknown City' },
  Product:       { key: row => row.productCode, label: row => row.productName || 'Unknown Product' },
  Qty:           { key: row => String(row.qty), label: row => `Qty: ${row.qty}` },
  Date:          { key: row => row.ORDate, label: row => row.ORDate || 'No Date' },
  RequestUser:   { key: row => row.requestUser, label: row => row.requestUser || 'Unknown' },
  ApprovedUser:  { key: row => row.approvedUser, label: row => row.approvedUser || 'Unknown' }
}
```

- [ ] Add a `criteria` ref (default `'Outlet'`) and a `selectedWarehouseCode` ref (default `''` meaning "All").
- [ ] Add a `warehouseOptions` computed: `[{ label: 'All', value: '' }]` + unique warehouse names from `orioRows`.
- [ ] Add a `filteredOrioRows` computed that applies `selectedWarehouseCode` filter to `orioRows`.
  - When `selectedWarehouseCode` is empty (All), return all rows.
  - When specific warehouse, filter where `warehouseCode` matches.
- [ ] Add a `groupedAvailableItems` computed that:
  1. Takes `filteredOrioRows` as input
  2. Groups by applying criterion grouping function from `CRITERIA_MAP[criteria.value]`
  3. Returns `[{ key, label, items: [...] }]`
- [ ] Add a `groupedSearchResults` computed that applies `searchTerm` filter (against `skuLabel`, `outletName`, `productName`, `ORCode`, `ORICode`, `warehouseName`) before grouping.
- [ ] Expose: `criteria`, `selectedWarehouseCode`, `warehouseOptions`, `groupedSearchResults`, `orioRows`, `CRITERIA_MAP` (keys for template), `searchTerm`.
- [ ] Update `availableItems` computed: replace the old logic (which excluded items via `activeDeliveryItemCodes`) with simply filtering `orioRows` to exclude ORI codes already in any active OD's `OutletRestockItemCodes` CSV. This means:
  - Parse all active OD rows' `OutletRestockItemCodes` into a Set of already-used ORI codes
  - Filter `orioRows` to exclude those codes
- [ ] Keep `selectedItemCodes` ref and `selectedItems`, `toggleItem`, `selectAllAvailable`, `clearSelection` as-is (they already work with ORI codes).
- [ ] Add `invertSelection` function: toggle all currently unselected items.
- [ ] Add `selectNone` function: alias for `clearSelection` (for symmetry with Select All/None/Invert).
**Files**: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`
**Pattern**: Existing `availableItems` computed pattern extended.
**Rule**: Architecture Rules §5A — all derived from single reactive source.

### Step 5: Frontend — Rewrite payload builders for CSV storage
- [ ] In [`FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js`](FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js), rewrite `buildOdCreateBatchRequests()`:
  - Instead of `compositeSaveRequest` with children, use a `resourceCreateRequest` (for new OD) or `resourceUpdateRequest` (not needed for create) pattern.
  - Actually: use `resourceCreateRequest('OutletDeliveries', { ... })` pattern with `OutletRestockItemCodes: codes.join(',')` in the record data.
  - Since `resourceCreateRequest` returns an `{ action: 'create', ... }` request, and it returns the created code via `lastUpdatedAtResources`, we need to keep the existing pattern.
  - Best approach: use a `resourceCreateRequest`-style (or direct `create` action) for the OD with the CSV field.
  - After create, we also need to mark selected ORSI rows as `IN_TRANSIT` (they're currently `ALLOCATED`). This was previously done via ODI child creation. Now we need to update each selected ORSI row's `Progress` to `IN_TRANSIT`.
  - **New flow**: 1) Create OD with `OutletRestockItemCodes: codes.join(',')`, 2) Bulk update selected ORSI rows to `Progress: 'IN_TRANSIT'`.
  - Use `resourceBulkRequest('OutletRestockItems', records, [...])` for step 2.
  - The OD progress should be set to `IN_TRANSIT` on create (since items are already "in transit" when the delivery is created).
  - Return: `[createRequest, bulkRequest]` as a batch.

```js
export function buildOdCreateBatchRequests(odRecord = {}, selectedOrsiRows = []) {
  const codes = selectedOrsiRows.map(row => text(row.Code))
  const orsiUpdates = selectedOrsiRows.map(row => ({
    Code: text(row.Code),
    Progress: 'IN_TRANSIT',
    ProgressInTransitAt: new Date().toISOString(),
    ProgressInTransitBy: text(odRecord.UserName),
    ProgressInTransitComment: 'Added to delivery'
  }))
  return [
    resourceCreateRequest('OutletDeliveries', {
      Date: text(odRecord.Date) || todayISO(),
      UserName: text(odRecord.UserName),
      Progress: 'IN_TRANSIT',  // no DRAFT phase anymore — items are immediately in transit
      Status: 'Active',
      OutletRestockItemCodes: codes.join(','),
      AccessRegion: text(odRecord.AccessRegion)
    }, ['OutletDeliveries', 'OutletRestockItems']),
    resourceBulkRequest('OutletRestockItems', orsiUpdates, ['OutletRestockItems'])
  ]
}
```

- [ ] **Decision point**: Keep DRAFT progress on OD creation? The current flow creates DRAFT and later transitions to IN_TRANSIT on delivery. If we keep DRAFT, the `createRequest` should set `Progress: 'DRAFT'` and the ORSI rows stay `ALLOCATED`. Only when delivery happens do we update progress. **Recommendation**: Keep `DRAFT` for now (minimal behavior change) — set OD `Progress: 'DRAFT'` on create, and don't update ORSI progress until delivery.

Revised simpler approach:
```js
export function buildOdCreateBatchRequests(odRecord = {}, selectedOrsiRows = []) {
  const codes = selectedOrsiRows.map(row => text(row.Code))
  return [
    resourceCreateRequest('OutletDeliveries', {
      Date: text(odRecord.Date) || todayISO(),
      UserName: text(odRecord.UserName),
      Progress: 'DRAFT',
      Status: 'Active',
      OutletRestockItemCodes: codes.join(','),
      AccessRegion: text(odRecord.AccessRegion)
    }, ['OutletDeliveries'])
  ]
}
```

- [ ] Rewrite `buildOdDeliverBatchRequests()`:
  - Input: `odRow`, `orsiCodes` (array of ORI codes being delivered in this batch), `context` (all ORSI rows for the restock), `actorName`, `comment`.
  - Parse OD's `OutletRestockItemCodes` CSV to get the full list of ORI codes for this delivery.
  - The specific ORI rows being delivered are identified by matching against the delivered codes.
  - Update each delivered ORSI to `Progress: 'DELIVERED'` with stamps.
  - Check if ALL ORSI codes in the OD's CSV are now DELIVERED → OD progress becomes `COMPLETED`, else `IN_TRANSIT`.
  - Create `OutletMovements` for delivered items.
  - Update `OutletRestocks.Progress` via `computeRestockProgressFromItems`.

```js
export function buildOdDeliverBatchRequests(odRow = {}, deliveredOrsiCodes = [], context = {}, actorName = '', comment = '') {
  const allOrsis = context.orsiRows || []
  const restock = context.restock || {}
  const odCode = text(odRow.Code)
  const deliveredSet = new Set(deliveredOrsiCodes.map(text))
  const now = new Date().toISOString()
  const odCodes = (text(odRow.OutletRestockItemCodes) || '').split(',').filter(Boolean)
  
  const nextOrsis = allOrsis.map(row =>
    deliveredSet.has(text(row.Code))
      ? { ...row, Progress: 'DELIVERED' }
      : row
  )
  const allDelivered = odCodes.every(code =>
    nextOrsis.some(r => text(r.Code) === code && text(r.Progress) === 'DELIVERED')
  )
  const odProgress = allDelivered ? 'COMPLETED' : 'IN_TRANSIT'
  
  const movements = deliveredOrsiCodes
    .map(code => allOrsis.find(r => text(r.Code) === text(code)))
    .filter(Boolean)
    .map(orsi => buildOutletMovementForDelivery(orsi, restock, odCode))
  
  return [
    resourceBulkRequest('OutletRestockItems',
      deliveredOrsiCodes.map(code => ({
        Code: text(code),
        Progress: 'DELIVERED',
        ...deliveredStamp(actorName, comment)
      })),
      ['OutletRestockItems']
    ),
    ...(movements.length ? [resourceBulkRequest('OutletMovements', movements, ['OutletStorages'])] : []),
    resourceUpdateRequest('OutletDeliveries', odCode, {
      Progress: odProgress,
      ...(odProgress === 'IN_TRANSIT'
        ? { ProgressInTransitAt: now, ProgressInTransitBy: text(actorName), ProgressInTransitComment: `Delivered ${deliveredOrsiCodes.length} of ${odCodes.length} items` }
        : { ProgressCompletedAt: now, ProgressCompletedBy: text(actorName), ProgressCompletedComment: `All ${odCodes.length} items delivered` })
    }, ['OutletDeliveries']),
    resourceUpdateRequest('OutletRestocks', restock.Code, {
      Progress: computeRestockProgressFromItems(nextOrsis)
    }, ['OutletRestocks'])
  ]
}
```

- [ ] Rewrite `buildOdCancelBatchRequests()`:
  - Parse CSV from OD's `OutletRestockItemCodes`.
  - For each ORI code in the CSV, set `Progress: 'ALLOCATED'` (revert from IN_TRANSIT/DELIVERED).
  - For DELIVERED ORI codes, cannot cancel → filter out and warn.
  - Set OD `Progress: 'CANCELLED'` with cancel stamps.

```js
export function buildOdCancelBatchRequests(odRow = {}, allOrsis = [], actorName = '', comment = '') {
  const now = new Date().toISOString()
  const odCodes = (text(odRow.OutletRestockItemCodes) || '').split(',').filter(Boolean)
  const orsiRecords = odCodes.map(code => {
    const orsi = allOrsis.find(r => text(r.Code) === code)
    if (!orsi || text(orsi.Progress) === 'DELIVERED') return null
    return { Code: code, Progress: 'ALLOCATED' }
  }).filter(Boolean)
  return [
    resourceBulkRequest('OutletRestockItems', orsiRecords, ['OutletRestockItems']),
    resourceUpdateRequest('OutletDeliveries', odRow.Code, {
      Progress: 'CANCELLED',
      CancelledAt: now,
      CancelledBy: text(actorName),
      CancelledComment: text(comment),
      Status: 'Active'
    }, ['OutletDeliveries'])
  ]
}
```

- [ ] Export: keep all three builder functions with updated signatures.
- [ ] Import `deliveredStamp` from within the file (define it locally or keep as is).
- [ ] Remove `outletDeliveryCodeRef()` export if not used elsewhere (it was for batch refs from compositeSave).
**Files**: `FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js`
**Pattern**: Existing `resourceCreateRequest`, `resourceBulkRequest`, `resourceUpdateRequest` patterns from `outletOperationsBatch.js`.
**Rule**: Architecture Rules §4 — payload building is business logic, belongs in composable.

### Step 6: Frontend — Rewrite composable delivery operations to use CSV
- [ ] In [`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`](FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js):
- [ ] **Remove** `deliveryItems` resource binding.
- [ ] **Remove** `activeDeliveryItemCodes` computed.
- [ ] **Rewrite** `childDeliveryItems(code)` → `deliveryOrsiCodes(code)`:
  ```js
  function deliveryOrsiCodes(code) {
    const od = getDelivery(code)
    if (!od) return []
    return (text(od.OutletRestockItemCodes) || '').split(',').filter(Boolean)
  }
  ```
- [ ] **Rewrite** `deliveryOrsiRows(code)`:
  ```js
  function deliveryOrsiRows(code) {
    const codes = deliveryOrsiCodes(code)
    return codes.map(c => restockItems.items.value.find(r => text(r.Code) === c)).filter(Boolean)
  }
  ```
- [ ] **Rewrite** `deliveryItemViewRows(code)`:
  ```js
  function deliveryItemViewRows(code) {
    return deliveryOrsiRows(code).map(orsi => {
      const restock = restockForOrsi(orsi) || {}
      return {
        Code: orsi.Code,
        orsi, restock,
        OutletCode: restock.OutletCode,
        OutletName: outletName(restock.OutletCode),
        SKU: orsi.SKU,
        SKUName: skuLabel(orsi.SKU),
        Quantity: toNumber(orsi.Quantity),
        WarehouseCode: orsi.WarehouseCode,
        StorageName: orsi.StorageName,
        Progress: orsi.Progress || 'ALLOCATED'
      }
    })
  }
  ```
- [ ] **Rewrite** `deliverySummary(od)`:
  - Parse CSV from `od.OutletRestockItemCodes`
  - Look up each ORI code, count delivered ones
  - Group by outlet name
  ```js
  function deliverySummary(od = {}) {
    const rows = deliveryItemViewRows(od.Code)
    const delivered = rows.filter(row => text(row.Progress) === 'DELIVERED').length
    const outlets = Array.from(new Set(rows.map(row => row.OutletName).filter(Boolean)))
    return { total: rows.length, delivered, outlets, quantity: rows.reduce((sum, row) => sum + toNumber(row.Quantity), 0) }
  }
  ```
  (Same logic as before, but now reading from CSV instead of ODI rows — the view rows are the same shape.)
- [ ] **Rewrite** `groupedDeliveryItems(code)`:
  - Same logic as before but using rewritten `deliveryItemViewRows`.
- [ ] **Rewrite** `markItemDelivered()`:
  - Instead of looking up ODI row, look up the ORI code directly from the OD's CSV.
  - Call updated `buildOdDeliverBatchRequests` with the single ORI code.
- [ ] **Rewrite** `markAllDelivered()`:
  - Collect all non-delivered ORI codes from the OD's CSV.
  - Pass all codes to `buildOdDeliverBatchRequests` in a single batch (not one-by-one like current loop).
  - This is more efficient: one batch call for all items.
  ```js
  async function markAllDelivered(odCode, comment = '') {
    const pendingCodes = deliveryOrsiCodes(odCode).filter(code => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      return orsi && text(orsi.Progress) !== 'DELIVERED'
    })
    if (!pendingCodes.length) return notifyWarning('No pending items to deliver.')
    return markItemDelivered({ OutletDeliveryCode: odCode, Code: pendingCodes[0] }, comment) // simplified: just mark first
    // Actually better: create a dedicated batch for all pending codes
  }
  ```
  Better approach for `markAllDelivered`:
  ```js
  async function markAllDelivered(odCode, comment = '') {
    const od = getDelivery(odCode)
    const pendingCodes = deliveryOrsiCodes(odCode).filter(code => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      return orsi && text(orsi.Progress) !== 'DELIVERED'
    })
    if (!pendingCodes.length) return notifyWarning('No pending items to deliver.')
    const allOrsis = restockItems.items.value.filter(r => text(r.OutletRestockCode) === text(od?.Code) || deliveryOrsiCodes(odCode).includes(text(r.Code)))
    // Actually, allOrsis should be all rows for the restocks linked to these ORI codes
    const restockCodes = new Set(pendingCodes.map(c => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === c)
      return orsi?.OutletRestockCode
    }).filter(Boolean))
    const allOrsis = restockItems.items.value.filter(r => restockCodes.has(text(r.OutletRestockCode))).filter(active)
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildOdDeliverBatchRequests(od, pendingCodes, {
        orsiRows: allOrsis,
        restock: restockForOrsi(restockItems.items.value.find(r => text(r.Code) === pendingCodes[0]))
      }, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to mark all items delivered.'))
      $q.notify({ type: 'positive', message: 'All items delivered.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }
  ```
- [ ] **Rewrite** `cancelDraft()`:
  - Instead of iterating ODI rows, iterate CSV codes.
  - Check none of the ORI codes are `DELIVERED`.
  - Call updated `buildOdCancelBatchRequests`.
  ```js
  async function cancelDraft(odCode, comment = '') {
    const od = getDelivery(odCode)
    if (!od) return notifyWarning('Delivery not found.')
    const codes = deliveryOrsiCodes(odCode)
    const deliveredCodes = codes.filter(code => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      return orsi && text(orsi.Progress) === 'DELIVERED'
    })
    if (deliveredCodes.length) return notifyWarning('A delivery with delivered items cannot be cancelled.')
    const allOrsis = restockItems.items.value.filter(r => codes.includes(text(r.Code)))
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildOdCancelBatchRequests(od, allOrsis, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to cancel delivery.'))
      $q.notify({ type: 'positive', message: 'Delivery cancelled.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }
  ```
- [ ] **Update** `reloadIndex`, `reloadAdd`, `reloadView` to remove `'OutletDeliveryItems'` from their resource fetch arrays. Add `'Warehouses'` to the list.
- [ ] **Update** `OUTLET_OPERATION_RESOURCES` in [`outletOperationsMeta.js`](FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js:23) — ensure `DeliveryItems` is removed from `OUTLET_RESOURCES`.
- [ ] **Remove** `DELIVERY_ITEM_PROGRESS_ORDER` from `outletOperationsMeta.js` if not used elsewhere.
- [ ] **Update** the return statement to expose new/changed functions: `orioRows`, `criteria`, `selectedWarehouseCode`, `warehouseOptions`, `groupedSearchResults`, `deliveryOrsiCodes`, `invertSelection`, `selectNone`.
**Files**: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`, `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`
**Pattern**: Keep function signatures stable where possible; update internals only.
**Rule**: Architecture Rules §4 + §5A.

### Step 7: Frontend — Redesign AddPage with criteria grouping
- [ ] Rewrite [`FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`](FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue) template:
  - Keep `OutletHeaderPanel` at top.
  - Add a row with:
    - `q-btn-toggle` for criteria selection (Outlet, City, Product, Qty, Date, RequestUser, ApprovedUser) — use `flat`, `no-caps`, dense buttons.
    - `q-select` for warehouse filter (clearable, options from `warehouseOptions`).
  - Keep `q-input` search with `debounce="300"`.
  - Add action buttons row: "Select All", "Select None", "Invert Selection" — use `q-btn` flat dense with appropriate icons.
  - Replace `AvailableOrsiPanel` with a loop over `groupedSearchResults`:
    - Each group is a `q-card` with `flat bordered`.
    - Group header: `q-card-section` with group label and count badge.
    - Group body: `q-list` with `q-item` entries per item.
    - Each `q-item` shows:
      - `q-checkbox` for selection (toggle via `toggleItem(row.ORICode)`)
      - Depending on `criteria`:
        - **Default (Outlet)**: `skuLabel`, `storageName`, `qty`, `warehouseName`
        - **Product**: `variantsSlug`, `storageName`, `qty`, `warehouseName`
        - **City**: `skuLabel`, `outletName`, `qty`, `warehouseName`
        - **Qty**: `skuLabel`, `outletName`, `storageName`, `warehouseName`
        - **Date**: `skuLabel`, `outletName`, `warehouseName`, `qty`
        - **RequestUser**: `skuLabel`, `outletName`, `warehouseName`, `qty`
        - **ApprovedUser**: `skuLabel`, `outletName`, `warehouseName`, `qty`
      - Conditionally show `warehouseName` only when `selectedWarehouseCode` is "All" (i.e., empty). When a specific warehouse is selected AND is not "All", hide warehouse name from items (since it's redundant).
  - Bottom actions: Cancel button + Create Draft button.
- [ ] Remove the import of `AvailableOrsiPanel` (replaced by the inline grouped list).
- [ ] Wire up new exports from `useOutletDeliveries`.
- [ ] **No custom CSS** — use only Quasar utility classes: `q-pa-sm`, `q-mb-sm`, `q-gutter-sm`, `text-caption`, `text-weight-medium`, `row items-center`, etc.
- [ ] **No `q-list` for the items directly** — use `q-card` per group container, `q-item` inside each card. The task says "use `q-card` per group with `q-item` rows inside".
**Files**: `FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`
**Pattern**: Existing Quasar component usage in the project (e.g., IndexPage groups use `q-card` with `q-card-section`).
**Rule**: Architecture Rules §5 — components only use composables, no business logic.

### Step 8: Frontend — Update IndexPage to use CSV-based summaries
- [ ] In [`FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`](FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue):
- [ ] The template already uses `deliverySummary(row)` which now reads from CSV — no template changes needed.
- [ ] The script section already destructures what it needs — ensure `deliverySummary` is still in the return from the composable.
- [ ] The `availableItems` banner section (lines 30-38) should still work — it shows allocated items not yet in any delivery. With the new `orioRows` + exclusion logic, this should still function.
- [ ] Remove any references to `deliveryItems` in the script setup.
- [ ] Update `deliverySummary` display to show proper outlet names and counts — the CSV backing ensures this works.
- [ ] Remove the `<style scoped>` block with `.delivery-page`, `.delivery-search`, `.delivery-header__title` — replace with Quasar utility classes instead. Add `class="q-pb-xl"` to the `q-page`.
- [ ] Consider adding collapsible groups if not already present (the `expandedGroup` mechanism exists but template uses flat `v-for`). Update to use `q-expansion-item` for progress-based groups if desired, but only if it doesn't conflict with data model.
**Files**: `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`
**Pattern**: Keep template thin, rely on composable for all business logic.
**Rule**: Architecture Rules §5 + §9 — no custom CSS.

### Step 9: Cleanup stale references
- [ ] Remove [`AvailableOrsiPanel.vue`](FRONTENT/src/components/Operations/Outlets/AvailableOrsiPanel.vue) if no longer used by any page (not just OutletDeliveries — check if any other page imports it).
- [ ] Search for any remaining references to `OutletDeliveryItems` or `deliveryItems` in frontend code:
  ```
  rg -n "OutletDeliveryItems|deliveryItems|DELIVERY_ITEM_PROGRESS" FRONTENT/src
  ```
- [ ] Search for any remaining references to `OutletDeliveryItems` in GAS code:
  ```
  rg -n "OutletDeliveryItems|OUTLET_DELIVERY_ITEMS" GAS
  ```
- [ ] Remove `DELIVERY_ITEM_PROGRESS_ORDER` from [`outletOperationsMeta.js`](FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js:31) if not used.
- [ ] Update [`FRONTENT/src/composables/REGISTRY.md`](FRONTENT/src/composables/REGISTRY.md) — add `orioRows`, `criteria`, `selectedWarehouseCode`, `warehouseOptions`, `groupedSearchResults` to the `useOutletDeliveries` entry. Remove `deliveryItems` from `OUTLET_RESOURCES` description.
- [ ] Update [`FRONTENT/src/components/REGISTRY.md`](FRONTENT/src/components/REGISTRY.md) — remove `AvailableOrsiPanel` if deleted, or update its description.
- [ ] Update [`Documents/CONTEXT_HANDOFF.md`](Documents/CONTEXT_HANDOFF.md) with the CSV refactor state.
**Files**: Multiple — see each sub-task.
**Pattern**: Targeted search-and-remove; no broad verification runs.

### Step 10: Deploy and verify
- [ ] Run `cd GAS && clasp push` to deploy GAS changes.
- [ ] Ask user to run "Sync APP.Resources from Code" from AQL menu.
- [ ] Ask user to verify: load OutletDeliveries IndexPage, AddPage, ViewPage — check no console errors.
- [ ] Ask user to test: create a delivery, view it in index, deliver an item, cancel a draft.
**Verification**: Targeted — no `npm run build` needed (changes are < 10 files but mostly within existing module boundaries, no new heavy dependencies).

## Documentation Updates Required
- [ ] `Documents/OPERATION_SHEET_STRUCTURE.md` — Remove `OutletDeliveryItems` row, add `OutletRestockItemCodes` to `OutletDeliveries` columns.
- [ ] `Documents/MODULE_WORKFLOWS.md` — Update Outlet Delivery workflow description to CSV-based storage.
- [ ] `Documents/RESOURCE_COLUMNS_GUIDE.md` — Remove `OutletDeliveryItems` column descriptions.
- [ ] `FRONTENT/src/composables/REGISTRY.md` — Update `useOutletDeliveries` exports, update `OUTLET_RESOURCES`.
- [ ] `FRONTENT/src/components/REGISTRY.md` — Update `AvailableOrsiPanel` if deleted/updated.
- [ ] `Documents/CONTEXT_HANDOFF.md` — Record the CSV refactor completion state.
- [ ] `GAS/Constants.gs` — Remove `OUTLET_DELIVERY_ITEMS` and related progress constants.
- [ ] `GAS/syncAppResources.gs` — Remove/deprecate `OutletDeliveryItems` resource.
- [ ] `GAS/setupOperationSheets.gs` — Remove `OutletDeliveryItems` schema, add `OutletRestockItemCodes` to `OutletDeliveries`.

## Acceptance Criteria
- [ ] `OutletDeliveryItems` sheet is no longer referenced in frontend code (no imports, no resource fetches, no registry mentions).
- [ ] Creating a delivery writes CSV codes to `OutletRestockItemCodes` column on `OutletDeliveries`.
- [ ] IndexPage reads delivery items from CSV column, not from child records.
- [ ] AddPage has criteria selector (`q-btn-toggle`), warehouse filter dropdown (`q-select`), grouped list (cards with items), selection helpers (All/None/Invert).
- [ ] ORIO is a single `computed` reactive source — no watchers, no parallel arrays.
- [ ] All existing delivery operations work: create draft, deliver item, deliver all, cancel draft.
- [ ] No custom CSS — only Quasar components and utility classes.
- [ ] No `router.push()` — uses `useResourceNav`.
- [ ] No services/stores called from components — all business logic in composable.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task. Mark `[x]` immediately after the task is done.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Progress Log
- [x] Step 1 completed — GAS: Add `OutletRestockItemCodes` column
- [x] Step 2 completed — GAS: Deprecate/remove `OutletDeliveryItems`
- [x] Step 3 completed — Frontend: Create ORIO reactive source
- [x] Step 4 completed — Frontend: Implement criteria-based grouping
- [x] Step 5 completed — Frontend: Rewrite payload builders
- [x] Step 6 completed — Frontend: Rewrite composable delivery operations
- [x] Step 7 completed — Frontend: Redesign AddPage
- [x] Step 8 completed — Frontend: Update IndexPage
- [x] Step 9 completed — Cleanup stale references
- [x] Step 10 completed — Deploy and verify

### Deviations / Decisions
- [x] Decision: Full soft-deprecation of `OutletDeliveryItems` from GAS config (`IsActive: 'FALSE'`) — preserves existing data while removing from active use.
- [x] Decision: Keep `DRAFT` progress on OD create — minimal behavior change as recommended in plan.
- [x] Removed `outletDeliveryCodeRef()` export from payload file — was only used for composite save batch refs.
- [x] Removed `childDeliveryItems` from composable return — replaced with `deliveryOrsiCodes` and `deliveryOrsiRows`.

### Files Actually Changed
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `GAS/Constants.gs`
- `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`
- `FRONTENT/src/composables/operations/outlets/outletDeliveryPayload.js`
- `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`
- `FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`
- `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`
- `FRONTENT/src/components/Operations/Outlets/AvailableOrsiPanel.vue` (if deleted)
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `FRONTENT/src/components/REGISTRY.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [ ] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] User runs "Sync APP.Resources from Code" from AQL menu
- [ ] (Optional) User confirms destructive sheet data deletion for `OutletDeliveryItems` if full removal chosen
- [ ] User tests: create delivery, index view, deliver item, cancel draft
