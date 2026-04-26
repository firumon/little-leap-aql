# PLAN: RFQ Create Flow And Index
**Status**: COMPLETED
**Created**: 2026-04-24
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Create the first custom RFQ frontend flow for AQL: an RFQ index that prioritizes draft RFQs, a click-first RFQ creation wizard from approved Purchase Requisitions, and a small RFQ view page. The flow must create RFQs from all PR items, update the linked PR and Procurement workflow states, and stay compliant with the frontend architecture boundaries.

## Context
- Active role for this plan: `Brain Agent`.
- Required docs reviewed: `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/ARCHITECTURE RULES.md`, `Documents/FRONTENT_README.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/CONTEXT_HANDOFF.md`, and `PLANS/_TEMPLATE.md`.
- Existing patterns reviewed:
  - `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`
  - `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionIndex.js`
  - `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionCreateFlow.js`
  - `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionEditableFlow.js`
  - `FRONTENT/src/composables/operations/procurements/useProcurements.js`
  - `FRONTENT/src/stores/workflow.js`
- User has manually updated app options for RFQ/RFQ supplier progress.
- Canonical values for this work:
  - `RFQProgress`: `DRAFT`, `SENT_TO_SUPPLIERS`, `CLOSED`, `CANCELLED`
  - `RFQSupplierProgress`: `ASSIGNED`, `SENT`, `RESPONDED`, `DECLINED`, `CANCELLED`
  - `PurchaseRequisitionProgress` target after RFQ create: `RFQ Processed`
  - `ProcurementProgress` target after draft RFQ create: `RFQ_GENERATED`
  - Future supplier-send target: `RFQ_SENT_TO_SUPPLIERS`
- RFQ sheet fields include: `Code`, `ProcurementCode`, `PurchaseRequisitionCode`, `PurchaseRequisitionItemsCode`, `RFQDate`, `LeadTimeDays`, `LeadTimeType`, `ShippingTermMode`, `ShippingTerm`, `PaymentTermMode`, `PaymentTerm`, `PaymentTermDetail`, `QuotationValidityDays`, `QuotationValidityMode`, `DeliveryMode`, `AllowPartialDelivery`, `AllowSplitShipment`, `SubmissionDeadline`, `Progress`, `Status`.

## Pre-Conditions
- [x] Confirm the user has already applied app option changes in the live/data source.
- [x] Build Agent reads `Documents/ARCHITECTURE RULES.md` before any `FRONTENT/` edit.
- [x] Build Agent reads `Documents/FRONTENT_README.md` before creating new frontend files.
- [x] Build Agent verifies current `useWorkflowStore.runBatchRequests()` response shape before wiring submit behavior.
- [x] Build Agent does not change backend schema unless implementation proves the existing generic API cannot support the workflow.

## Steps

### Step 1: Add RFQ Workflow Constants To Procurement Helper
- [x] Update `FALLBACK_PROCUREMENT_PROGRESS` to include `RFQ_SENT_TO_SUPPLIERS`.
- [x] Extend `procurementStage` with:
  - `rfqGenerated`
  - `rfqSentToSuppliers`
- [x] Keep existing PR workflow exports stable.
- [x] Do not move RFQ-specific form logic into `useProcurements.js`; only shared procurement stage helpers belong here.
**Files**: `FRONTENT/src/composables/operations/procurements/useProcurements.js`
**Pattern**: Existing `prCreated` / `prApproved` stage lookup.
**Rule**: Procurement stage names must resolve from `auth.appOptionsMap.ProcurementProgress` with fallback constants.

### Step 2: Create RFQ Payload/Metadata Helpers
- [x] Create RFQ helper module for field defaults, option descriptions, CSV helpers, and payload builders.
- [x] Add `buildPrItemCodeCsv(items)` that joins PR item `Code` values in datastore/display order.
- [x] Add `parsePrItemCodeCsv(value)` for view/summary rendering.
- [x] Add default date helpers:
  - `RFQDate = today` in `yyyy-MM-dd`
  - `SubmissionDeadline = RFQDate + 7 days`
  - `LeadTimeDays = days from today to selected PR.RequiredDate`, clamped to at least `0` when date is missing/past.
