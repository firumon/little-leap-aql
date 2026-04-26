# PLAN: Supplier Quotation Fixes
**Status**: COMPLETED
**Created**: 2026-04-26
**Created By**: Brain Agent (Codex GPT-5)
**Executed By**: Build Agent (Gemini)

## Objective
Fix Supplier Quotation create/edit behavior so first saves from assigned suppliers mark the RFQ supplier as responded, quotation item quantities/prices/totals are prefilled and recalculated reactively, confirmed totals remain synced, and save/page-load request chatter is reduced.

Done means:
- First Supplier Quotation save for a matching `RFQSuppliers` row in `ASSIGNED` stamps blank `SentDate` with today and sets `Progress = RESPONDED`.
- First save for `SENT` still sets `Progress = RESPONDED`.
- Add and View/Edit rows prefill from RFQ-linked `PurchaseRequisitionItems`, preserve existing saved values while editing, and recalculate `TotalPrice = Quantity * UnitPrice`.
- `form.TotalAmount` is always item subtotals plus extra charges for non-declined responses.
- Save/edit no longer triggers several extra single-resource `get` calls after a grouped refresh has already been requested or response ingestion is sufficient.

## Context
Source docs reviewed:
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/MODULE_WORKFLOWS.md`, Supplier Quotation section
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`, Supplier Quotation section
- `Documents/RESOURCE_COLUMNS_GUIDE.md`, notable column dependencies
- `C:\Users\firum\Desktop\fixes.md`

Source of truth:
- Supplier Quotation uses `SupplierQuotations` as parent and `SupplierQuotationItems` as children.
- RFQ item context comes from `RFQs.PurchaseRequisitionItemsCode`, parsed into `PurchaseRequisitionItems`.
- First save writes quotation data, updates only the matching `RFQSuppliers`, and advances `Procurements.Progress` only from `RFQ_SENT_TO_SUPPLIERS` to `QUOTATIONS_RECEIVED`.
- Subsequent edits do not repeat RFQ supplier or procurement workflow updates.
- Existing generic `batch`, grouped `get`, `update`, and `compositeSave` capabilities are sufficient.

Assumptions:
- `PurchaseRequisitionItems.Quantity` is the canonical requested quantity.
- The best available source unit price is the first meaningful numeric field among `UnitPrice`, `EstimatedUnitPrice`, `LastPurchasePrice`, `TargetUnitPrice`, `Price`, `Cost`, or `Rate` on the source item.
- If no source unit price is present or numeric, use `0`.
- Existing saved quotation item values must override source-item defaults in View/Edit and during create flow item resync.
- `toDateInputValue()` returns the required local date string for `RFQSuppliers.SentDate`.
- GAS grouped `get` responses are ingested into IDB by `GasApiService.ingestResourcePayloads()`, and IDB upsert callbacks update Pinia rows.

Out of scope:
- Backend endpoint changes.
- New `RFQItems` resource or redesign of procurement workflow states.
- Quotation comparison/scoring, PO generation, alternate SKUs, or stored calculated flags.
- Broad frontend architecture refactor outside the named generic fetch path.

## Pre-Conditions
- [x] Build Agent has read this plan only, plus required startup docs.
- [x] Before any `FRONTENT/` edit, Build Agent has read `Documents/ARCHITECTURE RULES.md`.
- [x] Build Agent has read `Documents/AI_COLLABORATION_PROTOCOL.md`.
- [x] Working tree status has been checked so unrelated user changes are not reverted.

## File Plan

### `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- Action: modify.
- Purpose: central Supplier Quotation stateless helpers.
- Related functions: `normalizeNumber`, `defaultItemForm`, `buildItemRecord`, `validateQuotation`.
- Dependencies: imports `EXTRA_CHARGE_KEYS` from `supplierQuotationMeta.js`.
- Required changes: add source-unit-price helper and make item defaults/submission totals deterministic from quantity and unit price.

### `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationTotals.js`
- Action: create.
- Purpose: shared reactive business logic for quotation item subtotals, extra charge totals, confirmed total syncing, and per-row `TotalPrice` syncing.
- Related functions: `useSupplierQuotationTotals`.
- Dependencies: Vue `computed`, `watch`; `normalizeNumber` and `isQuotedItem` from `supplierQuotationPayload.js`.
- Required changes: new reusable composable; update `FRONTENT/src/composables/REGISTRY.md`.

