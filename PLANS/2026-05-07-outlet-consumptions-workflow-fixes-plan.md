# PLAN: Outlet Consumptions Workflow and Frontend Fixes
**Status**: COMPLETED
**Created**: 2026-05-07
**Created By**: Brain Agent (Kilo Code)
**Executed By**: Build Agent (Kilo Code)

## Objective
Fix Outlet Consumptions and related outlet operation workflows after the GAS batch reference framework is available. This includes pluralizing the Outlet Consumptions route/folder, adding planned-visit diagnostics, converting consumption submit to one batch, deleting zero OutletStorages rows, and fixing cumulative Outlet Restock delivery progress.

## Context
- This plan depends on [PLANS/2026-05-07-gas-record-batch-ref-framework-plan.md](2026-05-07-gas-record-batch-ref-framework-plan.md) for the new `record` action and `$ref` batch resolver.
- Outlet consumption pages currently live in singular [FRONTENT/src/pages/Operations/OutletConsumption](../FRONTENT/src/pages/Operations/OutletConsumption).
- The backend resource and constants use plural `OutletConsumptions` in [GAS/Constants.gs](../GAS/Constants.gs:55).
- The current menu route is singular in [GAS/syncAppResources.gs](../GAS/syncAppResources.gs:826).
- Planned visit filtering is in [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:76).
- Consumption submit currently runs sequential phases in [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:158).
- Outlet storage maintenance is handled by [GAS/outletMovements.gs](../GAS/outletMovements.gs:34), which currently leaves zero rows.
- Restock delivery progress is calculated in [FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js](../FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js:98), but it uses only current delivery quantity.

## Pre-Conditions
- [ ] [PLANS/2026-05-07-gas-record-batch-ref-framework-plan.md](2026-05-07-gas-record-batch-ref-framework-plan.md) is implemented and verified.
- [ ] Required docs were reviewed: [Documents/ARCHITECTURE RULES.md](../Documents/ARCHITECTURE%20RULES.md), [Documents/AI_COLLABORATION_PROTOCOL.md](../Documents/AI_COLLABORATION_PROTOCOL.md), [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md), [Documents/GAS_PATTERNS.md](../Documents/GAS_PATTERNS.md).
- [ ] Build Agent understands frontend files require strict architecture compliance: components UI-only, composables hold business logic, services/stores stay generic.

## Steps

### Step 1: Pluralize Outlet Consumptions route and page folder
- [ ] Rename [FRONTENT/src/pages/Operations/OutletConsumption](../FRONTENT/src/pages/Operations/OutletConsumption) to `FRONTENT/src/pages/Operations/OutletConsumptions`.
- [ ] Update the menu route in [GAS/syncAppResources.gs](../GAS/syncAppResources.gs:826) from `/operations/outlet-consumption` to `/operations/outlet-consumptions`.
- [ ] Update navigation calls in [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:221) and [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:222) to use `outlet-consumptions`.
- [ ] Search for remaining `outlet-consumption` route slug references and update route slugs only.
- [ ] Keep resource names `OutletConsumptions`, `OutletConsumptionItems`, and `OutletConsumptionInvoices` unchanged.
**Files**: [FRONTENT/src/pages/Operations/OutletConsumption](../FRONTENT/src/pages/Operations/OutletConsumption), [GAS/syncAppResources.gs](../GAS/syncAppResources.gs), [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js)
**Pattern**: Resolver uses slug-to-folder conversion through [FRONTENT/src/pages/Operations/ActionResolverPage.vue](../FRONTENT/src/pages/Operations/ActionResolverPage.vue:45) and [FRONTENT/src/utils/appHelpers.js](../FRONTENT/src/utils/appHelpers.js:19)
**Rule**: Route slug folder must match plural resource naming convention.

### Step 2: Add planned-visit diagnostics to Outlet Consumption Add page
- [ ] Extend [useOutletConsumption()](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:24) with computed diagnostics:
  - total loaded OutletVisits count.
  - visits matching selected `OutletCode` regardless of status.
  - active planned visits matching selected `OutletCode`.
  - optional status distribution for selected outlet.
