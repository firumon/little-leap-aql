# PLAN: Outlet Consumptions Module — Stock Count, Invoice, Restock, and Visit Actions
**Status**: COMPLETED
**Created**: 2026-05-07
**Created By**: Brain Agent (Kilo Code GPT-5.5)
**Executed By**: Build Agent (Codex GPT-5)

## Objective

Build a complete Outlet Consumptions module for taking current outlet stock, deriving sold quantities, optionally generating a consumption invoice, optionally creating/submitting an outlet restock request, optionally completing the selected visit, and optionally scheduling the next visit.

The implementation must be simple enough to maintain, tap-friendly for field users, and aligned with the existing AQL generic resource architecture. The module must avoid custom backend endpoints unless Build Agent discovers a hard limitation in existing generic APIs.

Done means:

- The operation resource is standardized as `OutletConsumptions` instead of the current placeholder singular `OutletConsumption`.
- `OutletConsumptionItems` stores only final sold quantity in `Qty`.
- `OutletConsumptionInvoices` is created now for consumption-specific invoices.
- `OutletVisitCode` is optional context on `OutletConsumptions`.
- Existing related resources (`OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletMovements`, `OutletStorages`) are used but not structurally modified.
- Frontend flow supports outlet selection, auto-selected upcoming visit, tap-heavy stock count, sold/restock summary, checklist side effects, and coordinated submit.
- Resource metadata, setup scripts, docs, and frontend are aligned.

## Context

### Source Decisions From Guide Discussion

Final agreed decisions:

1. Use plural parent resource `OutletConsumptions` for consistency with operation resources like `Procurements`, `RFQs`, and `GoodsReceipts`.
2. Keep child resource name `OutletConsumptionItems`.
3. Add new invoice resource `OutletConsumptionInvoices`.
4. Add optional `OutletVisitCode` to `OutletConsumptions` only.
5. Do not modify columns of existing related resources touched by the flow.
6. Final checklist before submit:
   - `Complete selected visit`
   - `Schedule next visit`
   - `Generate invoice`
   - `Place restock request`
   - `Submit restock for approval immediately` (dependent on `Place restock request`)
7. `OutletConsumptions.Progress` values:
   - `PENDING_INVOICE_GENERATION`
   - `INVOICE_GENERATED`
   - `CANCELLED`
8. `OutletConsumptionItems` columns stay minimal: `Code`, `OutletConsumptionCode`, `SKU`, `Qty`, `Status`, audit columns.
9. `OutletConsumptionInvoices` columns use `PriceListCode`, `Subtotal`, `Discount`, and `Tax`; no `Total`, `Paid`, or `Balance` columns.
10. `OutletConsumptionInvoices.Progress` values:
    - `PENDING_PAYMENT`
    - `PARTIALLY_PAID`
    - `PAID`
    - `CANCELLED`
11. Treat all progress changes on new consumption/invoice resources as action-style changes with `At`, `By`, and `Comment` columns.
12. System-generated transitions must write detailed comments.
13. Restock output reuses existing `OutletRestocks` and `OutletRestockItems`.
14. Stock balance changes go through `OutletMovements`; never directly edit `OutletStorages`.

### Current State Observed

Existing placeholder/current implementation uses:

- `GAS/setupOperationSheets.gs` has placeholder `OutletConsumption` and `OutletConsumptionItems` schemas.
- `Documents/OPERATION_SHEET_STRUCTURE.md` documents singular `OutletConsumption` and `ConsumedQty`.
- `Documents/RESOURCE_COLUMNS_GUIDE.md` says `OutletConsumption` is independent of `OutletVisits` and currently does not include optional visit-link behavior.
- `Documents/MODULE_WORKFLOWS.md` has a short consumption workflow based on direct consumption quantity entry.
- Frontend currently has `FRONTENT/src/pages/operation/OutletConsumption/` pages and `useOutletConsumption.js` composable using singular `OutletConsumption`, `ConsumptionDate`, `RecordedByUserCode`, `ConsumedQty`, and `Progress = CONFIRMED`.
- Current add page is a simple manual consumed-item entry screen, not stock-count/summary/checklist flow.
- Existing outlet composables already use generic workflow store and resource data patterns.

### Architecture Constraints

- Read `Documents/ARCHITECTURE RULES.md` before touching any `FRONTENT/` file.
- Components must remain UI-only.
- Business logic must live in composables.
- No direct service calls from components or composables.
- Resource data should flow through `useDataStore`/`useResourceData` and workflow actions through `useWorkflowStore`.
- Navigation must go through `useResourceNav`.
- Generic stores/services must remain resource-agnostic.
- Backend changes should prefer existing GAS files and generic resource capabilities.
- After GAS changes, run `npm run gas:push` from repo root or `cd GAS && clasp push`.
- Ask for Web App redeployment only if the generic API contract changes. This plan should not require a contract change.

## Pre-Conditions

