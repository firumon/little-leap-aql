# PLAN: Outlet Consumptions UI, Invoice Views, and Visit Comment Follow-Up
**Status**: COMPLETED
**Created**: 2026-05-07
**Created By**: Brain Agent (Codex GPT-5)
**Executed By**: Build Agent (Codex GPT-5)

## Objective

Refine the `OutletConsumptions` module after the first implementation pass so it is usable by field users on mobile, exposes `OutletConsumptionInvoices` as a list/view-only resource, and supports pending-invoice completion from the consumption view.

Done means:

- Outlet consumption add flow is componentized into clear mobile-first steps.
- Stock count no longer uses a horizontally scrolling `q-table`.
- Date and username are internal defaults, not primary editable fields.
- Planned visit selection is a tappable row/card and completion remains explicit.
- Checklist options are aligned in rows.
- Auto-planned visits created after consumption carry a human-readable comment:
  `Auto planned after outlet consumption OC260001 by Firose Hussain on 29/10/2022`
- `OutletConsumptions` index is grouped by progress and shows outlet name/date as the primary human-readable row.
- `OutletConsumptions` view is a progress gateway with specific surfaces for pending invoice, generated invoice, and cancelled/other states.
- Pending invoice view can generate an invoice with zero pricing values.
- `OutletConsumptionInvoices` has a menu/list/view only; no add page.
- `PriceListCode` on `OutletConsumptionInvoices` is optional until pricing design is implemented.

## Context

### Source Decisions

User-approved decisions from Guide discussion:

- Keep selected-visit completion explicit, default checked only when a planned visit exists.
- Generated invoices use zero values until pricing is designed:
  - `Subtotal = 0`
  - `Discount = 0`
  - `Tax = 0`
- Do not ask the user for pricing fields while generating invoice.
- Make `OutletConsumptionInvoices.PriceListCode` optional for now.
- Add an invoice menu/list/view, but no add page.
- Refactor the all-in-one AddPage into components/steps.
- Keep all business logic in composables and components UI-only.

### Current State From Previous Plan

The previous Build Agent completed:

- `OutletConsumptions` plural parent resource.
- `OutletConsumptionItems.Qty`.
- `OutletConsumptionInvoices` resource.
- A functional but rough `OutletConsumption/AddPage.vue`.
- `useOutletConsumption.js` handles stock count and side-effect orchestration.
- `npm --prefix FRONTENT run build` succeeded.
- `npm run gas:push` succeeded.

Known issues to correct:

- AddPage uses a table-like stock count UI that wraps badly on mobile.
- Non-editable fields consume too much form space.
- Checklist options float visually instead of reading as decision rows.
- IndexPage is flat and code-first instead of progress-grouped and human-readable.
- ViewPage is not progress-specific and does not support pending invoice generation.
- `OutletConsumptionInvoices` has no menu/list/view route.
- Current next-visit creation does not include the requested human-readable auto-plan comment.

## Pre-Conditions

- [x] Build Agent has read `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, and this plan.
- [x] Build Agent has read `Documents/AI_COLLABORATION_PROTOCOL.md` before implementation.
- [x] Build Agent has read `Documents/ARCHITECTURE RULES.md` before touching `FRONTENT/`.
- [x] Build Agent has read `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, and `Documents/RESOURCE_COLUMNS_GUIDE.md` before touching `GAS/` or resource metadata.
- [x] Build Agent has inspected current files changed by the previous outlet-consumptions implementation before editing.
- [x] Build Agent has run `git status --short` and will preserve unrelated changes.

## Steps

### Step 1: Confirm Current Resource and Route Behavior

- [ ] Search for `OutletConsumptions`, `OutletConsumptionInvoices`, `PriceListCode`, `buildNextVisitRequest`, `OutletConsumption/AddPage`, and old singular `OutletConsumption`.
- [ ] Inspect operation route/page resolver behavior for custom operation pages and confirm folder naming requirements.
- [ ] Inspect existing custom index/view gateway patterns, especially PR and PO Receiving progress-driven pages.
- [ ] Confirm live code paths use `useResourceNav`, not direct `router.push`.

**Files**: `FRONTENT/src/router/`, `FRONTENT/src/pages/operation/`, `FRONTENT/src/composables/operation/outlets/`
**Pattern**: Existing progress-gateway pages such as Purchase Requisitions.
**Rule**: Do not rename route folders unless resolver behavior requires it.