### `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- Action: modify.
- Purpose: Add-page view model for first Supplier Quotation save.
- Related functions: `syncItemsFromContext`, `buildSaveRequests`, `save`, `loadData`, existing watchers.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, payload helpers, new `useSupplierQuotationTotals`.
- Required changes: use shared totals, fix RFQ supplier update data, keep grouped refresh, avoid duplicate local reload after save.

### `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- Action: modify.
- Purpose: View/Edit-page view model for existing Supplier Quotations.
- Related functions: `hydrate`, `loadData`, `buildChildRecords`, `save`, `reject`, watchers.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceConfig`, payload helpers, new `useSupplierQuotationTotals`.
- Required changes: use shared totals, preserve saved child values, remove extra `loadData(true)` after saves/rejects where grouped response ingestion covers refresh.

### `FRONTENT/src/composables/resources/useResourceData.js`
- Action: modify only if needed.
- Purpose: generic resource cache/reload composable.
- Related functions: `reload`, `runBackgroundSync`.
- Dependencies: `useDataStore`.
- Required changes: no quotation-specific logic. Add only a generic option to skip background sync or prefer cache when current store data is already present if required to stop normal page-load chatter.

### `FRONTENT/src/stores/data.js`
- Action: modify only if needed.
- Purpose: generic in-memory resource state and service coordinator.
- Related functions: `loadResource`, optional new `loadResources`.
- Dependencies: `fetchResourceRecords`; may use new `syncResourcesBatch` wrapper if introduced in `ResourceRecordsService.js`.
- Required changes: no quotation-specific logic. Add grouped load support only if create/view composables need one generic method rather than multiple single reloads.

### `FRONTENT/src/stores/workflow.js`
- Action: modify only if needed.
- Purpose: generic workflow/action store.
- Related functions: `runBatchRequests`.
- Dependencies: `executeGasApi`.
- Required changes: no quotation-specific logic. Leave unchanged unless response shape prevents existing grouped `get` ingestion from refreshing cache.

### `FRONTENT/src/services/ResourceFetchService.js`
- Action: modify only if needed.
- Purpose: service-only IDB/API fetch path.
- Related functions: `syncResourcesBatch`, `fetchResourceRecords`.
- Dependencies: `executeGasApi`, IDB services, mapper service.
- Required changes: keep generic. Use existing grouped `syncResourcesBatch` rather than adding resource-specific behavior.

### `FRONTENT/src/services/ResourceRecordsService.js`
- Action: modify only if needed.
- Purpose: wrapper that injects auth context into generic resource services.
- Related functions: `fetchResourceRecords`, `syncAllResources`; optional new `syncResourceRecordsBatch`.
- Dependencies: `syncResourcesBatch` from `ResourceFetchService.js`.
- Required changes: expose a generic grouped resource sync wrapper only if needed by `data.js`.

### `FRONTENT/src/services/GasApiService.js`
- Action: inspect only; modify only if grouped response ingestion is proven insufficient.
- Purpose: canonical GAS transport and resource payload ingestion.
- Related functions: `executeGasApi`, `ingestResourcePayloads`.
- Dependencies: `ApiClientService`, IDB services.
- Required changes: none expected.

### `FRONTENT/src/composables/REGISTRY.md`
- Action: modify.
- Purpose: composable discovery registry.
- Related entry: Supplier Quotation section.
- Required changes: add `useSupplierQuotationTotals`; update payload/create/view export descriptions if returned values change.

### `Documents/MODULE_WORKFLOWS.md`
- Action: modify.
- Purpose: canonical module workflow doc.
- Related section: `8. Supplier Quotation Response Capture`.
- Required changes: update only section 8.2/8.3 to mention assigned-row fallback stamping and reactive totals.

### `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- Action: modify.
- Purpose: procurement sheet behavior summary.
- Related section: `Supplier Quotation Response Capture`.
- Required changes: update first-save workflow sentence to include `ASSIGNED` fallback stamping blank `SentDate`.

