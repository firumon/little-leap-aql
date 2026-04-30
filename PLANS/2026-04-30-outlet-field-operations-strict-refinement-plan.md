# PLAN: Outlet & Field Sales Operations Strict Refinement
**Status**: COMPLETED
**Created**: 2026-04-30
**Created By**: Brain Agent (Kilo Code)
**Executed By**: Build Agent (Kilo Code)

## Objective
Refine the already implemented `Outlet & Field Sales Operations` module so it matches the strict correction rules from `C:/Users/firum/Desktop/implementation fix.md` while preserving the completed implementation wherever it is already compliant.

Done means:
- `Outlets` and `OutletOperatingRules` remain unchanged because the refinement rules say they are already manually fixed.
- `OutletVisits` is reduced to the approved minimal business schema: `VisitCode`, `OutletCode`, `Date`, `Status`, and `StatusComment`, mapped into AQL runtime using the existing generated `Code` primary key where required by generic resources.
- Visit UI/composable/docs no longer reference `SalesUserCode`, time fields, progress stamp fields, previous/next visit links, remarks, or access fields for visit logic.
- Visit lifecycle remains: complete updates the current row, postpone updates the current row and creates a new planned row, and cancel follows the same status/comment-only simplification.
- Restock, delivery, consumption, movement, and storage behavior stay intact except for removing over-engineered pieces that contradict the refinement rules.
- Delivery JSON remains a single JSON event snapshot in `OutletDeliveries.DeliveredItemsJSON`, not a child table, and cumulative truth remains `OutletRestockItems.DeliveredQty`.
- No new sheets, resources, custom endpoints, service calls in components, API calls in composables, or business logic in stores are introduced.

## Context
This is a correction/refinement task, not a new module design.

Source docs and files reviewed:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `PLANS/_TEMPLATE.md`
- `C:/Users/firum/Desktop/implementation fix.md`
- `PLANS/2026-04-28-outlet-field-operations-implementation-plan.md`
- Current implementation samples in `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/Constants.gs`, outlet frontend composables/pages, and outlet workflow docs.