### Step 2: Make `OutletConsumptionInvoices.PriceListCode` Optional

- [ ] Remove `PriceListCode` from `RequiredHeaders` for `OutletConsumptionInvoices` in resource sync metadata.
- [ ] Keep the `PriceListCode` column in the sheet schema as optional.
- [ ] Confirm invoice create payload can send blank `PriceListCode`.
- [ ] Update docs to state pricing is deferred and `PriceListCode` is optional until pricing design exists.

**Files**: `GAS/syncAppResources.gs`, `GAS/setupOperationSheets.gs`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/MODULE_WORKFLOWS.md`
**Pattern**: Optional-but-present columns remain in setup headers but are removed from `RequiredHeaders`.
**Rule**: Do not add invoice total/paid/balance fields.

### Step 3: Add `OutletConsumptionInvoices` Menu/List/View Only

- [ ] Add a visible menu item for `OutletConsumptionInvoices`.
- [ ] Route label should be human-readable, for example `Consumption Invoices`.
- [ ] Do not create or expose add/edit pages.
- [ ] Implement custom list and view pages only if generic list/view cannot show enough human context cleanly.
- [ ] Invoice list should show:
  - outlet name
  - invoice date
  - consumption code
  - username
  - payment progress
  - subtotal/discount/tax
- [ ] Invoice view should show:
  - invoice code
  - linked consumption code
  - outlet name
  - date
  - username
  - price list if available
  - subtotal/discount/tax
  - payment progress
  - link/navigation back to consumption where feasible.

**Files**: `GAS/syncAppResources.gs`, optional `FRONTENT/src/pages/operation/OutletConsumptionInvoices/`
**Pattern**: Existing custom operation page folders.
**Rule**: No invoice add flow in this plan.

### Step 4: Create Componentized Add Flow

- [ ] Keep `FRONTENT/src/pages/operation/OutletConsumption/AddPage.vue` as a thin orchestration shell.
- [ ] Split UI into components under `FRONTENT/src/components/operation/Outlets/`:
  - `OutletConsumptionContextStep.vue`
  - `OutletConsumptionStockCountStep.vue`
  - `OutletConsumptionSummaryStep.vue`
  - optional `OutletConsumptionCounterRow.vue` if stock count rows need a smaller reusable unit.
- [ ] Use `q-stepper`, tabs, or a simple step state if it improves mobile ergonomics.
- [ ] Do not put business logic in components.
- [ ] Components receive props and emit events only.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` for new reusable components.

**Files**: `FRONTENT/src/pages/operation/OutletConsumption/AddPage.vue`, `FRONTENT/src/components/operation/Outlets/*.vue`
**Pattern**: Quasar components, prop/event-driven UI, page consumes `useOutletConsumption`.
**Rule**: Components must not import stores, services, or call API/store methods.

### Step 5: Redesign Context Step

- [ ] Outlet remains the primary user input.
- [ ] Hide raw editable `Username` and `Date` inputs by default.
- [ ] `Username` should default from auth.
- [ ] `Date` should default to today.
- [ ] If shown, date/user should appear as compact read-only metadata, not form-heavy controls.
- [ ] Planned visit selection should be a tappable row/card:
  - no planned visit: show quiet empty state.
  - one planned visit: show one row with checkbox/toggle.
  - multiple planned visits: show compact list of selectable rows.
- [ ] Completion of selected visit remains explicit:
  - checked by default when visit exists.
  - disabled/unchecked when no selected visit.

**Files**: `OutletConsumptionContextStep.vue`, `useOutletConsumption.js`
**Pattern**: Existing `OutletVisits` status/options patterns.
**Rule**: Do not require an outlet visit to create a consumption.

### Step 6: Redesign Mobile Stock Count

- [ ] Replace table stock count UI with mobile-first product/SKU cards or rows.
- [ ] Each SKU row must fit mobile width without horizontal scroll.
- [ ] Each row should show:
  - product name
  - SKU display/variants
  - system quantity
  - current counted quantity
  - sold quantity
  - variance warning if counted > system
- [ ] Counter controls should be visually obvious:
  - minus icon button
  - numeric input/stepper area
  - plus icon button
  - `0` quick action
  - `Same` quick action
- [ ] `Same` must look clickable and should set counted stock to system stock.
- [ ] Use stable row/control dimensions so buttons and values do not wrap into three-line clutter.

