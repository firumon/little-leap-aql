# PLAN: Supplier Quotation Module
**Status**: COMPLETED
**Created**: 2026-04-25
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Build the Supplier Quotations feature so staff can manually capture supplier RFQ responses as normalized quotation headers and line items.

The module must support full quotations, partial quotations, and declines; expose a custom Supplier Quotations UI; update RFQ supplier/procurement progress only on the first saved response; and avoid comparison/scoring, purchase order generation, alternate item handling, RFQ snapshots, and database-level calculated flags.

## Context
- Source brief reviewed: `C:\Users\firum\Desktop\2026-04-25-supplier-quotation-module.md`.
- Active role for this plan: `Brain Agent`.
- Required docs reviewed for this plan:
  - `AGENTS.md`
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/DOC_ROUTING.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/ARCHITECTURE RULES.md`
  - `Documents/GAS_API_CAPABILITIES.md`
  - `Documents/GAS_PATTERNS.md`
  - `Documents/RESOURCE_COLUMNS_GUIDE.md`
  - `Documents/AQL_MENU_ADMIN_GUIDE.md`
  - `Documents/LOGIN_RESPONSE.md`
  - `Documents/CONTEXT_HANDOFF.md`
  - `PLANS/_TEMPLATE.md`
- Relevant current-state plan reviewed:
  - `PLANS/2026-04-25-rfq-supplier-assignment-send-flow.md`
- Existing implementation facts:
  - `SupplierQuotations` and `SupplierQuotationItems` already exist in `CONFIG.OPERATION_SHEETS`.
  - `GAS/syncAppResources.gs` has placeholder metadata for both resources.
  - `GAS/setupOperationSheets.gs` currently defines old/minimal Supplier Quotation headers.
  - RFQ custom pages exist under `FRONTENT/src/pages/Operations/Rfqs/`.
  - RFQ supplier dispatch is currently represented by `RFQSuppliers.Progress = ASSIGNED/SENT/RESPONDED/...` and `SentDate`.
  - `useResourceNav` is the required navigation path.
  - `workflowStore.runBatchRequests()`, `saveComposite()`, `updateResourceRecord()`, and `executeResourceAction()` are the approved frontend write orchestration surfaces.
- Important implementation risk:
  - `GAS/resourceApi.gs` currently builds executeAction auto-fill fields as `column + columnValue + At/By`. For uppercase `REJECTED`, that resolves to `ProgressREJECTEDAt`, while the requested headers are `ProgressRejectedAt` and `ProgressRejectedBy`. Build Agent must fix this case mapping cleanly or use an action configuration/value strategy that still preserves uppercase business values and populates the requested columns.

## Pre-Conditions
- [ ] Build Agent reads this plan and keeps implementation work aligned with it.
- [ ] Build Agent reads `Documents/ARCHITECTURE RULES.md` before editing any file under `FRONTENT/`.
- [ ] Build Agent confirms no newer Supplier Quotation plan supersedes this one.
- [ ] Build Agent confirms existing RFQ custom page resolver conventions before creating new pages.
- [ ] Build Agent confirms operation setup/refactor scripts that define Supplier Quotation headers and validations before editing GAS.
- [ ] Build Agent avoids broad verification until targeted changes are complete.

## Steps

### Step 1: Inspect Current Runtime Patterns
- [ ] Inspect the current Supplier Quotation resource rows in `GAS/syncAppResources.gs`.
- [ ] Inspect Supplier Quotation schemas in `GAS/setupOperationSheets.gs` and any other setup/refactor script that defines operation headers, defaults, or validations.
- [ ] Inspect RFQ custom pages and composables:
  - `FRONTENT/src/pages/Operations/Rfqs/IndexPage.vue`
  - `FRONTENT/src/pages/Operations/Rfqs/AddPage.vue`
  - `FRONTENT/src/pages/Operations/Rfqs/ViewPage.vue`
  - `FRONTENT/src/composables/operations/rfqs/useRFQIndex.js`
  - `FRONTENT/src/composables/operations/rfqs/useRFQCreateFlow.js`
  - `FRONTENT/src/composables/operations/rfqs/useRFQView.js` if present
  - `FRONTENT/src/composables/operations/rfqs/useRFQSupplierFlow.js`
  - `FRONTENT/src/composables/operations/rfqs/rfqPayload.js`
  - `FRONTENT/src/composables/operations/rfqs/rfqMeta.js`
- [ ] Inspect resource/navigation helpers and workflow stores before choosing save APIs:
  - `FRONTENT/src/composables/resources/useResourceNav.js`
  - `FRONTENT/src/composables/resources/useResourceData.js`
  - `FRONTENT/src/composables/resources/useResourceConfig.js`
  - `FRONTENT/src/composables/resources/useActionResolver.js`
  - `FRONTENT/src/composables/resources/useSectionResolver.js`
  - `FRONTENT/src/stores/workflow.js`
  - `FRONTENT/src/stores/data.js`
  - `FRONTENT/src/stores/sync.js`
  - `FRONTENT/src/stores/clientCache.js`
**Files**: read-only inspection first.
**Pattern**: Existing RFQ custom module and generic resource workflow patterns.
**Rule**: Do not introduce resource-specific logic into generic stores or services.

### Step 2: Align AppOptions And Dropdown Sources
- [ ] Update `GAS/Constants.gs` `APP_OPTIONS_SEED` with:
  - `SupplierQuotationResponseType: ['QUOTED', 'PARTIAL', 'DECLINED']`
  - `SupplierQuotationProgress: ['RECEIVED', 'ACCEPTED', 'REJECTED']`
  - `SupplierQuotationExtraChargeType: ['tax', 'freight', 'commission', 'handling', 'other']`
- [ ] Reuse existing RFQ option groups in the frontend for lead time, shipping term, payment term, and delivery mode.
- [ ] Check whether a currency AppOptions group already exists. If none exists, add a project-consistent group, preferably `Currency: ['AED']` unless existing project data clearly supports more values.
- [ ] Add matching setup/dropdown validations for every new Supplier Quotation option group where the target sheet has the field.
**Files**: `GAS/Constants.gs`, `GAS/setupOperationSheets.gs`, any related setup/refactor scripts discovered in Step 1.
**Pattern**: Existing `StockMovementReferenceType` and PR/RFQ option groups.
**Rule**: Do not hardcode selectable options inside Vue pages.

### Step 3: Update Supplier Quotation Sheet Schemas
- [ ] Replace the `SupplierQuotations` operation sheet header with:
  - `Code`
  - `ProcurementCode`
  - `RFQCode`
  - `SupplierCode`
  - `ResponseType`
  - `ResponseDate`
  - `DeclineReason`
  - `LeadTimeDays`
  - `LeadTimeType`
  - `DeliveryMode`
  - `AllowPartialDelivery`
  - `AllowSplitShipment`
  - `ShippingTerm`
  - `PaymentTerm`
  - `PaymentTermDetail`
  - `QuotationValidityDays`
  - `ValidUntilDate`
  - `Currency`
  - `TotalAmount`
  - `ExtraChargesBreakup`
  - `Remarks`
  - `Progress`
  - `ProgressRejectedComment`
  - `ProgressRejectedAt`
  - `ProgressRejectedBy`
  - `ResponseRecordedAt`
  - `ResponseRecordedBy`
  - `Status`
  - `AccessRegion`
  - common audit columns
- [ ] Set defaults for new quotation headers:
  - `Status = Active`
  - `Progress = RECEIVED`
  - `TotalAmount = 0`
  - `Currency = AED` or the selected default from the currency option group
  - `ExtraChargesBreakup` initialized to valid JSON with the controlled charge keys where practical.
- [ ] Apply dropdown validation for `ResponseType`, `Progress`, RFQ-derived option groups, and currency where supported by setup helpers.
- [ ] Replace the `SupplierQuotationItems` operation sheet header with:
  - `Code`
  - `SupplierQuotationCode`
  - `PurchaseRequisitionItemCode`
  - `SKU`
  - `Description`
  - `Quantity`
  - `UnitPrice`
  - `TotalPrice`
  - `LeadTimeDays`
  - `DeliveryDate`
  - `Remarks`
  - `Status`
  - common audit columns if the existing child-sheet pattern expects audit columns
- [ ] Use `SupplierQuotationCode`, not `QuotationCode`, if composite-save parent injection supports it. Current GAS parent-field resolution should support this because `SupplierQuotations` singularizes to `SupplierQuotationCode`.
- [ ] Remove old placeholder columns from the schema only through setup/refactor normalization, not manual sheet edits.
**Files**: `GAS/setupOperationSheets.gs`, any related operation setup/refactor script discovered in Step 1.
**Pattern**: Operation resource schema definitions in `setupOperationSheets()`.
**Rule**: No `IsQuoted`, `IsPartial`, `IsNormalized`, `IsComparable`, RFQ snapshots, alternate-item columns, or item-level constraint fields.

### Step 4: Update Resource Metadata
- [ ] Update `SupplierQuotations` in `GAS/syncAppResources.gs`:
  - keep `CodePrefix = SQ`
  - keep `RequiredHeaders = RFQCode,SupplierCode`
  - keep no uniqueness on `RFQCode + SupplierCode`
  - set `DefaultValues` for `Status`, `Progress`, and other project-consistent defaults
  - set `RecordAccessPolicy` consistently with procurement operation resources, unless current access rules require `ALL`
  - add the Procurement sidebar menu entry:
    - group `["Procurement"]`
    - order `5`
    - label `Supplier Quotations`
    - icon `request_quote`
    - route `/operations/quotations`
    - pageTitle `Supplier Quotations`
    - pageDescription `Record and manage supplier quotation responses`
    - show `true`
  - add a `Reject` mutate AdditionalAction visible only when `Progress = RECEIVED`
  - ensure `Reject` requires a mandatory comment field that maps to `ProgressRejectedComment`
- [ ] Update `SupplierQuotationItems` in `GAS/syncAppResources.gs`:
  - keep `CodePrefix = SQI`
  - set `RequiredHeaders = SupplierQuotationCode,SKU`
  - set `UniqueCompositeHeaders = SupplierQuotationCode+PurchaseRequisitionItemCode` or `SupplierQuotationCode+SKU` after confirming the best existing convention
  - keep menu empty and authorization included if child rows are needed by custom UI sync.
- [ ] Preserve unrelated resource metadata.
**Files**: `GAS/syncAppResources.gs`.
**Pattern**: `PurchaseRequisitions` AdditionalActions JSON and RFQ menu JSON.
**Rule**: Supplier Quotations sidebar entry is controlled by `APP.Resources.Menu`, not the Google Sheets admin menu.

### Step 5: Fix Or Confirm ExecuteAction Stamp Mapping
- [ ] Confirm whether existing `executeAction` can populate `ProgressRejectedAt/By/Comment` for uppercase `REJECTED`.
- [ ] If it cannot, update GAS executeAction header derivation to use a shared Pascal/title case conversion for stamp headers while preserving the stored business value exactly as `REJECTED`.
- [ ] Verify the same fix does not break existing display-case actions such as `Approved`, `Rejected`, and `Revision Required`.
- [ ] If a backend fix is made, document the behavior in `Documents/GAS_API_CAPABILITIES.md` or `Documents/GAS_PATTERNS.md` only if the public generic pattern changed materially.
**Files**: likely `GAS/resourceApi.gs`; docs only if behavior is materially clarified.
**Pattern**: Frontend `useActionFields()` derives fields with `toPascalCase(columnValue)`.
**Rule**: Business `Progress` values for Supplier Quotations remain uppercase: `RECEIVED`, `ACCEPTED`, `REJECTED`.

### Step 6: Create Supplier Quotation Composable Foundation
- [ ] Create Supplier Quotation operation composables under `FRONTENT/src/composables/operations/supplierQuotations/`.
- [ ] Add `supplierQuotationMeta.js` for option mapping, labels, progress ordering, status chip metadata, extra charge keys, and reusable display helpers.
- [ ] Add `supplierQuotationPayload.js` for:
  - header form defaults
  - item form defaults
  - controlled `ExtraChargesBreakup` JSON serialization/deserialization
  - numeric normalization
  - `TotalPrice = Quantity * UnitPrice` calculation when stored line totals are kept
  - create/update payload construction
  - composite-save child action mapping
- [ ] Add validation helpers in composables, not components:
  - RFQ required
  - supplier required
  - response type required
  - decline reason required for `DECLINED`
  - all RFQ items must be quoted for `QUOTED`
  - missing item rows allowed for `PARTIAL`
  - numeric fields non-negative where provided
  - `ExtraChargesBreakup` valid JSON with controlled keys
  - alternate SKUs disallowed.
**Files**:
  - `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationMeta.js`
  - `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
