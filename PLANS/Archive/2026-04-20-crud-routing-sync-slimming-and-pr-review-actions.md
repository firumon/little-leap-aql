# PLAN: CRUD Routing, Sync Slimming, and PR Review Actions
**Status**: COMPLETED
**Created**: 2026-04-20
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex)

## Objective
Fix canonical CRUD dispatch failures (`action=get` and similar), harden future payload handling, slim login-time sync to a single direct call, reduce misleading `master` naming in cross-scope functions, and restore save/submit behavior on Purchase Requisition review flow.

## Steps

### Step 1: Immediate CRUD routing fix + robust hardening
- [x] Replace scope-dependent CRUD detection with canonical action + resource selector validation.
- [x] Rename dispatcher helpers to generic names (`isGenericCrudAction`, `dispatchGenericCrudAction`).
- [x] Improve default error semantics for malformed canonical CRUD payloads.

**Files**: `GAS/apiDispatcher.gs`

### Step 2: Naming alignment for cross-scope sync functions
- [x] Rename frontend sync APIs from master-specific names to generic names.
- [x] Keep internal behavior consistent and update all imports/callers.

**Files**: `FRONTENT/src/services/ResourceFetchService.js`, `FRONTENT/src/services/ResourceSyncQueueService.js`, `FRONTENT/src/services/ResourceRecordsService.js`, `FRONTENT/src/stores/sync.js`

### Step 3: Login-time single-call slimming
- [x] Remove per-scope queue loop from global sync path.
- [x] Use one direct batched sync call over all readable non-functional resources.
- [x] Keep syncStore API behavior unchanged for callers.

**Files**: `FRONTENT/src/services/ResourceRecordsService.js`, `FRONTENT/src/stores/sync.js`, `FRONTENT/src/composables/core/useAuthLogic.js`

### Step 4: PR review page save/submit action fix
- [x] Implement actionable save/submit handlers in review composable.
- [x] Bind action bar to real handlers instead of re-emitting to no listener.
- [x] Remove obsolete scope field from PR payload builder.

**Files**: `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionReviewFlow.js`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`, `FRONTENT/src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload.js`

### Step 5: Verification and completion
- [x] Run targeted errors check on changed files.
- [x] Run frontend build.
- [x] Update plan status and changed files list.

## Acceptance Criteria
- [x] Canonical `get/create/update/bulk` works without `scope` when `resource` is provided.
- [x] Dispatcher error messages distinguish unsupported action vs malformed canonical payload.
- [x] Global sync executes as one direct call (not per-scope queue loop).
- [x] Review page save draft and submit trigger backend actions and user feedback.
- [x] No frontend build regressions.

## Post-Execution Notes
### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

### Files Actually Changed
- `GAS/apiDispatcher.gs`
- `FRONTENT/src/services/ResourceFetchService.js`
- `FRONTENT/src/services/ResourceSyncQueueService.js`
- `FRONTENT/src/services/ResourceRecordsService.js`
- `FRONTENT/src/stores/sync.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionReviewFlow.js`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`
- `PLANS/2026-04-20-crud-routing-sync-slimming-and-pr-review-actions.md`

### Validation Performed
- [x] Targeted error checks completed
- [x] Frontend build completed