Relevant current-state deviations found:
- `OutletVisits` currently has expanded fields in `GAS/setupOperationSheets.gs`: `Code`, `OutletCode`, `SalesUserCode`, `VisitDate`, planned/actual time columns, `Progress`, action stamp columns, `PostponedFromVisitCode`, `NextVisitCode`, `Remarks`, `Status`, `AccessRegion`, and audit columns.
- `OutletVisits` metadata in `GAS/syncAppResources.gs` currently requires `OutletCode,SalesUserCode,VisitDate,Progress,Status` and actions mutate `Progress`.
- Visit frontend currently uses `Progress`, `VisitDate`, `SalesUserCode`, time fields, `PostponedFromVisitCode`, `NextVisitCode`, `Remarks`, and progress-specific comments.
- `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, and `Documents/RESOURCE_COLUMNS_GUIDE.md` document the expanded visit model.
- `OutletRestocks` and `OutletConsumption` still include optional `OutletVisitCode`; the refinement says consumption is independent of visits and no linking enforcement is allowed. Because the same refinement explicitly names only the exact `OutletVisits` schema and says restock structure should be kept, remove visit-link enforcement and UI dependency, but do not broaden restock schema beyond the already implemented fields unless Build Agent finds current code forces visit coupling.
- `OutletOperatingRules` currently includes outlet-level rule fields in the implementation. Build Agent must not modify that resource even if older plan text mentions SKU-level rules.

Hard constraints from the refinement file:
- Do not modify `Outlets` or `OutletOperatingRules` sections/files except where a docs sentence must explicitly say they are unchanged.
- Do not add fields, sheets, resources, or child delivery sheets.
- Do not introduce SKU-level operating rules, forecasting, extra validation layers, or non-standard audit columns.
- Keep business logic in composables, components UI-only, stores state/orchestration only, and services as API/IDB only.

## Pre-Conditions
- [x] Build Agent has read this plan fully before editing.
- [x] Build Agent has read `C:/Users/firum/Desktop/implementation fix.md` before editing.
- [x] Build Agent has read `Documents/ARCHITECTURE RULES.md` before touching any file under `FRONTENT/`.
- [x] Build Agent has read `Documents/GAS_API_CAPABILITIES.md` and `Documents/GAS_PATTERNS.md` before touching any file under `GAS/`.
- [x] Build Agent has run `git status --short` before editing and will not revert unrelated changes.
- [x] Build Agent will not modify `Outlets` or `OutletOperatingRules` setup, metadata, docs sections, or UI except if a surrounding document must note that they are intentionally unchanged.

## Steps

### Step 1: Freeze Allowed Scope And Confirm Current Deviations
- [ ] Run `git status --short` and inspect existing changed files so unrelated work is preserved.
- [ ] Search for expanded visit-field references: `SalesUserCode`, `VisitDate`, `PlannedStartTime`, `PlannedEndTime`, `ActualStartTime`, `ActualEndTime`, `ProgressCompleted`, `ProgressPostponed`, `ProgressCancelled`, `PostponedFromVisitCode`, `NextVisitCode`, and `OutletVisitCode`.
- [ ] Classify each hit as either: must remove for `OutletVisits`, allowed existing restock field, allowed non-visit resource field, or documentation that needs correction.
- [ ] Do not edit `Outlets` or `OutletOperatingRules` implementation while doing this audit.
**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `FRONTENT/src/composables/operations/outlets/`, `FRONTENT/src/pages/Operations/OutletVisits/`, `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`
**Pattern**: Use targeted search/read before editing; do not broaden scope.
**Rule**: Correction mode only; preserve compliant implementation.

### Step 2: Simplify Outlet Visit Backend Schema And Metadata
- [ ] In operation sheet setup, replace the expanded `OutletVisits` schema with the minimal runtime sheet schema: `Code`, `OutletCode`, `Date`, `Status`, `StatusComment`, plus only AQL-required standard audit columns if the generic setup/resource contract requires audit for operation resources.
- [ ] Do not keep `SalesUserCode`, time fields, `Progress`, progress stamp columns, postponed/next link columns, `Remarks`, or `AccessRegion` in `OutletVisits` setup.
- [ ] In resource metadata, change `OutletVisits.RequiredHeaders` to `OutletCode,Date,Status` or `OutletCode,Date,Status,StatusComment` only if the existing generic write validator must require comments. Prefer requiring comment in frontend workflow logic rather than metadata if comments are conditional.
- [ ] Change `OutletVisits.DefaultValues` from `Progress=PLANNED` to `Status=PLANNED` while keeping AQL active/inactive semantics only if a separate active/inactive column is unavoidable. If one `Status` column must serve visit workflow because the approved schema has exactly `Status`, do not add a second workflow column.
- [ ] Rework `OutletVisits.AdditionalActions` to mutate `Status` values `COMPLETED`, `POSTPONED`, and `CANCELLED` with `StatusComment`, or remove `AdditionalActions` and use generic `update` if action stamping would force extra columns.
- [ ] Ensure AppOptions naming is aligned: either keep `OutletVisitProgress` only if reused safely by validation, or rename/repoint to visit status values without adding a new option group unless necessary.
**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `GAS/Constants.gs`
**Pattern**: Existing resource metadata pattern in `GAS/syncAppResources.gs`; generic write/update capabilities from `Documents/GAS_API_CAPABILITIES.md`.
**Rule**: Final business fields for visits are exactly `VisitCode`/AQL `Code`, `OutletCode`, `Date`, `Status`, `StatusComment`.

### Step 3: Refactor Outlet Visit Frontend Flow To Minimal Fields
- [ ] Update outlet visit metadata/constants so visit grouping and labels use `Status` values, not `Progress`.
- [ ] Change visit form state to use only `OutletCode`, `Date`, `Status`, and `StatusComment`.
- [ ] Remove `SalesUserCode`, planned/actual time fields, progress-specific comments, previous/next linking fields, and remarks from visit composable payloads and pages.
- [ ] Implement complete visit as an update/action that sets current row `Status=COMPLETED` and stores the comment in `StatusComment`.
- [ ] Implement postpone visit as: validate reason/comment and new date, set current row `Status=POSTPONED` with `StatusComment`, create a new row with the same `OutletCode`, new `Date`, `Status=PLANNED`, and blank/new `StatusComment`; do not write any link columns.
- [ ] Implement cancel visit with the simplified status/comment model. If the existing UI currently cancels only the current row, keep that unless the refinement discussion explicitly requires creating a replacement planned row; do not add link columns.
- [ ] Keep pages thin: pages bind fields and call composable methods only; composables own validation, status decisions, and payload construction.
**Files**: `FRONTENT/src/composables/operations/outlets/outletOperationsMeta.js`, `FRONTENT/src/composables/operations/outlets/useOutletVisits.js`, `FRONTENT/src/pages/Operations/OutletVisits/IndexPage.vue`, `FRONTENT/src/pages/Operations/OutletVisits/AddPage.vue`, `FRONTENT/src/pages/Operations/OutletVisits/ViewPage.vue`, outlet UI components only if labels/props currently say `Progress`.
**Pattern**: Existing outlet composable + `useWorkflowStore` batch/update requests; `useResourceNav` for navigation.
**Rule**: Components remain UI-only and no frontend layer bypasses services/stores.

### Step 4: Remove Visit Coupling From Consumption And Avoid Restock Expansion
- [ ] Ensure `OutletConsumption` forms, payload builders, list/view pages, and docs do not require or enforce `OutletVisitCode`.
- [ ] If `OutletConsumption.OutletVisitCode` exists in current schema, remove it from setup/docs only if doing so does not break existing rows or generic composite save behavior; otherwise leave it unused and document that consumption is independent and the field is not required. Prefer strict removal if no migration blocker exists.
- [ ] For `OutletRestocks`, keep the existing parent/child structure and same-document revision behavior. Do not introduce new restock fields.
- [ ] If restock UI currently requires selecting a visit, remove that requirement; an optional existing `OutletVisitCode` may remain blank unless Build Agent decides strict schema cleanup is safe.
- [ ] Remove any new validation that depends on visits for restock/consumption eligibility.
**Files**: `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`, `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`, `FRONTENT/src/composables/operations/outlets/outletConsumptionPayload.js`, `FRONTENT/src/composables/operations/outlets/useOutletConsumption.js`, related outlet restock/consumption pages.
**Pattern**: Existing composite save payload builders; optional reference fields are not workflow gates.
**Rule**: `OutletConsumption` is independent of visits and can be created anytime.

### Step 5: Remove Over-Engineering While Preserving Delivery And Stock Truth
- [ ] Remove SKU-level operating-rule logic from frontend validation and docs, especially `OutletOperatingRules.SKU`, SKU-level min/max, and SKU-level stock limit checks. Do not edit the actual `OutletOperatingRules` implementation if it has already been manually fixed; only remove dependent logic that expects SKU-level rules.
- [ ] Remove forecasting/replenishment recommendation language if present.
- [ ] Remove duplicate-restock and max-stock-value warning logic if it is an extra validation layer not part of the agreed refinement constraints.
- [ ] Preserve mandatory validations: positive restock request quantities, valid approval quantities, delivery quantity > 0, delivery not exceeding `ApprovedQty - DeliveredQty`, `DeliveredQty <= ApprovedQty`, consumption quantity > 0, and consumption not exceeding outlet stock.
- [ ] Keep `OutletDeliveries.DeliveredItemsJSON` as one JSON array of objects with lowercase keys exactly like `[ { "sku": "SKU1", "qty": 3 } ]`; update payload builder if it currently uses uppercase `SKU`/`Qty` keys or includes non-required keys in the stored JSON.
- [ ] Do not create any delivery item child sheet.
- [ ] Preserve `OutletMovements` and `OutletStorages` source-of-truth logic.
**Files**: `FRONTENT/src/composables/operations/outlets/outletStockLogic.js`, `FRONTENT/src/composables/operations/outlets/outletRestockPayload.js`, `FRONTENT/src/composables/operations/outlets/useOutletRestocks.js`, `FRONTENT/src/composables/operations/outlets/useOutletDeliveries.js`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/MODULE_WORKFLOWS.md`
**Pattern**: Delivery JSON is event snapshot; cumulative delivered truth is `OutletRestockItems.DeliveredQty`.
**Rule**: No over-engineering, no schema drift, no added complexity.