### `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Action: modify only if Build Agent confirms doc wording is materially stale.
- Purpose: column dependency guide.
- Related lines: `RFQSuppliers`, `SupplierQuotationItems`.
- Required changes: likely add one concise note that `RFQSuppliers.SentDate` may be stamped during first quotation save if a supplier responds while still `ASSIGNED`.

## Function-by-Function Plan

### `resolveSourceUnitPrice`
- File: `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- Action: create exported pure helper.
- Purpose: choose a safe default unit price from a source item.
- Inputs: one source item object.
- Outputs: numeric unit price.
- Side effects: none.
- Error handling: non-object, blank, null, undefined, non-finite, and non-positive missing values return `0`; valid `0` returns `0`.
- Edge cases: string numbers are accepted; negative values return `0`.
- Order: implement before changing `defaultItemForm`.
- Connects to: `defaultItemForm`.

### `defaultItemForm`
- File: `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- Action: modify.
- Purpose: build item rows with source defaults and saved-value preservation.
- Inputs: `context`, `seed`.
- Outputs: quotation item form object.
- Side effects: none.
- Error handling: blank saved values fall back to source defaults; invalid numeric source defaults become `0`.
- Edge cases: saved `Quantity` of `0` must remain `0`; saved `UnitPrice` of `0` must remain `0`; absent seed should set `Quantity` from `context.Quantity` and `UnitPrice` from `resolveSourceUnitPrice(context)`.
- Order: after `resolveSourceUnitPrice`.
- Connects to: create `syncItemsFromContext`, view `hydrate`.

### `buildItemRecord`
- File: `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- Action: modify.
- Purpose: serialize item data with authoritative calculated subtotal.
- Inputs: item form object.
- Outputs: child record object.
- Side effects: none.
- Error handling: invalid numbers normalize to `0`.
- Edge cases: do not use stale `item.TotalPrice`; always set `TotalPrice` from normalized `Quantity * UnitPrice`.
- Order: after `defaultItemForm`.
- Connects to: create `buildSaveRequests`, view `buildChildRecords`.

### `useSupplierQuotationTotals`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationTotals.js`
- Action: create exported function.
- Purpose: shared reactive totals for Add and View/Edit.
- Inputs: object containing `form` ref and `items` ref.
- Outputs: `itemSubtotal`, `extraChargesTotal`, `suggestedTotal`, `syncAllItemTotals`, and `syncItemTotal`.
- Side effects: Vue watchers update `item.TotalPrice` and `form.TotalAmount`.
- Error handling: all numeric inputs use `normalizeNumber`; missing form/items are treated as zero.
- Edge cases: for `DECLINED`, keep item subtotal available but set `form.TotalAmount` to `extraChargesTotal` only if business wants charges on declined responses; otherwise set to `0`. Use this plan's rule: declined total must be `0`.
- Order: create after payload helper changes, then wire into create and view.
- Connects to: both flow composables.

### `syncItemsFromContext`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- Action: modify.
- Purpose: populate create rows from RFQ-linked PR items while preserving user edits.
- Inputs: none; reads `items.value` and `itemContext.value`.
- Outputs: updates `items.value`.
- Side effects: mutates create items ref.
- Error handling: empty context produces empty items.
- Edge cases: do not overwrite user-edited `Quantity`, `UnitPrice`, `TotalPrice`, lead time, delivery, or remarks when context recomputes.
- Order: after importing new totals composable.
- Connects to: `watch(itemContext, syncItemsFromContext, { immediate: true })`.

### `buildSaveRequests`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- Action: modify.
- Purpose: build first-save batch with correct RFQ supplier fallback and one grouped refresh.
- Inputs: none; reads selected form, items, RFQ supplier row, procurement row.
- Outputs: batch request array.
- Side effects: none.
- Error handling: skip update request if no matching supplier row code exists.
- Edge cases: if supplier row progress is `ASSIGNED`, update data must include `Progress: 'RESPONDED'` and blank-only `SentDate: toDateInputValue()`; if `SentDate` already exists, preserve it by omitting `SentDate`; if progress is `SENT`, update only `Progress`; if already `RESPONDED`, leave progress update harmless or omit it.
- Order: after payload total changes.
- Connects to: `save`.