**Pattern**: `FRONTENT/src/composables/operations/rfqs/rfqMeta.js`, `rfqPayload.js`.
**Rule**: Components render and invoke composables only; all business rules live in composables.

### Step 7: Build Supplier Quotation Index Flow
- [ ] Create `useSupplierQuotationIndex.js`.
- [ ] Load needed resources via `useResourceData`:
  - `SupplierQuotations`
  - `SupplierQuotationItems` only if needed for summary counts
  - `RFQs`
  - `RFQSuppliers`
  - `Suppliers`
  - `Procurements`
- [ ] Filter active quotation rows and sort latest first.
- [ ] Group by `Progress` in order:
  - `RECEIVED`
  - `ACCEPTED`
  - `REJECTED`
  - unknown/other
- [ ] Default-expand `RECEIVED` when records exist.
- [ ] Exclude `REJECTED` quotations older than 14 days using `ProgressRejectedAt`, falling back to `UpdatedAt`, `ResponseRecordedAt`, or closest available audit timestamp.
- [ ] Keep `ACCEPTED` quotations visible until both:
  - related `Procurements.Progress = COMPLETED`
  - quotation last-updated timestamp is older than 14 days.
- [ ] Add search/filter support across quotation code, RFQ code, supplier code/name, procurement code, response type, amount, and dates.
- [ ] Expose navigation methods using `useResourceNav` only.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationIndex.js`.
**Pattern**: `useRFQIndex.js`.
**Rule**: No direct router usage in feature flow.

### Step 8: Build Supplier Quotation Index Page
- [ ] Create `FRONTENT/src/pages/Operations/SupplierQuotations/IndexPage.vue` or the exact resolver-mapped entity path after confirming route slug conversion for `/operations/quotations`.
- [ ] Render a Quasar-first custom index:
  - compact header
  - refresh/sync action
  - search input
  - progress groups
  - quotation cards with code, RFQ, supplier, procurement, response type, total/currency, dates, and progress chip
  - empty/loading states
  - FAB for Add when `canWrite`.
- [ ] Clicking a card navigates to View via `useResourceNav`.
- [ ] FAB navigates to Add via `useResourceNav`.
**Files**: `FRONTENT/src/pages/Operations/SupplierQuotations/IndexPage.vue`.
**Pattern**: `FRONTENT/src/pages/Operations/Rfqs/IndexPage.vue`.
**Rule**: Keep the page thin; move filtering/grouping to the composable.

### Step 9: Build Supplier Quotation Create Flow
- [ ] Create `useSupplierQuotationCreateFlow.js`.
- [ ] Load needed resources:
  - `RFQs`
  - `RFQSuppliers`
  - `Suppliers`
  - `SupplierQuotations`
  - `PurchaseRequisitionItems`
  - `Procurements`
- [ ] Show/select only RFQs with `Progress = SENT`.
- [ ] After RFQ selection, load/select suppliers from active assigned rows in `RFQSuppliers` matching `RFQCode`.
  - Include assigned/sent/responded rows as appropriate.
  - Avoid cancelled/inactive rows.
- [ ] Warn when the selected supplier already has one or more quotations for the selected RFQ.
- [ ] Allow multiple quotations from the same supplier for the same RFQ.
- [ ] Derive `ProcurementCode` from the selected RFQ.
- [ ] Parse RFQ `PurchaseRequisitionItemsCode` CSV and map to `PurchaseRequisitionItems.Code`.
- [ ] Build readonly item context from PR item rows:
  - PR item code
  - SKU
  - description/name if available
  - requested quantity
  - UOM if available.
- [ ] For `DECLINED`, validate decline fields and save no item rows.
- [ ] For `QUOTED`, require valid quote data for all RFQ PR item rows.
- [ ] For `PARTIAL`, allow missing item quote data and write only valid quoted item rows.
- [ ] On first save, use `compositeSave` for header + items when possible.
- [ ] Wrap first save and related progress updates in one `batch` request when needed:
  - create/update `SupplierQuotations`
  - create/update `SupplierQuotationItems`
  - update matching `RFQSuppliers.Progress = RESPONDED`
  - update `Procurements.Progress = QUOTATIONS_RECEIVED` only when current progress is exactly `RFQ_SENT_TO_SUPPLIERS`
  - include a final `get` for affected resources if needed for fresh deltas.
- [ ] Set `ResponseRecordedAt` and `ResponseRecordedBy` only for new quotations.
- [ ] Use the auth user shape for `ResponseRecordedBy`; follow existing timestamp/date conventions.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`.
**Pattern**: `useRFQCreateFlow.js`, `useRFQSupplierFlow.js`, `useProcurements.js`, `workflowStore.runBatchRequests()`.
**Rule**: Progress side effects happen only on first save when there was no existing quotation code.

