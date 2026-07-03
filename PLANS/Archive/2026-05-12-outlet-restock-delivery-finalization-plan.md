# PLAN: Outlet Restock & Delivery Finalization
**Status**: COMPLETED
**Created**: 2026-05-12
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Finish and verify the outlet restock/delivery breaking change from the current partially implemented state.

The target model is:
- `OutletRestockItems` (ORSI) is the atomic allocation/delivery unit.
- ORSI progress is `PENDING -> ALLOCATED -> DELIVERED`.
- `OutletDeliveries` (OD) is a multi-outlet header with derived progress `DRAFT`, `IN_TRANSIT`, `COMPLETED`, `CANCELLED`.
- `OutletDeliveryItems` (ODI) links one OD to one ORSI and starts `IN_TRANSIT`.
- Warehouse stock moves at ORSI allocation time through negative `StockMovements` with `ReferenceType = OutletRestock`.
- Outlet stock moves at ODI delivery time through positive `OutletMovements` with `ReferenceType = RestockDelivery`.

## Context
Required pre-reads completed for this plan:
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `PLANS/_TEMPLATE.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/OPERATION_CUSTOMIZATION.md`
- all files under `FRONTENT/src/composables/operation/outlets/`
- all files under `FRONTENT/src/pages/operation/OutletRestocks/`
- all files under `FRONTENT/src/pages/operation/OutletDeliveries/`
- all files under `FRONTENT/src/components/operation/Outlets/`
- required GAS snippets/files: `GAS/syncAppResources.gs`, `GAS/setupOperationSheets.gs`, `GAS/Constants.gs`, `GAS/stockMovements.gs`, `GAS/outletMovements.gs`

Current worktree observation:
- Many implementation files already contain the new model and are modified/untracked in the current worktree. Build Agent must preserve and complete this work, not overwrite it casually.
- `GAS/Constants.gs` already contains `OUTLET_DELIVERY_ITEMS`, `OutletDeliveryProgress`, `OutletDeliveryItemProgress`, and `OutletRestockItemProgress`. Treat the handoff note about missing `OutletRestockItemProgress` as stale unless it is absent in the Build Agent's local state.
- `GAS/setupOperationSheets.gs` already defines new ORSI, OD, and ODI setup headers.
- `GAS/syncAppResources.gs` already defines OD and ODI resource configs. ORSI resource config still needs `RequiredHeaders` correction.
- `outletOperationsMeta.js` already has `deliveryItems`, `RESTOCK_ITEM_PROGRESS_ORDER`, `DELIVERY_ITEM_PROGRESS_ORDER`, updated `DELIVERY_PROGRESS_ORDER`, and new meta labels.
- `outletDeliveryPayload.js` already exists.
- New components already exist in the worktree: `AvailableOrsiPanel.vue`, `OrsiAllocationRow.vue`, `OutletDeliveryItemRow.vue`, `OutletDeliverySummaryPanel.vue`.

Important implementation decision:
- Remove the `Approve` AdditionalAction from `OutletRestocks` resource metadata. Approval is now frontend-batch orchestrated because it must update/split ORSI rows and create `StockMovements`. Keeping the generic GAS action creates a second approval path that can bypass allocation. Keep `Submit`, `Reject`, and `SendBack`.

## Pre-Conditions
- [ ] Build Agent has read this plan.
- [ ] Build Agent understands this plan starts from a dirty worktree and must preserve existing user/agent changes.
- [ ] User has confirmed live outlet restock/delivery sheet data may be reset before destructive cleanup is performed.
- [ ] Build Agent has access for `npm run gas:push` and frontend build commands.

## Steps

### Step 1: Phase 0 - Finalize GAS Config Leftovers
- [ ] Verify `GAS/Constants.gs` includes `OutletRestockItemProgress: ['PENDING', 'ALLOCATED', 'DELIVERED']`. If already present, do not change it.
- [ ] In `GAS/syncAppResources.gs`, change `OutletRestockItems.RequiredHeaders` from any allocation-required form to exactly `OutletRestockCode,SKU,Quantity`.
- [ ] In `GAS/syncAppResources.gs`, remove the `Approve` AdditionalAction from `OutletRestocks`.
- [ ] Keep `Submit`, `Reject`, and `SendBack` AdditionalActions unchanged unless a direct conflict is found.
- [ ] Verify `OutletRestockItems.DefaultValues` remains `{"Status":"Active","Quantity":0,"Progress":"PENDING"}`.
- [ ] Verify OD/ODI configs remain aligned with the committed target model.
**Files**: `GAS/Constants.gs`, `GAS/syncAppResources.gs`, `GAS/setupOperationSheets.gs`
**Pattern**: `APP.Resources` metadata is the runtime control plane; setup headers must match resource metadata.
**Rule**: Creator-filled fields only should be required on ORSI resource config; approver/default fields must not block creator save.
**Verification**: `rg -n "OutletRestockItemProgress|OUTLET_DELIVERY_ITEMS|RequiredHeaders: 'OutletRestockCode,SKU,Quantity'|\"action\": \"Approve\"" GAS/Constants.gs GAS/syncAppResources.gs GAS/setupOperationSheets.gs`