### `save`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- Action: modify lightly.
- Purpose: save first quotation and navigate.
- Inputs: none.
- Outputs: none.
- Side effects: batch write, notify, navigate.
- Error handling: preserve existing validation and error notifications.
- Edge cases: ensure `form.TotalAmount` is synced before `buildHeaderRecord`; keep grouped `get` inside batch as the only post-write refresh.
- Order: after `buildSaveRequests`.
- Connects to: `workflowStore.runBatchRequests`.

### `hydrate`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- Action: modify.
- Purpose: hydrate existing quotation and item forms with saved values over source context.
- Inputs: none; reads `record`, `childRows`, `itemContext`.
- Outputs: sets `form.value` and `items.value`.
- Side effects: mutates refs.
- Error handling: if `record` missing, return.
- Edge cases: children are keyed by `PurchaseRequisitionItemCode`; source context provides defaults only for missing child rows; saved child `Quantity`, `UnitPrice`, `TotalPrice`, lead/delivery fields, and remarks must remain.
- Order: after shared totals import.
- Connects to: `watch([record, childRows, itemContext], hydrate, { immediate: true })`.

### `loadData`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- Action: modify only if needed.
- Purpose: initial cache-backed page data load.
- Inputs: `forceSync = false`.
- Outputs: promise completion.
- Side effects: calls resource reload methods.
- Error handling: preserve existing behavior.
- Edge cases: initial load should allow cache-first behavior; force reload should be reserved for explicit refresh, not automatic post-save duplication.
- Order: before save cleanup.
- Connects to: `watch(code, ...)`, `save`, `reject`.

### `save`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- Action: modify.
- Purpose: save existing quotation edits without duplicated post-save reloads.
- Inputs: none.
- Outputs: none.
- Side effects: batch write, notify.
- Error handling: preserve existing validation and error notifications.
- Edge cases: ensure `form.TotalAmount` is synced before `buildHeaderRecord`; keep the existing grouped `get` request for `SupplierQuotations` and `SupplierQuotationItems`; remove `await loadData(true)` after successful grouped batch unless manual testing proves ingestion does not update the store.
- Order: after totals wiring.
- Connects to: `workflowStore.runBatchRequests`, `GasApiService` response ingestion.

### `reject`
- File: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- Action: modify only if request chatter remains.
- Purpose: reject quotation through AdditionalAction.
- Inputs: none.
- Outputs: none.
- Side effects: action request, notify, clears comment.
- Error handling: preserve existing comment validation and negative notifications.
- Edge cases: after action, prefer a single grouped refresh if current action response does not ingest updated `SupplierQuotations`; do not call several resource reloads.
- Order: after save cleanup.
- Connects to: `workflowStore.executeResourceAction`.

### `reload`
- File: `FRONTENT/src/composables/resources/useResourceData.js`
- Action: modify only if normal page visits still issue avoidable per-resource gets.
- Purpose: generic cache-first loading.
- Inputs: `forceSync` or a backward-compatible options object.
- Outputs: none.
- Side effects: calls data store load/sync.
- Error handling: preserve existing behavior.
- Edge cases: existing callers passing boolean must continue working; no resource-specific names; background sync must still run when data is missing or stale.
- Order: only after quotation-local cleanup is tested.
- Connects to: all resource composables.

## Steps