### Step 10: Build Supplier Quotation Add Page
- [ ] Create `FRONTENT/src/pages/Operations/SupplierQuotations/AddPage.vue`.
- [ ] Use card-based clickable Quasar UI optimized for manual entry.
- [ ] Include these sections:
  - RFQ selection card
  - supplier selection card
  - duplicate quotation warning card
  - supplier response card
  - terms card
  - extra charges card
  - items card/list/table
  - summary card
  - explicit save/cancel action area.
- [ ] For decline responses, show only required decline fields and do not require items.
- [ ] For quoted/partial responses, show terms, charges, item entry, subtotal, and editable confirmed total.
- [ ] Use AppOptions-backed selects for response type, currency, lead time type, delivery mode, shipping term, payment term, and extra charge keys.
- [ ] Save only on explicit Save click.
**Files**: `FRONTENT/src/pages/Operations/SupplierQuotations/AddPage.vue`.
**Pattern**: `FRONTENT/src/pages/Operations/Rfqs/AddPage.vue`.
**Rule**: No auto-save and no hardcoded option lists in the page.

### Step 11: Build Supplier Quotation View/Edit Flow
- [ ] Create `useSupplierQuotationView.js`.
- [ ] Load the quotation, child items, RFQ, RFQ supplier, supplier master, PR item context, and procurement record.
- [ ] Expose progress-derived mode:
  - `RECEIVED` -> editable
  - `ACCEPTED` -> readonly
  - `REJECTED` -> readonly
  - unknown -> readonly fallback.
