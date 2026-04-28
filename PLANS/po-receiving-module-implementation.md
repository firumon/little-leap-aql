# PLAN: PO Receiving + Goods Receipts Implementation
**Status**: COMPLETED  
**Created**: 2026-04-27  
**Updated**: 2026-04-27  
**Created By**: Brain Agent  
**Executed By**: Build Agent (Kilo Code)

## Objective
Implement `POReceivings` as the editable inspection layer between `PurchaseOrders` and finalized `GoodsReceipts` GRNs.

Done means:
- `POReceivings` and `POReceivingItems` exist in sheet setup and `APP.Resources`.
- Existing placeholder `GoodsReceipts` and `GoodsReceiptItems` are revised into finalized GRN resources.
- `APP_OPTIONS_SEED` includes `POReceivingProgress` and updated `ProcurementProgress`.
- Procurement menu contains `PO Receiving` followed immediately by `Goods Receipts`.
- Custom frontend pages exist for `POReceivings` and `GoodsReceipts`.
- PO Receiving supports select PO, resume draft, save draft, confirm, generate GRN, cancel, replacement, and report placeholders.
- Goods Receipts supports index/view of finalized GRNs and invalidation workflow, but no direct add page.
- GAS workflow hooks keep procurement, PO receiving, and GRN state aligned.
- No stock movement, warehouse posting, or report-template generation is implemented in this phase.

## Source Of Truth
Primary requirement:
- `C:\Users\firum\Desktop\2026-04-27-po-receiving-implementation-prompt.md`

Architecture sources already required before implementation:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`

Agreed logic:
- `POReceivings` is the working receiving document.
- `POReceivingItems` stores entered inspection quantities only.
- Accepted, short, and excess quantities are derived in frontend composables and never stored in receiving sheets.
- `GoodsReceipts` is the finalized GRN header.
- `GoodsReceiptItems.Qty` stores accepted quantity only.
- `GenerateGRN` is an `AdditionalAction` on `POReceivings`; a GAS postAction hook creates GRN rows.
- `GoodsReceipts` can be manually invalidated through an action that sets `Status = Inactive`.
- PostAction hooks are non-blocking in AQL. Therefore frontend must block invalid actions before calling the API; GAS hooks must defensively repair state when possible and never throw.
- Custom page folder for PO Receiving must be `FRONTENT/src/pages/Operations/PoReceivings/`, because `ActionResolverPage.vue` uses `toPascalCase('po-receivings') -> PoReceivings`.

Assumptions:
- `PurchaseOrders` already carries or can resolve the linked `ProcurementCode`.
- Existing generic `executeAction` stamps `{Column}{ActionValue}At`, `{Column}{ActionValue}By`, and `{Column}{ActionValue}Comment` when matching columns exist.
- Existing generic `compositeSave` accepts a parent record plus child records for parent/child resources.
- Existing resource sync order values can be shifted safely for Procurement menu ordering.
- App option seed updates may require running the existing setup/sync flow and, if the app option row already exists, manually appending missing option values in APP sheets.

Out of scope:
- Stock movements, stock reversal, inventory ledger, and warehouse stock updates.
- Report-template generation.
- New custom GAS web endpoints.
- Direct generic CRUD add/edit pages for `GoodsReceipts`.
- Web App redeployment unless an existing API contract is changed.

## Context
Current state:
- `PurchaseOrders` already exists and is the upstream source document.
- `GoodsReceipts` and `GoodsReceiptItems` already exist as placeholders and must be revised in place.
- The frontend operation route resolver loads custom pages from `FRONTENT/src/pages/Operations/{PascalCaseSlug}/`.
- The repo requires business logic in composables, UI-only pages/components, API/IDB access only in services, and resource navigation through `useResourceNav`.
- GAS supports generic resource actions and postAction hooks; hooks must be treated as defensive side-effect handlers, not as pre-action validation gates.

## Pre-Conditions
- [ ] Required source docs listed in Source Of Truth have been reviewed.
- [ ] `Documents/ARCHITECTURE RULES.md` has been read before any `FRONTENT/` edit.
- [ ] `Documents/GAS_API_CAPABILITIES.md` and `Documents/GAS_PATTERNS.md` have been read before GAS workflow edits.
- [ ] `git status --short` has been checked before editing.
- [ ] No unrelated local changes are reverted.
- [ ] Existing `PurchaseOrders`, `PurchaseOrderItems`, and `Procurements` resource names/columns have been inspected before wiring lookups.

## File Plan

### GAS
`GAS/Constants.gs`
- Action: modify.
- Purpose: add operation sheet constants and AppOptions.
- Related items: `CONFIG.OPERATION_SHEETS`, `APP_OPTIONS_SEED.ProcurementProgress`, `APP_OPTIONS_SEED.POReceivingProgress`.
- Dependencies: `GAS/setupOperationSheets.gs`.

`GAS/setupOperationSheets.gs`
- Action: modify.
- Purpose: add `POReceivings` and `POReceivingItems`; revise `GoodsReceipts` and `GoodsReceiptItems`.
- Related items: operation sheet schema definitions, validations, defaults, widths.
- Dependencies: `GAS/Constants.gs`.

`GAS/syncAppResources.gs`
- Action: modify.
- Purpose: register all four resources, fields, menu entries, actions, parent relationships, list views, UI fields, and postAction names.
- Related items: `APP.Resources` sync definitions.
- Dependencies: `GAS/poReceivingWorkflow.gs`.

`GAS/poReceivingWorkflow.gs`
- Action: create.
- Purpose: implement postAction hooks for draft save, confirm/generate/cancel, and GRN invalidation.
- Related functions: listed in Function Plan.
- Dependencies: existing sheet/resource helpers used by other workflow files.

### Frontend Composables
`FRONTENT/src/composables/operations/poReceivings/poReceivingMeta.js`
- Action: create.
- Purpose: PO Receiving progress labels, order, colors, report placeholder metadata, and deterministic system messages.
- Dependencies: none.

`FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`
- Action: create.
- Purpose: derived quantity helpers, validation, default forms, payload builders.
- Dependencies: `poReceivingMeta.js`.

`FRONTENT/src/composables/operations/poReceivings/usePOReceivingIndex.js`
- Action: create.
- Purpose: list page view-model for PO Receiving.
- Dependencies: `useResourceData`, `useResourceNav`, `poReceivingMeta.js`.

`FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
- Action: create.
- Purpose: select PO, resume draft, edit draft, save, confirm, generate GRN, replacement flow.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `useQuasar`, `poReceivingPayload.js`, `poReceivingMeta.js`.

