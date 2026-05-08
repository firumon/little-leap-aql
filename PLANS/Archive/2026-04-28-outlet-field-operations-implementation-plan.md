# PLAN: Outlet & Field Sales Operations Implementation
**Status**: COMPLETED
**Created**: 2026-04-28
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Kilo Code | completed)

## Objective
Implement the `Outlet & Field Sales Operations` consignment module in AQL.

Done means:
- `Outlets` and `OutletOperatingRules` exist as master resources.
- `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletDeliveries`, `OutletConsumption`, `OutletConsumptionItems`, `OutletMovements`, and `OutletStorages` exist as operation resources.
- Visit, restock approval, delivery, consumption, movement, and storage-balance workflows are implemented through AQL generic resource APIs.
- Business logic lives in frontend composables.
- GAS stays generic except setup/resource metadata and the existing-style movement-to-storage post-write hook.
- Delivery JSON is stored only as an event snapshot; cumulative delivery truth is stored in `OutletRestockItems.DeliveredQty`.
- `OutletStorages` is updated only from `OutletMovements` through the post-write hook.
- Frontend pages are thin Quasar orchestration shells and use the existing operation page resolver.
- Docs, registries, sheet setup, resource metadata, and validation all match.

## Source Of Truth
Primary requirement:
- `C:\Users\firum\Desktop\Outlet & Field Sales Operations.md`