- [ ] Build Agent has read this full plan before editing.
- [ ] Build Agent has read `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md`.
- [ ] Build Agent has read `Documents/AI_COLLABORATION_PROTOCOL.md` before implementation.
- [ ] Build Agent has read `Documents/ARCHITECTURE RULES.md` before touching any file under `FRONTENT/`.
- [ ] Build Agent has read `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, and `Documents/RESOURCE_COLUMNS_GUIDE.md` before touching `GAS/` or schema metadata.
- [ ] Build Agent has inspected current `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/Constants.gs`, and outlet frontend files before editing.
- [ ] Build Agent has run `git status --short` before edits and will preserve unrelated user changes.
- [ ] Build Agent has reviewed the sample files visible on desktop only if accessible and useful: `C:/Users/firum/Desktop/OutletConsumptionProductDisplay.vue` and `C:/Users/firum/Desktop/OutletConsumptionSummary.vue`. These are references, not required to copy verbatim.

## Target Resource and Sheet Design

### Resource: `OutletConsumptions`

Purpose: parent document for one outlet stock count and sold-quantity recording session.

Headers in operation setup:

```javascript
[
  'Code',
  'OutletCode',
  'Date',
  'Username',
  'OutletVisitCode',
  'Progress',
  'ProgressPendingInvoiceGenerationAt',
  'ProgressPendingInvoiceGenerationBy',
  'ProgressPendingInvoiceGenerationComment',
  'ProgressInvoiceGeneratedAt',
  'ProgressInvoiceGeneratedBy',
  'ProgressInvoiceGeneratedComment',
  'ProgressCancelledAt',
  'ProgressCancelledBy',
  'ProgressCancelledComment',
  'Status',
  'AccessRegion',
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'UpdatedBy'
]
```

Required fields:

- `OutletCode`
- `Date`
- `Username`
- `Progress`
- `Status`

Optional fields:

- `OutletVisitCode`
- `AccessRegion`
- all action stamp/comment fields unless the matching progress transition occurs

Defaults:

- `Status = Active`
- `Progress = PENDING_INVOICE_GENERATION`

Validation values:

- `Progress`: `PENDING_INVOICE_GENERATION`, `INVOICE_GENERATED`, `CANCELLED`
- `Status`: current generic active/inactive handling, normally `Active`

Code prefix recommendation:

- `OC`

Code sequence length:

- Use the same operation convention length as nearby operation resources, likely `6` if year-scoped code generation is used. Build Agent must inspect existing outlet resource configs and follow the nearest convention.

Resource metadata requirements:

- `Name`: `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS`
- `Scope`: `operation`
- `SheetName`: `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS`
- `CodePrefix`: `OC`
- `Audit`: `TRUE`
- `RequiredHeaders`: `OutletCode,Date,Username,Progress,Status`
- `UniqueHeaders`: empty unless generic resource contract requires `Code`
- `DefaultValues`: `{"Status":"Active","Progress":"PENDING_INVOICE_GENERATION"}`
- `RecordAccessPolicy`: match current outlet operation parent resources, likely `OWNER_AND_UPLINE` or current placeholder policy. Do not invent a different policy without checking existing outlet resource configs.
- `OwnerUserField`: `CreatedBy`
- `IncludeInAuthorizationPayload`: `TRUE`
- `Functional`: `FALSE`
- `Menu`: add a visible Outlet Operations menu entry for list and/or a direct initiate route, depending on existing menu style.
- `CustomUIName`: leave blank unless the current routing requires custom UI; current full-page override can be used through pages if existing route patterns support it.
- `AdditionalActions`: include action definitions for progress transitions if the generic UI/actions will expose them.

AdditionalActions recommendation for `OutletConsumptions`:

```json
[
  {
    "action": "MarkInvoiceGenerated",
    "label": "Mark Invoice Generated",
    "icon": "receipt_long",
    "color": "positive",
    "kind": "mutate",
    "confirm": true,
    "column": "Progress",
    "columnValue": "INVOICE_GENERATED",
    "columnValueOptions": [],
    "fields": [
      { "name": "Comment", "label": "Comment", "type": "textarea", "required": false }
    ],
    "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_INVOICE_GENERATION" }
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
      { "name": "Comment", "label": "Cancellation Comment", "type": "textarea", "required": true }
    ],
    "visibleWhen": { "column": "Progress", "op": "nin", "value": ["CANCELLED"] }
  }
]
```

If the initial submit generates an invoice, frontend may set progress and stamp/comment fields directly in the create payload instead of using an immediate executeAction, but the stamp/comment columns must still be populated.

### Resource: `OutletConsumptionItems`

Purpose: child lines containing final sold quantity per SKU.

Headers:

```javascript
[
  'Code',
  'OutletConsumptionCode',
  'SKU',
  'Qty',
  'Status',
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'UpdatedBy'
]
```

Required fields:

- `OutletConsumptionCode`
- `SKU`
- `Qty`

Defaults:

- `Qty = 0`
- `Status = Active`

Validation/business rules:

- Only rows with `Qty > 0` are saved as active child rows.
- Duplicate `SKU` in the same consumption is blocked before submit.
- `Qty` is final sold quantity derived by the frontend stock count: `max(currentSystemStock - countedCurrentStock, 0)`.
- Do not store `OpeningQty`, `CurrentQty`, or `ConsumedQty`.
- Do not add action stamp columns to this child resource.

Code prefix recommendation:

- `OCI`

### Resource: `OutletConsumptionInvoices`

Purpose: consumption-specific invoice header generated from outlet consumption. Payment/receipt amounts are intentionally excluded because receipt/payment details will be implemented in a future receipt module.

Headers:

```javascript
[
  'Code',
  'OutletConsumptionCode',
  'Date',
  'OutletCode',
  'Username',
  'PriceListCode',
  'Subtotal',
  'Discount',
  'Tax',
  'Progress',
  'ProgressPendingPaymentAt',
  'ProgressPendingPaymentBy',
  'ProgressPendingPaymentComment',
  'ProgressPartiallyPaidAt',
  'ProgressPartiallyPaidBy',
  'ProgressPartiallyPaidComment',
  'ProgressPaidAt',
  'ProgressPaidBy',
  'ProgressPaidComment',
  'ProgressCancelledAt',
  'ProgressCancelledBy',
  'ProgressCancelledComment',
  'Status',
  'AccessRegion',
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'UpdatedBy'
]
```

Required fields:

- `OutletConsumptionCode`
- `Date`
- `OutletCode`
- `Username`
- `PriceListCode`
- `Progress`
- `Status`

Defaults:

- `Subtotal = 0`
- `Discount = 0`
- `Tax = 0`
- `Progress = PENDING_PAYMENT`
- `Status = Active`

Progress values:

- `PENDING_PAYMENT`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELLED`

Do not add these columns:

- `Total`
- `TotalAmount`
- `PaidAmount`
- `BalanceAmount`
- `InvoiceCode`

Reason:

- `Code` itself is invoice code.
- Receipt/payment module will later own paid/balance details.

Code prefix recommendation:

- `OCI` conflicts with item prefix; use `OCINV` or `OCIN`.
- Prefer `OCINV` if code prefix length supports it; otherwise use `OCIN`.

AdditionalActions recommendation for `OutletConsumptionInvoices`:

```json
[
  {
    "action": "MarkPartiallyPaid",
    "label": "Mark Partially Paid",
    "icon": "payments",
    "color": "info",
    "kind": "mutate",
    "confirm": true,
    "column": "Progress",
    "columnValue": "PARTIALLY_PAID",
    "columnValueOptions": [],
    "fields": [
      { "name": "Comment", "label": "Comment", "type": "textarea", "required": false }
    ],
    "visibleWhen": { "column": "Progress", "op": "eq", "value": "PENDING_PAYMENT" }
  },
  {
    "action": "MarkPaid",
    "label": "Mark Paid",
    "icon": "paid",
    "color": "positive",
    "kind": "mutate",
    "confirm": true,
    "column": "Progress",
    "columnValue": "PAID",
    "columnValueOptions": [],
    "fields": [
      { "name": "Comment", "label": "Comment", "type": "textarea", "required": false }
    ],
    "visibleWhen": { "column": "Progress", "op": "in", "value": ["PENDING_PAYMENT", "PARTIALLY_PAID"] }
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
      { "name": "Comment", "label": "Cancellation Comment", "type": "textarea", "required": true }
    ],
    "visibleWhen": { "column": "Progress", "op": "nin", "value": ["PAID", "CANCELLED"] }
  }
]
```

Note: If the receipt module later updates invoice progress automatically, it must write the matching `ProgressPartiallyPaid*` or `ProgressPaid*` stamp/comment columns.

## Important Build Rule: Existing Related Resource Columns Must Not Change

Do not modify the sheet columns for:

- `OutletVisits`
- `OutletRestocks`
- `OutletRestockItems`
- `OutletMovements`
- `OutletStorages`

The new flow may create/update/action these resources using their existing supported columns only.

Allowed interactions:

- Read `OutletVisits` to find planned/upcoming visit.
- Execute existing complete action/update for selected visit if checklist says complete selected visit.
- Create existing `OutletVisits` row for next planned visit if checklist says schedule next visit.
- Create existing `OutletRestocks` and `OutletRestockItems` if checklist says place restock request.
- Execute existing submit action for restock if checklist says submit immediately.
- Create existing negative `OutletMovements` rows with `ReferenceType = Consumption`.
- Read `OutletStorages` to determine current stock.

Forbidden interactions:

- Add new visit columns.
- Add new restock columns.
- Add new movement/storage columns.
- Directly update `OutletStorages.Quantity`.

## User Flow Requirements

### Step A: Outlet Selection

- Page starts by asking user to select an outlet.
- After outlet selection:
  - Load/filter current `OutletStorages` for that outlet.
  - Load/filter active/planned `OutletVisits` for that outlet.
  - Find upcoming planned visit:
    - `Status = PLANNED`
    - `Date >= today`
    - nearest date first
  - Auto-select this visit if found.
  - Allow user to clear or change selected visit if UI supports choosing from available planned visits.

### Step B: Product/SKU Stock Count

- Display stock rows grouped by product, then SKU.
- Source current stock from `OutletStorages.Quantity` by `OutletCode + SKU`.
- Resolve SKU to product using `SKUs.ProductCode` and `Products.Code`.
- Only show active products/SKUs/storages unless existing module behavior intentionally includes inactive for audit.
- For each SKU, show:
  - product name
  - SKU display text/variants
  - current system stock
  - current counted stock input
  - derived sold quantity
- Interface must be tap-friendly and minimum typing:
  - large plus/minus buttons for counted stock
  - quick set buttons such as `0`, `Same`, maybe `-1`, `+1`
  - numeric input still available for corrections
- Default counted current stock should be current system stock, resulting in sold `0` until user changes it.
- Derived sold quantity:
  - `soldQty = max(systemQty - countedCurrentQty, 0)`
- If counted current stock is greater than system stock:
  - show variance warning for that SKU
  - sold quantity remains `0`
  - Build Agent must decide with user or implement conservative behavior: allow proceed with warning but do not create negative movement for negative sold. Recommended: allow proceed only if variance rows are acknowledged in summary.

### Step C: Summary

Summary must show two sections:

1. Sold items
   - read-only list of SKUs where `soldQty > 0`
   - these become `OutletConsumptionItems` and negative `OutletMovements`
2. Restock items
   - default copied from sold items with same quantities
   - editable quantities
   - can remove lines
   - can add more product/SKU lines manually
   - only rows with restock quantity `> 0` create `OutletRestockItems`

The UI must clearly show that sold quantity is final persisted consumption `Qty`.

### Step D: Final Checklist

Checklist defaults:

- `Complete selected visit`: checked only when `OutletVisitCode` exists; disabled/unchecked when no selected visit.
- `Schedule next visit`: checked by default.
- `Generate invoice`: checked by default.
- `Place restock request`: checked by default when restock rows exist; unchecked/disabled if no restock rows.
- `Submit restock for approval immediately`: checked by default when `Place restock request` is checked; disabled if restock request is unchecked.

Checklist behavior:

- If `Complete selected visit` unchecked: do not complete selected visit.
- If `Schedule next visit` unchecked: do not create next visit.
- If `Generate invoice` unchecked: do not create invoice and set `OutletConsumptions.Progress = PENDING_INVOICE_GENERATION`.
- If `Generate invoice` checked: create `OutletConsumptionInvoices`, stamp invoice progress as `PENDING_PAYMENT`, and set `OutletConsumptions.Progress = INVOICE_GENERATED` with stamp/comment.
- If `Place restock request` unchecked: do not create restock parent/children.
- If `Submit restock for approval immediately` unchecked: leave created restock as `DRAFT`.
- If `Submit restock for approval immediately` checked: create restock and execute existing submit action to move it to `PENDING_APPROVAL`.

## Implementation Steps

### Step 1: Confirm Existing Constants and Resource Names

- [ ] Run `git status --short`.
- [ ] Search for all references to `OutletConsumption`, `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices`.
- [ ] Inspect `GAS/Constants.gs` for `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION` and related constants.
- [ ] Add or rename constants carefully:
  - Prefer adding `OUTLET_CONSUMPTIONS: 'OutletConsumptions'`.
  - Keep old singular alias only if needed temporarily to avoid breakage during migration, but final frontend/resource metadata should use plural parent.
  - Ensure `OUTLET_CONSUMPTION_ITEMS: 'OutletConsumptionItems'` remains.
  - Add `OUTLET_CONSUMPTION_INVOICES: 'OutletConsumptionInvoices'`.
