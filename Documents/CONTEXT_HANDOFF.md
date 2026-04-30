# Context Handoff - AQL

## Purpose
This file is a brief current-state snapshot for sessions that need continuation context. It is not a universal startup read.

## When To Read This File
Read this file only when:
- continuing unfinished work
- the task depends on current implementation state
- the user asks for resume context or latest project status

## Project Snapshot
- Project: AQL
- Domain: UAE baby product distribution operations
- Frontend: Quasar, Vue 3, Pinia, Vite
- Backend: Google Apps Script Web App with a single `doPost` entry
- Data model: Google Sheets split across APP, MASTERS, OPERATIONS, and REPORTS

## Current Operating Model
- `APP.Resources` is the main source of truth for resource metadata, routing, and permissions.
- A single APP Apps Script project is preferred for runtime behavior.
- `Config` in APP stores deployment-specific settings such as file IDs.
- GAS deployment is done with `clasp push`; manual Apps Script copy-paste is not part of the workflow.
- **Frontend Architecture**: Pinia remains the unified reactive state layer (record state via `useDataStore`, orchestration via dedicated workflow/cache/sync stores). IDB is the persistence layer, and sync cursors live in IDB `resource-meta` (not `localStorage`). Page shells are thin and consume composable view-models instead of importing stores/services directly.
- **Frontend Service/Boundary Layer**: Frontend now enforces pages -> composables -> stores/services boundaries. Reusable boundaries include app/resource navigation helpers (`useAppNav`, `useResourceNav`), action/page orchestration composables, and sync orchestration (`useResourceSync`). Service contracts are standardized around `{ success, data, error }`, with env-controlled logging via `src/services/_logger.js`.
- **Composable Structure (2026-04-25)**: `FRONTENT/src/composables/` remains purpose-grouped into `layout/`, `core/`, `resources/`, `operations/`, `masters/products/`, `reports/`, and `upload/`. Purchase Requisition editing/review pages consume the cross-stage `operations/procurements/useProcurements.js` workflow helper while PR-specific field/item concerns remain under `operations/purchaseRequisitions/`. RFQ creation/list/view logic now lives under `operations/rfqs/` including the newly added `useRFQSupplierFlow` for supplier assignment and send state dispatch.

## Current Important Constraints
- Use `Documents/DOC_ROUTING.md` to decide which docs to read for the task.
- Do not read all plans by default; read only the named or clearly relevant plan.
- For backend implementation, prefer existing GAS files and patterns first.
- For frontend implementation, keep pages thin when the task materially changes page structure.

