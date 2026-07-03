# PLAN: Outlet Restock Approval Allocation Redesign
**Status**: COMPLETED
**Created**: 2026-05-12
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Redesign the `OutletRestocks` approval view so approvers can review ORSI rows by warehouse availability, apply recommended warehouse/storage allocations, split rows across storages when needed, and approve any allocated quantity while preserving unallocated quantity as pending.

The implementation must keep AQL frontend architecture intact: components render prepared UI state and emit user intent only; allocation grouping, recommendation, splitting, validation, and payload preparation live in composables or pure helpers.

## Context
Required pre-reads completed for this plan:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/OPERATION_CUSTOMIZATION.md`
- Restock workflow section in `Documents/MODULE_WORKFLOWS.md`
- `PLANS/_TEMPLATE.md`
- Existing related completed plan: `PLANS/2026-05-12-outlet-restock-delivery-finalization-plan.md`
- `FRONTENT/src/pages/operation/OutletRestocks/ViewPage.vue`
- `FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue`
- `FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue`
- `FRONTENT/src/composables/operation/outlets/useOutletRestocks.js`
- `FRONTENT/src/composables/operation/outlets/outletStockLogic.js`
- `FRONTENT/src/composables/operation/outlets/outletRestockPayload.js`

Current implementation observations:
- `RestockApprovalView.vue` currently renders a flat list of rows and derives `allocatedCount` inside the component.
- `OrsiAllocationRow.vue` currently uses a SKU label prop, storage select, quantity input, and manual split dialog.
- `useOutletRestocks.js` currently exposes `storageOptionsForSku`, `allocationAvailable`, `updateAllocation`, and `splitAllocation`.
- `outletStockLogic.js` currently has availability validation and row progress helpers but no allocation recommendation/grouping helper.
- `outletRestockPayload.js` already builds allocation batches, creates negative `StockMovements`, stamps allocated ORSI rows, and sets parent `OutletRestocks.Progress = APPROVED`.
- Worktree is already dirty from the restock/delivery model. Build Agent must preserve existing user/agent changes and avoid unrelated cleanup.

Workflow rules to preserve:
- ORSI is the atomic allocation/delivery unit.
- Allocated ORSI rows become `ALLOCATED`.
- Partial allocation is represented by splitting: allocated row(s) are `ALLOCATED`; remaining quantity stays `PENDING`.
- Parent `OutletRestocks.Progress` becomes `APPROVED` when at least one ORSI row is allocated.
- Send Back and Reject remain available and require a comment.
- Send Back appends to `ProgressRevisionRequiredComment`; Reject writes rejection stamp/comment fields through existing payload behavior.

## Pre-Conditions
- [x] Build Agent has read this plan.
- [x] Build Agent has reviewed the current dirty worktree and will preserve unrelated existing edits.
- [x] Build Agent has the current frontend dependencies installed.
- [x] No sheet schema or GAS API contract change is expected for this plan.

## Steps

### Step 1: Add Pure Allocation Recommendation Helpers
- [ ] In `outletStockLogic.js`, add pure helpers for ORSI approval allocation. Prefer focused exports over one large helper.
- [ ] Add a helper that normalizes active warehouse storage availability for a SKU into sorted storage candidates with `warehouseCode`, `storageName`, `available`, and display-safe ids.
- [ ] Add `recommendOrsiAllocation(row, warehouseStorages)` or equivalent returning:
  - `availabilityGroup`: `full`, `partial`, or `none`
  - `requestedQty`
  - `availableQty`
  - `recommendedAllocations`: array of `{ WarehouseCode, StorageName, Quantity }`
  - `remainingQty`
  - `reason`
- [ ] Implement recommendation priority exactly:
  - first, choose one storage that can fully satisfy the request; if multiple can, choose the smallest sufficient storage, then stable sort by warehouse/storage name.
  - second, choose a two-storage combination that can fully satisfy the request; choose the pair with the least surplus, then stable sort by warehouse/storage name.
  - third, allocate from the smallest available storages first, emptying each storage before moving to the next, until the request is filled or available stock is exhausted.
- [ ] Grouping must be based on total active warehouse availability for the SKU:
  - `full`: total available quantity is greater than or equal to requested quantity.
  - `partial`: total available quantity is greater than zero but less than requested quantity.
  - `none`: total available quantity is zero.
- [ ] Add a helper to expand one pending ORSI request into allocation rows:
  - one `ALLOCATED` row per recommended storage allocation.
  - one `PENDING` remainder row when `remainingQty > 0`.
  - preserve the original row `Code` on the first allocated row when the source row is persisted.
  - create split rows without `Code`.
  - preserve `SKU`, `OutletRestockCode`, `Status`, and `AccessRegion`.
- [ ] Add unit-testable validation behavior in helpers, even if this repo does not currently have a unit test harness: reject zero/negative requested quantities and ignore inactive/zero stock storage rows.
**Files**: `FRONTENT/src/composables/operation/outlets/outletStockLogic.js`
**Pattern**: Pure, stateless business helpers live outside components; no store/service imports.
**Rule**: Components must not calculate availability groups or recommendation splits.

### Step 2: Move Approval View Model Logic Into `useOutletRestocks`
- [ ] In `useOutletRestocks.js`, build a computed approval view model from `rows`, `warehouseStorages`, `skus`, and `products`.
- [ ] Expose grouped rows as `approvalAllocationGroups` or a similarly clear API with exactly these logical buckets:
  - fully available
  - partially available
  - not available
- [ ] Each row view model must include a human product display made from product name plus SKU variants. Do not use SKU/code-first labels for the primary human display.
- [ ] Keep SKU/code available only as secondary debug/support text if the UI needs it.
- [ ] Add a composable action such as `applyRecommendedAllocation(rowKey)` that replaces the source pending row with the recommended allocated split rows and pending remainder row.
- [ ] Add a composable action such as `updateAllocationRow(rowKey, patch)` for manual storage/quantity edits, keeping row progress changes centralized.
- [ ] Add a composable action such as `addAllocationSplit(rowKey)` or `splitAllocationToStorage(rowKey, payload)` for manual multi-storage allocation rows.
- [ ] Ensure rows with no available stock remain non-allocatable but still visible in the not-available group.
- [ ] Ensure already `ALLOCATED` rows in the in-memory approval draft are displayed in the appropriate current group or an explicit allocated sub-state without being hidden from review.
- [ ] Keep `approveRestock`, `sendBackRestock`, and `rejectRestock` as the only methods that run workflow/batch requests.
**Files**: `FRONTENT/src/composables/operation/outlets/useOutletRestocks.js`
**Pattern**: Components consume composable view models and emit actions; composable owns workflow behavior.
**Rule**: No direct store/service imports in components; keep current `workflowStore.runBatchRequests` usage in composable only.

### Step 3: Update Approval Payload for Split Rows and Stamps
- [ ] Review `buildRestockAllocationBatchRequests` so split rows are persisted correctly:
  - existing source row with `Code` and allocated quantity is updated.
  - additional storage split rows without `Code` are created as new ORSI rows.
  - partial remainder row without `Code` stays `PENDING`.
  - only `ALLOCATED` rows receive `ProgressAllocatedAt`, `ProgressAllocatedBy`, and `ProgressAllocatedComment`.
  - only `ALLOCATED` rows produce negative `StockMovements`.
- [ ] Ensure all allocated stock movements use the allocated ORSI row code where available. If a newly created split row code is not available inside the same bulk response, use the restock code as the fallback reference unless existing batch ref support can safely reference the created row code.
- [ ] Keep parent `OutletRestocks` update to `Progress: 'APPROVED'` only after validation confirms at least one allocated row exists.
- [ ] Preserve existing `ApprovedUser` and `ProgressApprovedComment` behavior on the parent.
- [ ] Do not change GAS files unless a concrete frontend payload contract issue is discovered.
**Files**: `FRONTENT/src/composables/operation/outlets/outletRestockPayload.js`
**Pattern**: Payload builders prepare batch request bodies; components never prepare API payloads.
**Rule**: Allocated quantity reserves stock immediately through negative `StockMovements`.

### Step 4: Redesign `RestockApprovalView.vue` as UI-Only Grouped Review
- [ ] Change props so the component receives prepared grouped approval data from the composable instead of raw `rows` plus logic functions.
- [ ] Render submitted and revision comments above the grouped items:
  - show `ProgressSubmittedComment` when present.
  - show `ProgressRevisionRequiredComment` when present.
  - keep HTML formatting through the existing `formatWorkflowCommentHtml` prop or move formatted HTML into the composable.
- [ ] Render three sections in this order:
  - Fully Available
  - Partially Available
  - Not Available
- [ ] Each section should show count and total requested/available quantities from the prepared group summary.
- [ ] The primary item label must be product name plus variants, not SKU/code labels.
- [ ] Provide an affordance to apply the recommended allocation for full and partial rows.
- [ ] Disable allocation controls for not-available rows.
- [ ] Keep a single approval action for `Approve Allocated`; disable it until at least one in-memory ORSI row is `ALLOCATED`.
- [ ] Keep Send Back and Reject actions and keep their comment requirement visible in the UI. Validation remains in the composable, but the buttons may be disabled locally when the comment is blank.
- [ ] Do not import stores, services, or business helpers in this component.
**Files**: `FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue`
**Pattern**: Presentation-only component with props and emits.
**Rule**: UI grouping is rendered from composable-provided data; component does not compute stock availability.

### Step 5: Update `OrsiAllocationRow.vue` for Split Allocation UI
- [ ] Keep this component UI-only. It should receive a prepared row view model and option lists from the parent/composable.
- [ ] Support rendering one ORSI request with multiple allocation lines when the recommendation or manual split uses multiple storages.
- [ ] Each allocation line should allow storage selection and quantity editing only when the row is editable.
- [ ] Emit intent events such as `apply-recommendation`, `update-allocation-line`, `add-line`, `remove-line`, or `reset-allocation`; do not mutate business state inside the component.
- [ ] Show requested, allocated, remaining, and available quantities using values provided by the view model.
- [ ] Show status chip from prepared progress only.
- [ ] For partial allocation, show the pending remainder quantity as a clear read-only remainder line.
- [ ] Avoid SKU/code as the main label; use product name plus variants from the view model.
**Files**: `FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue`
**Pattern**: Components emit user intent; composable updates row state.
**Rule**: No allocation recommendation or split math inside the component.

### Step 6: Wire `OutletRestocks/ViewPage.vue`
- [ ] Update `ViewPage.vue` to pass the new composable approval view model and action methods into `RestockApprovalView.vue`.
- [ ] Keep page responsibilities thin: route lookup, loading flags, and handing events to composable methods.
- [ ] Do not introduce direct `router.push()`, direct stores, or services in the page.
- [ ] Confirm editable and readonly modes still receive the same props they need.
**Files**: `FRONTENT/src/pages/operation/OutletRestocks/ViewPage.vue`
**Pattern**: Page is a thin orchestration shell.
**Rule**: Navigation stays through existing composable/resource-nav flow.

### Step 7: Registries and Workflow Docs
- [ ] Update `FRONTENT/src/components/REGISTRY.md` for changed `RestockApprovalView` and `OrsiAllocationRow` props/emits.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` for new/changed exports in `outletStockLogic`, `outletRestockPayload`, and `useOutletRestocks`.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` Restock Workflow only if implementation behavior changes beyond the current documented rules. At minimum, ensure the workflow explicitly states grouped approval, recommendation priority, split allocation, and pending remainder behavior if those details are not already documented.
- [ ] Do not update `Documents/CONTEXT_HANDOFF.md` unless Build Agent determines this is a major architectural/process change or the final state needs continuation notes.
**Files**: `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`, `Documents/MODULE_WORKFLOWS.md`
**Pattern**: Reusable interface changes require registry updates.
**Rule**: Keep docs aligned only where behavior or reusable contracts change.

### Step 8: Targeted Verification
- [ ] Run targeted static checks:
  - `rg -n "from '../../../stores|from '../../../services|useWorkflowStore|useDataStore|callGasApi" FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue`
  - `rg -n "router\\.push" FRONTENT/src/pages/operation/OutletRestocks FRONTENT/src/composables/operation/outlets`
  - `rg -n "skuLabel\\(|SKU.*label|Code.*·|WarehouseStorages" FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue FRONTENT/src/composables/operation/outlets/useOutletRestocks.js`
- [ ] Run a focused frontend syntax/build check appropriate to the touched files. If no smaller project script exists, run `npm --prefix FRONTENT run build` because this changes a core workflow surface.
- [ ] Manual scenario: one ORSI where one storage can fully satisfy quantity should appear under Fully Available and prefill one allocation line.
- [ ] Manual scenario: one ORSI where two storages together can satisfy quantity should appear under Fully Available and prefill two allocation lines.
- [ ] Manual scenario: one ORSI requiring three or more storages should prefill smallest storages first until full or stock is exhausted.
- [ ] Manual scenario: one ORSI with less total stock than requested should appear under Partially Available, create allocated row(s), and leave a PENDING remainder.
- [ ] Manual scenario: one ORSI with zero stock should appear under Not Available with allocation controls disabled.
- [ ] Manual scenario: approving allocated rows updates allocated ORSI rows to `ALLOCATED`, creates negative `StockMovements`, leaves partial remainder as `PENDING`, and sets parent restock to `APPROVED`.
- [ ] Manual scenario: Send Back and Reject cannot proceed without comment and still work with comment.
**Files**: frontend files touched by this plan.
**Pattern**: Targeted checks first; full build only when risk warrants.
**Rule**: No broad GAS deployment is required unless GAS files unexpectedly change.

## Documentation Updates Required
- [ ] `FRONTENT/src/components/REGISTRY.md` for changed approval component contracts.
- [ ] `FRONTENT/src/composables/REGISTRY.md` for changed composable/helper exports.
- [ ] `Documents/MODULE_WORKFLOWS.md` if final behavior adds recommendation priority details to the Restock Workflow section.
- [ ] `Documents/CONTEXT_HANDOFF.md` only if Build Agent decides the final implementation materially changes architecture/process or needs continuation notes.

## Acceptance Criteria
- [ ] Approval view groups ORSI rows into Fully Available, Partially Available, and Not Available sections.
- [ ] Human-facing item display uses product name plus variants as the primary label, not SKU/code labels.
- [ ] Allocation recommendation logic lives outside Vue components.
- [ ] Recommendation priority is single full storage, then best two-storage combination, then smallest storages first.
- [ ] Recommended full multi-storage allocations create one allocated ORSI row per storage.
- [ ] Recommended partial allocations create allocated ORSI row(s) and leave the remaining quantity as a PENDING ORSI row.
- [ ] Allocated ORSI rows are stamped with `ProgressAllocatedAt`, `ProgressAllocatedBy`, and `ProgressAllocatedComment`.
- [ ] Allocated ORSI rows produce negative `StockMovements`.
- [ ] Parent `OutletRestocks.Progress` becomes `APPROVED` when at least one ORSI row is allocated.
- [ ] Not-available rows stay visible and cannot be allocated.
- [ ] Send Back and Reject actions remain present and require comments.
- [ ] Submitted and revision comments show above grouped items.
- [ ] `RestockApprovalView.vue` and `OrsiAllocationRow.vue` do not import stores, services, or API helpers.
- [ ] `ViewPage.vue` remains a thin orchestration shell.
- [ ] Frontend registries are updated for changed reusable interfaces.

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
- [x] Step 7 completed
- [x] Step 8 completed

### Deviations / Decisions
- [x] `[?]` Decision needed: None.
- [x] `[!]` Issue/blocker: No blocker. Live browser/API approval was not executed; recommendation scenarios were verified through pure helper checks and the frontend production build.

### Files Actually Changed
- `FRONTENT/src/composables/operation/outlets/outletStockLogic.js`
- `FRONTENT/src/composables/operation/outlets/useOutletRestocks.js`
- `FRONTENT/src/composables/operation/outlets/outletRestockPayload.js`
- `FRONTENT/src/components/operation/Outlets/RestockApprovalView.vue`
- `FRONTENT/src/components/operation/Outlets/OrsiAllocationRow.vue`
- `FRONTENT/src/pages/operation/OutletRestocks/ViewPage.vue`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/MODULE_WORKFLOWS.md`

### Validation Performed
- [x] Targeted architecture searches completed.
- [x] Frontend syntax/build verification completed.
- [x] Manual grouped-allocation scenarios verified.
- [x] Acceptance criteria verified.

### Manual Actions Required
- [x] No manual sheet action expected.
- [x] No GAS push expected unless Build Agent changes GAS files.
- [x] No Web App redeployment expected unless Build Agent changes the API contract.

## Build Handoff
Build Agent, read `PLANS/2026-05-12-outlet-restock-approval-allocation-redesign-plan.md` and execute it end-to-end.