**Files**: `OutletConsumptionStockCountStep.vue`, optional `OutletConsumptionCounterRow.vue`, `useOutletConsumption.js`
**Pattern**: Quasar buttons/inputs with touch-friendly spacing.
**Rule**: No `q-table` for the main stock count workflow.

### Step 7: Redesign Summary and Checklist Step

- [ ] Sold summary should be read-only and use human labels:
  - product name
  - SKU label
  - sold `Qty`
- [ ] Restock summary should be editable:
  - default from sold rows
  - allow quantity edits
  - allow remove
  - allow add extra SKU
- [ ] Checklist must be aligned in rows:
  - text/description left
  - toggle/checkbox right
  - disabled state clear
- [ ] Checklist dependencies:
  - submit-restock disabled unless place-restock checked.
  - place-restock disabled if no restock rows.
  - complete-visit disabled if no selected visit.
- [ ] Generate invoice should not show pricing fields.

**Files**: `OutletConsumptionSummaryStep.vue`, `useOutletConsumption.js`
**Pattern**: Existing Quasar `q-list`, `q-item`, `q-toggle`/`q-checkbox`.
**Rule**: Keep side-effect decision logic in composable, not component.

### Step 8: Add Human-Readable Auto-Planned Visit Comment

- [ ] Update next-visit request builder to accept the generated `OutletConsumptionCode`.
- [ ] When creating the next planned visit, write the best existing planned-comment field:
  - Prefer `StatusPlannedComment` if current `OutletVisits` schema has status triplet columns.
  - Otherwise use `StatusComment` if the current refined schema uses one comment field.
  - Build Agent must inspect current setup/resource metadata and pick the actual supported column.
- [ ] Comment format:
  - `Auto planned after outlet consumption OC260001 by Firose Hussain on 29/10/2022`
- [ ] Date format in comment should be `DD/MM/YYYY`.
- [ ] Actor should use the same current user display name used for `Username`.
- [ ] Do not add new `OutletVisits` columns.

**Files**: `FRONTENT/src/composables/operation/outlets/outletConsumptionPayload.js`, `FRONTENT/src/composables/operation/outlets/useOutletConsumption.js`
**Pattern**: Existing frontend batch side-effect request builders.
**Rule**: The comment needs the real returned consumption code, so it must be built after Phase 1 parent save.

### Step 9: Refactor `OutletConsumptions` Index

- [ ] Group records by progress:
  - `PENDING_INVOICE_GENERATION`
  - `INVOICE_GENERATED`
  - `CANCELLED`
  - `OTHER`
- [ ] Default expanded group:
  - expand pending invoice when pending records exist.
  - otherwise expand invoice generated.
- [ ] Primary row text should be outlet name + date.
- [ ] Secondary row text should include:
  - consumption code
  - username
  - total sold qty
  - invoice indicator if generated/found.
- [ ] Keep list tappable and navigates through `useResourceNav`.

**Files**: `FRONTENT/src/pages/operation/OutletConsumption/IndexPage.vue`, `useOutletConsumption.js`
**Pattern**: Existing grouped operation indexes such as restocks/visits/PO Receiving.
**Rule**: Do not make code the primary label when outlet/date are available.

### Step 10: Refactor `OutletConsumptions` View Into Progress Gateway

- [ ] Keep `ViewPage.vue` as a thin gateway.
- [ ] Create progress-specific components under `FRONTENT/src/components/operation/Outlets/` or page-local components if resolver conventions require:
  - `OutletConsumptionPendingInvoiceView.vue`
  - `OutletConsumptionInvoiceGeneratedView.vue`
  - optional `OutletConsumptionCancelledView.vue`
- [ ] Gateway chooses component based on `record.Progress`.
- [ ] All views should show human-readable context:
  - outlet name
  - date
  - username
  - optional visit code/date
  - sold item summary with product/SKU names and qty.
- [ ] Pending invoice view includes a `Generate Invoice` action.
- [ ] Generated invoice view shows invoice card and link/navigation to invoice view.
- [ ] Cancelled/other view should be read-only unless existing configured actions allow more.

**Files**: `FRONTENT/src/pages/operation/OutletConsumption/ViewPage.vue`, `FRONTENT/src/components/operation/Outlets/*.vue`, `useOutletConsumption.js`
**Pattern**: PR view gateway and outlet component UI-only conventions.
**Rule**: Progress-specific actions must stay in composable methods.

### Step 11: Implement Pending Invoice Generation Action