- [ ] Inspect `APP_OPTIONS_SEED` and add option arrays if this project stores progress validation there:
  - `OutletConsumptionProgress`: `['PENDING_INVOICE_GENERATION', 'INVOICE_GENERATED', 'CANCELLED']`
  - `OutletConsumptionInvoiceProgress`: `['PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']`
- [ ] Do not remove old option arrays if used by other code until all references are migrated.

**Files**: `GAS/Constants.gs`
**Pattern**: Existing `CONFIG.OPERATION_SHEETS` and `APP_OPTIONS_SEED` definitions.
**Rule**: Resource names in constants, setup, sync metadata, docs, and frontend must align.

### Step 2: Update Operation Sheet Setup Schemas

- [ ] In `GAS/setupOperationSheets.gs`, replace the current placeholder parent schema for singular `OUTLET_CONSUMPTION` with plural `OUTLET_CONSUMPTIONS`.
- [ ] Use the exact target `OutletConsumptions` headers from this plan.
- [ ] Set defaults:
  - `Status: 'Active'`
  - `Progress: 'PENDING_INVOICE_GENERATION'`
- [ ] Set progress validation to `APP_OPTIONS_SEED.OutletConsumptionProgress` if added, otherwise inline array.
- [ ] Add column widths for all new columns. Use readable widths:
  - codes and references around `150–190`
  - comments around `240–320`
  - timestamps around `160–180`
- [ ] Update `OutletConsumptionItems` schema:
  - replace `ConsumedQty` with `Qty`
  - remove `Remarks` unless Build Agent finds a hard UI/report dependency. The agreed schema does not include remarks.
  - headers: `Code`, `OutletConsumptionCode`, `SKU`, `Qty`, `Status`, audit columns
  - defaults: `Status: 'Active'`, `Qty: 0`
- [ ] Add new `OutletConsumptionInvoices` schema using exact target headers.
- [ ] Add progress validation for invoice progress.
- [ ] Do not edit schemas for existing related resources.

**Files**: `GAS/setupOperationSheets.gs`
**Pattern**: Existing outlet operation schemas near `OutletRestocks`, `OutletDeliveries`, and placeholder consumption schema.
**Rule**: Only new/refined consumption resources get schema changes; related resource columns remain unchanged.

### Step 3: Update Resource Registry Sync Config

- [ ] In `GAS/syncAppResources.gs`, find current placeholder `OutletConsumption` and `OutletConsumptionItems` entries.
- [ ] Rename/reconfigure parent to `OutletConsumptions` using `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS`.
- [ ] Update parent metadata:
  - `CodePrefix`: `OC`
  - `CodeSequenceLength`: follow operation convention, likely `6`
  - `Audit`: `TRUE`
  - `RequiredHeaders`: `OutletCode,Date,Username,Progress,Status`
  - `DefaultValues`: `{"Status":"Active","Progress":"PENDING_INVOICE_GENERATION"}`
  - `RecordAccessPolicy`: match existing outlet parent operations
  - `OwnerUserField`: `CreatedBy`
  - `AdditionalActions`: use actions from target design
  - `Menu`: visible under `Outlet Operations`; include at least list route and preferably add/initiate route
  - `UIFields`: include final fields for generic fallback; custom page can still override main flow
  - `IncludeInAuthorizationPayload`: `TRUE`
- [ ] Update `OutletConsumptionItems` metadata:
  - `ParentResource`: `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS`
  - `RequiredHeaders`: `OutletConsumptionCode,SKU,Qty`
  - `DefaultValues`: `{"Status":"Active","Qty":0}`
  - `UniqueCompositeHeaders`: `OutletConsumptionCode+SKU` if supported and consistent with other child resources
  - `Audit`: follow child resource convention. Current placeholder uses audit columns; target schema includes audit columns, so use `TRUE` unless existing operation child convention requires otherwise.
- [ ] Add new `OutletConsumptionInvoices` metadata:
  - `Name`: `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES`
  - `Scope`: `operation`
  - `ParentResource`: `CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS`
  - `CodePrefix`: `OCINV` or `OCIN`
  - `Audit`: `TRUE`
  - `RequiredHeaders`: `OutletConsumptionCode,Date,OutletCode,Username,PriceListCode,Progress,Status`
  - `DefaultValues`: `{"Status":"Active","Progress":"PENDING_PAYMENT","Subtotal":0,"Discount":0,"Tax":0}`
  - `RecordAccessPolicy`: match `OutletConsumptions`
  - `AdditionalActions`: use invoice actions from target design
  - `Menu`: can be hidden initially or visible under Outlet Operations depending user needs. Recommended visible list route under Outlet Operations after consumption.
  - `UIFields`: include final fields.
- [ ] Ensure JSON in `AdditionalActions`, `Menu`, and `UIFields` is valid.
- [ ] Do not modify `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletMovements`, or `OutletStorages` metadata except if a reference to renamed parent resource must be updated elsewhere.

**Files**: `GAS/syncAppResources.gs`
**Pattern**: Existing operation resources with parent/child relationships and AdditionalActions.
**Rule**: Resource config must match setup headers and defaults.

### Step 4: Update Any GAS Post-Write Hook References If Needed

- [ ] Search `GAS/` for `OutletConsumption` and `OutletConsumptionItems` references.
- [ ] If a post-write hook or helper expects singular `OutletConsumption`, update it to `OutletConsumptions`.
- [ ] Ensure `OutletMovements.ReferenceType = Consumption` remains valid and no custom hook writes outlet storage directly.
- [ ] If `resolveParentCodeField` is generic and uses resource name to infer parent key, verify it maps `OutletConsumptions` parent to child field `OutletConsumptionCode`.
  - If the generic resolver cannot infer singular parent from plural resource, add a narrowly scoped mapping in the existing resolver location.
  - Do not rename child link field to `OutletConsumptionsCode`; keep `OutletConsumptionCode`.