### Step 6: Align Documentation With The Refined Implemented State
- [ ] Update operation sheet documentation so `OutletVisits` required columns and column list match the minimal schema.
- [ ] Update module workflow docs so visit workflow uses `Status`, `Date`, and `StatusComment`, with no link fields or sales-user/time fields.
- [ ] Update resource columns guide to remove expanded visit progress/action-stamp language and to state the final simplified visit rule.
- [ ] Update docs to say `OutletConsumption` is independent of visits and has no visit-link enforcement.
- [ ] Keep `Outlets` and `OutletOperatingRules` docs unchanged except for removing any dependent SKU-level operating-rule claims introduced by the old plan if they conflict with the manually fixed state.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation with final state, validation performed, and manual sheet/menu actions.
**Files**: `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Keep docs/code/sheet setup/resource metadata aligned per `Documents/AI_COLLABORATION_PROTOCOL.md`.
**Rule**: Documentation must describe the corrected implementation, not the older expanded plan.

### Step 7: Run Targeted Verification And Deployment Sync
- [ ] Run a targeted search to confirm removed visit fields are absent from outlet visit setup, metadata, composables, pages, and docs.
- [ ] Run `npm run gas:push` after GAS changes.
- [ ] Run `npm --prefix FRONTENT run build` because this touches GAS, docs, and multiple frontend outlet files.
- [ ] Manually inspect the final diff for accidental `Outlets` or `OutletOperatingRules` modifications.
- [ ] Record verification results and any deviations in this plan's post-execution notes.
**Files**: `PLANS/2026-04-30-outlet-field-operations-strict-refinement-plan.md`
**Pattern**: Targeted checks plus frontend build for cross-cutting frontend changes.
**Rule**: Do not ask for Web App redeployment unless the API contract changes; this plan should not change the generic API contract.

## Documentation Updates Required
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` with the simplified `OutletVisits` schema and consumption independence.
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` with simplified visit status semantics and no expanded visit action stamps.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with the corrected outlet visit/consumption workflow.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` after implementation with final state and manual actions.