### Step 2: Phase 1 - Finish Frontend Composables
- [ ] In `outletOperationsBatch.js`, ensure old delivery actions `scheduleDelivery`, `deliverRestock`, and `cancelDelivery` are absent. Keep generic helpers unchanged.
- [ ] Decide whether an ODI action constant is necessary. Prefer not adding `deliverOdi` unless code uses `executeActionRequest`; current target uses direct `resourceUpdateRequest`.
- [ ] In `outletStockLogic.js`, align exported helper names with the handoff and consuming files:
  - current `validateAllocation` may satisfy `validateOrsiAllocation`; either rename or add a compatibility export if clearer.
  - add `canSplitRow(item)` returning true only for active `PENDING` rows if missing.
  - keep `computeRestockProgressFromItems`.
  - remove legacy JSON allocation helpers if any remain.
- [ ] In `outletStockLogic.js`, review `computeRestockProgressFromItems([])`. It currently returns `APPROVED`; decide if empty active rows after rejection should remain harmless. Do not use it for rejected/deactivated rows.
- [ ] In `outletRestockPayload.js`, verify `buildRestockCompositePayload` preserves existing ORSI fields only where appropriate:
  - creator draft rows should write `SKU`, `Quantity`, `Progress: PENDING`, `Status`, and access region.
  - it must not reset saved allocated rows to blank warehouse/storage when saving an editable draft or resubmission.
- [ ] In `outletRestockPayload.js`, verify allocation batch behavior:
  - updates allocated ORSI rows with row `Code`, `WarehouseCode`, `StorageName`, `Quantity`, `Progress=ALLOCATED`, and allocation stamps.
  - creates any split remainder rows as new PENDING ORSI rows.
  - creates negative `StockMovements` for allocated quantity only.
  - updates restock header to `APPROVED` when at least one row is allocated.
- [ ] In `outletRestockPayload.js`, verify rejection reversal:
  - creates positive `StockMovements` only for active ALLOCATED rows.
  - deactivates active ORSI rows.
  - updates header to `REJECTED`.
- [ ] In `useOutletRestocks.js`, verify `reloadView` includes `Warehouses` if the UI needs warehouse labels/options; current code only loads `WarehouseStorages`.
- [ ] In `useOutletRestocks.js`, keep old JSON allocation exports removed. Keep current row-level helpers only.
- [ ] In `useOutletRestocks.js`, ensure split allocation preserves the original persisted row code for the allocated part and creates a new PENDING remainder row without a code.
- [ ] In `useOutletRestocks.js`, ensure `rejectRestock` blocks if any child ORSI is `DELIVERED`.
- [ ] In `useOutletDeliveries.js`, verify required load lists include `Warehouses` if any display joins need warehouse labels; otherwise document that code-only warehouse display is intentional.
- [ ] In `useOutletDeliveries.js`, verify `availableItems` excludes ORSI rows already linked to active ODI rows.
- [ ] In `useOutletDeliveries.js`, verify `createDraft`, `markItemDelivered`, `markAllDelivered`, and `cancelDraft` all use `workflowStore.runBatchRequests`.
- [ ] In `outletDeliveryPayload.js`, verify OD create uses a batch/composite pattern that correctly links child `OutletDeliveryItems` to the newly created `OutletDeliveries` parent. If `compositeSaveRequest` children auto-link parent codes, keep it. If not, use explicit `$ref` helpers and `textOrRef()` correctly.
- [ ] In `outletDeliveryPayload.js`, verify OD cancel sets OD `Progress=CANCELLED`. Decide whether `Status` should stay `Active` for history visibility or become `Inactive`; prefer `Active` unless the product explicitly wants cancelled deliveries hidden from active lists.
- [ ] In `outletDeliveryPayload.js`, verify `buildOdDeliverBatchRequests` derives OD progress from all active ODIs after the target ODI is delivered and derives restock progress from all active ORSI rows for that restock.
**Files**: `FRONTENT/src/composables/operation/outlets/outletOperationsBatch.js`, `outletStockLogic.js`, `outletRestockPayload.js`, `useOutletRestocks.js`, `useOutletDeliveries.js`, `outletDeliveryPayload.js`
**Pattern**: Business logic and payload construction stay in composables/helpers; no stores/services imported into pages/components.
**Rule**: Batch refs must use `batchRef`/`textOrRef`; do not stringify `$ref` values.
**Verification**: `rg -n "StorageAllocationJSON|ItemsJSON|scheduleDelivery|deliverRestock|cancelDelivery|router\\.push" FRONTENT/src/composables/operation/outlets FRONTENT/src/pages/operation/OutletDeliveries FRONTENT/src/pages/operation/OutletRestocks`