### Step 1: Startup and status
- [x] Open `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, `Documents/ARCHITECTURE RULES.md`, and `Documents/AI_COLLABORATION_PROTOCOL.md`.
- [x] Run `git status --short`.
- [x] Do not edit unrelated changed files.
**Files**: project docs only.
**Pattern**: Brain/Build protocol and frontend architecture rules.
**Rule**: Build Agent may edit implementation files; Brain Agent plan remains source of task order.

### Step 2: Add payload defaults and calculated serialization
- [x] Open `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`.
- [x] Add exported helper `resolveSourceUnitPrice` after `normalizeNumber`.
- [x] In `defaultItemForm`, change missing `Quantity` behavior to use `context.Quantity`; change missing `UnitPrice` behavior to use `resolveSourceUnitPrice(context)`; keep saved seed values when present.
- [x] In `defaultItemForm`, calculate `TotalPrice` from the final normalized `Quantity` and `UnitPrice` unless a saved seed total exists for an existing row.
- [x] In `buildItemRecord`, always calculate `TotalPrice` from normalized `Quantity * UnitPrice`.
- [x] Do not change validation messages or header serialization.
- [x] Run `npm --prefix FRONTENT run lint -- --quiet` if that script exists; if it does not exist, run `npm --prefix FRONTENT run build` later in validation only.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
**Pattern**: pure helper functions in payload file.
**Rule**: Source defaults are only defaults; saved/user-edited values win.

### Step 3: Create shared reactive totals composable
- [x] Create `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationTotals.js`.
- [x] Export function `useSupplierQuotationTotals({ form, items })`.
- [x] Inside it, define computed `itemSubtotal`, `extraChargesTotal`, and `suggestedTotal`.
- [x] Add a function `syncItemTotal(item)` that mutates only that item's `TotalPrice` to `normalizeNumber(item.Quantity) * normalizeNumber(item.UnitPrice)`.
- [x] Add a function `syncAllItemTotals()` that loops current items and calls `syncItemTotal`.
- [x] Add a deep watcher on `items` that calls `syncAllItemTotals`.
- [x] Add a watcher on `suggestedTotal` and `form.value.ResponseType` that keeps `form.value.TotalAmount` synced; for `DECLINED`, set `TotalAmount` to `0`.
- [x] Return `itemSubtotal`, `extraChargesTotal`, `suggestedTotal`, `syncItemTotal`, and `syncAllItemTotals`.
- [x] Do not import stores or services.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationTotals.js`
**Pattern**: business logic in composables, pure numeric helpers from payload file.
**Rule**: No API, IDB, or service usage in this composable.

### Step 4: Wire create flow to shared totals and assigned fallback
- [x] Open `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`.
- [x] Add `toDateInputValue` to payload imports if not already imported.
- [x] Import `useSupplierQuotationTotals` from `./useSupplierQuotationTotals`.
- [x] Remove local computed definitions of `itemSubtotal`, `extraChargesTotal`, and `suggestedTotal`.
- [x] After `form` and `items` refs are declared, call `useSupplierQuotationTotals({ form, items })` and destructure `itemSubtotal`, `extraChargesTotal`, `suggestedTotal`, and `syncAllItemTotals`.
- [x] In `syncItemsFromContext`, keep the existing `existingByPrItem` map and continue mapping `itemContext` through `defaultItemForm(context, existing)`.
- [x] In `buildSaveRequests`, before building `header`, call `syncAllItemTotals()` or ensure `save` calls it before validation.
- [x] In `buildSaveRequests`, replace RFQ supplier update data with deterministic branch logic: `ASSIGNED` plus blank `SentDate` gets `SentDate: toDateInputValue()` and `Progress: 'RESPONDED'`; `ASSIGNED` with existing sent date gets only `Progress`; `SENT` gets only `Progress`; already `RESPONDED` may be skipped.
- [x] Keep procurement progress update exactly limited to current `RFQ_SENT_TO_SUPPLIERS`.
- [x] Keep the final grouped `get` request for `['SupplierQuotations', 'SupplierQuotationItems', 'RFQSuppliers', 'Procurements']`.
- [x] Do not add page-component service calls.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
**Pattern**: workflow batch construction stays in composable.
**Rule**: First save ends with RFQ supplier `RESPONDED`, not `SENT`.

### Step 5: Wire view/edit flow to shared totals and remove duplicate refresh
- [x] Open `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`.
- [x] Import `useSupplierQuotationTotals`.
- [x] Remove the local `itemSubtotal` computed.
- [x] After `form` and `items` refs are declared, call `useSupplierQuotationTotals({ form, items })` and destructure `itemSubtotal`, `extraChargesTotal`, `suggestedTotal`, and `syncAllItemTotals`.
- [x] In `hydrate`, continue building `childrenByPrItem`; ensure the seed comes from a child row when present and from source context only when no child exists.
- [x] Before validation in `save`, call `syncAllItemTotals()`.
- [x] Keep the grouped `get` request already inside `workflowStore.runBatchRequests`.
- [x] Remove `await loadData(true)` after successful save unless grouped response ingestion is proven insufficient.
- [x] For `reject`, either leave behavior unchanged or replace the post-action `await loadData(true)` with one grouped refresh path; do not add multiple single-resource reloads.
- [x] Return `extraChargesTotal` and `suggestedTotal` only if page components already consume or need them; otherwise keep return surface minimal.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
**Pattern**: View/Edit saves only quotation header/items.
**Rule**: Existing saved values always override source defaults.