Reviewed canonical docs:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/MASTER_SHEET_STRUCTURE.md`
- `PLANS/_TEMPLATE.md`

Agreed logic:
- Google Sheets are the database.
- GAS is the generic CRUD/composite/action/batch API layer.
- Frontend composables own business rules, validation, derived totals, and batch orchestration.
- No database joins or backend-heavy query logic are allowed.
- Fetch needed resource records in bulk and process in frontend.
- Keep sheet count minimal but use parent-child tables where needed.
- Delivery rows store `DeliveredItemsJSON` as an event log only.
- `OutletRestockItems.DeliveredQty` is the cumulative delivery source for restock fulfillment.
- No editing after submitted states. Revisions use `SendBack`.
- `OutletMovements` is the ledger. `OutletStorages` is the derived current balance.

Assumptions:
- Existing `SKUs`, `Products`, `Users`, and access-region infrastructure are available.
- A sales executive is identified through `CreatedBy`, `SalesUserCode`, or `AssignedSalesUserCode` fields, not a new user sheet.
- Outlets are customer/retail locations and belong in master scope.
- Outlet stock is separate from warehouse stock and must not use `WarehouseStorages`.
- Outlet movement/storage hook can reuse the structure of `GAS/stockMovements.gs` but must write to `OutletStorages`.
- If an approver sends a restock back, the same `OutletRestocks` row is revised and resubmitted.
- Postponed visits create a new planned visit row and leave the old visit as `POSTPONED`.

Out of scope:
- Accounting entries, invoicing, collections, POS integration, route optimization, maps/GPS, barcode scanning, and customer billing.
- New custom GAS endpoints.
- Backend-only validation beyond generic resource write validation and post-write movement hooks.
- Web App redeployment unless Build Agent changes the API contract, which this plan does not require.
- Automatic forecast/replenishment recommendation logic.

## Context
Current AQL supports:
- metadata-driven `APP.Resources`;
- operation-scope year-coded resources;
- generic `get`, `create`, `update`, `bulk`, `compositeSave`, `executeAction`, and `batch`;
- post-write hooks for stock movement storage updates;
- custom operation pages under `FRONTENT/src/pages/Operations/{PascalCaseSlug}/`;
- business logic in `FRONTENT/src/composables/operations/*`;
- resource navigation through `useResourceNav`;
- shared data access through stores/services only.

Use these existing patterns:
- Resource metadata pattern from `GAS/syncAppResources.gs`.
- Sheet setup pattern from `GAS/setupMasterSheets.gs` and `GAS/setupOperationSheets.gs`.
- Movement/storage hook pattern from `GAS/stockMovements.gs`.
- Batch request helper pattern from `FRONTENT/src/composables/operations/poReceivings/poReceivingBatch.js`.
- Custom operation page pattern from `FRONTENT/src/pages/Operations/PurchaseOrders/`, `PoReceivings/`, and `GoodsReceipts/`.

## Pre-Conditions
- [ ] Build Agent has read this plan fully before editing.
- [ ] Build Agent has read `Documents/ARCHITECTURE RULES.md` before touching `FRONTENT/`.
- [ ] Build Agent has read `Documents/GAS_API_CAPABILITIES.md` and `Documents/GAS_PATTERNS.md` before touching `GAS/`.
- [ ] Build Agent has run `git status --short` before editing and will not revert unrelated changes.
- [ ] Build Agent will use `apply_patch` or normal editor edits, not destructive git commands.

## File Plan

### GAS Setup And Metadata
`GAS/Constants.gs`
- Action: modify.
- Purpose: add new master and operation sheet constants; add AppOptions for outlet progress/status/reference values.
- Related items: `CONFIG.MASTER_SHEETS`, `CONFIG.OPERATION_SHEETS`, `APP_OPTIONS_SEED`.
- Dependencies: setup scripts and resource sync.

`GAS/setupMasterSheets.gs`
- Action: modify.
- Purpose: add `Outlets` and `OutletOperatingRules` master sheet schemas.
- Related items: `setupMasterSheets`, `schemaByResource`.
- Dependencies: `GAS/Constants.gs`.

`GAS/setupOperationSheets.gs`
- Action: modify.
- Purpose: add all outlet operation sheet schemas, validations, defaults, widths, audit/access columns.
- Related items: `setupOperationSheets`, `schemaByResource`.
- Dependencies: `GAS/Constants.gs`.

`GAS/syncAppResources.gs`
- Action: modify.
- Purpose: register all new resources in `APP.Resources` with scope, parent, code prefix, actions, menus, UI fields, defaults, access policy, and postAction.
- Related items: resource config array consumed by `syncAppResourcesFromCode`.
- Dependencies: setup scripts and `GAS/outletMovements.gs`.

`GAS/outletMovements.gs`
- Action: create.
- Purpose: post-write hook for `OutletMovements` that upserts `OutletStorages`.
- Related functions: listed in Function Plan.
- Dependencies: existing helpers used by `GAS/stockMovements.gs`, especially `openResourceSheet`, resource helpers, and sync cursor helpers.

### Frontend Composables
`FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`
- Action: create.
- Purpose: shared constants for progress values, labels, colors, resource names, and movement reference types.
- Dependencies: none.

`FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`
- Action: create.
- Purpose: create deterministic request builders for `batch`, `compositeSave`, `bulk`, `update`, `executeAction`, and refresh requests.
- Dependencies: `outletOperationsMeta.js`.

`FRONTENT/src/composables/operations/outlets/outletStockLogic.js`
- Action: create.
- Purpose: pure helpers for quantities, balances, delivery eligibility, consumption validation, value-limit checks, and duplicate-restock detection.
- Dependencies: `outletOperationsMeta.js`.

`FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`
- Action: create.
- Purpose: build restock parent/child composite payloads and delivery batch requests.
- Dependencies: `outletStockLogic.js`, `outletOperationsBatch.js`.

`FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`
- Action: create.
- Purpose: build consumption parent/child composite payloads and negative movement requests.
- Dependencies: `outletStockLogic.js`, `outletOperationsBatch.js`.

`FRONTENT/src/composables/operations/outlets/useOutletVisits.js`
- Action: create.
- Purpose: view-model and workflow logic for visit list/create/view/postpone/complete/cancel.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `outletOperationsBatch.js`.

`FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`
- Action: create.
- Purpose: restock index/create/edit/review/delivery orchestration.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `outletRestockPayload.js`, `outletStockLogic.js`.

`FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`
- Action: create.
- Purpose: delivery list/view/create flow, delivered JSON preview, and cumulative delivery validation.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `outletRestockPayload.js`.

`FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`
- Action: create.
- Purpose: consumption create/list/view flow and negative outlet stock movement orchestration.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, `outletConsumptionPayload.js`.

`FRONTENT/src/composables/operations/outlets/useOutletStock.js`
- Action: create.
- Purpose: outlet stock list/detail calculations from `OutletStorages`, enriched with SKU/Product labels and latest movements.
- Dependencies: `useResourceData`, `useResourceNav`, `outletStockLogic.js`.

`FRONTENT/src/composables/REGISTRY.md`
- Action: modify.
- Purpose: register all new outlet operation composables.
- Dependencies: new composable files.

### Frontend Components
`FRONTENT/src/components/Operations/Outlets/OutletHeaderPanel.vue`
- Action: create.
- Purpose: UI-only summary header for outlet operation pages.
- Dependencies: props and emits only.

`FRONTENT/src/components/Operations/Outlets/OutletItemGrid.vue`
- Action: create.
- Purpose: reusable UI-only editable/read-only SKU quantity grid for restock, delivery, and consumption rows.
- Dependencies: props and emits only.

`FRONTENT/src/components/Operations/Outlets/OutletProgressChip.vue`
- Action: create.
- Purpose: UI-only progress/status chip.
- Dependencies: props only.

`FRONTENT/src/components/Operations/Outlets/OutletStockRows.vue`
- Action: create.
- Purpose: UI-only current stock rows grouped by SKU/storage.
- Dependencies: props and emits only.

`FRONTENT/src/components/Operations/Outlets/OutletMovementTimeline.vue`
- Action: create.
- Purpose: UI-only outlet movement timeline for record views.
- Dependencies: props only.

`FRONTENT/src/components/REGISTRY.md`
- Action: modify.
- Purpose: register new reusable outlet operation components.
- Dependencies: component files.

### Frontend Pages
`FRONTENT/src/pages/Operations/OutletVisits/IndexPage.vue`
- Action: create.
- Purpose: custom visit list grouped by planned/completed/postponed/cancelled.
- Dependencies: `useOutletVisits.js`.

`FRONTENT/src/pages/Operations/OutletVisits/AddPage.vue`
- Action: create.
- Purpose: create planned visit.
- Dependencies: `useOutletVisits.js`.

`FRONTENT/src/pages/Operations/OutletVisits/ViewPage.vue`
- Action: create.
- Purpose: view visit and route actions to complete/postpone/cancel UI.
- Dependencies: `useOutletVisits.js`.

`FRONTENT/src/pages/Operations/OutletRestocks/IndexPage.vue`
- Action: create.
- Purpose: restock list grouped by progress.
- Dependencies: `useOutletRestocks.js`.

`FRONTENT/src/pages/Operations/OutletRestocks/AddPage.vue`
- Action: create.
- Purpose: create restock draft/request with child items.
- Dependencies: `useOutletRestocks.js`, outlet components.

`FRONTENT/src/pages/Operations/OutletRestocks/ViewPage.vue`
- Action: create.
- Purpose: switch between editable, approver review, and read-only restock views by progress.
- Dependencies: `useOutletRestocks.js`.

`FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`
- Action: create.
- Purpose: delivery list by outlet/restock/date.
- Dependencies: `useOutletDeliveries.js`.

`FRONTENT/src/pages/Operations/OutletDeliveries/AddPage.vue`
- Action: create.
- Purpose: create delivery against approved or partially delivered restock.
- Dependencies: `useOutletDeliveries.js`.

`FRONTENT/src/pages/Operations/OutletDeliveries/ViewPage.vue`
- Action: create.
- Purpose: read-only delivery event view.
- Dependencies: `useOutletDeliveries.js`.

`FRONTENT/src/pages/Operations/OutletConsumption/IndexPage.vue`
- Action: create.
- Purpose: consumption list by outlet/date.
- Dependencies: `useOutletConsumption.js`.

`FRONTENT/src/pages/Operations/OutletConsumption/AddPage.vue`
- Action: create.
- Purpose: create consumption with child items and negative stock movement.
- Dependencies: `useOutletConsumption.js`.

`FRONTENT/src/pages/Operations/OutletConsumption/ViewPage.vue`
- Action: create.
- Purpose: read-only consumption view with items and movements.
- Dependencies: `useOutletConsumption.js`.

`FRONTENT/src/pages/Operations/OutletStorages/IndexPage.vue`
- Action: create.
- Purpose: outlet stock list and outlet selector.
- Dependencies: `useOutletStock.js`.

`FRONTENT/src/pages/Operations/OutletStorages/ViewPage.vue`
- Action: create.
- Purpose: stock detail for a selected outlet or storage row.
- Dependencies: `useOutletStock.js`.

### Documentation
`Documents/MASTER_SHEET_STRUCTURE.md`
- Action: modify.
- Purpose: document `Outlets` and `OutletOperatingRules`.
- Dependencies: setup/resource metadata.

`Documents/OPERATION_SHEET_STRUCTURE.md`
- Action: modify.
- Purpose: document outlet operation resources and structural expectations.
- Dependencies: setup/resource metadata.

`Documents/RESOURCE_COLUMNS_GUIDE.md`
- Action: modify.
- Purpose: document outlet resource columns, progress action stamps, JSON semantics, and movement/storage source-of-truth rules.
- Dependencies: resource metadata.

`Documents/MODULE_WORKFLOWS.md`
- Action: modify.
- Purpose: add a new `Outlet & Field Sales Operations` workflow section.
- Dependencies: frontend/GAS workflow.

`Documents/CONTEXT_HANDOFF.md`
- Action: modify after implementation only.
- Purpose: record final state, validation, and manual sheet/menu actions.
- Dependencies: completed implementation.

## Sheet Schema Design

### Master: `Outlets`
- Scope: `master`.
- CodePrefix: `OUT`.
- CodeSequenceLength: `5`.
- Primary key: `Code`.
- Relationships: referenced by all outlet operation resources through `OutletCode`.
- Columns: `Code`, `Name`, `OutletType`, `CustomerName`, `ContactPerson`, `Phone`, `Email`, `Country`, `City`, `Area`, `Address`, `AssignedSalesUserCode`, `DefaultVisitFrequencyDays`, `CreditLimit`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `Name,OutletType,City,AssignedSalesUserCode`.
- Unique headers: `Name`.
- Defaults: `Status=Active`, `Country=UAE`, `DefaultVisitFrequencyDays=14`, `CreditLimit=0`.
- Example row: `OUT00001`, `Baby Corner Marina`, `Retail`, `Baby Corner LLC`, `Store Manager`, phone, email, `UAE`, `Dubai`, `Marina`, address, `USR00012`, `14`, `5000`, region, `Active`.

### Master: `OutletOperatingRules`
- Scope: `master`.
- CodePrefix: `OOR`.
- CodeSequenceLength: `5`.
- Primary key: `Code`.
- Relationships: child-like rule rows for `Outlets` through `OutletCode`.
- Columns: `Code`, `OutletCode`, `SKU`, `MinQty`, `MaxQty`, `MaxStockValueLimit`, `PreferredStorageName`, `VisitFrequencyDays`, `RestockLeadTimeDays`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,SKU`.
- Unique composite headers: `OutletCode+SKU`.
- Defaults: `Status=Active`, `MinQty=0`, `MaxQty=0`, `MaxStockValueLimit=0`, `RestockLeadTimeDays=0`.
- Example row: `OOR00001`, `OUT00001`, `SKU00007`, `2`, `10`, `1200`, `Shelf`, `14`, `2`, `Active`.

### Operation: `OutletVisits`
- Scope: `operation`.
- CodePrefix: `OV`.
- CodeSequenceLength: `6`.
- Primary key: `Code`.
- Relationships: references `Outlets.Code`.
- Columns: `Code`, `OutletCode`, `SalesUserCode`, `VisitDate`, `PlannedStartTime`, `PlannedEndTime`, `ActualStartTime`, `ActualEndTime`, `Progress`, `ProgressCompletedAt`, `ProgressCompletedBy`, `ProgressCompletedComment`, `ProgressPostponedAt`, `ProgressPostponedBy`, `ProgressPostponedComment`, `ProgressCancelledAt`, `ProgressCancelledBy`, `ProgressCancelledComment`, `PostponedFromVisitCode`, `NextVisitCode`, `Remarks`, `Status`, `AccessRegion`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,SalesUserCode,VisitDate,Progress,Status`.
- Defaults: `Progress=PLANNED`, `Status=Active`.
- Example row: `OV26000001`, `OUT00001`, `USR00012`, `2026-04-30`, `10:00`, `10:30`, blank, blank, `PLANNED`.

### Operation: `OutletRestocks`
- Scope: `operation`.
- CodePrefix: `ORS`.
- CodeSequenceLength: `6`.
- Primary key: `Code`.
- Relationships: parent for `OutletRestockItems`; references `Outlets.Code`; optional reference to `OutletVisits.Code`.
- Columns: `Code`, `OutletCode`, `OutletVisitCode`, `RequestDate`, `RequestedByUserCode`, `ApproverUserCode`, `Progress`, `ProgressSubmittedAt`, `ProgressSubmittedBy`, `ProgressSubmittedComment`, `ProgressRevisionRequiredAt`, `ProgressRevisionRequiredBy`, `ProgressRevisionRequiredComment`, `ProgressApprovedAt`, `ProgressApprovedBy`, `ProgressApprovedComment`, `ProgressRejectedAt`, `ProgressRejectedBy`, `ProgressRejectedComment`, `TotalRequestedQty`, `TotalApprovedQty`, `TotalDeliveredQty`, `Remarks`, `Status`, `AccessRegion`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,RequestDate,RequestedByUserCode,Progress,Status`.
- Defaults: `Progress=DRAFT`, `Status=Active`, totals `0`.
- Example row: `ORS26000001`, `OUT00001`, `OV26000001`, `2026-04-30`, `USR00012`, approver, `DRAFT`.

### Operation: `OutletRestockItems`
- Scope: `operation`.
- CodePrefix: `ORSI`.
- CodeSequenceLength: `7`.
- Primary key: `Code`.
- Relationships: child of `OutletRestocks` through `OutletRestockCode`; references `SKUs.Code`.
- Columns: `Code`, `OutletRestockCode`, `SKU`, `RequestedQty`, `ApprovedQty`, `DeliveredQty`, `Remarks`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletRestockCode,SKU,RequestedQty`.
- Unique composite headers: `OutletRestockCode+SKU`.
- Defaults: `RequestedQty=0`, `ApprovedQty=0`, `DeliveredQty=0`, `Status=Active`.
- Example row: `ORSI26000001`, `ORS26000001`, `SKU00007`, `5`, `4`, `0`, blank, `Active`.

### Operation: `OutletDeliveries`
- Scope: `operation`.
- CodePrefix: `ODL`.
- CodeSequenceLength: `6`.
- Primary key: `Code`.
- Relationships: references `OutletRestocks.Code` and `Outlets.Code`.
- Columns: `Code`, `OutletRestockCode`, `OutletCode`, `DeliveryDate`, `DeliveredByUserCode`, `DeliveredItemsJSON`, `Progress`, `ProgressConfirmedAt`, `ProgressConfirmedBy`, `ProgressConfirmedComment`, `Remarks`, `Status`, `AccessRegion`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletRestockCode,OutletCode,DeliveryDate,DeliveredItemsJSON,Progress,Status`.
- Defaults: `Progress=CONFIRMED`, `Status=Active`.
- Example row: `ODL26000001`, `ORS26000001`, `OUT00001`, `2026-05-01`, `USR00018`, JSON array with SKU/qty pairs, `CONFIRMED`.

### Operation: `OutletConsumption`
- Scope: `operation`.
- CodePrefix: `OCN`.
- CodeSequenceLength: `6`.
- Primary key: `Code`.
- Relationships: parent for `OutletConsumptionItems`; references `Outlets.Code`; optional reference to `OutletVisits.Code`.
- Columns: `Code`, `OutletCode`, `OutletVisitCode`, `ConsumptionDate`, `RecordedByUserCode`, `Progress`, `Remarks`, `Status`, `AccessRegion`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,ConsumptionDate,RecordedByUserCode,Progress,Status`.
- Defaults: `Progress=CONFIRMED`, `Status=Active`.
- Example row: `OCN26000001`, `OUT00001`, blank, `2026-05-02`, `USR00012`, `CONFIRMED`.

### Operation: `OutletConsumptionItems`
- Scope: `operation`.
- CodePrefix: `OCNI`.
- CodeSequenceLength: `7`.
- Primary key: `Code`.
- Relationships: child of `OutletConsumption` through `OutletConsumptionCode`; references `SKUs.Code`.
- Columns: `Code`, `OutletConsumptionCode`, `SKU`, `ConsumedQty`, `Remarks`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletConsumptionCode,SKU,ConsumedQty`.
- Unique composite headers: `OutletConsumptionCode+SKU`.
- Defaults: `ConsumedQty=0`, `Status=Active`.
- Example row: `OCNI26000001`, `OCN26000001`, `SKU00007`, `2`, blank, `Active`.

### Operation: `OutletMovements`
- Scope: `operation`.
- CodePrefix: `OMV`.
- CodeSequenceLength: `7`.
- Primary key: `Code`.
- Relationships: references `Outlets.Code`, `SKUs.Code`, and source documents through `ReferenceType`/`ReferenceCode`.
- Columns: `Code`, `OutletCode`, `StorageName`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode`, `ReferenceItemCode`, `MovementDate`, `Status`, `AccessRegion`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,SKU,QtyChange,ReferenceType,ReferenceCode`.
- Defaults: `StorageName=_default`, `QtyChange=0`, `Status=Active`.
- Example row: `OMV26000001`, `OUT00001`, `_default`, `SKU00007`, `4`, `RestockDelivery`, `ODL26000001`, `ORSI26000001`, `2026-05-01`.

### Operation: `OutletStorages`
- Scope: `operation`.
- CodePrefix: `OST`.
- CodeSequenceLength: `7`.
- Primary key: `Code`.
- Relationships: derived by `OutletMovements`; references `Outlets.Code` and `SKUs.Code`.
- Columns: `Code`, `OutletCode`, `StorageName`, `SKU`, `Quantity`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- Required headers: `OutletCode,StorageName,SKU,Quantity`.
- Unique composite headers: `OutletCode+StorageName+SKU`.
- Defaults: `StorageName=_default`, `Quantity=0`.
- Example row: `OST26000001`, `OUT00001`, `_default`, `SKU00007`, `2`.

## Status Definitions

### `OutletVisits.Progress`
- `PLANNED`: visit scheduled and not yet performed.
- `COMPLETED`: visit completed; no further status action allowed.
- `POSTPONED`: original visit was moved; `NextVisitCode` must point to the new planned visit.
- `CANCELLED`: visit will not happen; cancellation reason required.
- Transitions: `PLANNED -> COMPLETED`, `PLANNED -> POSTPONED`, `PLANNED -> CANCELLED`.
- No transition out of `COMPLETED`, `POSTPONED`, or `CANCELLED`.

### `OutletRestocks.Progress`
- `DRAFT`: SE can edit restock parent/items.
- `PENDING_APPROVAL`: submitted and locked from direct editing.
- `REVISION_REQUIRED`: approver sent back; SE can revise same document and resubmit.
- `APPROVED`: approved for delivery; `ApprovedQty` is locked.
- `PARTIALLY_DELIVERED`: at least one delivery posted but cumulative delivered is below approved total.
- `DELIVERED`: cumulative delivered quantity equals approved quantity for all active items.
- `REJECTED`: restock closed without delivery.
- Transitions: `DRAFT -> PENDING_APPROVAL`, `REVISION_REQUIRED -> PENDING_APPROVAL`, `PENDING_APPROVAL -> APPROVED`, `PENDING_APPROVAL -> REJECTED`, `PENDING_APPROVAL -> REVISION_REQUIRED`, `APPROVED -> PARTIALLY_DELIVERED`, `PARTIALLY_DELIVERED -> DELIVERED`.
- `APPROVED` remains approved until first partial delivery. A full first delivery may move directly to `DELIVERED`.

### `OutletDeliveries.Progress`
- `CONFIRMED`: delivery event is posted and movement rows were created.
- No draft delivery state in this phase. If delivery correction is needed, create a compensating delivery or movement in a later approved plan.

### `OutletConsumption.Progress`
- `CONFIRMED`: consumption event is posted and negative movement rows were created.
- No draft consumption state in this phase.

## Workflow Definitions

Visit lifecycle:
- Create planned visit with `OutletCode`, `SalesUserCode`, date/time, `Progress=PLANNED`.
- Complete visit by executing `Complete`; require actual start/end or completion comment.
- Postpone visit by collecting reason and new visit date; batch actions must update original visit to `POSTPONED`, create new `OutletVisits` row with `PostponedFromVisitCode`, then update original `NextVisitCode` with the new code if code is available from response.
- Cancel visit by executing `Cancel`; require comment.

Restock lifecycle:
- SE creates or edits `OutletRestocks` in `DRAFT` or `REVISION_REQUIRED` with `OutletRestockItems`.
- Submit uses `executeAction` to set `Progress=PENDING_APPROVAL`; submitted document becomes locked.
- Approver review page allows only `Approve`, `Reject`, or `SendBack`.
- `Approve` requires each active item to have `ApprovedQty >= 0` and no `ApprovedQty > RequestedQty` unless the UI warns and requires explicit confirmation.
- `Reject` requires comment and sets `Progress=REJECTED`.
- `SendBack` requires comment and sets `Progress=REVISION_REQUIRED`.
- Revision edits the same parent and item rows; do not create a replacement restock row.

Delivery lifecycle:
- User selects an eligible `OutletRestocks` record with `Progress=APPROVED` or `PARTIALLY_DELIVERED`.
- UI shows active `OutletRestockItems` and computes remaining quantity as `ApprovedQty - DeliveredQty`.
- User enters delivery quantities per SKU. Quantities must be positive and cannot exceed remaining.
- Save runs one batch: create `OutletDeliveries`, update matching `OutletRestockItems.DeliveredQty`, create positive `OutletMovements`, update `OutletRestocks.Progress` and totals, then refresh resources.
- `DeliveredItemsJSON` contains only delivered SKU/qty pairs for that event.
- Delivery JSON is never used as the cumulative source of truth.

Consumption lifecycle:
- User creates consumption anytime for an outlet.
- UI shows current stock from `OutletStorages`.
- User enters consumed quantities per SKU.
- Quantities must be positive and must not exceed current outlet stock for the same outlet/storage/SKU.
- Save runs one batch: create `OutletConsumption` with `OutletConsumptionItems`, create negative `OutletMovements`, then refresh resources.

Stock movement lifecycle:
- Restock delivery creates positive `OutletMovements` with `ReferenceType=RestockDelivery`.
- Consumption creates negative `OutletMovements` with `ReferenceType=Consumption`.
- `OutletMovements` post-write hook updates `OutletStorages.Quantity`.
- `OutletStorages` is never edited directly by frontend pages.

## Validation Rules
- `OutletRestockItems.RequestedQty` must be greater than `0` before submit.
- `OutletRestockItems.ApprovedQty` must be `0` or more.
- Delivery quantity must be greater than `0`.
- Delivery quantity must not exceed `ApprovedQty - DeliveredQty`.
- `OutletRestockItems.DeliveredQty` must never exceed `ApprovedQty`.
- Consumption quantity must be greater than `0`.
- Consumption quantity must not exceed matching `OutletStorages.Quantity`.
- `MaxStockValueLimit` warning: for each outlet/SKU, calculate projected quantity after restock delivery multiplied by SKU value if a usable SKU/product value exists. If no value field exists, skip this warning and record the limitation in docs. If limit is exceeded, warn user and require confirmation before submit.
- Duplicate restock warning: warn when the same outlet has another active restock in `DRAFT`, `PENDING_APPROVAL`, `REVISION_REQUIRED`, `APPROVED`, or `PARTIALLY_DELIVERED` containing the same SKU.
- No submit from `DRAFT` or `REVISION_REQUIRED` with zero active items.
- No approval if all item `ApprovedQty` values are `0`.
- No delivery for `REJECTED` or `DELIVERED` restocks.
- No direct edit after `PENDING_APPROVAL`, `APPROVED`, `PARTIALLY_DELIVERED`, `DELIVERED`, or `REJECTED`.

## Stock Movement Logic
- Movement resource: `OutletMovements`.
- Balance resource: `OutletStorages`.
- Balance key: `OutletCode + StorageName + SKU`.
- Default storage: `_default`.
- Positive movement: restock delivery.
- Negative movement: consumption.
- Movement rows are append-only active ledger rows.
- Hook upsert rule: if storage key exists, add `QtyChange` to existing `Quantity`; otherwise create a new storage row with `Quantity=QtyChange`.
- Negative final balances are not allowed from frontend validation. The GAS hook should still log if a movement would make quantity negative, but it must not throw unless existing stock hook conventions already throw.
- After hook writes `OutletStorages`, update the `OutletStorages` sync cursor.

## GAS API Design
- Use generic `get` for bulk loading resources.
- Use `compositeSave` for parent-child saves: `OutletRestocks` + `OutletRestockItems`, `OutletConsumption` + `OutletConsumptionItems`.
- Use `bulk` for multiple `OutletMovements` and multiple item updates.
- Use `executeAction` for visit and restock workflow transitions.
- Use `batch` to combine multi-step workflows and refresh reads.
- Do not add custom API dispatcher actions.
- Do not require `scope` in frontend payloads.
- Use nested write payloads only.

## UI/UX Flow
- Menus:
- `Field Sales > Outlet Visits` route `/operations/outlet-visits`.
- `Field Sales > Outlet Restocks` route `/operations/outlet-restocks`.
- `Field Sales > Outlet Deliveries` route `/operations/outlet-deliveries`.
- `Field Sales > Outlet Consumption` route `/operations/outlet-consumption`.
- `Field Sales > Outlet Stock` route `/operations/outlet-storages`.
- `Masters > Outlets` route `/masters/outlets`.
- `Masters > Outlet Rules` route `/masters/outlet-operating-rules`.

Page behavior:
- Index pages show dense operational lists with filters and progress chips.
- Add pages use Quasar forms and editable grids.
- View pages show header, status, item grid, totals, movement timeline when relevant, and action buttons.
- Use icons from Quasar material icons.
- Do not create marketing-style hero pages.
- Do not expose JSON fields directly to users; delivery JSON may be shown only as a readable item table.

## Function-By-Function Plan

### GAS Constants And Setup
`CONFIG.MASTER_SHEETS.OUTLETS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `Outlets`.
- Inputs: none.
- Outputs: string `Outlets`.
- Side effects: none.
- Error handling: none.
- Edge cases: spelling must match resource name exactly.
- Order: 1.
- Connects to: master setup and resource sync.

`CONFIG.MASTER_SHEETS.OUTLET_OPERATING_RULES`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletOperatingRules`.
- Inputs: none.
- Outputs: string `OutletOperatingRules`.
- Side effects: none.
- Error handling: none.
- Edge cases: do not call it `OutletRules`.
- Order: 1.
- Connects to: master setup and resource sync.

`CONFIG.OPERATION_SHEETS.OUTLET_VISITS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletVisits`.
- Inputs: none.
- Outputs: string `OutletVisits`.
- Side effects: none.
- Error handling: none.
- Edge cases: spelling must match page folder `OutletVisits`.
- Order: 1.
- Connects to: operation setup and resource sync.

`CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletRestocks`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: do not use `OutletRestockRequests`.
- Order: 1.
- Connects to: restock pages/composables.

`CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletRestockItems`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: parent field must be `OutletRestockCode`.
- Order: 1.
- Connects to: compositeSave child records.

`CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletDeliveries`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: delivery items are JSON, no child delivery item sheet.
- Order: 1.
- Connects to: delivery pages.

`CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletConsumption`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: singular resource name is intentional per approved scope.
- Order: 1.
- Connects to: consumption pages.

`CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletConsumptionItems`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: parent field must be `OutletConsumptionCode`.
- Order: 1.
- Connects to: compositeSave child records.

`CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletMovements`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: keep separate from `StockMovements`.
- Order: 1.
- Connects to: movement hook.

`CONFIG.OPERATION_SHEETS.OUTLET_STORAGES`
- File: `GAS/Constants.gs`.
- Purpose: sheet constant for `OutletStorages`.
- Inputs/outputs/side effects/error handling: same as other constants.
- Edge cases: keep separate from `WarehouseStorages`.
- Order: 1.
- Connects to: movement hook and stock pages.

`APP_OPTIONS_SEED.OutletVisitProgress`
- File: `GAS/Constants.gs`.
- Purpose: dropdown values for visit progress.
- Inputs: none.
- Outputs: `PLANNED`, `COMPLETED`, `POSTPONED`, `CANCELLED`.
- Side effects: AppOptions seed.
- Error handling: none.
- Edge cases: values must match `executeAction.columnValue`.
- Order: 2.
- Connects to: setup validation and UI labels.

`APP_OPTIONS_SEED.OutletRestockProgress`
- File: `GAS/Constants.gs`.
- Purpose: dropdown values for restock progress.
- Inputs: none.
- Outputs: `DRAFT`, `PENDING_APPROVAL`, `REVISION_REQUIRED`, `APPROVED`, `PARTIALLY_DELIVERED`, `DELIVERED`, `REJECTED`.
- Side effects: AppOptions seed.
- Error handling: none.
- Edge cases: `PENDING_APPROVAL` uses underscore naming; action audit columns must use PascalCase stamp names.
- Order: 2.
- Connects to: setup validation and UI.

`APP_OPTIONS_SEED.OutletMovementReferenceType`
- File: `GAS/Constants.gs`.
- Purpose: dropdown values for movement references.
- Inputs: none.
- Outputs: `RestockDelivery`, `Consumption`, `Adjustment`.
- Side effects: AppOptions seed.
- Error handling: none.
- Edge cases: `Adjustment` is reserved for future/manual corrections; do not implement adjustment UI in this plan.
- Order: 2.
- Connects to: setup validation and movement hook.

`setupMasterSheets`
- File: `GAS/setupMasterSheets.gs`.
- Purpose: add master schemas.
- Inputs: `CONFIG.MASTER_SHEETS`.
- Outputs: setup entries for `Outlets`, `OutletOperatingRules`.
- Side effects: creates/normalizes sheets.
- Error handling: existing setup try/catch.
- Edge cases: do not remove existing master schemas.
- Order: 3.
- Connects to: resource metadata.

`setupOperationSheets`
- File: `GAS/setupOperationSheets.gs`.
- Purpose: add operation schemas.
- Inputs: `CONFIG.OPERATION_SHEETS`, `APP_OPTIONS_SEED`.
- Outputs: setup entries for eight outlet operation resources.
- Side effects: creates/normalizes sheets.
- Error handling: existing setup try/catch.
- Edge cases: do not alter warehouse stock resources.
- Order: 4.
- Connects to: resource metadata.

`getDefaultResources`
- File: `GAS/syncAppResources.gs`.
- Purpose: add resource config objects.
- Inputs: constants.
- Outputs: resource rows synced to `APP.Resources`.
- Side effects: menu/auth/runtime metadata changes after sync.
- Error handling: existing sync behavior.
- Edge cases: every `AdditionalActions` state must have matching progress audit columns in setup.
- Order: 5.
- Connects to: frontend routing and GAS generic API.

### GAS Outlet Movement Hook
`handleOutletMovementsBulkSave_afterBulk`
- File: `GAS/outletMovements.gs`.
- Purpose: update `OutletStorages` after bulk `OutletMovements` writes.
- Inputs: postAction args `payload`, `result`, `auth`, `action`, `meta`, `resourceName`.
- Outputs: original `result`.
- Side effects: calls `applyBatchOutletMovementsToOutletStorages`.
- Error handling: catch/log and return original result.
- Edge cases: ignore failed result, missing saved records, inactive records, missing outlet/SKU.
- Order: 6.
- Connects to: `OutletMovements.PostAction`.

`handleOutletMovementsBulkSave_afterCreate`
- File: `GAS/outletMovements.gs`.
- Purpose: update `OutletStorages` after single `OutletMovements` create.
- Inputs: postAction args.
- Outputs: original `result`.
- Side effects: calls `applyOutletMovementToOutletStorages`.
- Error handling: catch/log and return original result.
- Edge cases: same as bulk.
- Order: 6.
- Connects to: generic create path.

`applyOutletMovementToOutletStorages`
- File: `GAS/outletMovements.gs`.
- Purpose: upsert one outlet storage balance.
- Inputs: movement record and auth.
- Outputs: none.
- Side effects: creates or updates one `OutletStorages` row and updates sync cursor.
- Error handling: log invalid inputs; catch/log unexpected errors.
- Edge cases: blank `StorageName` becomes `_default`; `QtyChange=0` is skipped.
- Order: 7.
- Connects to: single create hook.

`applyBatchOutletMovementsToOutletStorages`
- File: `GAS/outletMovements.gs`.
- Purpose: aggregate multiple movements by `OutletCode|StorageName|SKU` and upsert balances efficiently.
- Inputs: array of movement records and auth.
- Outputs: none.
- Side effects: writes `OutletStorages` rows and updates sync cursor once.
- Error handling: catch/log; skip malformed rows.
- Edge cases: multiple movements for same key in one batch must net together.
- Order: 7.
- Connects to: bulk hook.

`normalizeOutletStorageName`
- File: `GAS/outletMovements.gs`.
- Purpose: normalize blank storage names.
- Inputs: any value.
- Outputs: trimmed storage string or `_default`.
- Side effects: none.
- Error handling: none.
- Edge cases: whitespace-only becomes `_default`.
- Order: 7.
- Connects to: storage upsert helpers.

### Frontend Helper Functions
`OUTLET_OPERATION_RESOURCES`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`.
- Purpose: array of resources to refresh for outlet workflows.
- Inputs: none.
- Outputs: resource name array.
- Side effects: none.
- Error handling: none.
- Edge cases: include `Outlets`, `OutletOperatingRules`, `SKUs`, `Products`, and all outlet operation resources.
- Order: 8.
- Connects to: refresh requests.

`progressMeta`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`.
- Purpose: labels/colors/order for outlet statuses.
- Inputs: progress string.
- Outputs: display metadata.
- Side effects: none.
- Error handling: return neutral fallback for unknown values.
- Edge cases: uppercase progress values.
- Order: 8.
- Connects to: progress chips/pages.

`refreshOutletResourcesRequest`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`.
- Purpose: build a `get` request for outlet resources.
- Inputs: optional resource array.
- Outputs: batch sub-request.
- Side effects: none.
- Error handling: filter blank resource names.
- Edge cases: default to `OUTLET_OPERATION_RESOURCES`.
- Order: 9.
- Connects to: all save workflows.

`compositeSaveRequest`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`.
- Purpose: build a generic composite save sub-request.
- Inputs: `{ resource, code, data, children }`.
- Outputs: batch sub-request.
- Side effects: none.
- Error handling: omit code for create.
- Edge cases: children default to empty array.
- Order: 9.
- Connects to: restock/consumption saves.

`resourceBulkRequest`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`.
- Purpose: build bulk sub-request.
- Inputs: resource name and records.
- Outputs: batch sub-request.
- Side effects: none.
- Error handling: caller must pass non-empty records.
- Edge cases: records with `Code` update, records without `Code` create.
- Order: 9.
- Connects to: movements and item DeliveredQty updates.

`resourceUpdateRequest`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`.
- Purpose: build update sub-request.
- Inputs: resource, code, data.
- Outputs: batch sub-request.
- Side effects: none.
- Error handling: caller validates code.
- Edge cases: use nested `payload.data` to match current local pattern.
- Order: 9.
- Connects to: totals/progress updates.

`executeActionRequest`
- File: `FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js`.
- Purpose: build workflow transition request.
- Inputs: resource, code, action config, fields.
- Outputs: batch sub-request.
- Side effects: none.
- Error handling: caller validates action.
- Edge cases: action config values must match `APP.Resources.AdditionalActions`.
- Order: 9.
- Connects to: visits/restocks.

`toNumber`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: safe numeric conversion.
- Inputs: any value.
- Outputs: finite number or `0`.
- Side effects: none.
- Error handling: invalid becomes `0`.
- Edge cases: blank strings.
- Order: 10.
- Connects to: all calculations.

`remainingDeliveryQty`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: compute `ApprovedQty - DeliveredQty`.
- Inputs: restock item row.
- Outputs: non-negative number.
- Side effects: none.
- Error handling: invalid values become `0`.
- Edge cases: delivered greater than approved returns `0` and should be flagged by validator.
- Order: 10.
- Connects to: delivery validation.

`currentOutletStockQty`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: find current balance for outlet/storage/SKU.
- Inputs: storages array, outlet code, storage name, SKU.
- Outputs: quantity.
- Side effects: none.
- Error handling: missing row returns `0`.
- Edge cases: blank storage uses `_default`.
- Order: 10.
- Connects to: consumption validation.

`validateRestockDraft`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: validate restock before submit.
- Inputs: parent form, item rows, existing restocks/items/rules.
- Outputs: `{ valid, errors, warnings }`.
- Side effects: none.
- Error handling: collect errors instead of throwing.
- Edge cases: duplicate SKU rows, zero requested quantities, duplicate active restock warning.
- Order: 10.
- Connects to: `useOutletRestocks.submitRestock`.

`validateRestockApproval`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: validate approver quantities.
- Inputs: restock, items.
- Outputs: `{ valid, errors, warnings }`.
- Side effects: none.
- Error handling: collect errors.
- Edge cases: all approved zero invalid.
- Order: 10.
- Connects to: `useOutletRestocks.approveRestock`.

`validateDelivery`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: validate delivery quantities against remaining approved quantities.
- Inputs: restock, restock items, delivery rows.
- Outputs: `{ valid, errors, warnings }`.
- Side effects: none.
- Error handling: collect errors.
- Edge cases: no positive rows, overdelivery, delivered already complete.
- Order: 10.
- Connects to: `useOutletDeliveries.saveDelivery`.

`validateConsumption`
- File: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`.
- Purpose: validate consumption quantities against outlet stock.
- Inputs: outlet, consumption rows, outlet storages.
- Outputs: `{ valid, errors, warnings }`.
- Side effects: none.
- Error handling: collect errors.
- Edge cases: no stock row, insufficient stock, duplicate SKU rows.
- Order: 10.
- Connects to: `useOutletConsumption.saveConsumption`.

`buildRestockCompositePayload`
- File: `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`.
- Purpose: construct `OutletRestocks` composite save payload.
- Inputs: parent form, item rows, optional existing restock code.
- Outputs: composite payload object.
- Side effects: none.
- Error handling: caller validates first.
- Edge cases: inactive/deleted item rows use `_action=deactivate`; existing rows use `_action=update`; new rows use `_action=create`.
- Order: 11.
- Connects to: restock save.

`buildDeliveryBatchRequests`
- File: `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`.
- Purpose: construct full delivery batch.
- Inputs: restock, restock items, delivery form, delivery rows.
- Outputs: ordered batch sub-requests.
- Side effects: none.
- Error handling: caller validates first.
- Edge cases: update `DeliveredQty` cumulatively; set restock progress to `PARTIALLY_DELIVERED` or `DELIVERED`; create positive movements.
- Order: 11.
- Connects to: delivery save.

`buildConsumptionCompositePayload`
- File: `FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`.
- Purpose: construct `OutletConsumption` composite save payload.
- Inputs: parent form and item rows.
- Outputs: composite payload object.
- Side effects: none.
- Error handling: caller validates first.
- Edge cases: child field must be `OutletConsumptionCode`.
- Order: 11.
- Connects to: consumption save.

`buildConsumptionMovementRequests`
- File: `FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`.
- Purpose: construct negative movement bulk request after consumption save.
- Inputs: consumption code, outlet code, consumption items.
- Outputs: bulk movement request.
- Side effects: none.
- Error handling: caller validates first.
- Edge cases: negative `QtyChange`; reference type `Consumption`.
- Order: 11.
- Connects to: consumption save batch.

### Frontend Workflow Composables
`useOutletVisits`
- File: `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`.
- Purpose: load visits/outlets and execute visit transitions.
- Inputs: route/resource context from composables.
- Outputs: reactive records, filters, selected record, action handlers.
- Side effects: calls workflow store actions and navigates through `useResourceNav`.
- Error handling: return errors to UI and notify through existing store/service behavior where available.
- Edge cases: postponed visit must create new visit row.
- Order: 12.
- Connects to: OutletVisits pages.

`completeVisit`
- File: `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`.
- Purpose: complete a planned visit.
- Inputs: visit row and form fields.
- Outputs: workflow response.
- Side effects: `executeAction` to `COMPLETED`.
- Error handling: block non-planned visits.
- Edge cases: actual end before start invalid.
- Order: 12.
- Connects to: visit view action.

`postponeVisit`
- File: `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`.
- Purpose: postpone original visit and create replacement planned visit.
- Inputs: original visit, reason, new date/time.
- Outputs: batch response.
- Side effects: update original, create new visit, refresh.
- Error handling: block missing reason/date.
- Edge cases: if new code cannot be patched into `NextVisitCode`, still refresh and show warning.
- Order: 12.
- Connects to: visit view action.

`cancelVisit`
- File: `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`.
- Purpose: cancel planned visit.
- Inputs: visit and reason.
- Outputs: action response.
- Side effects: `executeAction` to `CANCELLED`.
- Error handling: require reason.
- Edge cases: no cancellation after completed.
- Order: 12.
- Connects to: visit view action.

`useOutletRestocks`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: restock list/create/edit/review logic.
- Inputs: route/resource context.
- Outputs: records, items, forms, validation state, action handlers.
- Side effects: composite saves, execute actions, batch refreshes.
- Error handling: expose validation errors and API failures.
- Edge cases: same document revision after send back.
- Order: 13.
- Connects to: OutletRestocks pages.

`saveRestockDraft`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: save draft or revision using composite save.
- Inputs: form, item rows.
- Outputs: parent code.
- Side effects: writes parent/children.
- Error handling: block invalid item rows.
- Edge cases: keep `Progress=DRAFT` or `REVISION_REQUIRED`; do not auto-submit.
- Order: 13.
- Connects to: restock add/view editable mode.

`submitRestock`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: submit saved restock to approval.
- Inputs: restock code.
- Outputs: action response.
- Side effects: `executeAction` to `PENDING_APPROVAL`.
- Error handling: block unsaved/invalid draft.
- Edge cases: include submit comment if user entered one.
- Order: 13.
- Connects to: restock editable mode.

`approveRestock`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: approve restock with approved quantities.
- Inputs: restock and approved item rows.
- Outputs: batch response.
- Side effects: bulk update item `ApprovedQty`, update parent totals, execute approve action.
- Error handling: validate before batch.
- Edge cases: item updates must occur before approve action.
- Order: 13.
- Connects to: approver view.

`rejectRestock`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: reject pending restock.
- Inputs: restock and comment.
- Outputs: action response.
- Side effects: `executeAction` to `REJECTED`.
- Error handling: require comment.
- Edge cases: no item changes.
- Order: 13.
- Connects to: approver view.

`sendBackRestock`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: request revision on same restock.
- Inputs: restock and comment.
- Outputs: action response.
- Side effects: `executeAction` to `REVISION_REQUIRED`.
- Error handling: require comment.
- Edge cases: same document remains editable after action.
- Order: 13.
- Connects to: approver view.

`resolveRestockViewMode`
- File: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Purpose: choose editable/review/read-only mode.
- Inputs: progress.
- Outputs: `editable`, `review`, or `readonly`.
- Side effects: none.
- Error handling: unknown progress returns `readonly`.
- Edge cases: `DRAFT` and `REVISION_REQUIRED` editable; `PENDING_APPROVAL` review.
- Order: 13.
- Connects to: `OutletRestocks/ViewPage.vue`.

`useOutletDeliveries`
- File: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`.
- Purpose: delivery create/list/view logic.
- Inputs: route/resource context.
- Outputs: eligible restocks, delivery rows, validation state, action handlers.
- Side effects: batch delivery save.
- Error handling: expose validation/API failures.
- Edge cases: partial deliveries, multiple deliveries per restock.
- Order: 14.
- Connects to: OutletDeliveries pages.

`saveDelivery`
- File: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`.
- Purpose: create delivery, update cumulative item quantities, create movements, refresh.
- Inputs: selected restock, delivery form, delivery rows.
- Outputs: delivery code if available.
- Side effects: batch write.
- Error handling: block invalid delivery.
- Edge cases: direct move to `DELIVERED` if all remaining delivered.
- Order: 14.
- Connects to: delivery add page.

`useOutletConsumption`
- File: `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`.
- Purpose: consumption create/list/view logic.
- Inputs: route/resource context.
- Outputs: consumption records, stock rows, forms, action handlers.
- Side effects: composite save, movement bulk, refresh.
- Error handling: block insufficient stock.
- Edge cases: independent of visits; optional visit link.
- Order: 15.
- Connects to: OutletConsumption pages.

`saveConsumption`
- File: `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`.
- Purpose: create consumption and negative movements in one batch.
- Inputs: form and item rows.
- Outputs: consumption code if available.
- Side effects: batch write.
- Error handling: block invalid/insufficient quantities.
- Edge cases: if consumption composite returns parent code, use it in movement references; otherwise block movement creation and show failure.
- Order: 15.
- Connects to: consumption add page.

`useOutletStock`
- File: `FRONTENT/src/composables/operations/outlets/useOutletStock.js`.
- Purpose: current outlet stock and movement detail view-model.
- Inputs: optional outlet code or storage code from route.
- Outputs: stock rows, grouped totals, movement timeline, navigation helpers.
- Side effects: loads resources and navigates through `useResourceNav`.
- Error handling: empty state for no stock.
- Edge cases: hide zero rows only if filter says so; default must show all non-zero active rows.
- Order: 16.
- Connects to: OutletStorages pages.

## Resource Metadata Plan
- `Outlets`: master, visible menu under `Masters`, no additional actions, `RecordAccessPolicy=ALL`, `OwnerUserField=CreatedBy`, `IncludeInAuthorizationPayload=TRUE`.
- `OutletOperatingRules`: master, visible menu under `Masters`, no additional actions, `RecordAccessPolicy=ALL`.
- `OutletVisits`: operation, visible menu under `Field Sales`, actions `Complete`, `Postpone`, `Cancel`, `RecordAccessPolicy=OWNER_AND_UPLINE`, owner `CreatedBy`.
- `OutletRestocks`: operation, visible menu under `Field Sales`, actions `Submit`, `Approve`, `Reject`, `SendBack`, parent none, `RecordAccessPolicy=OWNER_AND_UPLINE`.
- `OutletRestockItems`: operation child of `OutletRestocks`, hidden menu, no actions.
- `OutletDeliveries`: operation, visible menu under `Field Sales`, no additional actions, `RecordAccessPolicy=OWNER_AND_UPLINE`.
- `OutletConsumption`: operation, visible menu under `Field Sales`, no additional actions, `RecordAccessPolicy=OWNER_AND_UPLINE`.
- `OutletConsumptionItems`: operation child of `OutletConsumption`, hidden menu, no actions.
- `OutletMovements`: operation, hidden or low-priority menu under `Field Sales > Outlet Stock`, `PostAction=handleOutletMovementsBulkSave`.
- `OutletStorages`: operation, visible menu under `Field Sales`, no actions, read-only by UI convention.

AdditionalActions exact configs:
- `OutletVisits.Complete`: action `Complete`, kind `mutate`, column `Progress`, columnValue `COMPLETED`, visible when `Progress=PLANNED`, optional `Comment`.
- `OutletVisits.Postpone`: action `Postpone`, kind `mutate`, column `Progress`, columnValue `POSTPONED`, visible when `Progress=PLANNED`, required `Comment`.
- `OutletVisits.Cancel`: action `Cancel`, kind `mutate`, column `Progress`, columnValue `CANCELLED`, visible when `Progress=PLANNED`, required `Comment`.
- `OutletRestocks.Submit`: action `Submit`, kind `mutate`, column `Progress`, columnValue `PENDING_APPROVAL`, visible when `Progress` in `DRAFT,REVISION_REQUIRED`, optional `Comment`.
- `OutletRestocks.Approve`: action `Approve`, kind `mutate`, column `Progress`, columnValue `APPROVED`, visible when `Progress=PENDING_APPROVAL`, optional `Comment`.
- `OutletRestocks.Reject`: action `Reject`, kind `mutate`, column `Progress`, columnValue `REJECTED`, visible when `Progress=PENDING_APPROVAL`, required `Comment`.
- `OutletRestocks.SendBack`: action `SendBack`, label `Send Back`, kind `mutate`, column `Progress`, columnValue `REVISION_REQUIRED`, visible when `Progress=PENDING_APPROVAL`, required `Comment`.

Progress audit columns required:
- For `OutletVisits`: `ProgressCompletedAt`, `ProgressCompletedBy`, `ProgressCompletedComment`, `ProgressPostponedAt`, `ProgressPostponedBy`, `ProgressPostponedComment`, `ProgressCancelledAt`, `ProgressCancelledBy`, `ProgressCancelledComment`.
- For `OutletRestocks`: `ProgressSubmittedAt`, `ProgressSubmittedBy`, `ProgressSubmittedComment`, `ProgressApprovedAt`, `ProgressApprovedBy`, `ProgressApprovedComment`, `ProgressRejectedAt`, `ProgressRejectedBy`, `ProgressRejectedComment`, `ProgressRevisionRequiredAt`, `ProgressRevisionRequiredBy`, `ProgressRevisionRequiredComment`.

## Execution Steps

1. Inspect before editing.
- File to open: `Documents/ARCHITECTURE RULES.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, this plan.
- Change to make: none.
- Where: read relevant rules fully.
- Avoid changing: all files.
- Command after step: `git status --short`.
- Expected result: current worktree status is known.

2. Update constants and app options.
- File to open: `GAS/Constants.gs`.
- Change to make: add all master and operation constants listed in Function Plan; add `OutletVisitProgress`, `OutletRestockProgress`, and `OutletMovementReferenceType` to `APP_OPTIONS_SEED`.
- Where: add master constants beside existing master sheet constants; add operation constants beside existing operation constants; add option groups near related progress/reference groups.
- Avoid changing: existing constants and existing option values.
- Command after step: none.
- Expected result: all new resource names are centrally defined.

3. Add master sheet schemas.
- File to open: `GAS/setupMasterSheets.gs`.
- Change to make: add schema entries for `Outlets` and `OutletOperatingRules` exactly as listed in Sheet Schema Design.
- Where: in `schemaByResource`, after `Warehouses` or after `UOMs`; choose after `Warehouses` if preserving business grouping, otherwise after `UOMs`. Do not create a second `schemaByResource`.
- Avoid changing: existing master schemas and setup helper calls.
- Command after step: none.
- Expected result: master setup can create/normalize both outlet master sheets.

4. Add operation sheet schemas.
- File to open: `GAS/setupOperationSheets.gs`.
- Change to make: add schema entries for `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletDeliveries`, `OutletConsumption`, `OutletConsumptionItems`, `OutletMovements`, and `OutletStorages`.
- Where: in `schemaByResource`, after `WarehouseStorages` or before stock resources as a grouped outlet section. Keep all outlet resources contiguous.
- Avoid changing: procurement, GRN, warehouse stock schemas.
- Command after step: none.
- Expected result: operation setup can create/normalize all outlet operation sheets.

5. Add resource metadata.
- File to open: `GAS/syncAppResources.gs`.
- Change to make: add resource config objects for all ten new resources following Resource Metadata Plan.
- Where: master resources near other masters; operation resources near other operation inventory/field-sales resources. Keep outlet operation resources contiguous.
- Avoid changing: sync implementation functions below the resource array.
- Command after step: none.
- Expected result: resource sync can add/update all metadata and menus.

6. Create outlet movement hook.
- File to open: create `GAS/outletMovements.gs`.
- Change to make: implement only the hook/helper functions listed in GAS Outlet Movement Hook.
- Where: entire new file.
- Avoid changing: `GAS/resourceApi.gs`; existing postAction dispatcher already supports hooks.
- Command after step: none.
- Expected result: `OutletMovements` postAction can maintain `OutletStorages`.

7. Create frontend outlet helper composables.
- File to open: create `outletOperationsMeta.js`, `outletOperationsBatch.js`, `outletStockLogic.js`, `outletRestockPayload.js`, `outletConsumptionPayload.js` under `FRONTENT/src/composables/operations/outlets/`.
- Change to make: implement the helper functions exactly listed in Function Plan.
- Where: new folder `outlets`.
- Avoid changing: services or stores.
- Command after step: none.
- Expected result: all reusable business logic and request construction exists outside pages/components.

8. Create visit composable.
- File to open: `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`.
- Change to make: implement `useOutletVisits`, `completeVisit`, `postponeVisit`, and `cancelVisit`.
- Where: new file.
- Avoid changing: router files; use `useResourceNav`.
- Command after step: none.
- Expected result: visit pages can load and mutate visits without direct store/service imports.

9. Create restock composable.
- File to open: `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`.
- Change to make: implement `useOutletRestocks`, `saveRestockDraft`, `submitRestock`, `approveRestock`, `rejectRestock`, `sendBackRestock`, and `resolveRestockViewMode`.
- Where: new file.
- Avoid changing: generic operation pages.
- Command after step: none.
- Expected result: restock pages can handle draft, submit, review, approval, rejection, and send-back.

10. Create delivery composable.
- File to open: `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`.
- Change to make: implement `useOutletDeliveries` and `saveDelivery`.
- Where: new file.
- Avoid changing: `OutletRestockItems` schema or delivery JSON semantics.
- Command after step: none.
- Expected result: delivery flow supports partial/multiple deliveries and updates cumulative item delivery quantities.

11. Create consumption composable.
- File to open: `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`.
- Change to make: implement `useOutletConsumption` and `saveConsumption`.
- Where: new file.
- Avoid changing: delivery/restock composables.
- Command after step: none.
- Expected result: consumption flow creates negative movements only when stock is sufficient.

12. Create outlet stock composable.
- File to open: `FRONTENT/src/composables/operations/outlets/useOutletStock.js`.
- Change to make: implement `useOutletStock`.
- Where: new file.
- Avoid changing: warehouse stock composables.
- Command after step: none.
- Expected result: outlet stock pages can show balances and movement timeline.

13. Create shared UI components.
- File to open: create all files under `FRONTENT/src/components/Operations/Outlets/` listed in Frontend Components.
- Change to make: build UI-only components using props/emits only.
- Where: new folder `Outlets`.
- Avoid changing: stores, services, or business logic in components.
- Command after step: none.
- Expected result: pages can stay thin and reuse shared outlet UI.

14. Create `OutletVisits` pages.
- File to open: create `FRONTENT/src/pages/Operations/OutletVisits/IndexPage.vue`, `AddPage.vue`, `ViewPage.vue`.
- Change to make: wire Quasar UI to `useOutletVisits` and outlet shared components.
- Where: exact folder name `OutletVisits`.
- Avoid changing: operation route resolver.
- Command after step: none.
- Expected result: `/operations/outlet-visits` resolves to custom pages.

15. Create `OutletRestocks` pages.
- File to open: create `FRONTENT/src/pages/Operations/OutletRestocks/IndexPage.vue`, `AddPage.vue`, `ViewPage.vue`.
- Change to make: wire Quasar UI to `useOutletRestocks`; view page must switch by `resolveRestockViewMode`.
- Where: exact folder name `OutletRestocks`.
- Avoid changing: generic `_common` operation pages.
- Command after step: none.
- Expected result: restock list/create/review/read-only flows work from custom pages.

16. Create `OutletDeliveries` pages.
- File to open: create `FRONTENT/src/pages/Operations/OutletDeliveries/IndexPage.vue`, `AddPage.vue`, `ViewPage.vue`.
- Change to make: wire Quasar UI to `useOutletDeliveries`; show delivery items as rows, not raw JSON.
- Where: exact folder name `OutletDeliveries`.
- Avoid changing: restock pages.
- Command after step: none.
- Expected result: delivery event workflow has custom pages.

17. Create `OutletConsumption` pages.
- File to open: create `FRONTENT/src/pages/Operations/OutletConsumption/IndexPage.vue`, `AddPage.vue`, `ViewPage.vue`.
- Change to make: wire Quasar UI to `useOutletConsumption`.
- Where: exact folder name `OutletConsumption`.
- Avoid changing: folder spelling; use singular `Consumption` to match resource slug.
- Command after step: none.
- Expected result: consumption workflow has custom pages.

18. Create `OutletStorages` pages.
- File to open: create `FRONTENT/src/pages/Operations/OutletStorages/IndexPage.vue`, `ViewPage.vue`.
- Change to make: wire Quasar UI to `useOutletStock`.
- Where: exact folder name `OutletStorages`.
- Avoid changing: warehouse stock pages.
- Command after step: none.
- Expected result: outlet stock list/detail pages work.

19. Update frontend registries.
- File to open: `FRONTENT/src/composables/REGISTRY.md`, `FRONTENT/src/components/REGISTRY.md`.
- Change to make: add entries for all new outlet composables and components with purpose and dependencies.
- Where: operations sections.
- Avoid changing: unrelated registry rows.
- Command after step: none.
- Expected result: discovery docs match created frontend files.

20. Update canonical docs.
- File to open: `Documents/MASTER_SHEET_STRUCTURE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/MODULE_WORKFLOWS.md`.
- Change to make: document resources, columns, status rules, workflows, JSON event-log rule, source-of-truth rule, and movement/storage rule.
- Where: add outlet sections without deleting existing procurement/warehouse sections.
- Avoid changing: unrelated module claims.
- Command after step: none.
- Expected result: docs match implementation.

21. Run GAS deployment.
- File to open: none.
- Change to make: none.
- Where: repo root.
- Avoid changing: source files during push.
- Command after step: `npm run gas:push`.
- Expected result: clasp push succeeds and includes `outletMovements.gs`.

22. Run targeted frontend validation.
- File to open: none.
- Change to make: none unless validation fails.
- Where: repo root.
- Avoid changing: unrelated files.
- Command after step: `npm --prefix FRONTENT run build`.
- Expected result: build succeeds.

23. Update context handoff.
- File to open: `Documents/CONTEXT_HANDOFF.md`.
- Change to make: add final outlet module state, validation performed, and manual sheet actions.
- Where: current functional state / current handoff area.
- Avoid changing: unrelated historical details unless they are obsolete.
- Command after step: `git status --short`.
- Expected result: final changed-file list is known.

## Steps

### Step 1: Prepare
- [ ] Complete Execution Step 1.
**Files**: `Documents/ARCHITECTURE RULES.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`
**Pattern**: required pre-read before frontend/GAS work.
**Rule**: do not start editing until current worktree status is known.

### Step 2: Sheet And Resource Backend
- [ ] Complete Execution Steps 2 through 6.
**Files**: `GAS/Constants.gs`, `GAS/setupMasterSheets.gs`, `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/outletMovements.gs`
**Pattern**: existing resource setup and stock movement hook.
**Rule**: metadata, setup schemas, AppOptions, and hook names must align exactly.

### Step 3: Frontend Business Logic
- [ ] Complete Execution Steps 7 through 12.
**Files**: `FRONTENT/src/composables/operations/outlets/*`
**Pattern**: PO Receiving/Purchase Order composable organization.
**Rule**: all business validation, derived values, and batch orchestration live in composables.

### Step 4: Frontend UI
- [ ] Complete Execution Steps 13 through 18.
**Files**: `FRONTENT/src/components/Operations/Outlets/*`, `FRONTENT/src/pages/Operations/OutletVisits/*`, `FRONTENT/src/pages/Operations/OutletRestocks/*`, `FRONTENT/src/pages/Operations/OutletDeliveries/*`, `FRONTENT/src/pages/Operations/OutletConsumption/*`, `FRONTENT/src/pages/Operations/OutletStorages/*`
**Pattern**: thin custom operation pages.
**Rule**: components use props/emits only; pages do not import services or stores directly.

### Step 5: Docs And Verification
- [ ] Complete Execution Steps 19 through 23.
**Files**: frontend registries, canonical docs, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: update docs where behavior/schema changed.
**Rule**: run targeted push/build and record results.

## Validation Plan

Commands:
- `git status --short`
- `npm run gas:push`
- `npm --prefix FRONTENT run build`

Targeted code checks:
- Run `rg -n "OUTLET_|OutletVisits|OutletRestocks|OutletMovements|OutletStorages" GAS`.
- Run `rg -n "useOutlet|OutletStorages|OutletDeliveries" FRONTENT/src`.
- Run `rg -n "router.push|src/services|src/stores" FRONTENT/src/pages/Operations/Outlet* FRONTENT/src/components/Operations/Outlets`.

Expected command outputs:
- `npm run gas:push` succeeds.
- `npm --prefix FRONTENT run build` succeeds.
- `rg` finds outlet constants/resources in GAS.
- No direct `router.push`, service imports, or store imports appear in outlet pages/components.

Manual sheet/setup checks:
- In Google Sheet menu, run resource sync from code.
- Run master setup and operation setup if required by current AQL setup process.
- Confirm `APP.Resources` contains all ten outlet resources.
- Confirm `APP.AppOptions` contains `OutletVisitProgress`, `OutletRestockProgress`, and `OutletMovementReferenceType`.
- Confirm sheet headers match this plan exactly.

Manual frontend checks:
- Login after resource sync.
- Confirm menus appear under `Field Sales` and `Masters`.
- Create an outlet and outlet operating rule.
- Create a planned outlet visit.
- Complete, postpone, and cancel separate planned visits.
- Create restock draft with two SKUs.
- Submit restock and verify direct editing is locked.
- Send back restock and verify same document becomes editable.
- Resubmit and approve with approved quantities.
- Create partial delivery and verify restock becomes `PARTIALLY_DELIVERED`, item `DeliveredQty` increases, movement rows are positive, and outlet storage increases.
- Create second delivery and verify restock becomes `DELIVERED`.
- Create consumption and verify movement rows are negative and outlet storage decreases.
- Try over-delivery and verify UI blocks it.
- Try consumption above current stock and verify UI blocks it.
- Open outlet stock page and verify balances match movements.

Failure signs and meanings:
- `OutletStorages` edited directly from UI means source-of-truth violation.
- Delivery JSON used to calculate cumulative delivered means source-of-truth violation.
- `DeliveredQty > ApprovedQty` means delivery validation failure.
- Negative outlet storage after consumption means stock validation or hook failure.
- Direct service/store imports in pages/components means frontend architecture violation.
- Missing progress audit columns means `executeAction` stamps will not be recorded.
- Missing `PostAction` on `OutletMovements` means `OutletStorages` will not update.

Tests to add or update:
- No formal test framework is evident for this module. Do not invent a new test framework.
- If existing frontend unit test infrastructure is discovered during implementation, add focused tests for `outletStockLogic.js` only.
- Minimum test cases for helper tests, if added: remaining delivery qty, delivery overage validation, consumption insufficient stock validation, duplicate active restock warning.

## Regression Checklist
- Existing procurement workflows remain unchanged.
- Existing PO Receiving, Goods Receipts, GRN stock entry, `StockMovements`, and `WarehouseStorages` behavior remain unchanged.
- Existing generic GAS API contracts remain unchanged.
- Existing resource sync behavior remains unchanged.
- Existing master and operation page resolvers remain unchanged.
- Existing `SKUs`, `Products`, `Warehouses`, and warehouse stock pages remain unchanged.
- Frontend services remain the only layer with API/IDB access.
- Components do not import stores or services.
- Pages use composables and `useResourceNav`, not direct router calls.
- No new custom API action is added to `apiDispatcher.gs`.
- No broad frontend build is skipped after this cross-cutting module.

## Documentation Updates Required
- [ ] Update `Documents/MASTER_SHEET_STRUCTURE.md` with `Outlets` and `OutletOperatingRules`.
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` with all outlet operation resources.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with outlet resource columns, action audit requirements, delivery JSON rule, delivered quantity rule, and movement/storage rule.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with `Outlet & Field Sales Operations`.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` with outlet composables.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` with outlet components.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation.

## Acceptance Criteria
- [ ] Outlets can be created and listed as master data.
- [ ] Outlet operating rules can be created per outlet/SKU.
- [ ] Planned visits can be completed, postponed, or cancelled.
- [ ] Postponing a visit creates a new planned visit.
- [ ] Restock drafts can be saved with child items.
- [ ] Restocks can be submitted, approved, rejected, and sent back.
- [ ] Sent-back restocks are revised on the same document.
- [ ] Approved restocks can receive partial and multiple deliveries.
- [ ] Delivery creates positive outlet movement rows.
- [ ] Delivery updates `OutletRestockItems.DeliveredQty` cumulatively.
- [ ] Delivery JSON is stored but not used as cumulative truth.
- [ ] Consumption can be raised independently of visits.
- [ ] Consumption creates negative outlet movement rows.
- [ ] `OutletStorages` reflects movement-derived balances.
- [ ] Over-delivery and over-consumption are blocked.
- [ ] Frontend architecture rules are followed.
- [ ] GAS push and frontend build pass.

## Final Acceptance Checklist
- [ ] `GAS/Constants.gs` contains all new outlet constants and AppOptions.
- [ ] `GAS/setupMasterSheets.gs` contains `Outlets` and `OutletOperatingRules`.
- [ ] `GAS/setupOperationSheets.gs` contains all eight outlet operation schemas.
- [ ] `GAS/syncAppResources.gs` contains all ten outlet resource configs.
- [ ] `GAS/outletMovements.gs` exists and updates `OutletStorages`.
- [ ] `OutletMovements.PostAction` is `handleOutletMovementsBulkSave`.
- [ ] `OutletVisits` has required progress audit columns.
- [ ] `OutletRestocks` has required progress audit columns.
- [ ] `OutletRestockItems` includes `RequestedQty`, `ApprovedQty`, and `DeliveredQty`.
- [ ] `OutletDeliveries` includes `DeliveredItemsJSON`.
- [ ] `OutletStorages` uses `OutletCode + StorageName + SKU` as the balance key.
- [ ] All frontend outlet composables exist under `FRONTENT/src/composables/operations/outlets/`.
- [ ] All outlet pages exist under exact PascalCase resolver folders.
- [ ] Shared outlet components exist under `FRONTENT/src/components/Operations/Outlets/`.
- [ ] Frontend registries are updated.
- [ ] Canonical docs are updated.
- [ ] `npm run gas:push` succeeds.
- [ ] `npm --prefix FRONTENT run build` succeeds.
- [ ] Build Agent fills Post-Execution Notes.

## Post-Execution Notes
Build Agent must fill this section after implementation. Change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` with the concrete agent/runtime identity before finishing.

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

### Deviations / Decisions
- [x] `[?]` Delivery workflow posts movement rows after the delivery create response returns the real `OutletDeliveries.Code`; this avoids placeholder reference codes while keeping cumulative truth in `OutletRestockItems.DeliveredQty`.
- [x] `[!]` No blocker remains. Manual Google Sheet resource sync/setup is still required for live metadata and sheets.

### Files Actually Changed
- `GAS/Constants.gs`
- `GAS/setupMasterSheets.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `GAS/outletMovements.gs`
- `FRONTENT/src/composables/operations/outlets/`
- `FRONTENT/src/components/Operations/Outlets/`
- `FRONTENT/src/pages/Operations/OutletVisits/`
- `FRONTENT/src/pages/Operations/OutletRestocks/`
- `FRONTENT/src/pages/Operations/OutletDeliveries/`
- `FRONTENT/src/pages/Operations/OutletConsumption/`
- `FRONTENT/src/pages/Operations/OutletStorages/`
- `FRONTENT/src/composables/REGISTRY.md`
- `FRONTENT/src/components/REGISTRY.md`
- `Documents/MASTER_SHEET_STRUCTURE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] `git status --short`
- [x] `npm run gas:push`
- [x] `npm --prefix FRONTENT run build`
- [ ] Manual frontend workflow checks completed

### Manual Actions Required
- [ ] Run AQL Resources sync from the Google Sheet menu.
- [ ] Run master and operation sheet setup from the Google Sheet menu if new sheets are not created automatically.
- [ ] Confirm AppOptions rows contain outlet option groups.
- [ ] Clear resource config cache if menus/resources do not appear after sync.
- [x] No Web App redeployment is expected unless Build Agent changes the API contract.