`FRONTENT/src/composables/operations/poReceivings/usePOReceivingView.js`
- Action: create.
- Purpose: read-only receiving view, linked GRN, actions, report placeholders.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `poReceivingPayload.js`, `poReceivingMeta.js`.

`FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptIndex.js`
- Action: create.
- Purpose: Goods Receipts list page view-model.
- Dependencies: `useResourceData`, `useResourceNav`.

`FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`
- Action: create.
- Purpose: GRN read-only view and invalidation action.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`.

`FRONTENT/src/composables/REGISTRY.md`
- Action: modify.
- Purpose: register new operation composables after signatures are final.
- Dependencies: all new composable files.

### Frontend Components
`FRONTENT/src/components/Operations/PoReceivings/POReceivingSummaryCards.vue`
- Action: create.
- Purpose: UI-only summary cards for draft/view totals.
- Dependencies: props from PO Receiving composables.

`FRONTENT/src/components/Operations/PoReceivings/POReceivingItemGrid.vue`
- Action: create.
- Purpose: UI-only editable/read-only item grid with derived columns.
- Dependencies: props/events only; no service/store imports.

`FRONTENT/src/components/Operations/PoReceivings/POReceivingBulkToolbar.vue`
- Action: create.
- Purpose: UI-only bulk edit controls.
- Dependencies: emits bulk intent events only.

`FRONTENT/src/components/Operations/PoReceivings/POReceivingReportLinks.vue`
- Action: create.
- Purpose: UI-only disabled/future-ready report links.
- Dependencies: report placeholder props.

`FRONTENT/src/components/Operations/GoodsReceipts/GoodsReceiptItemsTable.vue`
- Action: create.
- Purpose: UI-only accepted-item table for GRN view.
- Dependencies: props only.

`FRONTENT/src/components/REGISTRY.md`
- Action: modify.
- Purpose: register the new reusable operation components.
- Dependencies: component files above.

### Frontend Pages
`FRONTENT/src/pages/Operations/PoReceivings/IndexPage.vue`
- Action: create.
- Purpose: custom PO Receiving index page.
- Dependencies: `usePOReceivingIndex.js`.

`FRONTENT/src/pages/Operations/PoReceivings/AddPage.vue`
- Action: create.
- Purpose: custom PO Receiving add/resume draft page.
- Dependencies: `usePOReceivingAddFlow.js`, PO Receiving components.

`FRONTENT/src/pages/Operations/PoReceivings/ViewPage.vue`
- Action: create.
- Purpose: custom PO Receiving view/action page.
- Dependencies: `usePOReceivingView.js`, PO Receiving components.

`FRONTENT/src/pages/Operations/GoodsReceipts/IndexPage.vue`
- Action: create.
- Purpose: custom Goods Receipts index page.
- Dependencies: `useGoodsReceiptIndex.js`.

`FRONTENT/src/pages/Operations/GoodsReceipts/ViewPage.vue`
- Action: create.
- Purpose: custom Goods Receipts read-only view page.
- Dependencies: `useGoodsReceiptView.js`, `GoodsReceiptItemsTable.vue`.

### Docs
`Documents/MODULE_WORKFLOWS.md`
- Action: modify.
- Purpose: add PO Receiving + GRN workflow and route behavior.

`Documents/OPERATION_SHEET_STRUCTURE.md`
- Action: modify.
- Purpose: document operation sheets for PO Receiving and GRN.

`Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- Action: modify.
- Purpose: document procurement progress alignment.

`Documents/RESOURCE_COLUMNS_GUIDE.md`
- Action: modify.
- Purpose: document columns, progress values, status semantics, and derived quantity rules.

`Documents/AQL_MENU_ADMIN_GUIDE.md`
- Action: modify.
- Purpose: add `PO Receiving` and `Goods Receipts` to Procurement menu order.

`Documents/CONTEXT_HANDOFF.md`
- Action: modify only after implementation.
- Purpose: record final implementation state for future agents.

## Resource Metadata Plan

### `POReceivings`
- Resource name: `POReceivings`.
- Sheet constant: `CONFIG.OPERATION_SHEETS.PO_RECEIVINGS`.
- ParentResource: `PurchaseOrders`.
- CodePrefix: `POR`.
- CodeSequenceLength: `5`.
- RequiredHeaders: `PurchaseOrderCode,InspectionDate,InspectedUserName,Progress,Status`.
- DefaultValues: `Progress=DRAFT`, `Status=Active`.
- Progress options: `APP_OPTIONS_SEED.POReceivingProgress`.
- Menu: visible under `Procurement`.
- Menu route: `/operations/po-receivings`.
- Menu order: next after `Purchase Orders`; use order `7` if current `Purchase Orders` is `6`.
- AdditionalActions: `Confirm`, `GenerateGRN`, `Cancel`.
- PostAction: `handlePOReceivingWorkflow`.
- AccessRegion: included.
- IncludeInAuthorizationPayload: follow existing operation transaction resources.