- [ ] Keep `plannedVisits` filtering strict but normalized with `text(row.Status).toUpperCase() === 'PLANNED'` and `text(row.OutletCode) === text(form.value.OutletCode)`.
- [ ] Pass diagnostics from [FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue](../FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue) to [OutletConsumptionContextStep.vue](../FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue).
- [ ] Update empty state in [OutletConsumptionContextStep.vue](../FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue:18) to show useful diagnostics only when no planned visits are visible.
- [ ] Do not call stores or services directly from the component.
**Files**: [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js), [FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue](../FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue), [FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue](../FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue)
**Pattern**: Component receives props and emits events only, like [OutletConsumptionContextStep.vue](../FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue:39)
**Rule**: Diagnostics reveal whether issue is loading/authorization, outlet-code mismatch, or status mismatch.

### Step 3: Convert consumption submit to one batch using standard `$ref`
- [ ] Replace the three-phase submit in [saveConsumption()](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js:158) with one `workflowStore.runBatchRequests()` call.
- [ ] Build one request array using the new standard from [PLANS/2026-05-07-gas-record-batch-ref-framework-plan.md](2026-05-07-gas-record-batch-ref-framework-plan.md).
- [ ] First request creates `OutletConsumptions` with child `OutletConsumptionItems` through `compositeSave`.
- [ ] Subsequent side-effect requests reference `{ "$ref": "OutletConsumptions.latest.code" }` for `OutletConsumptionCode`, `ReferenceCode`, and consumption action `code`.
- [ ] If placing and submitting restock, create `OutletRestocks` through `compositeSave`, then submit it with `{ "$ref": "OutletRestocks.latest.code" }`.
- [ ] Remove fallback request [buildConsumptionProgressFallbackRequest()](../FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js:110) if the new one-batch flow makes it unnecessary.
- [ ] Keep payload-construction helpers in [outletConsumptionPayload.js](../FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js), not in page/components.
- [ ] Ensure response handling reads created codes from batch result if needed only for notification/navigation, while state updates remain generic.
**Files**: [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js), [FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js](../FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js), [FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js](../FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js)
**Pattern**: Existing request-builder separation in [outletConsumptionPayload.js](../FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js:13)
**Rule**: One consumption submit equals one HTTP batch request.

### Step 4: Delete zero OutletStorages rows on movement application
- [ ] Update [applyBatchOutletMovementsToOutletStorages()](../GAS/outletMovements.gs:34) to delete existing outlet storage rows when `nextQty <= 0`.
- [ ] Do not create new `OutletStorages` rows for zero or negative new balances.
- [ ] Follow the descending-row delete pattern from [GAS/stockMovements.gs](../GAS/stockMovements.gs:287).
- [ ] Update sync cursor only when rows are updated, inserted, or deleted.
- [ ] Add a one-time cleanup function or admin-safe utility to remove existing `OutletStorages` rows with `Quantity <= 0` if Build Agent determines immediate data cleanup is required.
**Files**: [GAS/outletMovements.gs](../GAS/outletMovements.gs), optionally [GAS/setupOperationSheets.gs](../GAS/setupOperationSheets.gs) only if a setup/admin cleanup hook is added
**Pattern**: Warehouse storage zero deletion in [GAS/stockMovements.gs](../GAS/stockMovements.gs:245)
**Rule**: OutletStorages should store only positive stock balances.

### Step 5: Fix cumulative Outlet Restock delivery progress
- [ ] Update [deliveryRestockProgress()](../FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js:98) to include previously delivered deliveries for the same `OutletRestockCode`.
- [ ] Sum active deliveries with `Progress === 'DELIVERED'` plus current scheduled delivery `ItemsJSON`.
- [ ] Compare cumulative delivered total against requested restock item total.
- [ ] Return `DELIVERED` only when cumulative total reaches requested total; otherwise return `PARTIALLY_DELIVERED`.
- [ ] Use or extend existing helpers in [outletStockLogic.js](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js), such as [deliveredQtyForSku()](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js:11) and [deliverySummary()](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js:87).
- [ ] Ensure [eligibleRestocks](../FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js:34) still allows partially delivered restocks when no scheduled delivery exists.
**Files**: [FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js](../FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js), [FRONTENT/src/composables/operations/outlets/outletStockLogic.js](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js)
**Pattern**: Existing delivery parsing helpers in [outletStockLogic.js](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js:7)
**Rule**: Restock progress is based on cumulative delivered quantity, not only current delivery quantity.