## Acceptance Criteria
- [ ] `OutletVisits` setup no longer includes `SalesUserCode`, time fields, `Progress`, progress stamp fields, previous/next link fields, `Remarks`, or `AccessRegion`.
- [ ] `OutletVisits` resource metadata no longer requires `SalesUserCode` or `VisitDate`, and visit workflow uses `Date`, `Status`, and `StatusComment`.
- [ ] Visit add/view pages expose only outlet, date, status/comment behavior needed by the simplified workflow.
- [ ] Postponing a visit updates the current row and creates a new planned row without link columns.
- [ ] Completing a visit updates the same row to `COMPLETED` with a comment.
- [ ] Cancelling a visit uses the simplified `StatusComment` model and does not introduce linking columns.
- [ ] `OutletConsumption` can be created without a visit and no UI/composable validation requires visit linkage.
- [ ] Restock send-back revises the same document and no new restock document is created for revision.
- [ ] Delivery JSON stored in `DeliveredItemsJSON` uses lowercase `{ "sku", "qty" }` event rows only.
- [ ] No delivery child item sheet/resource is introduced.
- [ ] Cumulative delivery truth remains `OutletRestockItems.DeliveredQty`.
- [ ] Outlet stock truth remains `OutletMovements` ledger plus derived `OutletStorages` balance.
- [ ] No `Outlets` or `OutletOperatingRules` implementation change is included in the final diff.
- [ ] No SKU-level operating-rule validation, forecasting logic, or extra validation layers remain in the outlet frontend/docs.
- [ ] Frontend architecture rules are followed: services are not used in components/composables, components remain UI-only, and business logic stays in composables.
- [ ] `npm run gas:push` succeeds after GAS changes.
- [ ] `npm --prefix FRONTENT run build` succeeds.

## Change Log Required In Build Completion
Build Agent must include a final change log with these categories:

Removed:
- Expanded `OutletVisits` fields: `SalesUserCode`, time fields, `Progress`, progress stamp fields, previous/next link fields, remarks/access fields.
- Visit UI references to sales user, times, progress stamps, and visit linking.
- Any SKU-level operating-rule validation/forecasting/extra warning logic found in outlet frontend/docs.

Modified:
- `OutletVisits` schema and metadata to the strict minimal status/comment model.
- Visit composable/page workflow to use `Date`, `Status`, and `StatusComment`.
- Delivery JSON payload to strict lowercase `sku`/`qty` event objects if needed.
- Docs to match the refined implementation.

Kept:
- `Outlets` and `OutletOperatingRules` implementation unchanged.
- Restock same-document revision behavior.
- No delivery child table.
- Movement/storage source-of-truth design.
- AQL frontend architecture boundaries.

Guarantee statement to include:
- No schema drift beyond the requested correction.
- No added complexity.
- No new sheets/resources/endpoints.
- Fully aligned with the strict refinement rules and AQL architecture.

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

### Deviations / Decisions
- [x] `[?]` Step 1 audit complete: removed-visit-field hits are concentrated in `GAS/setupOperationSheets.gs`, `GAS/syncAppResources.gs`, outlet visit frontend files, and docs. `OutletVisitCode` in `OutletRestocks` is allowed as optional existing structure; `OutletConsumption.OutletVisitCode` was removed from setup/payload/docs because consumption is independent. Other `ProgressCancelled*` hits belong to non-visit resources and are allowed.
- [x] `[?]` `npm run gas:push` exited successfully but reported `Skipping push.` from `clasp push`; recorded as successful local command execution with no remote push performed by clasp.
- [x] `[!]` Issue/blocker: none.

### Files Actually Changed
- `GAS/setupOperationSheets.gs`
- `GAS/syncAppResources.gs`
- `GAS/Constants.gs`
- `FRONTENT/src/composables/operations/outlets/`
- `FRONTENT/src/pages/Operations/OutletVisits/`
- `FRONTENT/src/pages/Operations/OutletConsumption/`
- `FRONTENT/src/pages/Operations/OutletRestocks/`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] `git status --short`
- [x] targeted search for removed visit fields
- [x] `npm run gas:push` (command succeeded; `clasp push` output: `Skipping push.`)
- [x] `npm --prefix FRONTENT run build`
- [x] acceptance criteria verified

### Manual Actions Required
- [ ] Run AQL resource sync from the Google Sheet menu.
- [ ] Run operation sheet setup from the Google Sheet menu to normalize the `OutletVisits` sheet schema.
- [ ] Confirm live `OutletVisits` sheet headers match the refined schema.
- [ ] Clear frontend/resource cache or re-login if old visit fields remain visible after resource sync.
- [x] No Web App redeployment is expected unless Build Agent changes the generic API contract.

### Completion Change Log
Removed:
- Expanded `OutletVisits` fields: `SalesUserCode`, time fields, `Progress`, progress stamp fields, previous/next link fields, remarks/access fields.
- Visit UI references to sales user, times, progress stamps, and visit linking.
- SKU-level operating-rule stock-value validation and duplicate-open-restock warning logic from outlet frontend logic.

Modified:
- `OutletVisits` setup/resource metadata now uses the strict minimal status/comment model: `Code`, `OutletCode`, `Date`, `Status`, `StatusComment`, plus standard audit columns.
- Visit composable/page workflow now uses `Date`, `Status`, and `StatusComment`; postpone updates current row and creates an unlinked planned row.
- `OutletConsumption` setup/payload/docs no longer include or require `OutletVisitCode`.
- Delivery JSON payload and view now use lowercase `sku`/`qty` event objects.
- Docs and context handoff now describe the refined implementation state.

Kept:
- `Outlets` and `OutletOperatingRules` implementation unchanged.
- Restock same-document revision behavior.
- No delivery child table.
- Movement/storage source-of-truth design.
- AQL frontend architecture boundaries.

Guarantee:
- No schema drift beyond the requested correction.
- No added complexity.
- No new sheets/resources/endpoints.
- Fully aligned with the strict refinement rules and AQL architecture.