Headers:
- `Code`
- `PurchaseOrderCode`
- `InspectionDate`
- `InspectedUserName`
- `Progress`
- `ProgressConfirmedAt`
- `ProgressConfirmedBy`
- `ProgressConfirmedComment`
- `ProgressCancelledAt`
- `ProgressCancelledBy`
- `ProgressCancelledComment`
- `ProgressGRNGeneratedAt`
- `ProgressGRNGeneratedBy`
- `ProgressGRNGeneratedComment`
- `Remarks`
- `Status`
- `AccessRegion`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

UI fields:
- List: `Code`, `PurchaseOrderCode`, `InspectionDate`, `InspectedUserName`, `Progress`, `Status`, `UpdatedAt`.
- Detail: same as schema excluding audit stamps where existing detail helpers hide them.
- Child resources shown on detail: `POReceivingItems`; linked `GoodsReceipts` handled by custom view.

AdditionalActions:
- `Confirm`: mutate `Progress` to `CONFIRMED`; visible only when `Progress=DRAFT`; optional `ProgressConfirmedComment`.
- `GenerateGRN`: mutate `Progress` to `GRN_GENERATED`; visible only when `Progress=CONFIRMED`; optional `ProgressGRNGeneratedComment`.
- `Cancel`: mutate `Progress` to `CANCELLED`; visible only when `Progress` is `DRAFT`, `CONFIRMED`, or `GRN_GENERATED`; required `ProgressCancelledComment`.

### `POReceivingItems`
- Resource name: `POReceivingItems`.
- Sheet constant: `CONFIG.OPERATION_SHEETS.PO_RECEIVING_ITEMS`.
- ParentResource: `POReceivings`.
- CodePrefix: `PORI`.
- CodeSequenceLength: `6`.
- RequiredHeaders: `POReceivingCode,PurchaseOrderItemCode,SKU,ExpectedQty,ReceivedQty,DamagedQty,RejectedQty,Status`.
- DefaultValues: `ReceivedQty=0`, `DamagedQty=0`, `RejectedQty=0`, `Status=Active`.
- Menu: hidden.
- AdditionalActions: none.
- PostAction: none.

Headers:
- `Code`
- `POReceivingCode`
- `PurchaseOrderItemCode`
- `SKU`
- `ExpectedQty`
- `ReceivedQty`
- `DamagedQty`
- `RejectedQty`
- `RejectedReason`
- `Remarks`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

### `GoodsReceipts`
- Resource name: `GoodsReceipts`.
- Existing placeholder resource must be revised, not duplicated.
- ParentResource: `POReceivings`.
- CodePrefix: `GRN`.
- CodeSequenceLength: `5`.
- RequiredHeaders: `ProcurementCode,PurchaseOrderCode,POReceivingCode,Date,Status`.
- DefaultValues: `Status=Active`.
- Menu: visible under `Procurement`.
- Menu route: `/operations/goods-receipts`.
- Menu order: immediately after `PO Receiving`; use order `8` if PO Receiving is `7`.
- AdditionalActions: `Invalidate`.
- PostAction: `handlePOReceivingWorkflow`.
- AccessRegion: included.
- IncludeInAuthorizationPayload: follow existing operation transaction resources.

Headers:
- `Code`
- `ProcurementCode`
- `PurchaseOrderCode`
- `POReceivingCode`
- `Date`
- `Status`
- `AccessRegion`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

AdditionalActions:
- `Invalidate`: mutate `Status` to `Inactive`; visible only when `Status=Active`; require confirmation; no custom endpoint.

### `GoodsReceiptItems`
- Resource name: `GoodsReceiptItems`.
- Existing placeholder resource must be revised, not duplicated.
- ParentResource: `GoodsReceipts`.
- CodePrefix: `GRNI`.
- CodeSequenceLength: `6`.
- RequiredHeaders: `GoodsReceiptCode,POReceivingItemCode,SKU,Qty,Status`.
- DefaultValues: `Status=Active`.
- Menu: hidden.
- AdditionalActions: none.
- PostAction: none.

Headers:
- `Code`
- `GoodsReceiptCode`
- `POReceivingItemCode`
- `SKU`
- `Qty`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## Function-By-Function Plan

### AppOptions and Sheet Setup
`APP_OPTIONS_SEED.ProcurementProgress`
- File: `GAS/Constants.gs`.
- Purpose: include `GOODS_RECEIVING` and `GRN_GENERATED`.
- Inputs: none.
- Outputs: updated seed list preserving existing values.
- Side effects: setup can seed/append options.
- Error handling: none.
- Edge cases: do not remove `PO_ISSUED` or `COMPLETED`.
- Order: first.
- Connects to: procurement workflow hooks and frontend displays.

`APP_OPTIONS_SEED.POReceivingProgress`
- File: `GAS/Constants.gs`.
- Purpose: provide progress options for `POReceivings.Progress`.
- Inputs: none.
- Outputs: `DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`.
- Side effects: setup can seed option group.
- Error handling: none.
- Edge cases: names must match action column values exactly after casing.
- Order: after procurement options.
- Connects to: PO Receiving schema validation and resource UI.

`POReceivings schema`
- File: `GAS/setupOperationSheets.gs`.
- Purpose: define receiving header sheet.
- Inputs: operation sheet constants and AppOptions.
- Outputs: schema entry.
- Side effects: setup creates/updates sheet.
- Error handling: existing setup behavior.
- Edge cases: do not add `WarehouseCode`, `GeneratedGRNCode`, supplier note, invoice, shipment, `AcceptedQty`, `ShortQty`, or `ExcessQty`.
- Order: after constants.
- Connects to: `APP.Resources.POReceivings`.

`POReceivingItems schema`
- File: `GAS/setupOperationSheets.gs`.
- Purpose: define receiving line sheet.
- Inputs: operation sheet constants.
- Outputs: schema entry.
- Side effects: setup creates/updates sheet.
- Error handling: existing setup behavior.
- Edge cases: `ExpectedQty` stored from PO item; derived quantities not stored.
- Order: after parent schema.
- Connects to: compositeSave child rows.