- [x] Add hardcoded user-facing descriptions for RFQ option cards:
  - Shipping terms: `EXW`, `FOB`, `CIF`, `DDP`
  - Payment terms: `ADVANCE`, `PARTIAL`, `CAD`, `LC`, `CREDIT`
  - Lead time types: `FLEXIBLE`, `STRICT`, `RANGE_10`, `RANGE_25`
  - Quotation validity modes: `MIN_REQUIRED`, `MAX_ALLOWED`, `FLEXIBLE`
  - Delivery modes: `ANY`, `FIXED`
- [x] Ensure terms copy is concise and business-friendly, based on the user-provided `C:\Users\firum\Desktop\Terms.txt`.
**Files**: `FRONTENT/src/composables/operations/rfqs/rfqMeta.js`, `FRONTENT/src/composables/operations/rfqs/rfqPayload.js`
**Pattern**: `purchaseRequisitionMeta.js`, `purchaseRequisitionPayload.js`
**Rule**: `PurchaseRequisitionItemsCode` is CSV, not JSON.

### Step 3: Build RFQ Create Composable
- [x] Create `useRFQCreateFlow()` as the single owner of the AddPage state and business logic.
- [x] Load required resources through `useResourceData(ref(...))`:
  - `PurchaseRequisitions`
  - `PurchaseRequisitionItems`
  - `RFQs`
  - optionally `Procurements` if needed for display/validation.
- [x] List only active approved PRs where `Progress === 'Approved'`.
- [x] When a PR is selected, show all PR items read-only for analysis; do not allow item selection.
- [x] Preserve PR item datastore order when building CSV.
- [x] Use app options for selectable values where available:
  - `RFQLeadTimeType`
  - `RFQShippingTermMode`
  - `RFQShippingTerm`
  - `RFQPaymentTermMode`
  - `RFQPaymentTerm`
  - `RFQQuotationValidityMode`
  - `RFQDeliveryMode`
- [x] Default missing option lists from local RFQ metadata helpers.
- [x] Implement wizard steps:
  - Step 1: Select approved PR and inspect PR items.
  - Step 2: Lead time, lead time type, quotation validity days/mode, submission deadline.
  - Step 3: shipping, payment, delivery, partial delivery, split shipment.
  - Step 4: summary and confirm.
- [x] If `LeadTimeDays` differs from calculated PR required-date lead time, expose a warning hint; do not block submit.
- [x] If `ShippingTermMode === 'ANY'`, keep `ShippingTerm` visible but disabled/readonly.
- [x] If `PaymentTermMode === 'ANY'`, keep `PaymentTerm` visible but disabled/readonly.
- [x] Build create workflow:
  - create `RFQs` with `Progress: 'DRAFT'`, `Status: 'Active'`, today `RFQDate`, default/editable `SubmissionDeadline`, selected PR code, Procurement code, and PR item CSV.
  - update selected `PurchaseRequisitions.Progress` to `RFQ Processed`.
  - update linked `Procurements.Progress` to `RFQ_GENERATED`.
- [x] If selected PR has no `ProcurementCode`, create a new Procurement first, then update the PR with the new Procurement code and use that code in the RFQ create.
- [x] Prefer `workflowStore.runBatchRequests()` for sequential write operations when the generated Procurement code is available from an earlier batch response.
- [x] If the existing batch result shape cannot safely pass the newly generated Procurement code into later requests, implement the submit as two sequential frontend calls inside the composable:
  - create Procurement and read returned code
  - create RFQ + update PR + update Procurement in a second batch
- [x] Navigate to RFQ view after successful create using `useResourceNav().goTo('view', { code })`.
**Files**: `FRONTENT/src/composables/operations/rfqs/useRFQCreateFlow.js`
**Pattern**: `usePurchaseRequisitionCreateFlow.js`, `usePurchaseRequisitionEditableFlow.js`, `useProcurements.js`
**Rule**: Components/pages must not call services or stores directly; this composable may use stores and resource composables.