### Step 6: Align related resource metadata and generated resources
- [ ] Run or prepare sync for APP.Resources after changing [GAS/syncAppResources.gs](../GAS/syncAppResources.gs), depending on deployment flow.
- [ ] Confirm [GAS/Constants.gs](../GAS/Constants.gs:55) remains unchanged for resource names.
- [ ] If menu docs exist for operation routes, update them only if they describe outlet-consumption singular route.
**Files**: [GAS/syncAppResources.gs](../GAS/syncAppResources.gs), [GAS/Constants.gs](../GAS/Constants.gs)
**Pattern**: Menu route definitions in [GAS/syncAppResources.gs](../GAS/syncAppResources.gs:801)
**Rule**: Menu route and frontend resolver folder must align.

## Documentation Updates Required
- [ ] Update [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md) examples if outlet consumption single-batch workflow is used as an example of `$ref` dependency chaining.
- [ ] Update [Documents/GAS_PATTERNS.md](../Documents/GAS_PATTERNS.md) if outlet movement storage cleanup is documented as a stock ledger pattern.
- [ ] Update [Documents/OPERATION_SHEET_STRUCTURE.md](../Documents/OPERATION_SHEET_STRUCTURE.md) only if the cleanup function or storage-row semantics are documented there.
- [ ] Update [Documents/MODULE_WORKFLOWS.md](../Documents/MODULE_WORKFLOWS.md) only if Outlet workflows are documented there and describe old multi-phase behavior or singular route.
- [ ] Update [FRONTENT/src/composables/REGISTRY.md](../FRONTENT/src/composables/REGISTRY.md) only if reusable composable APIs are added or changed.
- [ ] Update frontend component registries only if reusable component props/interfaces are materially changed beyond local outlet usage.

## Acceptance Criteria
- [ ] Outlet Consumptions page resolves from plural route `/operations/outlet-consumptions` and folder `OutletConsumptions`.
- [ ] Old singular route slug references are removed except historical docs if intentionally retained.
- [ ] Empty planned-visit UI shows diagnostics that distinguish no visits loaded, no visits for outlet, and no planned visits for outlet.
- [ ] Consumption submit uses one batch request for parent, items, movements, invoice, visit completion, next visit, optional restock creation, and optional restock submit.
- [ ] OutletStorages rows reaching `Quantity <= 0` are deleted and new non-positive rows are not created.
- [ ] Existing zero OutletStorages can be cleaned up by an explicit cleanup routine or documented manual/admin action.
- [ ] A partially delivered OutletRestock becomes `DELIVERED` after cumulative delivered quantity reaches requested quantity.
- [ ] No components call services or stores directly.
- [ ] GAS changes are pushed with `npm run gas:push` or equivalent.
- [ ] User is told to redeploy Web App if this plan is executed together with the API-contract plan.

