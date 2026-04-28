# PLAN: PO Receiving Frontend Batch GRN Refactor
**Status**: COMPLETED
**Created**: 2026-04-27
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Kilo Code)

## Objective
Refactor PO Receiving and Goods Receipt workflows so GRN creation and related progress updates are frontend-orchestrated through one `batch` request using `compositeSave`, instead of relying on `GAS/poReceivingWorkflow.gs` postAction hooks.

Done means:
- PO Receiving drafts are saved only as `DRAFT`.
- A draft PO Receiving can be confirmed only after the current form/items are clean.
- Dirty POR edit state shows `Save` only; clean draft state shows `Confirm` only, following the Purchase Requisition editable pattern.
- GRN creation is performed from frontend composables using one `batch` request containing `GoodsReceipts` + `GoodsReceiptItems` `compositeSave`, POR progress update/action, procurement progress update, and refresh reads.
- `POReceivings` and `GoodsReceipts` no longer depend on `PostAction: 'handlePOReceivingWorkflow'`.
- `GAS/poReceivingWorkflow.gs` is removed if no references remain.

## Context
User decision:
- Avoid postAction for this module.
- Use frontend orchestration because this matches the existing AQL approach used by PR/RFQ/SQ/PO flows.
- Do not design multi-roundtrip GRN creation; use `workflowStore.runBatchRequests`.
- Use `compositeSave` for `GoodsReceipts` + `GoodsReceiptItems`; it is intended for parent/child saves where generated parent code must be linked to child rows.

Required docs and current surfaces reviewed by Brain Agent:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/_TEMPLATE.md`
- Existing completed plan: `PLANS/po-receiving-module-implementation.md`

Relevant current implementation:
- `FRONTENT/src/stores/workflow.js` already exposes `runBatchRequests`, `saveComposite`, `executeResourceAction`, and `updateResourceRecord`.
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionEditableFlow.js` has the required clean/dirty pattern using a loaded snapshot, `hasUnsavedChanges`, `canUpdate`, and `canSubmit`.
- `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js` already uses `runBatchRequests` with `compositeSave`, updates, actions, and a final `get` in one frontend-triggered GAS call.
- Current PO Receiving composables call `executeResourceAction('POReceivings', ..., GenerateGRN)` and rely on the GAS postAction to create GRN rows. This must change.

## Pre-Conditions
- [ ] Build Agent reads `Documents/ARCHITECTURE RULES.md` before touching any `FRONTENT/` file.
- [ ] Build Agent reads `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, and `Documents/GAS_PATTERNS.md` before touching `GAS/` files.
- [ ] Build Agent reads this plan and the current `PLANS/po-receiving-module-implementation.md` only for historical/current module context.
- [ ] Build Agent checks `git status --short` before editing and does not revert unrelated user/agent changes.

## Steps

### Step 1: Remove PO Receiving PostAction Wiring
- [ ] In `GAS/syncAppResources.gs`, set `PostAction: ''` for `POReceivings`.
- [ ] In `GAS/syncAppResources.gs`, set `PostAction: ''` for `GoodsReceipts`.
- [ ] Keep `AdditionalActions` that are still needed as generic mutate actions:
  - `POReceivings.Confirm`
  - `POReceivings.GenerateGRN`
  - `POReceivings.Cancel`
  - `GoodsReceipts.Invalidate`
- [ ] Do not introduce custom GAS endpoints.
- [ ] Do not change generic API contracts.
**Files**: `GAS/syncAppResources.gs`
**Pattern**: Existing frontend-owned workflow resources use generic actions/updates without custom postAction where practical.
**Rule**: `PostAction` must not be required for POR confirmation, GRN creation, GRN invalidation, or replacement/cancel workflows.

### Step 2: Remove Obsolete Workflow Hook File
- [ ] After Step 1, search for `handlePOReceivingWorkflow` and `poReceivingWorkflow`.
- [ ] If no runtime references remain, delete `GAS/poReceivingWorkflow.gs`.
- [ ] If a reference remains only in documentation, update that documentation in Step 7.
- [ ] Do not remove unrelated GAS workflow files such as `procurement.gs` or `stockMovements.gs`.
**Files**: `GAS/poReceivingWorkflow.gs`
**Pattern**: Keep GAS files only when active metadata or code dispatches them.
**Rule**: No dead postAction file should remain for this module.

### Step 3: Add POR Dirty/Clean State In The Add/Edit Flow
- [ ] Update `usePOReceivingAddFlow.js` to track a loaded snapshot of the POR header and item rows after load, select, save, and force refresh.
- [ ] Add computed state equivalent to the PR pattern:
  - `hasUnsavedChanges`
  - `canSaveDraft`
  - `canConfirm`
- [ ] `hasUnsavedChanges` must include header fields and all editable item fields that affect saved POR data.
- [ ] Save must always persist `Progress: 'DRAFT'`; do not allow save to write `CONFIRMED` or `GRN_GENERATED`.
- [ ] `canConfirm` must be true only when:
  - there is an existing POR code,
  - POR progress is `DRAFT`,
  - validation passes,
  - and `hasUnsavedChanges` is false.
- [ ] `confirmReceiving()` must not call `saveDraft()` first. If dirty, it must notify that the draft must be saved before confirmation.
**Files**: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`, `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`
**Pattern**: `usePurchaseRequisitionEditableFlow.js` snapshot/dirty/can-submit model.
**Rule**: Dirty POR shows Save only; clean draft POR shows Confirm only.