## Current Functional State
- Resource-driven auth, menu, and master runtime are active.
- Login payload includes authorization/resource context and profile identity context.
- Master pages use cache-first IndexedDB sync with incremental updates.
- The project uses documented module workflows and canonical docs for menu and login payload behavior.
- Scope infrastructure is now data-driven via App.Config "Scopes" key, supporting dynamic scope addition without code changes.
- Procurement module schema initiated with PurchaseRequisitions, PurchaseRequisitionItems, and UOM master resources.
- Operation-scope resources use year-scoped code generation (e.g., PR26000001).
- PR frontend flow now routes through an entity custom `PurchaseRequisitions/ViewPage.vue` that switches by canonical PR progress: `Draft`/`Revision Required` -> editable page, `Pending Approval` -> review page, and `Approved`/`Rejected`/`RFQ Processed` -> read-only page.
- PR workflow logic is now frontend-owned via `useProcurements.js`, including first submit, revision resubmit, review send-back, approve, reject, Procurement progress mapping, and comment-thread formatting using `ProgressRevisionRequiredComment` / `ProgressRejectedComment`.
- RFQ frontend flow now has custom operation pages resolved from `FRONTENT/src/pages/Operations/Rfqs/`: `IndexPage.vue` prioritizes `DRAFT` RFQs, `AddPage.vue` creates draft RFQs from approved PRs with all PR item codes stored as CSV, and `ViewPage.vue` shows a minimal read-only RFQ summary. RFQ create updates the PR to `RFQ Processed` and the linked Procurement to `RFQ_GENERATED`; if an approved PR is missing `ProcurementCode`, the frontend creates a Procurement first and uses its returned code.
- **RFQ Supplier Flow (2026-04-25)**: Supplier dispatch is managed via two custom actions from the read-only RFQ view: `Assign Supplier` creates multi-select rows in `RFQSuppliers` as `ASSIGNED` and locks the parent RFQ, while `Mark As Sent` stamps selected rows with `SENT` / `SentDate` and advances the linked `Procurements` record to `RFQ_SENT_TO_SUPPLIERS` once all dispatch rows are out of `ASSIGNED` state.
- **Supplier Quotation Flow (2026-04-25)**: `/operations/supplier-quotations` now resolves to custom pages under `FRONTENT/src/pages/Operations/SupplierQuotations/` and composables under `operations/supplierQuotations/`. First save captures `QUOTED`, `PARTIAL`, or `DECLINED` responses into `SupplierQuotations` / `SupplierQuotationItems`; if dispatch was forgotten it moves matching `RFQSuppliers` from `ASSIGNED` to `SENT`, advances `Procurements` from `RFQ_GENERATED` to `RFQ_SENT_TO_SUPPLIERS`, then marks the supplier `RESPONDED` and advances eligible procurements to `QUOTATIONS_RECEIVED`. The view page allows editing `AllowPartialPO` and `SupplierQuotationReference`.
- **Purchase Order Flow (2026-04-26)**: `/operations/purchase-orders` handles PO creation from active non-declined quotations. Users can create a single Full PO (which consumes all items and blocks further full POs) or Partial POs (which allow toggling items and adjusting quantity down to frontend-computed remaining quantity). PO creation updates the source Supplier Quotation to `ACCEPTED`; when cumulative active PO quantities exactly match every RFQ item quantity, the create flow warns that closing blocks further SQs and executes the RFQ `Close` AdditionalAction only after user confirmation, with `ProgressClosedComment` set to `<user_name>/system: "Complete purchase order created, hence closing RFQ"`. PO actions use configured `AdditionalActions`; cancelling a PO marks matching `RFQSuppliers` as `CANCELLED`, rolls `PO_ISSUED` procurements back to `QUOTATIONS_RECEIVED` when no other active non-cancelled PO remains, and reopens a closed RFQ to `SENT` while clearing `ProgressClosedComment`.
- **GRN Stock Entry (2026-04-28)**: `POReceivings` now carries direct `ProcurementCode` in setup/resource metadata and frontend POR drafts. `/operations/stock-movements/grn-entry` resolves to a Warehouse-side GRN posting page that lists active unposted GRNs by selected warehouse, allocates accepted `GoodsReceiptItems.Qty` across storage rows, and submits positive `StockMovements` rows with `ReferenceType = GRN`; `WarehouseStorages` continues to update only through the existing StockMovements hook.
- **Warehouse Stock List (2026-04-28)**: `Warehouse > Stock List` opens `/masters/warehouses/stock-list` for warehouse-card selection. Warehouse records expose a navigate-kind `ViewStock` action to `/masters/warehouses/{Code}/stock`, and GRN Stock Entry redirects there after a successful stock post.
- `procurement.gs` is now narrowed to one postAction responsibility: after Procurement create, copy the created Procurement code back to the linked Purchase Requisition when the create payload carries `linkedPurchaseRequisitionCode`.
- Operations 3-tier UI architecture implemented, mirroring Masters but customized for operations context (ViewParent instead of ViewAudit, filtered details).
- Frontend refactor execution completed for the service/store/page migration plan: pages and composables now consume store actions or new service modules, and the legacy `src/services/apiClient.js`, `src/services/gasApi.js`, `src/services/resourceRecords.js`, and `src/utils/db.js` files were removed.
- Frontend architecture remediation completed on 2026-04-19: reviewed pages no longer import `src/stores/*` or `src/services/*`, direct page-level `router.push`/`$router.back` usage is removed, frontend source files are under 400 lines, and `npm run build` succeeds.
- PR/composable reorg plan executed on 2026-04-20: the PR initiate page keeps a direct `formatSkuVariants` import, hero Sass `lighten()` usage has been removed from the targeted hero token/card files, and the current build output shows only separate `darken()` deprecation warnings in other hero partials outside that targeted migration.
- API contract update executed on 2026-04-21: write actions (`create`, `update`, `bulk`, `executeAction`, `compositeSave`) now require nested payload objects and return write-delta resource payloads under canonical `data.resources` using `lastUpdatedAtByResource` cursors.
- Batch contract now returns ordered per-request envelopes in `data.result.responses` and an aggregated `data.resources` map for generic frontend ingestion.
- Generic service naming enforced on 2026-04-21: `createMasterRecord→createRecord`, `updateMasterRecord→updateRecord`, `bulkMasterRecords→bulkRecords`; all `*Master*` transitional aliases removed. `submitStockMovementsBatch` removed from `workflow.js`; `useStockMovements.js` composable now owns full dispatch logic via `runBatchRequests`.

- GAS postAction dispatch refactor executed on 2026-04-23: supported write actions now resolve hooks through one strict dispatcher with order `{PostAction}_after<Action>` then `{PostAction}`, using signature `payload, result, auth, action, meta, resourceName`. `get` and `batch` never dispatch hooks. `stockMovements.gs` consumes the unified hook contract, and `procurement.gs` now uses the same contract only for Procurement create to PR code handoff.
- GAS `executeAction` stamp headers now derive from PascalCase column values while preserving the stored progress/status value, so uppercase action values such as `REJECTED` correctly populate fields like `ProgressRejectedAt` and `ProgressRejectedBy`.

## Deep-Dive References
- Role boundaries: `Documents/MULTI_AGENT_PROTOCOL.md`
- Task-based doc loading: `Documents/DOC_ROUTING.md`
- Implementation alignment: `Documents/AI_COLLABORATION_PROTOCOL.md`
- Module workflows: `Documents/MODULE_WORKFLOWS.md`