### Step 3: Phase 2 - Finish Frontend Components
- [ ] Verify `OutletProgressChip.vue` works through `progressMeta` for `PENDING`, `ALLOCATED`, `DRAFT`, `IN_TRANSIT`, `COMPLETED`, and `DELIVERED`.
- [ ] In `RestockApprovalView.vue`, confirm props and emits are row-level allocation based only:
  - no `allocations`, `allocationTotal`, `allocationAvailability`, `updateAllocation`, `addAllocation`, or `removeAllocation` props remain.
  - pending rows are editable, allocated/delivered rows are read-only or clearly protected.
- [ ] In `OrsiAllocationRow.vue`, prevent allocation edits for non-PENDING rows unless the intended design allows adjusting ALLOCATED rows before final approval.
- [ ] In `OrsiAllocationRow.vue`, ensure split action appears only for PENDING rows with quantity greater than 1.
- [ ] In `RestockReadonlyView.vue`, ensure row progress, warehouse, storage, quantity, allocation stamps, and delivery stamps are visible or intentionally omitted.
- [ ] In `RestockDraftView.vue`, keep creator UX SKU/quantity only. Do not expose warehouse/storage/progress controls.
- [ ] In `RestockCard.vue`, keep item progress summary prop and ensure `IndexPage.vue` passes it consistently.
- [ ] In `AvailableOrsiPanel.vue`, ensure it supports the expected searchable/filterable list through the parent `searchTerm` and displays outlet, SKU/product, quantity, warehouse, and storage.
- [ ] In `OutletDeliveryItemRow.vue`, require optional delivery comment from the parent dialog only; component should just emit the row.
- [ ] In `OutletDeliverySummaryPanel.vue`, verify header summary uses OD header plus derived ODI/ORSI summary.
**Files**: `FRONTENT/src/components/operation/Outlets/OutletProgressChip.vue`, `RestockApprovalView.vue`, `OrsiAllocationRow.vue`, `RestockReadonlyView.vue`, `RestockDraftView.vue`, `RestockCard.vue`, `AvailableOrsiPanel.vue`, `OutletDeliveryItemRow.vue`, `OutletDeliverySummaryPanel.vue`
**Pattern**: Components are presentation-only and emit events to pages/composables.
**Rule**: Components must not import stores/services or perform API work.
**Verification**: `rg -n "from '../../../stores|from '../../../services|StorageAllocationJSON|allocations|allocationTotal" FRONTENT/src/components/operation/Outlets`

### Step 4: Phase 3 - Finish Frontend Pages
- [ ] In `OutletRestocks/IndexPage.vue`, remove or rework the old "Pending Delivery" section. The plan preference is to remove it because OD is no longer tied to one restock; delivery readiness now belongs in the OD add/list flow via ALLOCATED ORSI rows.
- [ ] In `OutletRestocks/AddPage.vue`, ensure new rows are created as PENDING through the composable/payload and creator does not see allocation fields.
- [ ] In `OutletRestocks/ViewPage.vue`, verify the new `RestockApprovalView` prop/emits are wired correctly and no old allocation JSON props remain.
- [ ] In `OutletDeliveries/IndexPage.vue`, verify sections are DRAFT, IN_TRANSIT, COMPLETED, CANCELLED and summaries are derived from ODI/ORSI joins.
- [ ] In `OutletDeliveries/AddPage.vue`, verify selected ORSI rows create an OD draft and navigate to view.
- [ ] In `OutletDeliveries/ViewPage.vue`, verify item delivery, deliver-all, and draft cancellation actions call the composable and reload/refresh correctly after success.
- [ ] In all touched pages, keep navigation through `useResourceNav` via composables. Do not introduce direct `router.push()`.
**Files**: `FRONTENT/src/pages/operation/OutletRestocks/AddPage.vue`, `IndexPage.vue`, `ViewPage.vue`, `FRONTENT/src/pages/operation/OutletDeliveries/AddPage.vue`, `IndexPage.vue`, `ViewPage.vue`
**Pattern**: Pages are thin orchestration shells.
**Rule**: Business logic stays in `useOutletRestocks` and `useOutletDeliveries`.
**Verification**: `rg -n "router\\.push|StorageAllocationJSON|ItemsJSON|OutletRestockCode|WarehouseCode.*OutletDeliveries" FRONTENT/src/pages/operation/OutletRestocks FRONTENT/src/pages/operation/OutletDeliveries`