### Step 4: Save Draft Through One Batch Request
- [ ] Replace direct `workflowStore.saveComposite(buildCompositePayload(...))` with `workflowStore.runBatchRequests`.
- [ ] Batch requests for draft save should include:
  1. `compositeSave` for `POReceivings` + `POReceivingItems` using `Progress: 'DRAFT'`.
  2. Conditional `update` for linked `Procurements.Progress = 'GOODS_RECEIVING'` when the current procurement is `PO_ISSUED`.
  3. Final `get` for `PurchaseOrders`, `PurchaseOrderItems`, `POReceivings`, `POReceivingItems`, `GoodsReceipts`, `GoodsReceiptItems`, and `Procurements` with inactive rows included as needed.
- [ ] Extract parent code from the first batch response and update `form.Code` / `selectedReceivingCode`.
- [ ] Reset the loaded snapshot after successful save and refreshed data ingestion.
**Files**: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
**Pattern**: `usePurchaseOrderCreateFlow.js` one-call `runBatchRequests` sequence with final `get`.
**Rule**: Draft save must be one frontend-triggered GAS call and must not rely on GAS postAction.

### Step 5: Confirm Draft Through One Batch Request
- [ ] Confirm must run only for a clean draft POR.
- [ ] Replace direct standalone `executeResourceAction` with `runBatchRequests`.
- [ ] Batch requests for confirm should include:
  1. `executeAction` for `POReceivings.Confirm`.
  2. Optional `update` for linked `Procurements.Progress = 'GOODS_RECEIVING'` when needed.
  3. Final `get` for affected resources.