## Maintenance Rule
Update this file when current-state assumptions materially change, for example:
- a major architecture/runtime decision changes
- current operating constraints change
- a major module or platform capability changes enough that continuation context would be misleading

Keep this file summarized and current. Replace outdated state instead of appending dated history.
# Current Handoff — 2026-04-27 PO Receiving + Goods Receipts Frontend Batch Refactor

Refactored PO Receiving and Goods Receipt workflow ownership so POR draft save, confirm, GRN creation, GRN invalidation, cancellation, and replacement are frontend-batch orchestrated instead of GAS postAction-driven.

Changed surfaces:
- `GAS/syncAppResources.gs` keeps `POReceivings` and `GoodsReceipts` `PostAction` blank while retaining generic `AdditionalActions`.
- No runtime `GAS/poReceivingWorkflow.gs` file remains in the workspace.
- PO Receiving add/edit flow now tracks a loaded snapshot, exposes `hasUnsavedChanges`, `canSaveDraft`, `canConfirm`, and saves drafts only as `DRAFT`.
- GRN creation uses one `workflowStore.runBatchRequests` call with `GoodsReceipts` + `GoodsReceiptItems` `compositeSave`, POR `GenerateGRN`, procurement update, and refresh reads.
- GRN invalidation, POR cancel, and replacement side effects are built in shared frontend batch helpers.
- Frontend registries and canonical module/resource docs reflect frontend-owned workflow orchestration.

Validation performed:
- Pending for this refactor: targeted `rg`, `npm run gas:push`, `npm --prefix FRONTENT run build`, and final `git status --short`.

Manual follow-up:
- Run APP resource sync from the AQL sheet menu so blank `PostAction` metadata is applied to live `APP.Resources`.
- Confirm `APP.AppOptions` contains `POReceivingProgress`, `GOODS_RECEIVING`, and `GRN_GENERATED`; append manually if the existing option rows are not updated by setup/sync.
- No Web App redeployment is expected because no custom API contract was added.
2026-04-28 Outlet & Field Sales Operations implemented through the assigned Build Agent plan.

Changed surfaces:
- Added master resources `Outlets` and `OutletOperatingRules` in setup/resource metadata.
- Added operation resources `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletDeliveries`, `OutletConsumption`, `OutletConsumptionItems`, `OutletMovements`, and `OutletStorages`.
- Added `GAS/outletMovements.gs` so `OutletMovements` post-write hooks update `OutletStorages` balances.
- Added outlet frontend composables, shared UI components, and custom operation pages under the resolver folders.
- Updated frontend registries and canonical sheet/resource/workflow docs.

Validation performed:
- `git status --short`
- `npm run gas:push`
- `npm --prefix FRONTENT run build`

Manual follow-up:
- Run APP resource sync from the AQL sheet menu so outlet metadata is applied to live `APP.Resources`.
- Run master and operation setup from the Google Sheet menu to create/normalize outlet sheets.
- Confirm `APP.AppOptions` contains outlet progress/reference groups.
- No Web App redeployment is expected because no custom API contract was added.

2026-04-30 Outlet & Field Sales Operations strict refinement executed from `PLANS/2026-04-30-outlet-field-operations-strict-refinement-plan.md`.

Final refined state:
- `OutletVisits` is reduced to `Code`, `OutletCode`, `Date`, `Status`, `StatusComment`, plus standard audit columns. Workflow status values are `PLANNED`, `COMPLETED`, `POSTPONED`, and `CANCELLED` on `Status`; visit comments use only `StatusComment`.
- Visit completion and cancellation update the current row. Visit postponement updates the current row and creates a new planned row without previous/next link columns.
- `OutletConsumption` is independent of visits; the operation setup, payload builder, and docs no longer use `OutletVisitCode` for consumption.
- `OutletRestocks` now uses simplified request columns `Date`, `RequestedUser`, and `ApprovedUser`; `OutletRestockItems` stores `SKU`, `Quantity`, approver-owned `StorageAllocationJSON`, status, and audit.
- `OutletDeliveries.DeliveredItemsJSON` stores lowercase event rows like `{ "sku": "SKU1", "qty": 3 }`; fulfillment is derived by aggregating delivery JSON against `OutletRestockItems.Quantity`, and delivery does not update restock item rows.
- Over-engineered outlet frontend checks for SKU-level operating-rule stock value limits and duplicate open restock warnings were removed. Required quantity/stock validations remain.
- `Outlets` and `OutletOperatingRules` implementation was intentionally not changed.

Validation performed:
- Pending for this refinement: targeted removed-field search, `npm run gas:push`, `npm --prefix FRONTENT run build`, and final diff review.

Manual follow-up:
- Run AQL resource sync from the Google Sheet menu.
- Run operation sheet setup from the Google Sheet menu to normalize `OutletVisits` headers.
- Confirm live `OutletVisits` headers match the refined schema.
- Clear frontend/resource cache or re-login if old visit fields remain visible after sync.
- No Web App redeployment is expected because the generic API contract was not changed.