### Step 6: Generic request chatter cleanup only if still needed
- [x] Test current request behavior after Steps 4 and 5 before editing generic files.
- [x] If normal page visits still issue avoidable force-sync calls with cache present, open `FRONTENT/src/composables/resources/useResourceData.js`.
- [x] Make `reload` backward-compatible with existing boolean calls and optional object calls, for example supporting cache-first behavior without force sync.
- [x] If grouped initial load is required, add generic `loadResources(resourceNames, options)` to `FRONTENT/src/stores/data.js` and a generic wrapper in `FRONTENT/src/services/ResourceRecordsService.js` around `syncResourcesBatch`.
- [x] Do not reference `SupplierQuotations`, `RFQSuppliers`, or any other specific resource inside generic stores/services.
- [x] Do not change `GasApiService.js` unless grouped responses are not being ingested.
**Files**: optional generic files listed in File Plan.
**Pattern**: services own API/IDB; stores coordinate generic state; composables own business logic.
**Rule**: Generic layers remain generic.

### Step 7: Update frontend registry
- [x] Open `FRONTENT/src/composables/REGISTRY.md`.
- [x] Add one row for `useSupplierQuotationTotals` near the other supplier quotation rows.
- [x] Update `supplierQuotationPayload` row to include `resolveSourceUnitPrice`.
- [x] Update create/view rows only if returned values changed.
- [x] Do not edit component registry unless components changed.
**Files**: `FRONTENT/src/composables/REGISTRY.md`
**Pattern**: existing table row format.
**Rule**: Registry must match actual exports.

### Step 8: Update workflow docs
- [x] Open `Documents/MODULE_WORKFLOWS.md`.
- [x] In section `8.2 Core Behaviors`, update first-save behavior to state that if the matching RFQ supplier is still `ASSIGNED`, first save stamps blank `SentDate` and sets `RESPONDED`; if `SENT`, it still sets `RESPONDED`.
- [x] Add one concise sentence to section 8.2 or 8.3 stating quotation item subtotal and confirmed total are runtime reactive calculations.
- [x] Open `Documents/PROCUREMENT_SHEET_STRUCTURE.md`.
- [x] Update the Supplier Quotation first-save bullet with the assigned fallback.
- [x] Open `Documents/RESOURCE_COLUMNS_GUIDE.md` only if the current RFQSuppliers note remains misleading after the above docs; add one concise note if needed.
- [x] Do not add future workflow claims.
**Files**: docs listed above.
**Pattern**: concise canonical behavior notes.
**Rule**: Docs must describe implemented behavior only.

## Validation Plan

Commands:
- `git status --short`
- `npm --prefix FRONTENT run build`
- If available: `npm --prefix FRONTENT run lint`

Manual checks:
- Add page: select an RFQ and supplier; confirm item rows are created from `RFQs.PurchaseRequisitionItemsCode` -> `PurchaseRequisitionItems`.
- Add page: confirm `Quantity` equals source item quantity.
- Add page: confirm `UnitPrice` equals first meaningful source unit price, else `0`.
- Add page: edit quantity and unit price; `TotalPrice` updates immediately.
- Add page: edit extra charges; `TotalAmount` updates immediately.
- View/Edit page: existing saved child rows preserve saved values.
- View/Edit page: edit quantity, unit price, or extra charges; row subtotal and confirmed total update immediately.
- First save with `RFQSuppliers.Progress = ASSIGNED` and blank `SentDate`: updated row has today's `SentDate` and `Progress = RESPONDED`.
- First save with `RFQSuppliers.Progress = ASSIGNED` and existing `SentDate`: existing date is preserved and progress becomes `RESPONDED`.
- First save with `RFQSuppliers.Progress = SENT`: progress becomes `RESPONDED`.
- Subsequent edit does not update RFQ supplier or procurement progress.
- Browser/network manual check: after view save, there is one batch containing composite save plus grouped `get`, and no immediate extra series of single-resource `get` calls from `loadData(true)`.
- Browser/network manual check: normal page visit uses cache-backed render where available and avoids unnecessary force-sync style reloads.