## Verification Guidance
- [ ] Search for `outlet-consumption` and verify intended pluralization.
- [ ] Use a test outlet with known OutletVisits to inspect planned-visit diagnostics.
- [ ] Submit an outlet consumption and verify browser/network shows one batch request.
- [ ] Verify resulting `OutletConsumptions`, `OutletConsumptionItems`, `OutletMovements`, `OutletConsumptionInvoices`, `OutletVisits`, and optional `OutletRestocks` update correctly.
- [ ] Apply an outlet movement that reduces a storage row to zero and verify the row is deleted.
- [ ] Deliver a restock in two partial deliveries and verify the final restock progress becomes `DELIVERED`.
- [ ] Run targeted lint/build checks only if touched scope warrants it; broad frontend build only if cross-cutting risk is high.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] 2026-05-07T12:28:19Z — Build Agent startup completed: read `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, assigned workflow-fixes plan, and dependency plan status.
- [x] 2026-05-07T12:28:29Z — Required implementation docs reviewed: `Documents/ARCHITECTURE RULES.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, and `Documents/GAS_PATTERNS.md`; dependency plan is `COMPLETED`.
- [x] 2026-05-07T12:28:38Z — Plan marked `IN_PROGRESS` for Build Agent execution.
- [x] 2026-05-07T12:31:13Z — Inspected outlet consumption/delivery composables, payload builders, context/add page, outlet movement hook, stock zero-delete pattern, menu route metadata, and current singular route search results.
- [x] 2026-05-07T12:31:25Z — Renamed frontend page folder from `FRONTENT/src/pages/Operations/OutletConsumption` to `FRONTENT/src/pages/Operations/OutletConsumptions`.
- [x] 2026-05-07T12:31:41Z — Updated Outlet Consumptions menu route and composable navigation slug to `/operations/outlet-consumptions` / `outlet-consumptions`.
- [x] 2026-05-07T12:32:28Z — Added planned visit diagnostics, normalized planned visit filtering, added `batchRef()` helper, and converted consumption submit from three sequential batches to one `$ref`-based batch request.
- [x] 2026-05-07T12:32:50Z — Passed planned-visit diagnostics into the Outlet Consumptions add page context step and expanded empty-state UI with loaded/matching/status diagnostics without service/store calls in the component.
- [x] 2026-05-07T12:33:08Z — Updated outlet movement storage application to delete existing `OutletStorages` rows when `Quantity <= 0`, skip non-positive new rows, cursor-update only on mutations, and added `cleanupZeroOutletStorages()` admin utility.
- [x] 2026-05-07T12:33:29Z — Added cumulative delivered-item helper and changed restock delivery progress to compare prior delivered deliveries plus current scheduled delivery against requested restock items per SKU.
- [x] 2026-05-07T12:33:55Z — Targeted production search confirmed no remaining `buildConsumptionProgressFallbackRequest` or singular `outlet-consumption` references in `FRONTENT/src` or `GAS`.
- [x] 2026-05-07T12:33:59Z — Targeted frontend syntax checks passed for changed composable/helper JavaScript files.
- [x] 2026-05-07T12:34:16Z — Ran `npm run gas:push`; clasp pushed 26 GAS files successfully.
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

### Deviations / Decisions
- [x] No decision needed: historical plan/doc references to the old singular route were intentionally left unchanged; production `FRONTENT/src` and `GAS` references were pluralized.
- [x] No issue/blocker encountered during execution.

### Files Actually Changed
- [FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue](../FRONTENT/src/pages/Operations/OutletConsumptions/AddPage.vue)
- [FRONTENT/src/pages/Operations/OutletConsumptions/IndexPage.vue](../FRONTENT/src/pages/Operations/OutletConsumptions/IndexPage.vue)
- [FRONTENT/src/pages/Operations/OutletConsumptions/ViewPage.vue](../FRONTENT/src/pages/Operations/OutletConsumptions/ViewPage.vue)
- [FRONTENT/src/composables/operations/outlets/useOutletConsumption.js](../FRONTENT/src/composables/operations/outlets/useOutletConsumption.js)
- [FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js](../FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js)
- [FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue](../FRONTENT/src/components/Operations/Outlets/OutletConsumptionContextStep.vue)
- [FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js](../FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js)
- [FRONTENT/src/composables/operations/outlets/outletStockLogic.js](../FRONTENT/src/composables/operations/outlets/outletStockLogic.js)
- [FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js](../FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js)
- [GAS/outletMovements.gs](../GAS/outletMovements.gs)
- [GAS/syncAppResources.gs](../GAS/syncAppResources.gs)

### Validation Performed
- [x] Route/folder resolution verified by renaming folder and targeted search: no singular `outlet-consumption` production references remain under `FRONTENT/src` or `GAS`.
- [x] Planned visit diagnostics verified by static code inspection and syntax check; runtime outlet data verification remains manual.
- [x] Single-batch consumption submit verified by static code inspection and syntax check; browser/network verification remains manual.
- [x] Outlet storage zero deletion verified by static code inspection against warehouse-storage delete pattern; sheet-data verification remains manual.
- [x] Cumulative delivery progress verified by static code inspection and syntax check; two-partial-delivery runtime verification remains manual.

### Manual Actions Required
- [ ] Run resource sync / update APP.Resources if menu route changes are not automatically synced by deployment.
- [ ] Web App redeployment is required because this plan depends on and follows the completed GAS batch reference framework API-contract plan.
- [ ] Optionally run `cleanupZeroOutletStorages()` once from Apps Script admin context to remove existing non-positive `OutletStorages` rows.