- [ ] Add composable method, for example `generateInvoiceForConsumption(record)`.
- [ ] Validate:
  - record exists
  - record progress is `PENDING_INVOICE_GENERATION`
  - no active invoice already exists for the consumption.
- [ ] Run a batch:
  - create `OutletConsumptionInvoices` with:
    - `OutletConsumptionCode`
    - `Date`
    - `OutletCode`
    - `Username`
    - `PriceListCode = ''`
    - `Subtotal = 0`
    - `Discount = 0`
    - `Tax = 0`
    - `Progress = PENDING_PAYMENT`
    - `ProgressPendingPaymentComment = Invoice generated from pending outlet consumption.`
  - execute or update `OutletConsumptions` to `INVOICE_GENERATED` and write action comment:
    - `Invoice generated from pending outlet consumption.`
- [ ] After success, refresh relevant resources and show generated view state.

**Files**: `useOutletConsumption.js`, `outletConsumptionPayload.js`
**Pattern**: Existing `workflowStore.runBatchRequests`, `executeActionRequest`, `resourceCreateRequest`.
**Rule**: No pricing input until pricing design is approved.

### Step 12: Update Documentation and Registries

- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` for optional `PriceListCode` and invoice menu/view behavior if relevant.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` to capture zero-pricing/deferred pricing rule.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` section `11.5 Consumption Workflow` for:
  - componentized add flow
  - pending invoice generation from view
  - grouped index behavior
  - invoice list/view only
  - auto-planned visit comment.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` for new components.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` if composable return surface changes.

**Files**: docs and registries listed above.
**Pattern**: Keep docs describing implemented state, not intended future work.
**Rule**: Do not update unrelated docs.

### Step 13: GAS Push and Verification

- [ ] Run targeted searches:
  - `PriceListCode` required headers no longer include invoice.
  - `OutletConsumptionInvoices` menu exists.
  - no invoice add page route/menu exists.
  - no `q-table` remains in the stock-count add flow.
  - auto-plan comment builder includes consumption code, actor, and `DD/MM/YYYY` date.
- [ ] Run `npm run gas:push` after GAS metadata changes.
- [ ] Run `npm --prefix FRONTENT run build` because the frontend scope is cross-cutting.
- [ ] Confirm no custom GAS endpoint was added.
- [ ] Record results in this plan.

**Files**: whole repo targeted search.
**Pattern**: Existing verification discipline.
**Rule**: Ask for Web App redeployment only if the generic API contract changes; this plan should not require it.

## Documentation Updates Required

- [x] `Documents/OPERATION_SHEET_STRUCTURE.md`
- [x] `Documents/RESOURCE_COLUMNS_GUIDE.md`
- [x] `Documents/MODULE_WORKFLOWS.md`
- [x] `Documents/CONTEXT_HANDOFF.md`
- [x] `FRONTENT/src/components/REGISTRY.md`
- [x] `FRONTENT/src/composables/REGISTRY.md` if return signatures change.

## Acceptance Criteria

### Add Flow UX

- [x] Add page is componentized and page file remains thin.
- [x] User selects outlet first.
- [x] Date and username are not editable primary controls.
- [x] Planned visit appears as tappable row/card and completion remains explicit.
- [x] Stock count is mobile-first, no horizontal scroll, no table layout.
- [x] Counter controls are clear and include `Same`.
- [x] Summary separates sold rows from editable restock rows.
- [x] Checklist is aligned in rows with clear disabled states.

### Index/View UX

- [x] `OutletConsumptions` index groups by progress.
- [x] Pending invoice group expands by default when present; otherwise generated group expands.
- [x] Index row primary text is outlet name + date.
- [x] Consumption view gateway renders progress-specific view.
- [x] Pending invoice view can generate invoice.
- [x] Generated invoice view shows invoice information and human-readable consumption context.

### Invoice Resource

- [x] `OutletConsumptionInvoices` has visible menu/list/view.
- [x] No add page/menu/action is exposed for invoices.
- [x] `PriceListCode` is optional.
- [x] Generated invoice uses zero pricing values until pricing design exists.

### Side Effects

- [x] Next planned visit comment uses:
  `Auto planned after outlet consumption <code> by <user> on <DD/MM/YYYY>`
- [x] No new `OutletVisits` columns are added.
- [x] Existing related resource columns are not structurally changed except `OutletConsumptionInvoices.PriceListCode` requiredness.

### Architecture and Verification

- [x] Components are UI-only and import no stores/services.
- [x] Composable owns validation, calculations, invoice generation, and workflow orchestration.
- [x] Navigation uses `useResourceNav`.
- [x] `npm run gas:push` completed.
- [x] `npm --prefix FRONTENT run build` completed.
- [x] No Web App redeployment is required unless Build Agent changes API contract unexpectedly.

## Post-Execution Notes (Build Agent fills this)

*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `pending` with the concrete agent/runtime identity used in that session. Build Agent must remove `pending` when execution completes.)*

### Progress Log

- [x] 2026-05-07 20:31 IST - Execution started as Build Agent; plan marked IN_PROGRESS and execution identity set.
- [x] 2026-05-07 20:36 IST - Step 1 completed: route resolver confirmed singular consumption folder is route-compatible; invoice route maps to `OutletConsumptionInvoices`.
- [x] 2026-05-07 20:38 IST - Step 2 started: invoice `PriceListCode` removed from `OutletConsumptionInvoices.RequiredHeaders`; column remains in sheet schema.
- [x] 2026-05-07 20:49 IST - Steps 4-8 implemented in code: add flow componentized, mobile stock cards added, summary/checklist redesigned, and auto-planned visit comment builder added.
- [x] 2026-05-07 20:55 IST - Steps 9-11 implemented in code: grouped consumption index, progress-gateway view, invoice list/view pages, and pending invoice generation action added.
- [x] 2026-05-07 21:08 IST - Step 13 completed: `npm run gas:push` succeeded after GAS metadata changes; final targeted searches and git status completed.
- [x] Step 1 completed: current route/resource behavior confirmed.
- [x] Step 2 completed: invoice `PriceListCode` made optional.
- [x] Step 3 completed: invoice menu/list/view added with no add flow.
- [x] Step 4 completed: add flow componentized.
- [x] Step 5 completed: context step redesigned.
- [x] Step 6 completed: mobile stock count redesigned.
- [x] Step 7 completed: summary/checklist redesigned.
- [x] Step 8 completed: auto-planned visit comment implemented.
- [x] Step 9 completed: consumption index grouped and humanized.
- [x] Step 10 completed: consumption view gateway added.
- [x] Step 11 completed: pending invoice generation action implemented.
- [x] Step 12 completed: docs and registries updated.
- [x] Step 13 completed: GAS push and verification completed.

### Deviations / Decisions

- [x] No pending decision needed.
- [x] No blocker encountered.

### Files Actually Changed

- `GAS/syncAppResources.gs`
- `GAS/setupOperationSheets.gs`
- `FRONTENT/src/composables/operation/outlets/outletConsumptionPayload.js`
- `FRONTENT/src/composables/operation/outlets/useOutletConsumption.js`
- `FRONTENT/src/pages/operation/OutletConsumption/AddPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumption/IndexPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumption/ViewPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumptionInvoices/IndexPage.vue`
- `FRONTENT/src/pages/operation/OutletConsumptionInvoices/ViewPage.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionContextStep.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionStockCountStep.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionSummaryStep.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionPendingInvoiceView.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionInvoiceGeneratedView.vue`
- `FRONTENT/src/components/operation/Outlets/OutletConsumptionReadonlyView.vue`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed

- [x] `git status --short` reviewed before edits and after final verification.
- [x] Targeted searches completed:
  - `rg -n "RequiredHeaders: 'OutletConsumptionCode,Date,OutletCode,Username,PriceListCode|q-table" FRONTENT/src/pages/operation/OutletConsumption FRONTENT/src/components/operation/Outlets GAS/syncAppResources.gs` returned no matches.
  - `rg -n "outlet-consumption-invoices|Consumption Invoices|Auto planned after outlet consumption|formatCommentDate|buildInvoiceGeneratedRequest" GAS FRONTENT/src Documents` returned expected implementation and documentation matches.
- [x] `npm run gas:push` completed; `clasp push --force` pushed 26 GAS files.
- [x] `npm --prefix FRONTENT run build` completed successfully.
- [x] Acceptance criteria verified.

### Manual Actions Required

- [ ] Run AQL resource sync from the Google Sheet menu so the invoice menu and required-header metadata reach live sheets.
- [ ] Re-login or clear frontend/resource cache if menu/resource metadata remains stale.
- [ ] No Web App redeployment required; no generic API contract changed.