### Step 4: Create Custom RFQ Add Page
- [x] Create `FRONTENT/src/pages/Operations/RFQs/AddPage.vue`.
- [x] Keep the page thin; it should only render the wizard and bind to `useRFQCreateFlow()`.
- [x] Use Quasar-first UI:
  - `q-stepper` or equivalent step navigation
  - `q-card` PR selection cards
  - `q-chip` item/code summaries
  - `q-select` / option cards for modes and terms
  - `q-toggle` for partial delivery and split shipment
  - `q-banner` for lead time warning
  - `q-btn` for next/back/confirm
- [x] Design for low keyboard usage: clicks, chips, toggles, date picker for deadline, numeric stepper/input for days.
- [x] Do not make `RFQDate` editable in the UI.
- [x] Keep the file near or below the 400-line rule; if it grows, split UI sections into local RFQ components.
**Files**: `FRONTENT/src/pages/Operations/RFQs/AddPage.vue`
**Pattern**: `FRONTENT/src/pages/Operations/PurchaseRequisitions/AddPage.vue`, `InitiatePurchaseRequisitionsPage.vue`
**Rule**: Add page is custom for RFQs and must stay frontend-layer compliant.

### Step 5: Create Custom RFQ Index Page
- [x] Create `FRONTENT/src/pages/Operations/RFQs/IndexPage.vue`.
- [x] Create `useRFQIndex()` for grouping/filtering/search/navigation.
- [x] Group RFQs by progress:
  - `DRAFT`
  - `SENT_TO_SUPPLIERS`
  - `CLOSED`
  - `CANCELLED`
  - `others`
- [x] Auto-expand/highlight `DRAFT` when draft RFQs exist, equivalent to PR Index prioritizing `Revision Required`.
- [x] Show compact RFQ cards with:
  - `Code`
  - `ProcurementCode`
  - `PurchaseRequisitionCode`
  - `RFQDate`
  - `SubmissionDeadline`
  - progress chip
  - shipping/payment summary chips
  - partial/split shipment indicators
- [x] Add refresh and search controls.
- [x] Add `+` create button when `permissions.canWrite`, navigating to AddPage through `useResourceNav`.
**Files**: `FRONTENT/src/pages/Operations/RFQs/IndexPage.vue`, `FRONTENT/src/composables/operations/rfqs/useRFQIndex.js`
**Pattern**: `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`, `usePurchaseRequisitionIndex.js`
**Rule**: DRAFT RFQs are high-priority actionable records.

### Step 6: Create Small RFQ View Page
- [x] Create `FRONTENT/src/pages/Operations/RFQs/ViewPage.vue`.
- [x] Load selected RFQ by route code through `useResourceData(ref('RFQs'))`.
- [x] Resolve CSV item codes with `parsePrItemCodeCsv()`.
- [x] Display a light read-only summary:
  - RFQ code
  - progress
  - PR code
  - Procurement code
  - RFQ date
  - submission deadline
  - PR item code chips
  - lead time/validity summary
  - shipping/payment/delivery summary
- [x] Include a back/index navigation action through `useResourceNav` if consistent with nearby pages.
- [x] Defer supplier assignment UI to a later plan.
**Files**: `FRONTENT/src/pages/Operations/RFQs/ViewPage.vue`
**Pattern**: Read-only portions of `PurchaseRequisitions/ViewPage.vue`
**Rule**: This is intentionally a minimal first view.

### Step 7: Update Frontend Registries If Required
- [x] Add new reusable composables to `FRONTENT/src/composables/REGISTRY.md`.
- [x] If Build creates reusable RFQ components under `FRONTENT/src/components/Operations/RFQs/`, add them to `FRONTENT/src/components/REGISTRY.md`.
- [x] Do not register page-private helpers that are not meant for reuse.
**Files**: `FRONTENT/src/composables/REGISTRY.md`, optionally `FRONTENT/src/components/REGISTRY.md`
**Pattern**: Existing purchase requisition registry entries.
**Rule**: Reusable frontend discovery must stay current.

### Step 8: Documentation And Handoff Updates
- [x] Update `Documents/CONTEXT_HANDOFF.md` after implementation with the RFQ flow state and new workflow rules.
- [x] If Build changes GAS/backend metadata or app option seed files, update the relevant structure/setup docs in the same execution.
- [x] Do not update backend docs if only frontend code changes and the user already manually changed app options.
**Files**: `Documents/CONTEXT_HANDOFF.md`, possibly backend/resource docs only if GAS/resource metadata changes.
**Pattern**: Existing current-state bullets.
**Rule**: Keep docs aligned only with actual changed surfaces.