- [ ] Support editing and saving header/items only when `Progress = RECEIVED`.
- [ ] For existing quotation saves:
  - update quotation/header/item rows only
  - do not update `RFQSuppliers.Progress`
  - do not update `Procurements.Progress`
  - do not reset `ResponseRecordedAt` or `ResponseRecordedBy`.
- [ ] Expose reject action only for `RECEIVED`.
- [ ] Reject requires a mandatory comment and invokes the configured `Reject` AdditionalAction through `workflowStore.executeResourceAction()`.
- [ ] Ensure fields sent with reject include `ProgressRejectedComment` and allow GAS to fill `ProgressRejectedAt` and `ProgressRejectedBy` after Step 5 fix.
**Files**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`.
**Pattern**: `usePurchaseRequisitionApprovalFlow.js`, `useResourceConfig.additionalActions`, `workflowStore.executeResourceAction()`.
**Rule**: No acceptance/comparison/scoring logic in this module.

### Step 12: Build Supplier Quotation View Page And Subcomponents
- [ ] Create `FRONTENT/src/pages/Operations/SupplierQuotations/ViewPage.vue`.
- [ ] Use progress-based routing/rendering:
```vue
<EditableReceivedQuotation v-if="quotation.Progress === 'RECEIVED'" />
<ReadOnlyQuotation v-else-if="quotation.Progress === 'ACCEPTED'" />
<ReadOnlyQuotation v-else-if="quotation.Progress === 'REJECTED'" />
<ReadOnlyQuotation v-else />
```
- [ ] If the view would exceed the project size guidance, create UI-only components under `FRONTENT/src/components/Operations/SupplierQuotations/`, for example:
  - `EditableReceivedQuotation.vue`
  - `ReadOnlyQuotation.vue`
  - `SupplierQuotationItemsEditor.vue`
  - `SupplierQuotationSummary.vue`
- [ ] Keep components UI-only; components may use composables but must not import stores/services or implement business rules.
- [ ] Show rejection comment/date/user for rejected records.
**Files**:
  - `FRONTENT/src/pages/Operations/SupplierQuotations/ViewPage.vue`
  - optional `FRONTENT/src/components/Operations/SupplierQuotations/*.vue`
**Pattern**: Purchase Requisition view/edit/review split and RFQ view page shell.
**Rule**: Keep each file near the ~400-line project guidance.

### Step 13: Confirm Route Slug And Custom Page Resolution
- [ ] Confirm `/operations/quotations` resolves to resource `SupplierQuotations` via menu route matching.
- [ ] Confirm entity-custom path generated from slug `quotations` maps to the intended folder. If it maps to `Quotations`, either:
  - use folder `FRONTENT/src/pages/Operations/Quotations/`, or
  - change route to `/operations/supplier-quotations` and update the menu/admin docs accordingly.
- [ ] Prefer the least invasive route that preserves the source brief intent and actually resolves with `ActionResolverPage.vue`.
- [ ] If a custom UI registry is required for new full-page custom files, update it.
**Files**: `GAS/syncAppResources.gs`, `FRONTENT/src/pages/Operations/...`, `FRONTENT/src/pages/Operations/_custom/REGISTRY.md` if applicable.
**Pattern**: `ActionResolverPage.vue` `toPascalCase(resourceSlug)` resolution.
**Rule**: Route must match `APP.Resources.Menu` and the actual auto-discovered page path.

### Step 14: Update Registries
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` for new Supplier Quotation composables.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` if reusable Supplier Quotation components are added.
- [ ] Update `FRONTENT/src/pages/Operations/_custom/REGISTRY.md` only if tenant custom pages are added under `_custom`.
- [ ] If an entity-local registry pattern exists for RFQs or operation pages, add/update the Supplier Quotation equivalent only when created.
**Files**:
  - `FRONTENT/src/composables/REGISTRY.md`
  - `FRONTENT/src/components/REGISTRY.md`
  - optional page/component custom registries.
**Pattern**: Existing frontend registry table style.
**Rule**: Registry updates must reflect actual new reusable interfaces, not planned-but-uncreated files.

### Step 15: Update Documentation
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with Supplier Quotation/Supplier Quotation Item semantics:
  - response type/progress values
  - reject action tracking columns
  - parent link `SupplierQuotationCode`
  - no `IsQuoted`/partial flags.
- [ ] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` with Supplier Quotation and item headers plus workflow placement after RFQ supplier send.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` sidebar taxonomy if the Procurement group entry changes or is clarified.
- [ ] Update `Documents/LOGIN_RESPONSE.md` for new AppOptions groups and any currency option group.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` if procurement/RFQ workflow sections document supplier responses.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation because this is a major module/process change.
**Files**: docs listed above.
**Pattern**: Existing concise doc sections.
**Rule**: Keep docs aligned with actual implemented behavior, not future comparison/scoring work.

### Step 16: Targeted Verification
- [ ] Run syntax/lint/build checks appropriate to touched files.
- [ ] Inspect `package.json` before choosing commands.
- [ ] For frontend changes, run `npm run lint` or the closest available frontend check from the correct frontend directory if available.
- [ ] Run `npm run build` for frontend because this feature is cross-cutting and adds multiple pages/composables.
- [ ] If GAS files changed, run `npm run gas:push` from the repo root.
- [ ] If `npm run gas:push` is blocked by credentials/environment, report that explicitly and do not ask the user to copy-paste GAS files.
- [ ] Manually verify in the app/dev environment when possible:
  - sidebar shows Procurement -> Supplier Quotations
  - index grouping and stale filters work
  - add flow selects RFQ `SENT`
  - supplier list is RFQ-specific
  - duplicate warning appears
  - QUOTED/PARTIAL/DECLINED save paths work
  - first save updates RFQSupplier/Procurement progress correctly
  - subsequent saves do not repeat workflow progress updates
  - view page readonly/editable modes follow progress
  - reject works only for `RECEIVED` and stores comment/date/user.
**Files**: `package.json`, `FRONTENT/package.json` if present.
**Pattern**: Targeted checks first; full frontend build due to breadth.
**Rule**: Request Web App redeployment only if API contract changes. This plan should avoid API contract changes.

## Documentation Updates Required
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` for Supplier Quotation metadata/action-tracking semantics.
- [ ] Update `Documents/PROCUREMENT_SHEET_STRUCTURE.md` for Supplier Quotation/Supplier Quotation Item schemas and workflow placement.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` if the Procurement sidebar taxonomy changes or needs the Supplier Quotations entry aligned.
- [ ] Update `Documents/LOGIN_RESPONSE.md` for new AppOptions groups.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` if the documented procurement/RFQ workflow changes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation.
- [ ] Update frontend registries for any new reusable composable/component/page registry entry.

## Acceptance Criteria
- [ ] `SupplierQuotations` sheet/resource supports the finalized normalized header columns and defaults.
- [ ] `SupplierQuotationItems` sheet/resource supports finalized item columns and `SupplierQuotationCode` parent linkage.
- [ ] AppOptions include supplier quotation response/progress/extra charge groups and needed currency options.
- [ ] Supplier Quotations appears under Procurement at order 5.
- [ ] `SupplierQuotations` has a `Reject` AdditionalAction visible only for `RECEIVED`.
- [ ] Reject requires comment and populates `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`.
- [ ] Custom index page groups quotations by progress and filters stale rejected/accepted-completed records.
- [ ] FAB opens custom Add page using `useResourceNav`.
- [ ] Add page lets staff select an RFQ with `Progress = SENT`, then a supplier assigned to that RFQ.
- [ ] Add page warns but does not block when the same supplier already has quotation responses for the RFQ.
- [ ] Add page supports `QUOTED`, `PARTIAL`, and `DECLINED`.
- [ ] Add page loads item context from RFQ `PurchaseRequisitionItemsCode` to `PurchaseRequisitionItems.Code` and uses `SKU`.
- [ ] First save creates quotation/header/items and updates `RFQSuppliers.Progress` plus `Procurements.Progress` exactly as specified.
- [ ] Subsequent saves update only quotation/header/item data.
- [ ] View page uses progress-based rendering and is readonly for `ACCEPTED`/`REJECTED`.
- [ ] Components stay thin and business logic stays in composables.
- [ ] No comparison/scoring/PO generation, alternate item handling, RFQ snapshot columns, or database-level calculated flags are implemented.

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
- [x] Step 9 completed
- [x] Step 10 completed
- [x] Step 11 completed
- [x] Step 12 completed
- [x] Step 13 completed
- [x] Step 14 completed
- [x] Step 15 completed
- [x] Step 16 completed

### Deviations / Decisions
- [x] `[?]` Decision needed: `/operations/quotations` resolves to entity folder `Quotations`, so the page files were implemented under `FRONTENT/src/pages/Operations/Quotations/` while resource/composable names remain Supplier Quotation specific.
- [x] `[!]` Issue/blocker: Pre-existing deleted RFQ custom page files remain in the worktree and were not restored or modified by this plan execution.

### Files Actually Changed
- `GAS/Constants.gs`
- `GAS/syncAppResources.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/resourceApi.gs`
- `FRONTENT/src/pages/Operations/Quotations/IndexPage.vue`
- `FRONTENT/src/pages/Operations/Quotations/AddPage.vue`
- `FRONTENT/src/pages/Operations/Quotations/ViewPage.vue`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationIndex.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`
- `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
- `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationMeta.js`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/2026-04-25-supplier-quotation-module.md`

### Validation Performed
- [x] Targeted frontend boundary check completed: no direct `router.push`, `useRouter`, or service imports in the new Supplier Quotation pages/composables.
- [x] Frontend build completed: `npm run build` from `FRONTENT`.
- [x] GAS push completed: `npm run gas:push` from repo root pushed 25 Apps Script files.
- [x] Acceptance criteria verified against implemented code paths and build output.

### Manual Actions Required
- [ ] Run `AQL > Resources > Sync APP.Resources from Code` after GAS metadata deployment.
- [ ] Run `AQL > Setup & Refactor > Setup All Operations` after GAS schema deployment.
- [ ] Re-login to refresh `resources` and `appOptions`.
- [x] No Web App redeployment required; the transport/API contract was not changed.

## Build Handoff
Build Agent, read `PLANS/2026-04-25-supplier-quotation-module.md` and execute it end-to-end.