### Step 5: Phase 4 - Deploy, Setup, and Data Reset
- [ ] Run `npm run gas:push` after GAS changes.
- [ ] Run `npm --prefix FRONTENT run build` because this touches more than 10 frontend files and changes a core workflow.
- [ ] From the AQL Google Sheet menu, run APP resource sync so `APP.Resources` and `APP.AppOptions` receive the new config.
- [ ] From the AQL Google Sheet menu or setup runner, run operation setup so `OutletDeliveryItems` exists and outlet sheets have new headers.
- [ ] Before deleting sheet data, obtain explicit user confirmation again. This is destructive.
- [ ] Clean slate reset should clear existing outlet restock/delivery data that cannot be migrated safely:
  - `OutletRestocks`
  - `OutletRestockItems`
  - `OutletDeliveries`
  - `OutletDeliveryItems`
  - related test/legacy `StockMovements` and `OutletMovements` rows only if the user confirms the stock ledger should be reset too.
- [ ] Do not request Web App redeployment unless Build Agent changes the generic API contract. This plan should not require it.
**Files**: GAS project and live sheets.
**Pattern**: Agent runs `clasp push`; user only performs sheet menu actions or confirms destructive data reset.
**Rule**: Never delete live data without explicit confirmation.
**Verification**: command output and manual sheet inspection.

### Step 6: Phase 5 - Docs and Registries
- [ ] Review `Documents/RESOURCE_COLUMNS_GUIDE.md`. It already contains much of the new model; update only if implementation decisions in this plan change it.
- [ ] Review `Documents/OPERATION_SHEET_STRUCTURE.md` and `Documents/MODULE_WORKFLOWS.md`; update any old `StorageAllocationJSON`, `ItemsJSON`, or scheduled-delivery semantics.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` for `AvailableOrsiPanel`, `OrsiAllocationRow`, `OutletDeliveryItemRow`, `OutletDeliverySummaryPanel`, and changed restock components.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` for `outletDeliveryPayload`, `outletRestockPayload`, `outletStockLogic`, `useOutletRestocks`, and `useOutletDeliveries`.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after execution with final state, validation, and manual follow-up.
**Files**: `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`, `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`
**Pattern**: Keep docs aligned with runtime metadata and frontend behavior.
**Rule**: Documentation updates are part of the same change set.
**Verification**: `rg -n "StorageAllocationJSON|ItemsJSON|SCHEDULED|OutletDeliveryCancel|single-outlet|scheduled delivery" Documents FRONTENT/src/components/REGISTRY.md FRONTENT/src/composables/REGISTRY.md`

## Documentation Updates Required
- [ ] `Documents/RESOURCE_COLUMNS_GUIDE.md` only if final implementation diverges from the current new-model text.
- [ ] `Documents/OPERATION_SHEET_STRUCTURE.md` to match ORSI/OD/ODI sheets.
- [ ] `Documents/MODULE_WORKFLOWS.md` if outlet workflow prose exists there.
- [ ] `Documents/CONTEXT_HANDOFF.md` after execution.
- [ ] `FRONTENT/src/components/REGISTRY.md`.
- [ ] `FRONTENT/src/composables/REGISTRY.md`.