## Documentation Updates Required
- [x] Update `FRONTENT/src/composables/REGISTRY.md` for `useRFQCreateFlow`, `useRFQIndex`, and any RFQ metadata/payload helper considered reusable.
- [x] Update `FRONTENT/src/components/REGISTRY.md` only if reusable RFQ components are created.
- [x] Update `Documents/CONTEXT_HANDOFF.md` after Build completion because this is a new procurement workflow surface.
- [x] If GAS files are changed, update the relevant GAS/resource docs and run `npm run gas:push` from repo root or `cd GAS && clasp push`.

## Acceptance Criteria
- [x] `/operations/rfqs` uses the custom RFQ index and auto-expands/highlights `DRAFT` RFQs.
- [x] RFQ index create button navigates to the custom RFQ AddPage for users with write permission.
- [x] AddPage lists only active approved PRs.
- [x] Selecting a PR shows all PR items in compact read-only analysis mode.
- [x] RFQ creation includes all selected PR's PR item codes as CSV in datastore order.
- [x] `RFQDate` is set to today in the payload and is not editable in the UI.
- [x] `SubmissionDeadline` defaults to RFQ date + 7 days and can be changed by user.
- [x] `LeadTimeDays` defaults from PR `RequiredDate`; user changes show a warning hint but do not block submit.
- [x] Shipping/payment term descriptions are visible enough for users unfamiliar with trade/payment terms.
- [x] `ANY` shipping/payment modes leave dependent term controls visible but disabled/readonly.
- [x] Confirming the wizard creates an RFQ with `Progress = DRAFT` and `Status = Active`.
- [x] Confirming the wizard updates the selected PR to `Progress = RFQ Processed`.
- [x] Confirming the wizard updates linked Procurement to `Progress = RFQ_GENERATED`.
- [x] If selected PR has no `ProcurementCode`, the flow creates a Procurement, updates the PR with its code, and uses that code for the RFQ.
- [x] Successful create navigates to the new RFQ ViewPage.
- [x] RFQ ViewPage displays a minimal read-only summary and parses PR item CSV into chips.
- [x] No page imports stores or services directly.
- [x] No new frontend file exceeds the project file-size rule without being split.

## Verification Guidance
- [x] Run targeted frontend lint/type/build checks available in the project if they are cheap and relevant.
- [x] Run `npm run build` inside `FRONTENT` if the implementation touches many files or Build considers the workflow cross-cutting enough to warrant it.
- [ ] Manually verify with seeded/local data:
  - approved PR with existing `ProcurementCode`
  - approved PR without `ProcurementCode`
  - PR with multiple items
  - lead time changed from default
  - `ANY` shipping/payment mode
  - generated RFQ view navigation

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

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
- [x] `[?]` Decision needed: none.
- [x] `[!]` Issue/blocker: Entity custom pages were created under `FRONTENT/src/pages/Operations/Rfqs/` instead of `RFQs/` because the existing auto-discovery resolver maps `/operations/rfqs` to `Rfqs`.

### Files Actually Changed
- `FRONTENT/src/composables/operations/procurements/useProcurements.js`
- `FRONTENT/src/composables/operations/rfqs/rfqMeta.js`
- `FRONTENT/src/composables/operations/rfqs/rfqPayload.js`
- `FRONTENT/src/composables/operations/rfqs/useRFQCreateFlow.js`
- `FRONTENT/src/composables/operations/rfqs/useRFQIndex.js`
- `FRONTENT/src/composables/operations/rfqs/useRFQView.js`
- `FRONTENT/src/pages/Operations/Rfqs/AddPage.vue`
- `FRONTENT/src/pages/Operations/Rfqs/IndexPage.vue`
- `FRONTENT/src/pages/Operations/Rfqs/ViewPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/2026-04-24-rfq-create-flow.md`

### Validation Performed
- [x] `npm run build` completed successfully in `FRONTENT`.
- [x] Acceptance criteria verified by code review/build where local seeded data was unavailable.

### Manual Actions Required
- [x] None known beyond the user's already-completed app option updates. No GAS files changed.