`GoodsReceipts schema`
- File: `GAS/setupOperationSheets.gs`.
- Purpose: replace placeholder with finalized GRN header.
- Inputs: operation sheet constants.
- Outputs: revised schema entry.
- Side effects: setup creates/updates sheet.
- Error handling: existing setup behavior.
- Edge cases: `Status=Inactive` means invalidated, not deleted.
- Order: after receiving schemas.
- Connects to: generate GRN hook and GRN pages.

`GoodsReceiptItems schema`
- File: `GAS/setupOperationSheets.gs`.
- Purpose: replace placeholder with finalized GRN item rows.
- Inputs: operation sheet constants.
- Outputs: revised schema entry.
- Side effects: setup creates/updates sheet.
- Error handling: existing setup behavior.
- Edge cases: `Qty` is accepted quantity only.
- Order: after `GoodsReceipts`.
- Connects to: generate GRN hook and GRN view.

### GAS Workflow
`handlePOReceivingWorkflow_afterCompositeSave`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: after PO Receiving draft save, move linked procurement from `PO_ISSUED` to `GOODS_RECEIVING`.
- Inputs: postAction context: `payload`, `result`, `auth`, `action`, `meta`, `resourceName`.
- Outputs: original result.
- Side effects: updates linked `Procurements.Progress` only when current progress is exactly `PO_ISSUED`.
- Error handling: catch/log all errors and return result.
- Edge cases: ignore child resources; ignore missing procurement; ignore completed procurement.
- Order: first workflow hook.
- Connects to: add flow draft save.

`handlePOReceivingWorkflow_afterExecuteAction`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: handle `Confirm`, `GenerateGRN`, `Cancel`, and `Invalidate`.
- Inputs: postAction context.
- Outputs: original result.
- Side effects: creates GRN rows, updates procurement, invalidates active GRN, repairs blocked cancellation.
- Error handling: catch/log all errors and return result.
- Edge cases: branch by `resourceName`; for completed procurement cancellation, restore previous receiving progress from `meta.previousRecord` if available because postAction cannot block the write before it happens.
- Order: after composite save hook.
- Connects to: frontend `executeAction` calls.

`generateGoodsReceiptForReceiving`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: create one active GRN header and accepted-only GRN items for a confirmed receiving.
- Inputs: saved `POReceivings` record, auth context.
- Outputs: created GRN code or existing active GRN code.
- Side effects: writes `GoodsReceipts` and `GoodsReceiptItems`; sets procurement to `GRN_GENERATED`.
- Error handling: catch/log at caller; skip invalid item rows.
- Edge cases: if an active GRN already exists for the receiving, do not create a duplicate; create item rows only where `max(ReceivedQty - DamagedQty - RejectedQty, 0) > 0`.
- Order: called by afterExecuteAction for `POReceivings.GenerateGRN`.
- Connects to: GRN pages.

`invalidateActiveGoodsReceiptsForReceiving`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: mark active GRNs for a receiving inactive.
- Inputs: `POReceivingCode`, reason/auth context.
- Outputs: list of invalidated GRN codes.
- Side effects: updates `GoodsReceipts.Status=Inactive`; optionally updates active `GoodsReceiptItems.Status=Inactive` for that GRN.
- Error handling: catch/log at caller.
- Edge cases: no active GRN is a no-op.
- Order: before canceling a receiving and when replacing a non-draft receiving.
- Connects to: cancel and replacement flow.

`rollbackReceivingAfterGrnInvalidation`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: when a GRN becomes inactive, roll linked receiving from `GRN_GENERATED` back to `CONFIRMED`.
- Inputs: `GoodsReceipts` record, auth context.
- Outputs: none.
- Side effects: updates `POReceivings.Progress=CONFIRMED`; updates procurement from `GRN_GENERATED` to `GOODS_RECEIVING` only when not `COMPLETED`.
- Error handling: catch/log at caller.
- Edge cases: if receiving is already `CANCELLED`, do not change it.
- Order: called by afterExecuteAction for `GoodsReceipts.Invalidate` and by update fallback.
- Connects to: GRN invalidation.

`handlePOReceivingWorkflow_afterUpdate`
- File: `GAS/poReceivingWorkflow.gs`.
- Purpose: fallback for direct `GoodsReceipts.Status` updates to `Inactive`.
- Inputs: postAction context.
- Outputs: original result.
- Side effects: same rollback as invalidation action.
- Error handling: catch/log all errors and return result.
- Edge cases: only run when `resourceName=GoodsReceipts` and status changed from active to inactive.
- Order: after executeAction hook.
- Connects to: manual generic update paths.

### Frontend Payload And Metadata
`PO_RECEIVING_PROGRESS_META`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingMeta.js`.
- Purpose: labels/order/colors for `DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`.
- Inputs: progress string.
- Outputs: metadata.
- Side effects: none.
- Error handling: unknown progress maps to neutral fallback.
- Edge cases: casing must match AppOptions.
- Order: before composables.
- Connects to: all PO Receiving UI.

`PO_RECEIVING_REPORT_PLACEHOLDERS`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingMeta.js`.
- Purpose: define disabled placeholder links for Damage List, Reject List, Short List, Excess List.
- Inputs: none.
- Outputs: array metadata.
- Side effects: none.
- Error handling: none.
- Edge cases: no actual report generation.
- Order: before view composable.
- Connects to: `POReceivingReportLinks.vue`.

`acceptedQty`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: calculate accepted quantity.
- Inputs: `ReceivedQty`, `DamagedQty`, `RejectedQty`.
- Outputs: `max(received - damaged - rejected, 0)`.
- Side effects: none.
- Error handling: invalid values normalize to zero.
- Edge cases: never returns negative.
- Order: first helper.
- Connects to: item grid and GRN payload reasoning.