- [ ] Do not create a new GAS endpoint for this module.

**Files**: `GAS/*.gs`
**Pattern**: Existing generic `compositeSave` parent-code injection and outlet movement post-write hook.
**Rule**: Parent resource pluralization must not break child `OutletConsumptionCode` injection.

### Step 5: Update Frontend Resource Constants and Meta

- [ ] In `outletOperationsMeta.js`, change `OUTLET_RESOURCES.consumption` from `OutletConsumption` to `OutletConsumptions`.
- [ ] Add `OUTLET_RESOURCES.consumptionInvoices = 'OutletConsumptionInvoices'`.
- [ ] Ensure `OUTLET_OPERATION_RESOURCES` includes the new invoice resource.
- [ ] Add progress order constants if needed:
  - `CONSUMPTION_PROGRESS_ORDER`
  - `CONSUMPTION_INVOICE_PROGRESS_ORDER`
- [ ] Add `META` labels/colors for:
  - `PENDING_INVOICE_GENERATION`
  - `INVOICE_GENERATED`
  - `PENDING_PAYMENT`
  - `PARTIALLY_PAID`
  - `PAID`
- [ ] Keep `CONFIRMED` only if other existing code still uses it; new consumption flow must not use it.
- [ ] Confirm no component/store directly hardcodes singular `OutletConsumption` except route folder naming if routes require it.

**Files**: `FRONTENT/src/composables/operation/outlets/outletOperationsMeta.js`
**Pattern**: Existing outlet resource constants and progress meta.
**Rule**: Frontend resource names must match `APP.Resources` names.

### Step 6: Replace Consumption Payload Builder

- [ ] Refactor `outletConsumptionPayload.js` to build the new payloads.
- [ ] Replace `buildConsumptionCompositePayload(form, rows)` with a function that writes `OutletConsumptions` parent data:
  - `OutletCode`
  - `Date`
  - `Username`
  - optional `OutletVisitCode`
  - `Progress`
  - matching progress stamp/comment fields depending on invoice checklist
  - `Status`
  - `AccessRegion`
- [ ] Child records must use:
  - `SKU`
  - `Qty`
  - `Status`
- [ ] Remove use of `ConsumptionDate`, `RecordedByUserCode`, `ConsumedQty`, and `Remarks` from new consumption payloads.
- [ ] Add builder for negative `OutletMovements`:
  - `OutletCode`
  - `StorageName: '_default'` only if existing `OutletMovements` schema still requires it
  - `SKU`
  - `QtyChange: -Math.abs(Qty)`
  - `ReferenceType: 'Consumption'`
  - `ReferenceCode: consumptionCode`
  - `ReferenceItemCode`: leave blank unless Build Agent can map generated child item codes reliably
  - `MovementDate: Date`
  - `Status: 'Active'`
  - `AccessRegion`
- [ ] Add builder for `OutletConsumptionInvoices` create record:
  - `OutletConsumptionCode`
  - `Date`
  - `OutletCode`
  - `Username`
  - `PriceListCode`
  - `Subtotal`
  - `Discount`
  - `Tax`
  - `Progress: 'PENDING_PAYMENT'`
  - `ProgressPendingPaymentAt`
  - `ProgressPendingPaymentBy`
  - `ProgressPendingPaymentComment`
  - `Status: 'Active'`
  - `AccessRegion`
- [ ] Add helper for detailed system action comments. Example output:
  - `Invoice created automatically from outlet consumption OC26000001 by Firose Hussain on 23/12/2026 at 9 PM.`
- [ ] Add builders for optional restock create/composite and submit action only if not already reusable in `outletRestockPayload.js`.
- [ ] Avoid duplicate logic; reuse existing restock payload builder where possible.

**Files**: `FRONTENT/src/composables/operation/outlets/outletConsumptionPayload.js`, possibly `outletRestockPayload.js`
**Pattern**: Existing payload-builder files keep data shaping outside components.
**Rule**: Payload builders are pure helpers; workflow orchestration belongs in composables.

### Step 7: Create/Refactor Consumption Business Composables

Refactor `useOutletConsumption.js` or split it into smaller composables if the file would exceed the architecture target. Recommended split:

- `useOutletConsumptionSelection.js`
- `useOutletConsumptionStockCount.js`
- `useOutletConsumptionSummary.js`
- `useOutletConsumptionSubmit.js`
- keep `useOutletConsumption.js` as aggregator if helpful

Required state and behavior:

- [ ] Load all needed resources through `workflowStore.fetchResources`:
  - `OutletConsumptions`
  - `OutletConsumptionItems`
  - `OutletConsumptionInvoices`
  - `OutletStorages`
  - `OutletVisits`
  - `OutletRestocks`
  - `OutletRestockItems`
  - `OutletMovements`
  - `Outlets`
  - `OutletOperatingRules`
  - `Products`
  - `SKUs`
  - any price-list resources if they exist
- [ ] Maintain form state:
  - `OutletCode`
  - `Date`
  - `Username`
  - `OutletVisitCode`
  - `PriceListCode`
  - `AccessRegion`
- [ ] Maintain stock count rows derived from outlet storage:
  - `ProductCode`
  - `ProductName`
  - `SKU`
  - `SkuLabel`
  - `SystemQty`
  - `CurrentQty`
  - derived `SoldQty`
  - variance flags
- [ ] Maintain summary restock rows:
  - default from sold rows
  - editable `Quantity`
  - add/remove/manual SKU support
- [ ] Maintain checklist state with defaults and dependencies.
- [ ] Implement outlet selection handler:
  - set outlet
  - rebuild stock rows
  - auto-select upcoming planned visit
  - initialize summary/checklist defaults
- [ ] Implement quantity functions:
  - increment current counted stock
  - decrement current counted stock, not below `0`
  - quick set to `0`
  - quick set to system qty
  - direct numeric update with non-negative normalization