- [ ] Preserve action audit behavior by using the configured `Confirm` AdditionalAction rather than plain update where possible.
- [ ] Navigate to POR view after successful batch.
**Files**: `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
**Pattern**: Existing PR submit uses batch requests instead of isolated calls.
**Rule**: Confirmation must not save dirty data implicitly.

### Step 6: Create GRN Through CompositeSave In One Batch Request
- [ ] Add payload helpers that build:
  - `GoodsReceipts` header record from the confirmed POR, linked PO, linked procurement, and today date.
  - accepted-only `GoodsReceiptItems` child records from `POReceivingItems`, where `Qty = max(ReceivedQty - DamagedQty - RejectedQty, 0)`.
- [ ] Exclude item rows where accepted quantity is `0`.
- [ ] Block GRN generation in the composable when:
  - POR is not `CONFIRMED`,
  - a linked active GRN already exists,
  - no accepted quantity rows exist,
  - linked procurement is `COMPLETED`.
- [ ] Replace `executeAction('POReceivings', ..., GenerateGRN)`-only logic with one `runBatchRequests` call containing:
  1. `compositeSave` for `GoodsReceipts` parent and `GoodsReceiptItems` children.
  2. `executeAction` for `POReceivings.GenerateGRN` to stamp `Progress = GRN_GENERATED`.
  3. `update` for linked `Procurements.Progress = 'GRN_GENERATED'` when procurement is not `COMPLETED`.
  4. Final `get` for `POReceivings`, `POReceivingItems`, `GoodsReceipts`, `GoodsReceiptItems`, `PurchaseOrders`, and `Procurements`.
- [ ] Read the created GRN code from the first batch response and navigate to the GRN view after success.
- [ ] Implement this shared GRN creation path for both add flow and view flow; avoid duplicate logic between `usePOReceivingAddFlow.js` and `usePOReceivingView.js`.
**Files**: `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`, `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`, `FRONTENT/src/composables/operations/poReceivings/usePOReceivingView.js`
**Pattern**: `PurchaseOrders` create flow uses `compositeSave` plus follow-up updates/actions in one `runBatchRequests` call.
**Rule**: GRN creation must be frontend-owned and must not depend on `PostAction`.

### Step 7: Move Invalidation, Cancel, And Replacement Side Effects To Frontend Batch
- [ ] Update `useGoodsReceiptView.js` invalidation to use one batch request:
  1. `executeAction` for `GoodsReceipts.Invalidate`.
  2. Update or bulk-update active `GoodsReceiptItems` for that GRN to `Status: 'Inactive'`.
  3. If linked POR is `GRN_GENERATED`, update POR `Progress = 'CONFIRMED'`.
  4. If linked procurement is not `COMPLETED`, update procurement `Progress = 'GOODS_RECEIVING'`.
  5. Final `get` for affected resources.
- [ ] Update `usePOReceivingView.js` cancel to use one batch request:
  1. If active linked GRN exists, execute `GoodsReceipts.Invalidate`.
  2. If active linked GRN exists, update or bulk-update its active `GoodsReceiptItems` to inactive.
  3. Execute `POReceivings.Cancel` with required cancellation comment.
  4. If linked procurement is not `COMPLETED`, update procurement `Progress = 'PO_ISSUED'`.
  5. Final `get` for affected resources.
- [ ] Update `usePOReceivingAddFlow.js` replacement flow to use the same batch construction used by cancel/invalidation, then hydrate a new draft after success.
- [ ] Keep the frontend block for `COMPLETED` procurement; do not rely on backend postAction repair.
**Files**: `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`, `FRONTENT/src/composables/operations/poReceivings/usePOReceivingView.js`, `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
**Pattern**: Frontend-owned operation workflows perform related writes in one batch and refresh affected resources in-band.
**Rule**: No GRN invalidation or cancel side effect may depend on `GAS/poReceivingWorkflow.gs`.

### Step 8: Update Pages For Save-Only / Confirm-Only UX
- [ ] Update `PoReceivings/AddPage.vue` so:
  - Save button displays only when the current draft is dirty or has not yet been saved.
  - Confirm button displays only when there is an existing clean draft.
  - Generate GRN remains available only for confirmed POR without active GRN.
  - Button labels and disabled states reflect the PR editable-page pattern.
- [ ] If `PoReceivings/ViewPage.vue` exposes Generate GRN or Cancel, ensure actions call the frontend batch orchestration from Step 6/7.
- [ ] Keep pages thin; do not move payload-building or batch-building logic into page files.
**Files**: `FRONTENT/src/pages/Operations/PoReceivings/AddPage.vue`, `FRONTENT/src/pages/Operations/PoReceivings/ViewPage.vue`
**Pattern**: `PurchaseRequisitionEditablePage.vue` displays update vs submit based on clean/dirty state.
**Rule**: UI must not offer Confirm for dirty POR.