`shortQty`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: calculate shortage.
- Inputs: `ExpectedQty`, `ReceivedQty`.
- Outputs: `max(expected - received, 0)`.
- Side effects: none.
- Error handling: invalid values normalize to zero.
- Edge cases: never returns negative.
- Order: after `acceptedQty`.
- Connects to: item grid and report placeholders.

`excessQty`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: calculate excess.
- Inputs: `ExpectedQty`, `ReceivedQty`.
- Outputs: `max(received - expected, 0)`.
- Side effects: none.
- Error handling: invalid values normalize to zero.
- Edge cases: never returns negative.
- Order: after `shortQty`.
- Connects to: item grid and report placeholders.

`defaultHeaderForm`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: create header form from selected PO or existing receiving.
- Inputs: purchase order, optional existing receiving, current user display name.
- Outputs: header form object.
- Side effects: none.
- Error handling: missing PO returns blank form.
- Edge cases: do not set forbidden fields.
- Order: before add flow.
- Connects to: `selectPurchaseOrder`.

`defaultItemForm`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: create line form from PO item and optional receiving item.
- Inputs: PO item, optional existing receiving item.
- Outputs: item form object with derived display values.
- Side effects: none.
- Error handling: missing PO item returns minimal blank line.
- Edge cases: `ExpectedQty` from PO item is read-only.
- Order: before hydration.
- Connects to: add flow and item grid.

`validateReceiving`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: validate header and lines before save/confirm.
- Inputs: header form and item forms.
- Outputs: `{ valid, errors }`.
- Side effects: none.
- Error handling: never throw.
- Edge cases: reject negative quantities; require `RejectedReason` when `RejectedQty > 0`; enforce `ReceivedQty >= DamagedQty + RejectedQty`.
- Order: before save/confirm.
- Connects to: add flow buttons.

`buildCompositePayload`
- File: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Purpose: serialize parent/child records for `compositeSave`.
- Inputs: header form, item forms, existing codes.
- Outputs: composite save payload matching existing workflow store contract.
- Side effects: none.
- Error handling: invalid numbers normalize to zero.
- Edge cases: never include derived quantities.
- Order: after validation.
- Connects to: `saveDraft`.

### Frontend PO Receiving
`usePOReceivingIndex`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingIndex.js`.
- Purpose: load, group, filter, and navigate PO Receiving records.
- Inputs: none.
- Outputs: records, grouped records, search, loading, refresh, navigation helpers.
- Side effects: resource reloads only.
- Error handling: empty state on failure/no records.
- Edge cases: unknown progress goes to fallback group.
- Order: before index page.
- Connects to: `PoReceivings/IndexPage.vue`.

`usePOReceivingAddFlow`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`.
- Purpose: full add/resume/edit workflow.
- Inputs: route query/code and user actions.
- Outputs: form state, line rows, action state, handlers.
- Side effects: loads resources, calls `compositeSave`, calls `executeAction`, navigates with `useResourceNav`.
- Error handling: Quasar notify on validation/API failures.
- Edge cases: resume existing draft; block non-draft replacement unless cancellation confirmed; block cancellation when linked procurement is `COMPLETED`.
- Order: before add page.
- Connects to: `PoReceivings/AddPage.vue`.

`selectPurchaseOrder`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`.
- Purpose: select PO and hydrate receiving state.
- Inputs: `PurchaseOrderCode`.
- Outputs: selected PO, header form, line rows.
- Side effects: may load existing draft state.
- Error handling: missing PO clears state and shows warning.
- Edge cases: active draft opens instead of duplicate; non-draft active receiving requires cancellation/replacement path.
- Order: first workflow handler.
- Connects to: top PO selector.

`saveDraft`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`.
- Purpose: persist current receiving.
- Inputs: current forms.
- Outputs: saved parent/child state.
- Side effects: calls `compositeSave`; procurement moves through GAS hook.
- Error handling: validation stops request; API failure notifies.
- Edge cases: first save creates; later saves update; removed lines become inactive only if the existing pattern supports child deactivation.
- Order: after validation.
- Connects to: save button.

`confirmReceiving`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`.
- Purpose: save if needed, then execute `Confirm`.
- Inputs: optional comment.
- Outputs: refreshed receiving.
- Side effects: `executeAction`.
- Error handling: validation/API notify.
- Edge cases: only draft; no editing after success.
- Order: after `saveDraft`.
- Connects to: confirm button.

`generateGRN`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js` and `usePOReceivingView.js`.
- Purpose: execute `GenerateGRN`.
- Inputs: receiving code and optional comment.
- Outputs: refreshed data and navigation target.
- Side effects: `executeAction`; GAS creates GRN; navigate to active GRN view if found.
- Error handling: notify if no confirmed receiving or duplicate active GRN.
- Edge cases: available only for `CONFIRMED` and no active GRN.
- Order: after confirm and in view composable.
- Connects to: post-confirm prompt and view action.

`startReplacement`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`.
- Purpose: invalidate active GRN, cancel old receiving, then start a new draft.
- Inputs: existing receiving and selected PO.
- Outputs: new draft state.
- Side effects: calls `GoodsReceipts.Invalidate` when needed, then `POReceivings.Cancel`.
- Error handling: stop if procurement is `COMPLETED` or action fails.
- Edge cases: cancellation reason must be deterministic: `System replacement: new receiving started for same PO`.
- Order: after selection checks.
- Connects to: replacement prompt.

`usePOReceivingView`
- File: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingView.js`.
- Purpose: read-only detail, linked GRN, actions, report placeholders.
- Inputs: route code.
- Outputs: receiving, items, derived summaries, linked GRN, action handlers.
- Side effects: loads resources and executes actions.
- Error handling: missing record shows empty state.
- Edge cases: cancel invalidates active GRN first; completed procurement blocks cancel.
- Order: before view page.
- Connects to: `PoReceivings/ViewPage.vue`.