- [ ] Implement validations:
  - outlet required
  - date required
  - username required
  - sold rows must have no duplicate SKU
  - at least one sold row or one side effect must make sense; recommended: require at least one sold row for consumption save
  - sold `Qty > 0` rows only
  - restock duplicate SKUs blocked
  - restock quantity positive for rows to save
  - `Generate invoice` requires `PriceListCode`
  - invoice amount fields must be non-negative
  - `Complete selected visit` requires selected visit and planned status
  - `Submit restock immediately` requires `Place restock request`
- [ ] Implement submit flow with progress indicators and user notifications.

**Files**: `FRONTENT/src/composables/operation/outlets/useOutletConsumption.js`, optional new files in `FRONTENT/src/composables/operation/outlets/`
**Pattern**: Existing outlet composables using `useWorkflowStore`, `useResourceData`, and `useResourceNav`.
**Rule**: Composables own business logic; components remain UI-only.

### Step 8: Implement Coordinated Submit Sequence

Because later request payloads need generated `OutletConsumptionCode`, do not assume `__PENDING__` will be automatically replaced inside unrelated bulk requests unless existing batch infrastructure explicitly supports placeholder substitution. Current code appears to use `__PENDING__`, but Build Agent must verify whether the backend replaces it. If not verified, use a safe two-phase submit.

Recommended safe submit:

#### Phase 1: Create consumption parent + child items

- [ ] Run `compositeSave` for `OutletConsumptions` + `OutletConsumptionItems`.
- [ ] Extract returned parent code from batch/composite response.
- [ ] If no parent code returned, show error and stop side effects.

#### Phase 2: Run side-effect batch with real `OutletConsumptionCode`

Build batch requests based on checklist:

1. Always create negative `OutletMovements` for sold rows.
2. If `Generate invoice` checked:
   - create `OutletConsumptionInvoices` with `OutletConsumptionCode = returned code`
   - update or action `OutletConsumptions` to `INVOICE_GENERATED` and stamp/comment fields if this was not already set in Phase 1
3. If `Complete selected visit` checked:
   - execute existing visit complete action or update using existing allowed fields only
   - write an existing comment field if current action supports it
4. If `Schedule next visit` checked:
   - create `OutletVisits` planned row using existing visit columns only
   - compute date from `OutletOperatingRules.VisitFrequencyDays`, fallback `14`
5. If `Place restock request` checked:
   - create `OutletRestocks` + `OutletRestockItems` via existing composite save
   - use existing fields only
   - `Date = consumption Date`
   - `OutletCode = selected outlet`
   - `RequestedUser = Username`
   - restock items use `Quantity`
6. If `Submit restock for approval immediately` checked:
   - after restock parent code is known, execute existing submit action to `PENDING_APPROVAL`
   - If the batch cannot reference the restock code from a previous request, do this as Phase 3.

#### Phase 3: Dependent restock submit if needed

- [ ] If restock was created and submit-immediately is checked, execute submit action with actual restock code.

Failure policy:

- If Phase 1 fails: nothing should be created; show error.
- If Phase 2 partially fails after consumption exists: show clear warning that consumption was saved but some side effects failed; include which side effect failed.
- Do not attempt rollback unless existing generic APIs support reliable rollback. Instead, surface exact recovery steps.
- For failed invoice generation, leave or update consumption `Progress = PENDING_INVOICE_GENERATION`.

**Files**: consumption composables and payload builders.
**Pattern**: Existing `runBatchRequests`, `compositeSaveRequest`, `resourceCreateRequest`, `resourceBulkRequest`, `executeActionRequest` helpers.
**Rule**: Use real generated codes for references; avoid unverified placeholders.

### Step 9: Build Tap-Friendly UI Components

Create or refactor components under `FRONTENT/src/components/operation/Outlets/`. Components must be UI-only and receive props/events from composables/pages.

Recommended components:

1. `OutletConsumptionOutletStep.vue`
   - outlet selector
   - date field
   - username display/input
   - selected planned visit display
   - option to clear/change selected visit
2. `OutletConsumptionProductDisplay.vue`
   - product-grouped SKU stock-count UI
   - large tap buttons for counted current stock
   - displays system qty, current counted qty, sold qty
   - emits quantity update events
3. `OutletConsumptionSummary.vue`
   - sold item summary
   - editable restock item summary
   - add more restock product/SKU
   - invoice amount/price list fields if generate invoice checked or summary needs totals
4. `OutletConsumptionChecklist.vue`
   - final checklist with dependency behavior
   - emits checklist changes
5. Optional small components if file sizes exceed 400 lines:
   - `OutletConsumptionSkuCounter.vue`
   - `OutletConsumptionRestockRows.vue`

Use desktop sample components only as visual/reference input. Do not copy logic into components if it belongs in composables.

UI details:

- Prefer Quasar utility classes.
- Avoid component-scoped styles unless strictly component-specific.
- Keep mobile/tap layout first.
- Use `q-stepper` or clear card sections if easier:
  - Outlet
  - Count Stock
  - Summary & Checklist
- Disable submit while saving.
- Show clear warnings for variance rows and unchecked side effects.

**Files**: `FRONTENT/src/components/operation/Outlets/*.vue`
**Pattern**: Existing outlet UI components are simple and prop/event-driven.
**Rule**: Components must not import stores or services directly.

### Step 10: Refactor Outlet Consumption Pages

Current pages are in singular route folder `FRONTENT/src/pages/operation/OutletConsumption/`. Build Agent must inspect route generation before renaming folders.

Recommended approach:

- [ ] If routes are resource-slug based from `APP.Resources`, plural `OutletConsumptions` likely maps to route slug `outlet-consumptions`. Add or rename page folder if required by existing route resolver.
- [ ] If current full page override expects folder/entity singular, update resolver-compatible naming carefully.
- [ ] Ensure menu route in `APP.Resources.Menu` points to the actual route.

Add page:

- Replace simple consumed item table with full flow:
  - outlet/date/user/visit selection
  - stock count grouped by product/SKU
  - summary/restock/invoice/checklist
  - final submit

Index page:

- Use `OutletConsumptions` data.
- Display:
  - code
  - outlet
  - date
  - username
  - progress chip
  - total consumed qty from `OutletConsumptionItems.Qty`
  - invoice indicator if related invoice exists

View page:

