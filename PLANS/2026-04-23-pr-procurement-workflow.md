# PLAN: Purchase Requisition Procurement Workflow
**Status**: COMPLETED
**Created**: 2026-04-23
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex)

## Objective
Implement the agreed Purchase Requisition to Procurement workflow end-to-end so frontend owns all workflow decisions, Purchase Requisitions render through one progress-aware view flow, and GAS is narrowed to Procurement create to PR code handoff only.

## Context
- Canonical PR progress values come from login `appOptionsMap.PurchaseRequisitionProgress`.
- Canonical Procurement progress values come from login `appOptionsMap.ProcurementProgress`.
- Old PR aliases like `New`, `Submitted`, `Review`, and `Revision` should not drive the new logic.
- Current PR workflow logic is spread across multiple purchase requisition composables.
- The entity-level Operations page resolver supports `FRONTENT/src/pages/Operations/PurchaseRequisitions/ViewPage.vue` as the custom view override.
- A GAS procurement hook already exists, but it currently contains broader workflow mapping that should move to frontend.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Create the canonical workflow layer
- [x] Add `operations/procurements/useProcurements.js` as the single frontend owner for PR workflow transitions, allowed actions, progress normalization, Procurement progress mapping, and revision/reject comment rules.
- [x] Centralize helpers for first submit, revision resubmit, review send-back, approve, and reject.
- [x] Ensure first submit builds a two-step batch flow: PR update plus Procurement create when `ProcurementCode` is missing.
- [x] Ensure revision resubmit updates PR to `Pending Approval` and existing Procurement to `PR_CREATED` without creating a new Procurement.
**Files**: `FRONTENT/src/composables/operations/procurements/useProcurements.js`
**Pattern**: Existing operation composables under `FRONTENT/src/composables/operations/`
**Rule**: Workflow decisions live in composables, not services or components.

### Step 2: Refactor Purchase Requisition composables around the workflow layer
- [x] Update PR create/edit/review/index composables to consume `useProcurements` instead of hardcoding status names and transition rules.
- [x] Rename the draft edit page/composable surface to the editable PR flow and keep it valid for both `Draft` and `Revision Required`.
- [x] Replace `ProgressReviewComment` usage with `ProgressRevisionRequiredComment` and add `ProgressRejectedComment` handling.
**Files**: `FRONTENT/src/composables/operations/purchaseRequisitions/*`
**Pattern**: Existing cache-first `useResourceData` plus workflow-store save actions
**Rule**: PR-specific form/item concerns stay in purchase requisition files; workflow meaning moves to procurements.

### Step 3: Add the progress-aware entity view flow
- [x] Create `FRONTENT/src/pages/Operations/PurchaseRequisitions/ViewPage.vue` as the entity-level custom view entry point.
- [x] Create `PurchaseRequisitionEditablePage.vue` for `Draft` and `Revision Required`.
- [x] Create `PurchaseRequisitionReviewPage.vue` for `Pending Approval` with Approve/Reject/Send Back actions.
- [x] Reuse the generic read-only view rendering for `Approved`, `Rejected`, and `RFQ Processed`.
- [x] Keep the UI Quasar-first, lightweight, and visually improved without overcomplicating the layout.
**Files**: `FRONTENT/src/pages/Operations/PurchaseRequisitions/ViewPage.vue`, `FRONTENT/src/components/Operations/PurchaseRequisitions/*`
**Pattern**: Thin page shells with composable-driven logic; existing PR hero/items/action-bar components where useful
**Rule**: View routing stays stable on `view`; rendered surface changes by progress.

### Step 4: Narrow GAS procurement behavior to code handoff only
- [x] Replace the current PR-centric procurement hook logic with a Procurement create postAction that reads the linked PR code from the create payload and writes the new Procurement code back to that PR.
- [x] Keep Procurement creation itself generic; no broader workflow decisions remain in GAS.
- [x] Push GAS changes after implementation.
**Files**: `GAS/procurement.gs`
**Pattern**: Existing centralized postAction dispatcher in `GAS/resourceApi.gs`
**Rule**: GAS only handles persistence-side linking/code transfer for this workflow.

### Step 5: Align docs, registries, and validation
- [x] Update composable/component registries for any new reusable frontend modules.
- [x] Update workflow-related docs where the PR/procurement flow meaning materially changed.
- [x] Update `Documents/CONTEXT_HANDOFF.md` because this changes process architecture and workflow ownership.
- [x] Run targeted validation for the changed frontend and GAS flow; run broader build only if the change radius justifies it.
**Files**: `FRONTENT/src/composables/REGISTRY.md`, `FRONTENT/src/components/REGISTRY.md`, `Documents/CONTEXT_HANDOFF.md`, related workflow docs if needed
**Pattern**: Registry/doc maintenance rules from AQL collaboration docs
**Rule**: Keep code, workflow docs, and handoff context aligned.

## Documentation Updates Required
- [x] Update relevant workflow docs with the finalized PR to Procurement flow and comment field conventions.
- [x] Update `FRONTENT/src/composables/REGISTRY.md` for new/changed reusable composables.
- [x] Update `FRONTENT/src/components/REGISTRY.md` if reusable PR components are added or their contracts change materially.
- [x] Update `Documents/CONTEXT_HANDOFF.md` for the new frontend-owned PR workflow and narrowed GAS hook role.

## Acceptance Criteria
- [x] First PR submit from `Draft` moves PR to `Pending Approval`, creates Procurement only when missing, sets Procurement progress to `PR_CREATED`, and links the Procurement code back to the PR.
- [x] `Revision Required` PRs are editable, require a comment on resubmit, append that comment into `ProgressRevisionRequiredComment`, and return the linked Procurement to `PR_CREATED`.
- [x] `Pending Approval` PRs render the review surface and support Approve, Reject, and Send Back with correct mandatory comment behavior.
- [x] `Approved`, `Rejected`, and `RFQ Processed` PRs render as read-only.
- [x] No old PR progress aliases are used for the new workflow logic.

## Post-Execution Notes (Solo Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

### Deviations / Decisions
- [x] Compatibility wrappers were kept for the old record-page files and composable import names so older routes/imports still land on the new editable PR flow while `ViewPage.vue` becomes the primary workflow surface.
- [x] `Procurements.PostAction` now owns the code-handoff hook and `PurchaseRequisitions.PostAction` is cleared in `syncAppResources.gs`; if the APP sheet registry still has the old metadata, it must be refreshed from code.

### Files Actually Changed
- `PLANS/2026-04-23-pr-procurement-workflow.md`
- `FRONTENT/src/composables/operations/procurements/useProcurements.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionEditableFlow.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionApprovalFlow.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionDraftFlow.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionReviewFlow.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionIndex.js`
- `FRONTENT/src/composables/REGISTRY.md`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewHero.vue`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewActionBar.vue`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/ViewPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/PurchaseRequisitionEditablePage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/PurchaseRequisitionReviewPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- `GAS/procurement.gs`
- `GAS/syncAppResources.gs`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] `npm run build` completed successfully in `FRONTENT/`.
- [x] `npm run gas:push` completed successfully from repo root.
- [x] Local Quasar dev server started successfully on `http://localhost:9100/`.
- [x] Acceptance criteria verified against the implemented frontend/GAS workflow logic.

### Manual Actions Required
- [x] Refresh `APP.Resources` from code if the sheet registry still contains the old PR `PostAction` metadata and has not yet been synced from `GAS/syncAppResources.gs`.