### Frontend Goods Receipts
`useGoodsReceiptIndex`
- File: `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptIndex.js`.
- Purpose: list active and inactive GRNs.
- Inputs: none.
- Outputs: records, search, status grouping, navigation helpers.
- Side effects: reloads `GoodsReceipts`, `PurchaseOrders`, `POReceivings`.
- Error handling: empty state.
- Edge cases: inactive records remain visible and clearly labelled.
- Order: before Goods Receipts index page.
- Connects to: `GoodsReceipts/IndexPage.vue`.

`useGoodsReceiptView`
- File: `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`.
- Purpose: read-only GRN details and invalidation action.
- Inputs: route code.
- Outputs: GRN, items, linked PO Receiving, navigation/action handlers.
- Side effects: reloads data; executes `Invalidate`.
- Error handling: missing record shows empty state; API failures notify.
- Edge cases: no add/edit behavior; invalidated GRN remains readable.
- Order: before Goods Receipts view page.
- Connects to: `GoodsReceipts/ViewPage.vue`.

`invalidateGoodsReceipt`
- File: `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`.
- Purpose: execute `GoodsReceipts.Invalidate`.
- Inputs: current GRN.
- Outputs: refreshed state.
- Side effects: GAS rolls receiving/procurement back.
- Error handling: no-op if already inactive.
- Edge cases: do not run if linked procurement is `COMPLETED` unless final implementation confirms business approval.
- Order: after loadData.
- Connects to: invalidate button.

## Execution Steps

1. Review required architecture docs.
- File to open: `Documents/ARCHITECTURE RULES.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`.
- Change to make: none.
- Where: read frontend layer rules and GAS action/postAction rules.
- Avoid changing: all files.
- Command after step: `git status --short`.
- Expected result: worktree status is known before edits.

2. Update constants and AppOptions.
- File to open: `GAS/Constants.gs`.
- Change to make: add `PO_RECEIVINGS` and `PO_RECEIVING_ITEMS` to `CONFIG.OPERATION_SHEETS`; add `APP_OPTIONS_SEED.POReceivingProgress` with `DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`; extend `APP_OPTIONS_SEED.ProcurementProgress` with `GOODS_RECEIVING` after `PO_ISSUED` and `GRN_GENERATED` before `COMPLETED` if missing.
- Where: alongside existing operation sheet constants and app option seed groups.
- Avoid changing: existing option spelling/order except inserting required values.
- Command after step: none.
- Expected result: constants provide sheet names and both progress option groups.

3. Update operation sheet schemas.
- File to open: `GAS/setupOperationSheets.gs`.
- Change to make: add schemas for `POReceivings` and `POReceivingItems`; replace existing placeholder `GoodsReceipts` and `GoodsReceiptItems` schema definitions with the finalized headers listed in this plan.
- Where: in the operation sheet setup list near existing procurement operation resources.
- Avoid changing: unrelated operation resources and existing generic setup helpers.
- Command after step: none.
- Expected result: all four resources have exact headers, defaults, validations, and widths matching this plan.

4. Update resource metadata.
- File to open: `GAS/syncAppResources.gs`.
- Change to make: add/revise `APP.Resources` definitions for `POReceivings`, `POReceivingItems`, `GoodsReceipts`, `GoodsReceiptItems`.
- Where: in the operations/procurement resource section near `PurchaseOrders`.
- Avoid changing: generic resource sync logic.
- Command after step: none.
- Expected result: both `PO Receiving` and `Goods Receipts` appear in Procurement menu order; child resources remain hidden; actions and postAction names are configured.

5. Create workflow hook file.
- File to open: create `GAS/poReceivingWorkflow.gs`.
- Change to make: implement only the functions listed in the GAS Workflow section.
- Where: entire new file.
- Avoid changing: `resourceApi.gs` unless an existing hook dispatch bug is discovered and documented before editing.
- Command after step: none.
- Expected result: hooks are non-throwing and scoped to `POReceivings` and `GoodsReceipts`.

6. Create PO Receiving metadata and payload helpers.
- File to open: create `FRONTENT/src/composables/operations/poReceivings/poReceivingMeta.js` and `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`.
- Change to make: add progress/report metadata, quantity helpers, validation, default form builders, and composite payload builder.
- Where: new composable folder.
- Avoid changing: services, stores, and page files in this step.
- Command after step: none.
- Expected result: all business calculations live outside pages/components.

7. Create PO Receiving composables.
- File to open: create `usePOReceivingIndex.js`, `usePOReceivingAddFlow.js`, and `usePOReceivingView.js` under `FRONTENT/src/composables/operations/poReceivings/`.
- Change to make: implement the composable functions listed in this plan.
- Where: new files.
- Avoid changing: API services and stores unless existing public methods are missing; if missing, stop and document the exact gap before editing shared services.
- Command after step: none.
- Expected result: pages can consume complete view-models without containing business logic.

8. Create Goods Receipts composables.
- File to open: create `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptIndex.js` and `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`.
- Change to make: implement GRN list/view/invalidate view-models.
- Where: new folder or existing `goodsReceipts` folder if already present.
- Avoid changing: adding any direct GRN create/edit flow.
- Command after step: none.
- Expected result: Goods Receipts has custom index and view support only.

9. Create UI-only components.
- File to open: create the five component files listed in the Frontend Components file plan.
- Change to make: build presentational components using props and emits only.
- Where: `FRONTENT/src/components/Operations/PoReceivings/` and `FRONTENT/src/components/Operations/GoodsReceipts/`.
- Avoid changing: stores, services, and resource APIs; no business calculations inside components except displaying values already provided by composables.
- Command after step: none.
- Expected result: pages remain under the architecture line and avoid large inline grids/toolbars.