## Acceptance Criteria
- [ ] `GAS/syncAppResources.gs` ORSI `RequiredHeaders` is exactly `OutletRestockCode,SKU,Quantity`.
- [ ] `OutletRestocks` resource metadata no longer exposes a generic `Approve` action.
- [ ] Creator can create restock items with SKU and quantity only, then submit to `PENDING_APPROVAL`.
- [ ] Approver can allocate full or partial ORSI quantities with warehouse/storage.
- [ ] Partial allocation creates a PENDING remainder row.
- [ ] Allocation creates negative `StockMovements` and `WarehouseStorages` decreases through the existing hook.
- [ ] Delivery user can create OD `DRAFT` from ALLOCATED ORSI rows and ODI rows are created as `IN_TRANSIT`.
- [ ] Marking first ODI delivered creates positive `OutletMovements`, marks ODI/ORSI `DELIVERED`, and moves OD to `IN_TRANSIT`.
- [ ] Marking all ODIs delivered moves OD to `COMPLETED`.
- [ ] Restock header becomes `PARTIALLY_DELIVERED` or `DELIVERED` from ORSI progress.
- [ ] DRAFT OD cancellation deactivates ODIs, returns linked ORSIs to `ALLOCATED`, and creates no warehouse movement.
- [ ] OD with any delivered ODI cannot be cancelled.
- [ ] Restock rejection is blocked when any ORSI is `DELIVERED`.
- [ ] Restock rejection with no delivered ORSI reverses allocated warehouse stock and deactivates active ORSI rows.
- [ ] `npm run gas:push` succeeds.
- [ ] `npm --prefix FRONTENT run build` succeeds.
- [ ] Live sheet setup/sync steps are documented in final notes.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task. Mark `[x]` immediately after the task is done. This is the single source of execution progress.

If execution is interrupted, the next agent reads this plan, finds the first unchecked `[ ]`, and resumes from that exact sub-task.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

### Deviations / Decisions
- [x] `[>]` Decision applied: cancelled OD headers keep `Status=Active` per plan's preference for history visibility.
- [ ] `[?]` Decision needed: confirm exact destructive data reset scope, especially whether stock/outlet movement ledger rows are included.
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/Constants.gs`
- `GAS/syncAppResources.gs`
- `GAS/setupOperationSheets.gs`
- `FRONTENT/src/composables/operation/outlets/outletOperationsBatch.js`
- `FRONTENT/src/composables/operation/outlets/outletStockLogic.js`
- `FRONTENT/src/composables/operation/outlets/outletRestockPayload.js`
- `FRONTENT/src/composables/operation/outlets/outletDeliveryPayload.js`
- `FRONTENT/src/composables/operation/outlets/useOutletRestocks.js`
- `FRONTENT/src/composables/operation/outlets/useOutletDeliveries.js`
- `FRONTENT/src/components/operation/Outlets/OutletProgressChip.vue`
- `FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue`
- `FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue`
- `FRONTENT/src/components/operation/Outlets/RestockReadonlyView.vue`
- `FRONTENT/src/components/operation/Outlets/RestockDraftView.vue`
- `FRONTENT/src/components/operation/Outlets/RestockCard.vue`
- `FRONTENT/src/components/operation/Outlets/AvailableOrsiPanel.vue`
- `FRONTENT/src/components/operation/Outlets/OutletDeliveryItemRow.vue`
- `FRONTENT/src/components/operation/Outlets/OutletDeliverySummaryPanel.vue`
- `FRONTENT/src/pages/operation/OutletRestocks/AddPage.vue`
- `FRONTENT/src/pages/operation/OutletRestocks/IndexPage.vue`
- `FRONTENT/src/pages/operation/OutletRestocks/ViewPage.vue`
- `FRONTENT/src/pages/operation/OutletDeliveries/AddPage.vue`
- `FRONTENT/src/pages/operation/OutletDeliveries/IndexPage.vue`
- `FRONTENT/src/pages/operation/OutletDeliveries/ViewPage.vue`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [x] Targeted old-field searches completed (no `router.push`, `StorageAllocationJSON`, `ItemsJSON`, old delivery actions found).
- [x] GAS push completed (26 files, no errors).
- [x] Frontend build completed (PWA build succeeded).
- [ ] Manual workflow validation completed (pending user sheet actions).
- [ ] Acceptance criteria verified (pending user sheet sync + data reset).

### Manual Actions Required
- [ ] User confirms destructive sheet data reset scope before deletion (OutletRestocks, OutletRestockItems, OutletDeliveries, OutletDeliveryItems, related StockMovements/OutletMovements).
- [ ] Run APP resource sync from the AQL sheet menu (AQL 🚀 > Resources > Sync APP.Resources from Code).
- [ ] Run operation sheet setup/reset from the AQL sheet menu (AQL 🚀 > Setup & Refactor > Setup Operation Sheets).
- [ ] Run setupAppSheets function in GAS editor to seed `OutletRestockItemProgress` AppOptions row (already added to Constants.gs, needs sheet write).
- [ ] Clear frontend/resource cache or re-login if old metadata remains visible.
- [ ] No Web App redeployment needed — generic API contract unchanged.

## Build Handoff
Build Agent, read `PLANS/2026-05-12-outlet-restock-delivery-finalization-plan.md` and execute it end-to-end.

