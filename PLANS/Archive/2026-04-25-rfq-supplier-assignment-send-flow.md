# PLAN: RFQ Supplier Assignment And Send Flow
**Status**: COMPLETED
**Created**: 2026-04-25
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Gemini)

## Objective
Turn the RFQ record into a two-stage supplier dispatch workflow:
1. assign one or more suppliers to an RFQ and persist those rows in `RFQSuppliers` as `ASSIGNED`
2. mark selected assigned suppliers as `SENT`, stamp `SentDate` with today, and advance Procurement only when the RFQ supplier dispatch state warrants it

The RFQ itself must become read-only after supplier assignment, and supplier sending must be accessible later from the RFQ index/record flow for dispatch history and retry handling.

## Context
- Active role for this plan: `Brain Agent`.
- Required docs reviewed for this plan:
  - `AGENTS.md`
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/DOC_ROUTING.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/ARCHITECTURE RULES.md`
  - `Documents/FRONTENT_README.md`
  - `Documents/GAS_API_CAPABILITIES.md`
  - `Documents/CONTEXT_HANDOFF.md`
  - `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
  - `Documents/RESOURCE_COLUMNS_GUIDE.md`
  - `PLANS/_TEMPLATE.md`
- Current implementation state already in place:
  - RFQ index/view/create pages exist under `FRONTENT/src/pages/Operations/Rfqs/`
  - `RFQ` view currently supports draft editing and assign-supplier navigation
  - `useResourceConfig()` already normalizes navigate actions and `visibleWhen`
  - `workflowStore.updateResourceRecord()` exists and can be reused for single-record updates
  - `GAS/setupOperationSheets.gs` currently defines `RFQSuppliers` with headers:
    `Code, ProcurementCode, RFQCode, SupplierCode, SentDate, Progress, Status, AccessRegion`
  - `RFQSuppliers` schema currently needs alignment because its default/progress validation still assumes the old send-state shape
- Business rules from the user:
  - supplier selection is multi-select
  - supplier assignment writes to `RFQSuppliers`
  - `RFQSuppliers.Progress` starts at `ASSIGNED`
  - `RFQSuppliers.Status` is `Active`
  - `RFQSuppliers.SentDate` is blank on assignment and set to today when sent
  - `MARK AS SENT` updates only the specific suppliers selected on that page
  - RFQ becomes read-only after assignment
  - Procurement stays at `RFQ_GENERATED` until supplier dispatch is actually sent
  - once all relevant selected dispatch rows are sent, Procurement advances to `RFQ_SENT_TO_SUPPLIERS`

## Pre-Conditions
- [x] Build Agent confirms the current RFQ supplier schema and resource metadata before editing.
- [x] Build Agent reuses the existing RFQ custom page resolver pattern instead of hardcoding router logic.
- [x] Build Agent keeps all API calls inside approved stores/services/composables, not page components.
- [x] Build Agent updates only the docs that reflect the changed workflow and sheet semantics.

## Steps

### Step 1: Align RFQ Supplier Schema And Metadata
- [x] Update `GAS/setupOperationSheets.gs` so `RFQSuppliers` defaults and progress validation match the new workflow:
  - default `Progress = ASSIGNED`
  - keep `Status = Active`
  - keep `SentDate` as the send timestamp field
  - allow at least `ASSIGNED` and `SENT` in progress validation
  - retain `QUOTATION_RECEIVED` only if the later quotation flow still depends on it
- [x] Update any `GAS/syncAppResources.gs` metadata for RFQ workflow actions so the RFQ resource exposes both dispatch stages:
  - `Assign Supplier`
  - `Mark As Sent`
- [x] Ensure the RFQ/procurement progress vocabulary still includes `RFQ_SENT_TO_SUPPLIERS` where the workflow requires it.