10. Create PO Receiving pages.
- File to open: create `FRONTENT/src/pages/Operations/PoReceivings/IndexPage.vue`, `AddPage.vue`, `ViewPage.vue`.
- Change to make: compose Quasar layout from the PO Receiving composables and UI components.
- Where: exact `PoReceivings` folder name.
- Avoid changing: route resolver files; do not create `POReceivings` folder because resolver will not find it.
- Command after step: none.
- Expected result: `/operations/po-receivings`, add, and view actions resolve to custom pages.

11. Create Goods Receipts pages.
- File to open: create `FRONTENT/src/pages/Operations/GoodsReceipts/IndexPage.vue` and `ViewPage.vue`.
- Change to make: compose Quasar layout from Goods Receipts composables and item table.
- Where: exact `GoodsReceipts` folder name.
- Avoid changing: adding `AddPage.vue` or `EditPage.vue`.
- Command after step: none.
- Expected result: `/operations/goods-receipts` and view action resolve to custom pages; no direct add page exists.

12. Update frontend registries.
- File to open: `FRONTENT/src/composables/REGISTRY.md` and `FRONTENT/src/components/REGISTRY.md`.
- Change to make: add entries for the new composables/components with purpose and dependencies.
- Where: operations sections.
- Avoid changing: unrelated registry entries.
- Command after step: none.
- Expected result: reusable frontend files are discoverable and architecture docs stay aligned.

13. Update canonical docs.
- File to open: `Documents/MODULE_WORKFLOWS.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/PROCUREMENT_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/AQL_MENU_ADMIN_GUIDE.md`.
- Change to make: document the module, exact columns, route/menu order, actions, progress behavior, GRN invalidation, and no-stock/no-report-template scope.
- Where: existing procurement/operation sections; add a new PO Receiving + GRN workflow section in `MODULE_WORKFLOWS.md`.
- Avoid changing: unrelated module behavior.
- Command after step: none.
- Expected result: docs match sheets, resources, and frontend routing.

14. Push GAS changes.
- File to open: none.
- Change to make: none.
- Where: repo root.
- Avoid changing: files during push.
- Command after step: `npm run gas:push`.
- Expected result: clasp push succeeds and includes `poReceivingWorkflow.gs`.

15. Run targeted frontend validation.
- File to open: none.
- Change to make: none.
- Where: repo root.
- Avoid changing: files unless validation reveals a defect.
- Command after step: `npm --prefix FRONTENT run build`.
- Expected result: frontend build succeeds.

16. Update handoff after implementation.
- File to open: `Documents/CONTEXT_HANDOFF.md`.
- Change to make: record final implemented state, validation results, and any manual AppOptions/setup steps.
- Where: current-state section.
- Avoid changing: historical unrelated notes.
- Command after step: `git status --short`.
- Expected result: final changed-file list is known.

## Steps
This section maps to `PLANS/_TEMPLATE.md`. Use the detailed `Execution Steps` above as the authoritative task list.

### Step 1: Prepare And Inspect
- [ ] Complete Execution Step 1.
**Files**: `Documents/ARCHITECTURE RULES.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`
**Pattern**: read required rules before touching frontend or GAS files.
**Rule**: do not infer architecture from memory.

### Step 2: GAS Schemas And Resources
- [ ] Complete Execution Steps 2, 3, and 4.
**Files**: `GAS/Constants.gs`, `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`
**Pattern**: existing operation resource setup near procurement resources.
**Rule**: schemas, AppOptions, and `APP.Resources` must stay aligned.

### Step 3: GAS Workflow Hooks
- [ ] Complete Execution Step 5.
**Files**: `GAS/poReceivingWorkflow.gs`
**Pattern**: AQL postAction hook suffixes documented in GAS capabilities.
**Rule**: hooks never throw and never introduce custom endpoints.

### Step 4: Frontend Composables
- [ ] Complete Execution Steps 6, 7, and 8.
**Files**: `FRONTENT/src/composables/operations/poReceivings/*`, `FRONTENT/src/composables/operations/goodsReceipts/*`
**Pattern**: purchase-order operation composables plus `useResourceData`, `useWorkflowStore`, `useResourceNav`.
**Rule**: all business logic, validation, and derived quantities live here.

### Step 5: Frontend Components And Pages
- [ ] Complete Execution Steps 9, 10, and 11.
**Files**: `FRONTENT/src/components/Operations/PoReceivings/*`, `FRONTENT/src/components/Operations/GoodsReceipts/*`, `FRONTENT/src/pages/Operations/PoReceivings/*`, `FRONTENT/src/pages/Operations/GoodsReceipts/*`
**Pattern**: UI-only Quasar components and thin operation pages.
**Rule**: use `PoReceivings` folder exactly; do not create Goods Receipts add/edit pages.

### Step 6: Registries, Docs, And Verification
- [ ] Complete Execution Steps 12, 13, 14, 15, and 16.
**Files**: frontend registries, canonical docs, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: update docs only where behavior/schema/routes changed.
**Rule**: run targeted verification and record outcomes.

## Validation Plan

Commands:
- `git status --short`
- `npm run gas:push`
- `npm --prefix FRONTENT run build`

Targeted setup checks:
- Confirm `APP_OPTIONS_SEED.POReceivingProgress` exists with `DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`.
- Confirm `APP_OPTIONS_SEED.ProcurementProgress` includes `GOODS_RECEIVING` and `GRN_GENERATED`.
- Confirm `APP.Resources` has `POReceivings`, `POReceivingItems`, `GoodsReceipts`, and `GoodsReceiptItems`.
- Confirm Procurement menu shows `PO Receiving` before `Goods Receipts`.