Expected outputs:
- Build completes successfully.
- No architecture rule violations: no service imports in components, no resource-specific logic in stores/services, no direct API/IDB in composables.
- Docs and registry match implemented exports/behavior.

Failure signs:
- `TotalPrice` changes only after save: item watcher not wired correctly.
- `TotalAmount` stale after extra charge edit: shared totals watcher not observing charge object deeply enough.
- `RFQSuppliers` stays `ASSIGNED` or `SENT` after first save: branch in `buildSaveRequests` is wrong or matching supplier row failed.
- Existing View/Edit item values are overwritten by PR item defaults: `hydrate` seed precedence is wrong.
- Multiple `get` calls after save: `loadData(true)` or per-resource forced reload still runs.

## Regression Checklist
- [x] Supplier Quotation index grouping and stale filtering remain unchanged.
- [x] Create flow still shows only active `RFQs` with `Progress = SENT`.
- [x] Supplier picker still includes active RFQ supplier rows excluding cancelled/inactive rows.
- [x] Duplicate supplier response warning behavior remains unchanged.
- [x] `DECLINED` still requires `DeclineReason` and does not submit child item rows.
- [x] `QUOTED` still requires quote data for every RFQ-linked item.
- [x] `PARTIAL` still allows missing item rows.
- [x] First save still sets `ResponseRecordedAt` and `ResponseRecordedBy`.
- [x] Procurement progress advances only from `RFQ_SENT_TO_SUPPLIERS` to `QUOTATIONS_RECEIVED`.
- [x] Existing quotation edits do not re-run first-save workflow updates.
- [x] Reject action still works only when configured and visible for `RECEIVED`.
- [x] Generic resource loading remains cache-first and still syncs missing/stale data.
- [x] No new backend endpoints or GAS files are introduced.

## Acceptance Criteria
- [x] `RFQSuppliers.Progress = ASSIGNED` first save stamps blank `SentDate` and sets `RESPONDED`.
- [x] `RFQSuppliers.Progress = SENT` first save sets `RESPONDED`.
- [x] Source PR item quantity prefill works on Add.
- [x] Source PR item unit price prefill works when available; missing price becomes `0`.
- [x] View/Edit preserves saved quotation item values.
- [x] `SupplierQuotationItems.TotalPrice` is always serialized as `Quantity * UnitPrice`.
- [x] Add page row subtotals update when quantity or unit price changes.
- [x] View/Edit page row subtotals update when quantity or unit price changes.
- [x] Add page `form.TotalAmount` updates from item subtotals plus extra charges.
- [x] View/Edit page `form.TotalAmount` updates from item subtotals plus extra charges.
- [x] Post-save request chatter is reduced to grouped refresh or response ingestion.
- [x] Normal page visits avoid unnecessary per-resource forced `get` calls when cache/store data is enough.
- [x] `FRONTENT/src/composables/REGISTRY.md` documents new/changed composable exports.
- [x] Workflow docs describe the implemented assigned fallback and reactive total behavior.
- [x] Frontend build passes.

## Documentation Updates Required
- [x] Update `FRONTENT/src/composables/REGISTRY.md` for `useSupplierQuotationTotals` and payload export changes.
- [x] Update `Documents/MODULE_WORKFLOWS.md` Supplier Quotation section.
- [x] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` Supplier Quotation section.
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` only if its RFQ supplier/Supplier Quotation column notes remain incomplete.
- [x] Do not update `Documents/CONTEXT_HANDOFF.md` unless the Build Agent introduces broader architecture or process changes beyond this plan.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed or confirmed unnecessary
- [x] Step 7 completed
- [x] Step 8 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationTotals.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`

### Validation Performed
- [x] `npm --prefix FRONTENT run build`
- [x] Targeted manual Add/View/Edit checks completed
- [x] Network request behavior checked
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] None expected; no GAS changes or Web App redeployment planned.