### Step 9: Update Registries And Canonical Docs
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` if new helpers/composable exports are added or existing PO Receiving composable responsibilities materially change.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` to state that PO Receiving GRN creation, invalidation, cancellation, and replacement are frontend-batch orchestrated.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if it currently references GAS postAction behavior for POR/GRN.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation with final state and validation.
- [ ] Update any existing doc references that say `GAS/poReceivingWorkflow.gs` is the active hook for this workflow.
**Files**: `FRONTENT/src/composables/REGISTRY.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Keep docs aligned with runtime ownership.
**Rule**: Docs must not claim GRN creation is GAS postAction-driven after this refactor.

### Step 10: Verification And Deployment
- [ ] Run targeted search checks:
  - `rg -n "handlePOReceivingWorkflow|poReceivingWorkflow" GAS FRONTENT/src Documents PLANS`
  - `rg -n "PostAction: 'handlePOReceivingWorkflow'|GenerateGRN" GAS/syncAppResources.gs FRONTENT/src/composables/operations/poReceivings`
- [ ] Run `npm run gas:push` because GAS metadata/file changes are part of the refactor.
- [ ] Run `npm --prefix FRONTENT run build` because this touches shared operation composables, custom pages, GAS metadata, and docs.
- [ ] Check `git status --short` after verification.
**Files**: repository root
**Pattern**: Current project verification policy for cross-surface frontend + GAS changes.
**Rule**: No Web App redeployment should be required because no custom API contract changes are planned.

## Documentation Updates Required
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with frontend-batch POR save/confirm/GRN/invalidate/cancel/replacement behavior.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if it mentions PO Receiving postAction ownership.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` if composable exports/responsibilities change.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with the final frontend-owned workflow state and validation results.

## Acceptance Criteria
- [ ] Saving a new or edited POR always saves `Progress = DRAFT`.
- [ ] Dirty POR state shows Save only.
- [ ] Clean saved draft POR state shows Confirm only.
- [ ] Confirming a POR uses one batch call and does not silently save dirty changes.
- [ ] Generating GRN uses one batch call with `GoodsReceipts` + `GoodsReceiptItems` `compositeSave`.
- [ ] Generated `GoodsReceiptItems` contain accepted quantity only.
- [ ] GRN generation updates POR to `GRN_GENERATED` and procurement to `GRN_GENERATED` without `PostAction`.
- [ ] GRN invalidation rolls active GRN items inactive and returns POR/procurement to the expected state without `PostAction`.
- [ ] POR cancel/replacement handles active linked GRN invalidation through frontend batch orchestration.
- [ ] `POReceivings` and `GoodsReceipts` no longer have `PostAction: 'handlePOReceivingWorkflow'`.
- [ ] `GAS/poReceivingWorkflow.gs` is deleted if no references remain.
- [ ] `npm run gas:push` succeeds.
- [ ] `npm --prefix FRONTENT run build` succeeds.

## Post-Execution Notes
Build Agent must update `Status`, `Executed By`, progress log, changed files, validation, and manual actions before finishing.

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

### Deviations / Decisions
- [x] `[?]` Decision: `GAS/poReceivingWorkflow.gs` was already absent from the workspace before this execution; no delete operation was required.
- [x] `[?]` Decision: Added shared `FRONTENT/src/composables/operations/poReceivings/poReceivingBatch.js` as a small reusable batch helper to avoid duplicating GRN/cancel/invalidation request construction between add/view flows.
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/operations/poReceivings/usePOReceivingAddFlow.js`
- `FRONTENT/src/composables/operations/poReceivings/usePOReceivingView.js`
- `FRONTENT/src/composables/operations/poReceivings/poReceivingPayload.js`
- `FRONTENT/src/composables/operations/poReceivings/poReceivingBatch.js`
- `FRONTENT/src/composables/operations/goodsReceipts/useGoodsReceiptView.js`
- `FRONTENT/src/pages/Operations/PoReceivings/AddPage.vue`
- `FRONTENT/src/pages/Operations/PoReceivings/ViewPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] `rg -n "handlePOReceivingWorkflow|poReceivingWorkflow" GAS FRONTENT/src Documents PLANS` completed; remaining hits are documentation/plan history only, with no runtime `GAS` or `FRONTENT/src` hook references.
- [x] `rg -n "PostAction: 'handlePOReceivingWorkflow'|GenerateGRN" GAS/syncAppResources.gs FRONTENT/src/composables/operations/poReceivings` completed; no `PostAction: 'handlePOReceivingWorkflow'` remains, and `GenerateGRN` remains only as the generic configured action/frontend batch action.
- [x] `npm run gas:push`
- [x] `npm --prefix FRONTENT run build`
- [ ] Manual POR save/confirm/GRN/invalidate/cancel/replacement checks completed (not available in local CLI verification)

### Manual Actions Required
- [x] Run APP resource sync from the AQL sheet menu so removed PostAction metadata is applied to live `APP.Resources`.
- [x] No Web App redeployment expected unless Build Agent changes the API contract.