**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/Constants.gs` if app options need the new state
**Pattern**: Existing operation-sheet setup and resource metadata rows.
**Rule**: `SentDate` is the sheet field name, not `SendDate`.

### Step 2: Create Shared RFQ Supplier Flow Logic
- [x] Add a reusable RFQ supplier workflow composable under `FRONTENT/src/composables/operations/rfqs/`.
- [x] Load the RFQ record, supplier master records, and RFQ supplier rows through approved resource composables.
- [x] Expose read-only RFQ header data for both supplier pages:
  - RFQ code
  - procurement code
  - PR code
  - PR item codes
  - RFQ date
  - submission deadline
  - key term fields
- [x] Expose supplier rows with display fields:
  - supplier name
  - province
  - country
  - contact person
- [x] Track selection state for multi-select checkbox/card UI.
- [x] Provide one save path for assignment and one save path for send-state updates.
- [x] Use generic workflow/store update calls only:
  - bulk create/update for `RFQSuppliers`
  - direct RFQ/procurement update calls when state needs to advance
- [x] Keep page-private rendering out of the composable.

**Files**: `FRONTENT/src/composables/operations/rfqs/useRFQSupplierFlow.js` or equivalent shared composable
**Pattern**: `useRFQCreateFlow.js`, `usePurchaseRequisitionEditableFlow.js`
**Rule**: The composable owns selection, payload shaping, and transition logic; pages stay thin.

### Step 3: Rebuild The Assign Supplier Page
- [x] Replace the current placeholder `RecordAssignSupplierPage.vue` with a working supplier assignment screen.
- [x] Render the RFQ primary fields as read-only only.
- [x] Render the supplier list as selectable cards or a compact table with checkbox selection.
- [x] Allow multiple suppliers to be selected.
- [x] On save, create `RFQSuppliers` rows for each selected supplier with:
  - `Progress = ASSIGNED`
  - `Status = Active`
  - `SentDate = ''`
  - `Code`, `ProcurementCode`, `RFQCode`, `SupplierCode` populated automatically
- [x] After a successful assignment save, set the RFQ to read-only mode.
- [x] Keep the page accessible later from the RFQ record/index route for history review.

**Files**: `FRONTENT/src/pages/Operations/Rfqs/RecordAssignSupplierPage.vue`
**Pattern**: RFQ view page layout plus Quasar selection controls.
**Rule**: No RFQ field editing after assignment.

### Step 4: Build The Mark-As-Sent Page
- [x] Create the second custom RFQ dispatch page for moving selected supplier rows from `ASSIGNED` to `SENT`.
- [x] Show the same read-only RFQ primary fields and the assigned supplier rows.
- [x] Allow the user to select only the specific assigned suppliers to send now.
- [x] Provide the dispatch tools on the page:
  - download RFQ document
  - RFQ text for WhatsApp
  - RFQ email body with attachment
  - RFQ email body without attachment
- [x] Enable `MARK AS SENT` only when at least one selected supplier row is still `ASSIGNED`.
- [x] On click, update only the selected rows:
  - `Progress = SENT`
  - `SentDate = today`
- [x] After the write succeeds, update `Procurement.Progress` to `RFQ_SENT_TO_SUPPLIERS` only when the workflow determines the RFQ has no remaining unsent assigned supplier rows.
- [x] Remove or hide the action forever for rows already sent, while keeping the page accessible from index for audit/history.

**Files**: `FRONTENT/src/pages/Operations/Rfqs/RecordMarkAsSentPage.vue` or the final resolver-named equivalent
**Pattern**: Record-page custom override routed through `ActionResolverPage.vue`.
**Rule**: Only the user-selected suppliers are updated on send.

### Step 5: Update RFQ Entry And Locking Behavior
- [x] Update the RFQ view surface so draft editing stops once assignment occurs.
- [x] Keep `SAVE` only for actual draft dirtiness.
- [x] Keep `ASSIGN SUPPLIER` available only when the RFQ is still editable and clean.
- [x] Add navigation entry points to the new mark-as-sent page so dispatch can be reached from the RFQ index/record flow.
- [x] Preserve the existing RFQ read-only summary behavior for later stages.

**Files**: `FRONTENT/src/pages/Operations/Rfqs/ViewPage.vue`, `FRONTENT/src/pages/Operations/Rfqs/IndexPage.vue` if needed
**Pattern**: Existing RFQ gateway view and navigation gating.
**Rule**: RFQ editing ends at the supplier assignment boundary.

### Step 6: Update Registries And Workflow Docs
- [x] Register the new composable in `FRONTENT/src/composables/REGISTRY.md`.
- [x] Update `FRONTENT/src/pages/Operations/_custom/REGISTRY.md` for the new RFQ custom pages.
- [x] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` to describe the new supplier-assignment/send lifecycle.
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` if the RFQ supplier progress semantics changed materially.
- [x] Update `Documents/MODULE_WORKFLOWS.md` with the RFQ supplier-dispatch workflow.
- [x] Update `Documents/CONTEXT_HANDOFF.md` so continuation sessions understand the new RFQ state model.

**Files**: `FRONTENT/src/composables/REGISTRY.md`, `FRONTENT/src/pages/Operations/_custom/REGISTRY.md`, `Documents/PROCUREMENT_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Existing registry and workflow documentation style.
**Rule**: Keep docs aligned with actual behavior only.

## Documentation Updates Required
- [x] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` with the RFQ supplier assignment/send lifecycle.
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with the new `RFQSuppliers.Progress` semantics and `SentDate` usage.
- [x] Update `Documents/MODULE_WORKFLOWS.md` with the RFQ supplier dispatch flow.
- [x] Update `Documents/CONTEXT_HANDOFF.md` after implementation so the current-state snapshot reflects the new RFQ workflow.
- [x] Update frontend registries for any new reusable composable/component.
- [x] If GAS files change, run `npm run gas:push` from the repo root.

## Acceptance Criteria
- [x] The Assign Supplier page shows RFQ primary fields in read-only mode.
- [x] The Assign Supplier page lets the user multi-select suppliers and saves them to `RFQSuppliers`.
- [x] New supplier rows are written with `Progress = ASSIGNED`, `Status = Active`, and blank `SentDate`.
- [x] The RFQ becomes read-only after supplier assignment.
- [x] The Mark As Sent page can update only the user-selected supplier rows.
- [x] Sending stamps `SentDate` with today and advances selected rows to `SENT`.
- [x] Procurement advances to `RFQ_SENT_TO_SUPPLIERS` only when the workflow rules say the RFQ dispatch is complete.
- [x] The page remains accessible from the RFQ index after send state is recorded.
- [x] No page directly calls GAS or IDB services outside the approved architecture layers.

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

### Deviations / Decisions
- [ ] `[?]` Decision needed: None
- [ ] `[!]` Issue/blocker: None

### Files Actually Changed
- `GAS/Constants.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/composables/operations/rfqs/useRFQSupplierFlow.js`
- `FRONTENT/src/pages/Operations/Rfqs/RecordAssignSupplierPage.vue`
- `FRONTENT/src/pages/Operations/Rfqs/RecordMarkAsSentPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`
- `FRONTENT/src/pages/Operations/Rfqs/REGISTRY.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] Targeted verification completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] `AQL > Resources > Sync APP.Resources from Code` if resource metadata changed
- [x] `cd GAS && clasp push` if GAS files changed