- Use `OutletConsumptions` data.
- Display:
  - parent details
  - optional visit link/code
  - sold items from `OutletConsumptionItems`
  - invoice card if generated
  - restock link if created can be derived only if there is a reference. If no reference column exists on restock, avoid forcing this display.
- Use `Qty` in children, not `ConsumedQty`.

Navigation:

- Use `useResourceNav` only.
- Do not use direct `router.push()`.

**Files**: `FRONTENT/src/pages/operation/OutletConsumption/` or new resolver-compatible plural folder; route/resource resolver files if required.
**Pattern**: Existing operation page folder conventions.
**Rule**: Pages stay thin and call composable methods only.

### Step 11: Update Frontend Registries If Reusable Interfaces Change

- [ ] If adding reusable components under `FRONTENT/src/components/operation/Outlets/`, update `FRONTENT/src/components/REGISTRY.md` if this project tracks all reusable components there.
- [ ] If adding custom operation section overrides under `_custom`, update `FRONTENT/src/components/operation/_custom/REGISTRY.md`. Prefer normal outlet components/pages unless custom override mechanism is required.
- [ ] If adding new composables, update a composable registry only if one exists and this project uses it. Search before editing.

**Files**: `FRONTENT/src/components/REGISTRY.md`, optional registry docs.
**Pattern**: Existing registry tables.
**Rule**: Update registries only when reusable interfaces/components are added or changed materially.

### Step 12: Update Documentation

Update docs to match final implementation.

- [ ] `Documents/OPERATION_SHEET_STRUCTURE.md`
  - Rename operation resource list entry from `OutletConsumption` to `OutletConsumptions`.
  - Add `OutletConsumptionInvoices` to current operation resources.
  - Update outlet operation table rows for `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices`.
  - Update column list with final headers.
  - Keep existing related resource columns unchanged.

- [ ] `Documents/RESOURCE_COLUMNS_GUIDE.md`
  - Update notable dependencies for consumption:
    - optional `OutletVisitCode`, no visit enforcement
    - `OutletConsumptionItems.Qty` final sold qty only
    - `OutletConsumptionInvoices` owns invoice header progress, not receipt amounts
    - payment amounts are deferred to receipt module
  - Add progress semantics and action stamp rule for new resources.

- [ ] `Documents/MODULE_WORKFLOWS.md`
  - Expand section `11.5 Consumption Workflow` with the new stock count → summary → checklist → submit flow.
  - Note current outlet stock source is `OutletStorages`.
  - Note stock update uses negative `OutletMovements` with `ReferenceType = Consumption`.
  - Note restock output reuses existing restock workflow.
  - Note invoice generation creates `OutletConsumptionInvoices`.

- [ ] `Documents/CONTEXT_HANDOFF.md`
  - Update only after implementation with final state, changed files, manual actions, and verification.

**Files**: `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Existing outlet operation documentation sections.
**Rule**: Docs must describe implemented state, not just intended design.

### Step 13: Sheet Resource Sync and Deployment Steps

After code changes:

- [ ] Run targeted syntax/search checks first.
- [ ] Run `npm run gas:push` from repo root after GAS changes.
- [ ] User/manual sheet actions required after deployment:
  - run AQL resource sync from Google Sheet menu to update `APP.Resources`
  - run operation sheet setup to create/normalize `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices`
  - clear frontend/resource cache or re-login if old singular resource metadata remains cached
- [ ] Ask for Web App redeployment only if Build Agent changes the API contract. This plan should not require redeployment because it uses existing generic APIs.

**Files**: no direct file; deployment/manual action notes in plan post-execution.
**Pattern**: Existing GAS deployment practice.
**Rule**: Agent runs `clasp push`; user runs sheet menu actions.

### Step 14: Targeted Verification

Run targeted checks, not broad verification by default, unless Build Agent touches many frontend files and risk becomes cross-cutting.

Required checks:

- [ ] Search for old singular resource usage:
  - `OutletConsumption` should remain only where intentionally part of child/resource names like `OutletConsumptionItems`, `OutletConsumptionInvoices`, or link field `OutletConsumptionCode`, and not as parent resource name.
- [ ] Search for old columns in new consumption flow:
  - `ConsumptionDate`
  - `RecordedByUserCode`
  - `ConsumedQty`
  - `CONFIRMED`
  These should not be used by new `OutletConsumptions` flow.
- [ ] Confirm setup headers and resource metadata agree exactly.
- [ ] Confirm docs mention `OutletConsumptions` and `OutletConsumptionInvoices`.
- [ ] Confirm no direct frontend writes to `OutletStorages`.
- [ ] Confirm no columns added to existing related resources.
- [ ] If frontend changes touch multiple pages/components/composables, run `npm --prefix FRONTENT run build`.
- [ ] Record validation results in this plan's post-execution notes.

**Files**: whole repo targeted search.
**Pattern**: Existing verification discipline.
**Rule**: Do not leave parent resource split between singular and plural names.

## Documentation Updates Required

- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` for `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices` schemas.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` for resource metadata semantics, progress values, optional visit link, and invoice/receipt boundary.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` section `11.5` for the detailed stock-count workflow.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation with final state and manual menu actions.
- [ ] Update frontend registries only if reusable component/composable registry rules require it.

## Acceptance Criteria

### Backend/Schema

- [ ] `CONFIG.OPERATION_SHEETS` includes `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices` constants.
- [ ] `GAS/setupOperationSheets.gs` creates/normalizes final headers for all three resources.
- [ ] `GAS/syncAppResources.gs` defines all three resources with matching required headers, defaults, progress values, and actions.
- [ ] `OutletConsumptions` has optional `OutletVisitCode`.
- [ ] `OutletConsumptionItems` uses `Qty`, not `ConsumedQty`.
- [ ] `OutletConsumptionInvoices` uses `PriceListCode`, `Subtotal`, `Discount`, `Tax`, and no total/paid/balance columns.
- [ ] Existing related resource columns are not modified.

### Frontend Flow