Manual frontend checks:
- Open `/operations/po-receivings`; index loads and groups by progress.
- Start PO Receiving from a selected PO; PO items preload with `ExpectedQty`.
- Edit lines and verify accepted/short/excess values update in UI only.
- Save draft, leave, reopen, and verify no duplicate draft is created.
- Confirm draft; verify page becomes read-only.
- Generate GRN; verify one active `GoodsReceipts` row and accepted-only `GoodsReceiptItems` rows.
- Open `/operations/goods-receipts`; index loads active and inactive GRNs.
- Open a GRN view; verify accepted items and link back to PO Receiving.
- Invalidate a GRN; verify receiving rolls back from `GRN_GENERATED` to `CONFIRMED`.
- Cancel a receiving with active GRN; verify GRN is invalidated first.
- Try cancel when linked procurement is `COMPLETED`; verify frontend blocks action.

Expected outputs:
- GAS push succeeds.
- Frontend build succeeds.
- No stock movement rows are created.
- No report-template generation is added.
- No direct router calls are introduced in custom composables/pages; navigation uses `useResourceNav`.

Failure signs:
- Custom page folder is `POReceivings` instead of `PoReceivings`.
- Goods Receipts has an add page or direct create menu action.
- `GoodsReceiptItems` stores damaged/rejected/short/excess values.
- A second active draft can be created for the same PO.
- `GenerateGRN` creates duplicate active GRNs.
- Cancellation proceeds for `COMPLETED` procurement without frontend blocking or GAS repair.

## Regression Checklist
- Existing `PurchaseOrders` flow remains unchanged except downstream navigation can open PO Receiving.
- Existing `PurchaseRequisitions`, `RFQs`, `SupplierQuotations`, and `Procurements` continue to work.
- Existing generic `get`, `create`, `update`, `batch`, `compositeSave`, and `executeAction` contracts remain unchanged.
- Existing stock and warehouse behavior remains unchanged.
- Existing route resolver behavior remains unchanged.
- Existing menu permissions remain unchanged except for added PO Receiving and Goods Receipts entries.
- Frontend services remain the only layer with API/IndexedDB access.
- Stores remain state holders and do not gain business logic.
- Pages and components remain UI-only; business rules stay in composables.

## Documentation Updates Required
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with PO Receiving + GRN workflow, actions, replacement, and invalidation behavior.
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` with all four operation resources and exact columns.
- [ ] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` with procurement progress alignment.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with new resource columns, AppOptions, derived quantity rules, and GRN status semantics.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` with `PO Receiving` and `Goods Receipts` in Procurement menu order.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation with final state and manual setup notes.

## Acceptance Criteria
- [ ] User can create PO Receiving from a selected Purchase Order.
- [ ] User can save and resume a draft without duplicate active drafts.
- [ ] User can confirm a draft and generate a finalized GRN.
- [ ] Goods Receipt view shows accepted-only quantities.
- [ ] Procurement progress transitions match this plan.
- [ ] Goods Receipt invalidation rolls linked receiving back correctly.
- [ ] Completed procurement blocks PO Receiving cancellation.
- [ ] No stock movements or report-template generation are added.
- [ ] Architecture rules are followed.
- [ ] Validation commands pass.

## Final Acceptance Checklist
- [ ] `PO_RECEIVINGS` and `PO_RECEIVING_ITEMS` constants added.
- [ ] `POReceivingProgress` AppOption seed added.
- [ ] `ProcurementProgress` seed includes `GOODS_RECEIVING` and `GRN_GENERATED`.
- [ ] `POReceivings` sheet schema exactly matches required columns.
- [ ] `POReceivingItems` sheet schema exactly matches required columns.
- [ ] `GoodsReceipts` placeholder schema revised to finalized GRN columns.
- [ ] `GoodsReceiptItems` placeholder schema revised to accepted-only item columns.
- [ ] `APP.Resources.POReceivings` added with menu, actions, parent, defaults, and postAction.
- [ ] `APP.Resources.POReceivingItems` added as hidden child resource.
- [ ] `APP.Resources.GoodsReceipts` revised with menu, invalidation action, parent, defaults, and postAction.
- [ ] `APP.Resources.GoodsReceiptItems` revised as hidden child resource.
- [ ] PO Receiving custom pages exist under `FRONTENT/src/pages/Operations/PoReceivings/`.
- [ ] Goods Receipts custom index/view pages exist under `FRONTENT/src/pages/Operations/GoodsReceipts/`.
- [ ] No Goods Receipts add/edit page is added.
- [ ] Derived quantities are computed in composables and not stored.
- [ ] Draft save/resume prevents duplicate active drafts.
- [ ] Confirm, Generate GRN, Cancel, and Invalidate flows are implemented through generic actions.
- [ ] GRN generation creates accepted-only item rows and no stock movement rows.
- [ ] GRN invalidation rolls linked receiving back to `CONFIRMED`.
- [ ] Completed procurement blocks PO Receiving cancellation.
- [ ] Frontend registries and canonical docs are updated.
- [ ] `npm run gas:push` succeeds.
- [ ] `npm --prefix FRONTENT run build` succeeds.

## Post-Execution Notes
Build Agent must fill this section after implementation. Change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` with the concrete agent/runtime identity before finishing.

Progress log:
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
- [x] Step 13 completed
- [x] Step 14 completed
- [x] Step 15 completed
- [x] Step 16 completed

Deviations:
- [x] Implementation used a compact UI/component implementation while preserving the planned resource, workflow, routing, and validation behavior.

Files actually changed:
- [x] GAS constants, operation setup, resource sync, and `GAS/poReceivingWorkflow.gs`.
- [x] PO Receiving and Goods Receipt frontend composables, UI components, and custom pages.
- [x] Frontend registries and canonical docs, including `Documents/CONTEXT_HANDOFF.md`.

Validation performed:
- [x] `npm --prefix FRONTENT run build` succeeded.
- [x] `npm run gas:push` succeeded.
- [x] `git status --short` checked before and after implementation.

Manual actions required:
- [ ] Confirm APP.AppOptions contains newly seeded progress values after setup/sync.
- [ ] No Web App redeployment expected unless Build Agent changes API contracts.