- [ ] User can select an outlet first.
- [ ] Upcoming planned visit for selected outlet is auto-selected when available.
- [ ] User can perform tap-friendly current stock count by product/SKU.
- [ ] Sold quantities are derived from current outlet stock minus counted stock.
- [ ] Summary shows read-only sold items and editable restock items.
- [ ] User can add extra restock items.
- [ ] Final checklist controls complete visit, schedule next visit, generate invoice, place restock request, and submit restock immediately.
- [ ] Submit creates consumption parent/child rows.
- [ ] Submit creates negative outlet movement rows for sold quantities.
- [ ] If invoice checked, submit creates `OutletConsumptionInvoices` and marks consumption invoice generated.
- [ ] If restock checked, submit creates `OutletRestocks` and `OutletRestockItems` using existing schema.
- [ ] If submit restock immediately checked, restock moves to `PENDING_APPROVAL` using existing action.
- [ ] If complete selected visit checked, selected planned visit is completed using existing visit fields/actions.
- [ ] If schedule next visit checked, new planned visit is created using existing visit fields.

### Architecture

- [ ] Components do not import stores/services or contain business logic.
- [ ] Composables own validation, calculations, checklist behavior, payload preparation, and workflow orchestration.
- [ ] Stores/services remain generic.
- [ ] Navigation uses `useResourceNav`.
- [ ] No custom GAS endpoint is introduced.
- [ ] No direct update to `OutletStorages` exists.

### Documentation and Verification

- [ ] Docs reflect final resource names and schemas.
- [ ] Targeted search confirms old placeholder fields are removed from new flow.
- [ ] `npm run gas:push` completed after GAS changes.
- [ ] Frontend build completed if frontend scope is broad/cross-cutting.
- [ ] Manual sheet menu actions are listed for the user.

## Post-Execution Notes (Build Agent fills this)

*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace pending execution identity with the concrete agent/runtime identity used in that session. Build Agent must remove `pending` when execution completes.)*

### Progress Log

- [x] 2026-05-07 19:37 IST - Execution started as Build Agent; plan status set to IN_PROGRESS and ownership set.
- [x] 2026-05-07 19:40 IST - Mandatory pre-reads completed: MULTI_AGENT_PROTOCOL, DOC_ROUTING, AI_COLLABORATION_PROTOCOL, ARCHITECTURE RULES, GAS_API_CAPABILITIES, GAS_PATTERNS, RESOURCE_COLUMNS_GUIDE.
- [x] 2026-05-07 19:41 IST - Baseline scan completed for OutletConsumption references, old columns, and current module usage across GAS/FRONTENT/Documents.
- [x] 2026-05-07 19:48 IST - Step 1 executed: constants updated for OutletConsumptions + OutletConsumptionInvoices and new AppOptions progress lists.
- [x] 2026-05-07 19:50 IST - Step 2 executed: operation sheet setup schemas replaced with OutletConsumptions, OutletConsumptionItems(Qty), and OutletConsumptionInvoices.
- [x] 2026-05-07 19:53 IST - Step 3 executed: APP.Resources sync config updated for new resources, actions, defaults, and parent-child mappings.
- [x] 2026-05-07 20:03 IST - Steps 5-10 implementation executed in frontend: outlet meta, stock validation, payload builders, composable flow rewrite, and add/index/view pages refactor.
- [x] 2026-05-07 20:10 IST - Documentation and registry updates completed for operation structure, resource columns, workflows, and context handoff.
- [x] 2026-05-07 20:12 IST - Verification completed: targeted legacy-field search, frontend production build success, and GAS push success.
- [x] 2026-05-07 20:13 IST - Plan finalized as COMPLETED with execution notes, validations, and manual action checklist.
- [x] Step 1 completed: constants and resource names confirmed/updated.
- [x] Step 2 completed: operation sheet setup schemas updated.
- [x] Step 3 completed: resource registry sync config updated.
- [x] Step 4 completed: GAS references and parent-code mapping verified.
- [x] Step 5 completed: frontend resource constants/meta updated.
- [x] Step 6 completed: consumption payload builders replaced.
- [x] Step 7 completed: consumption composables implemented/refactored.
- [x] Step 8 completed: coordinated submit sequence implemented.
- [x] Step 9 completed: tap-friendly UI implemented in add page flow (no extra standalone component files created).
- [x] Step 10 completed: pages refactored and route naming verified.
- [x] Step 11 completed: frontend registries updated.
- [x] Step 12 completed: documentation updated.
- [x] Step 13 completed: GAS push/manual action notes handled.
- [x] Step 14 completed: targeted verification completed.

### Deviations / Decisions

- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:
- [x] `[!]` Deviation recorded: plan asked for new dedicated UI component files; implementation kept pages thin but did not add new component files because existing shared outlet components plus page-level QTable/QForm were sufficient and build-verified.

### Files Actually Changed

- `GAS/Constants.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/operation/outlets/outletOperationsMeta.js`
- `FRONTENT/src/composables/operation/outlets/outletOperationsBatch.js`
- `FRONTENT/src/composables/operation/outlets/outletStockLogic.js`
- `FRONTENT/src/composables/operation/outlets/outletConsumptionPayload.js`
- `FRONTENT/src/composables/operation/outlets/useOutletConsumption.js`
- `FRONTENT/src/pages/operation/OutletConsumption/AddPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumption/IndexPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumption/ViewPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed

- [x] `git status --short` reviewed before edits.
- [x] Targeted search for singular parent resource and old columns completed.
- [x] Setup/resource metadata consistency checked.
- [x] GAS pushed with `npm run gas:push` or `cd GAS && clasp push`.
- [x] Frontend build run if required by touched-file/risk scope.
- [x] Acceptance criteria verified (with noted UI-component-file deviation).

### Manual Actions Required

- [ ] Run AQL resource sync from the Google Sheet menu.
- [ ] Run operation sheet setup from the Google Sheet menu.
- [ ] Confirm new/updated sheets exist with final headers:
  - `OutletConsumptions`
  - `OutletConsumptionItems`
  - `OutletConsumptionInvoices`
- [ ] Clear frontend/resource cache or re-login if old `OutletConsumption` metadata remains visible.
- [ ] Web App redeployment only if Build Agent changed the generic API contract; otherwise not required.

