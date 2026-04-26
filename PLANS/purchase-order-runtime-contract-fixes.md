# PLAN: Purchase Order Runtime Contract Fixes
**Status**: COMPLETED
**Created**: 2026-04-26
**Created By**: Brain Agent (Codex GPT-5)
**Executed By**: Build Agent (Codex GPT-5)

## Objective
Fix the Purchase Order frontend runtime-contract errors introduced during PO module implementation.

Done means:
- `usePurchaseOrderIndex`, `usePurchaseOrderCreateFlow`, and `usePurchaseOrderView` use the current `useResourceData(resourceRef)` API: `items`, `reload`, `getRecordByCode`, and `loading`.
- PO navigation uses `useResourceNav().goTo(...)`; no destructuring of nonexistent `navigateTo` or `navigateToAdd` from `useResourceNav` remains.
- PO create uses the current `compositeSave` child contract: child groups use `records`, and every child entry is `{ _action: 'create', data: buildItemRecord(item) }`.
- PO create reads the batch result from `response.data[0]`, not `response.data.results[0]`.
- Procurement update uses `payload.code`, not `payload.id`.
- PO actions execute through the current action contract and no longer pass raw `id/actionConfig/data` payloads.
- No backend, GAS, sheet schema, or resource metadata changes are made.

## Context
Source docs reviewed:
- `AGENTS.md`
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/_TEMPLATE.md`
- `PLANS/purchase-order-module-implementation.md`
- `Documents/MODULE_WORKFLOWS.md`, Purchase Order section

Relevant implementation references:
- `FRONTENT/src/composables/resources/useResourceData.js`
- `FRONTENT/src/composables/resources/useResourceNav.js`
- `FRONTENT/src/composables/resources/useResourceConfig.js`
- `FRONTENT/src/stores/workflow.js`
- `FRONTENT/src/services/ResourceCrudService.js`
- `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
- `FRONTENT/src/composables/operations/rfqs/useRFQCreateFlow.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload.js`

Source of truth:
- `useResourceData` must be instantiated per resource, for example `const purchaseOrders = useResourceData(ref('PurchaseOrders'))`.
- Records are read from `purchaseOrders.items.value`, not from a global `getRecords(resourceName)` helper.
- Data reloads use `purchaseOrders.reload(forceSync)`, not `fetchResource(resourceName, forceSync)`.
- `useResourceNav` exposes only `goTo(target, params)`.
- Current route resource navigation for the PO module should use `goTo('list')`, `goTo('add')`, and `goTo('view', { code })`.
- `workflowStore.runBatchRequests(requests)` returns `{ success, data }` where `data` is an array of ordered per-request responses.
- `compositeSave` child groups must use `records`, not `data`.
- `update` requests must send `payload.code`.
- For action execution, prefer `workflowStore.executeResourceAction(resourceName, code, actionConfig, fields)` because it delegates to `ResourceCrudService.executeAction`, which builds the canonical `executeAction` payload.

Assumptions:
- Existing PO schema/resource metadata from the completed PO plan stays unchanged.
- Existing pages can remain Options API wrappers if they only call composables and contain no business logic.
- The Build Agent may fix import paths from relative paths to `src/...` aliases only if needed by lint/build consistency.
- This task does not need new frontend files.

Out of scope:
- Redesigning PO UI.
- Editing GAS files.
- Changing `useResourceData`, `useResourceNav`, `workflow.js`, or generic services.
- Refactoring SupplierQuotation or RFQ flows, even if similar defects are discovered there.
- Changing sheet setup/resource docs except registry text if the exposed PO composable return surface changes.

## Pre-Conditions
- [ ] Build Agent has read this plan and the required startup docs.
- [ ] Before editing any file under `FRONTENT/`, Build Agent has read `Documents/ARCHITECTURE RULES.md`.
- [ ] Build Agent has checked `git status --short` and will not revert unrelated changes such as `todo.txt`.
- [ ] Build Agent understands this is a focused repair plan, not a full PO module rewrite.

## File Plan

### `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- Action: modify.
- Purpose: align index flow with current resource/nav composables.
- Related functions: `usePurchaseOrderIndex`, `reload`, `navigateTo`, `navigateToAdd`.
- Dependencies: `useResourceData`, `useResourceConfig`, `useResourceNav`, `purchaseOrderMeta.js`.

### `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Action: modify.
- Purpose: align create flow with current resource/nav/batch/composite contracts.
- Related functions: `usePurchaseOrderCreateFlow`, `loadData`, `selectQuotation`, `save`, `cancel`.
- Dependencies: `useResourceData`, `useWorkflowStore`, `useResourceNav`, PO payload/quantity/totals helpers.

### `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- Action: modify.
- Purpose: align view flow with current route/resource/nav/action contracts.
- Related functions: `usePurchaseOrderView`, `loadData`, `runAction`, `goToList`.
- Dependencies: `useResourceConfig`, `isActionVisible`, `useResourceData`, `useWorkflowStore`, `useResourceNav`, PO metadata/payload helpers.

### `FRONTENT/src/composables/operations/purchaseOrders/purchaseOrderPayload.js`
- Action: modify only if needed.
- Purpose: support object-valued `ExtraChargesBreakup` in `parseCharges` if totals/action fixes expose stale total behavior.
- Related functions: `parseCharges`, `stringifyCharges`.
- Dependencies: `purchaseOrderMeta.js`.

### `FRONTENT/src/composables/REGISTRY.md`
- Action: modify only if actual return names/signatures change.
- Purpose: keep PO composable discovery accurate.
- Related entries: `usePurchaseOrderIndex`, `usePurchaseOrderCreateFlow`, `usePurchaseOrderView`.
- Dependencies: final composable return surfaces.

## Function-by-Function Plan

### `usePurchaseOrderIndex`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- Purpose: provide PO index state using current resource API.
- Inputs: none.
- Outputs: keep the existing return names expected by `IndexPage.vue`: `permissions`, `items`, `loading`, `searchTerm`, `groups`, `totalVisible`, `reload`, `isGroupExpanded`, `toggleGroup`, `navigateTo`, `navigateToAdd`, `supplierName`, `formatDate`, `formatCurrency`.
- Side effects: `reload(forceSync)` reloads PO/supplier/warehouse resources.
- Error handling: failed reload should let the existing `useResourceData` notification/error behavior surface; do not add custom service calls.
- Edge cases: empty resource lists produce empty groups; unknown progress goes to `OTHER`.
- Implementation order: first PO composable fix.
- Connections: `IndexPage.vue` consumes this directly.

### `reload`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- Purpose: refresh PO index dependencies.
- Inputs: optional `forceSync = false`.
- Outputs: promise.
- Side effects: calls `purchaseOrders.reload(forceSync)`, `suppliers.reload(forceSync)`, and `warehouses.reload(forceSync)`.
- Error handling: preserve `finally` clearing local loading if local loading is kept.
- Edge cases: must accept the existing page call `reload(true)`.
- Implementation order: inside Step 2.
- Connections: refresh button in `IndexPage.vue`.

### `navigateTo`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- Purpose: navigate to PO view.
- Inputs: PO row.
- Outputs: none.
- Side effects: calls `nav.goTo('view', { code: row.Code })`.
- Error handling: if row/code missing, no-op.
- Edge cases: must not call `navigateTo('PurchaseOrders', code)`.
- Implementation order: inside Step 2.
- Connections: PO cards/table rows.

### `navigateToAdd`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- Purpose: navigate to PO add page.
- Inputs: none.
- Outputs: none.
- Side effects: calls `nav.goTo('add')`.
- Error handling: none.
- Edge cases: must not destructure a nonexistent `navigateToAdd`.
- Implementation order: inside Step 2.
- Connections: index FAB.

### `usePurchaseOrderCreateFlow`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Purpose: provide PO creation workflow using current resource and batch contracts.
- Inputs: none.
- Outputs: preserve existing return names consumed by `AddPage.vue`.
- Side effects: reloads resources, saves through `workflowStore.runBatchRequests`, notifies through Quasar, navigates through `nav.goTo`.
- Error handling: validation warnings remain; failed batch sub-responses must surface first failed entry message.
- Edge cases: no eligible quotations, duplicate full PO, zero remaining quantity, partial qty above remaining.
- Implementation order: after index fix.
- Connections: `AddPage.vue`, PO payload/quantity/totals helpers.

### `loadData`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Purpose: load all resources needed to create a PO.
- Inputs: optional `forceSync = false`.
- Outputs: promise.
- Side effects: calls `.reload(forceSync)` on `SupplierQuotations`, `SupplierQuotationItems`, `PurchaseOrders`, `PurchaseOrderItems`, `Suppliers`, `Warehouses`, `RFQs`, `PurchaseRequisitionItems`, and `Procurements`.
- Error handling: preserve final loading reset.
- Edge cases: resources without data should result in empty arrays, not thrown lookup errors.
- Implementation order: before `selectQuotation`.
- Connections: page `onMounted`.

### `selectQuotation`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Purpose: hydrate PO form/items from selected SupplierQuotation.
- Inputs: selected quotation code.
- Outputs: mutates `selectedQuotationCode`, `form`, `items`.
- Side effects: calls `syncAllTotals`.
- Error handling: blank code resets form/items.
- Edge cases: must read quotation/item data from `quotations.items.value`, `quotationItems.items.value`, and `prItems.items.value`.
- Implementation order: after resource ref setup.
- Connections: Add page quotation select.

### `responseFailed`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js` and optionally duplicated in `usePurchaseOrderView.js`.
- Purpose: detect failed top-level or sub-response batch results.
- Inputs: normalized workflow response.
- Outputs: boolean.
- Side effects: none.
- Error handling: null/undefined returns true.
- Edge cases: inspect `Array.isArray(response.data)` and any `entry.success === false`.
- Implementation order: before `save`.
- Connections: `save`, `runAction` if batch remains in view.

### `firstFailureMessage`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js` and optionally `usePurchaseOrderView.js`.
- Purpose: produce user-facing failure message.
- Inputs: response and fallback string.
- Outputs: string.
- Side effects: none.
- Error handling: fallback when no message exists.
- Edge cases: must check failed sub-response `error` and `message`, then top-level `error`.
- Implementation order: with `responseFailed`.
- Connections: notifications.

### `resultCode`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`.
- Purpose: extract created PO code from the first batch response.
- Inputs: first batch entry, normally `response.data?.[0]`.
- Outputs: code string.
- Side effects: none.
- Error handling: blank string if not found.
- Edge cases: check in this order: `entry.data.result.parentCode`, `entry.data.result.code`, `entry.data.code`.
- Implementation order: before `save`.
- Connections: post-create navigation.

### `save`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Purpose: save PO parent and children through current batch/composite contract.
- Inputs: none.
- Outputs: none.
- Side effects: batch write, notification, navigation.
- Error handling: show first failed sub-response if any.
- Edge cases: call `syncAllTotals()` before `buildHeaderRecord`; child group must use `records`; procurement update must use `payload.code`; grouped refresh must use one `get` with `resource: ['PurchaseOrders', 'PurchaseOrderItems', 'Procurements']` and `payload: { includeInactive: true }`.
- Implementation order: after helper functions.
- Connections: Add page save button.

### `cancel`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- Purpose: return to PO list.
- Inputs: none.
- Outputs: none.
- Side effects: `nav.goTo('list')`.
- Error handling: none.
- Edge cases: no direct router usage.
- Implementation order: after `save`.
- Connections: Add page cancel/back buttons.

### `usePurchaseOrderView`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- Purpose: show PO and execute configured actions using current route/action contracts.
- Inputs: route context from `useResourceConfig`.
- Outputs: preserve return names consumed by `ViewPage.vue`.
- Side effects: reloads resources, executes action, notifies, clears action comment.
- Error handling: missing record/action no-ops; failed action notifies.
- Edge cases: route code is `code`, not `routeCode`; `isActionVisible` must come from `useResourceConfig`, not `useActionResolver`.
- Implementation order: after create flow fix.
- Connections: `ViewPage.vue`.

### `loadData`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- Purpose: load view dependencies.
- Inputs: optional `forceSync = false`.
- Outputs: promise.
- Side effects: calls `.reload(forceSync)` on `PurchaseOrders`, `PurchaseOrderItems`, `SupplierQuotations`, `SupplierQuotationItems`, `Suppliers`, `Warehouses`, and `RFQs`.
- Error handling: preserve final loading reset.
- Edge cases: pass `true` after successful action refresh if needed.
- Implementation order: before computed record use.
- Connections: page `onMounted` and action refresh.

### `runAction`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- Purpose: execute Send/Acknowledge/Accept/Cancel.
- Inputs: normalized action config from `additionalActions`.
- Outputs: none.
- Side effects: calls `workflowStore.executeResourceAction('PurchaseOrders', record.value.Code, actionConfig, fields)`, reloads `PurchaseOrders`, notifies, clears `actionComment`.
- Error handling: require comment only when action field config has `{ name: 'Comment', required: true }`; failed response shows response error.
- Edge cases: build `fields` as `{ ProgressSentComment: comment }`, `{ ProgressAcknowledgedComment: comment }`, `{ ProgressAcceptedComment: comment }`, or `{ ProgressCancelledComment: comment }`; omit blank optional comments or send empty string only if current pattern expects it.
- Implementation order: after resource/nav fixes.
- Connections: View page action buttons.

### `goToList`
- File: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- Purpose: return to PO list.
- Inputs: none.
- Outputs: none.
- Side effects: `nav.goTo('list')`.
- Error handling: none.
- Edge cases: no `navigateTo('PurchaseOrders')`.
- Implementation order: after `runAction`.
- Connections: View page back button.

### `parseCharges`
- File: `FRONTENT/src/composables/operations/purchaseOrders/purchaseOrderPayload.js`
- Purpose: normalize charge data from either JSON string or already-parsed object.
- Inputs: string, object, null, undefined.
- Outputs: charge object containing all `EXTRA_CHARGE_KEYS`.
- Side effects: none.
- Error handling: invalid JSON returns `blankCharges()`.
- Edge cases: object input must not go through `JSON.parse`; this prevents totals from becoming zero when `form.ExtraChargesBreakup` is already an object.
- Implementation order: only if Build Agent confirms totals currently zero out object charges.
- Connections: `usePurchaseOrderTotals`, `defaultHeaderForm`, `extraCharges` view display.

## Steps

### Step 1: Startup and status
- [ ] Open `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, and `Documents/ARCHITECTURE RULES.md`.
- [ ] Run `git status --short`.
- [ ] Do not revert existing PO module files, docs, GAS changes, or unrelated `todo.txt`.
**Files**: docs only.
**Pattern**: Brain/Build role boundary plus frontend architecture rules.
**Rule**: This plan fixes runtime contracts only.

### Step 2: Fix PO index resource/nav usage
- [ ] Open `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`.
- [ ] Add `ref` import usage if needed; the file already imports `ref`.
- [ ] Replace `const { resourceName, permissions } = useResourceConfig('PurchaseOrders')` with the current no-argument `useResourceConfig()` call and keep only `permissions` unless `resourceName` is genuinely used.
- [ ] Replace `const { fetchResource, getRecords } = useResourceData()` with three resource instances: `purchaseOrders = useResourceData(ref('PurchaseOrders'))`, `suppliersResource = useResourceData(ref('Suppliers'))`, and `warehousesResource = useResourceData(ref('Warehouses'))`.
- [ ] Replace every `getRecords('PurchaseOrders')` with `purchaseOrders.items.value`.
- [ ] Replace every `getRecords('Suppliers')` with `suppliersResource.items.value`.
- [ ] Remove any use of `getRecords('Warehouses')` unless needed; if only reload needs warehouses, do not create unused computed values.
- [ ] Replace `const { navigateTo, navigateToAdd } = useResourceNav()` with `const nav = useResourceNav()`.
- [ ] Implement local function `navigateTo(row)` that calls `nav.goTo('view', { code: row.Code })` when `row?.Code` exists.
- [ ] Implement local function `navigateToAdd()` that calls `nav.goTo('add')`.
- [ ] Update `reload(forceSync = false)` so it calls `purchaseOrders.reload(forceSync)`, `suppliersResource.reload(forceSync)`, and `warehousesResource.reload(forceSync)`.
- [ ] Return `loading: purchaseOrders.loading` if local loading is removed, or keep local loading only as a combined reload indicator.
- [ ] Do not edit `IndexPage.vue` unless its template requires changed return names.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
**Pattern**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationIndex.js`
**Rule**: Composable owns resource-specific orchestration; generic composables are not modified.

### Step 3: Fix PO create resource setup
- [ ] Open `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`.
- [ ] Remove the unused `useAuthStore` import and `authStore` variable unless Build Agent finds a real use.
- [ ] Replace `const { fetchResource, getRecords } = useResourceData()` with one resource instance per required resource: `supplierQuotations`, `supplierQuotationItems`, `purchaseOrders`, `purchaseOrderItems`, `suppliersResource`, `warehousesResource`, `rfqs`, `prItems`, and `procurements`.
- [ ] Each instance must call `useResourceData(ref('<ResourceName>'))`.
- [ ] Replace computed source arrays so they read from the corresponding `.items.value`.
- [ ] Keep the existing computed names `quotations`, `quotationItems`, `purchaseOrders`, `purchaseOrderItems`, `suppliers`, `warehouses`, `rfqs`, `prItems`, and `procurements` only if the names do not conflict with resource instance variables. If conflicts would occur, name resource instances with `Resource` suffix.
- [ ] Replace `const { navigateTo } = useResourceNav()` with `const nav = useResourceNav()`.
- [ ] Update `loadData(forceSync = false)` to call `.reload(forceSync)` on each resource instance instead of `fetchResource`.
- [ ] Do not import stores/services directly into page files.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
**Pattern**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`
**Rule**: No direct API/IDB calls in composables; resource loading goes through `useResourceData`.

### Step 4: Fix PO create batch payload
- [ ] In `usePurchaseOrderCreateFlow.js`, add local helpers `responseFailed`, `firstFailureMessage`, and `resultCode` following the SupplierQuotation create/view pattern.
- [ ] Before building the header payload in `save`, call `syncAllTotals()`.
- [ ] Replace the child composite payload object so it has `records`, not `data`.
- [ ] Each PO child record must have shape `{ _action: 'create', data: buildItemRecord(item) }`.
- [ ] Remove `foreignKey: 'PurchaseOrderCode'` from the child group; parent code injection is handled by backend convention.
- [ ] In the procurement update request, replace `payload.id` with `payload.code`.
- [ ] Keep update payload data as `{ Progress: 'PO_ISSUED' }`.
- [ ] Replace the three separate post-save `get` requests with one grouped request: `action: 'get'`, `resource: ['PurchaseOrders', 'PurchaseOrderItems', 'Procurements']`, `payload: { includeInactive: true }`.
- [ ] After `runBatchRequests`, call `responseFailed(response)` and show `firstFailureMessage(response, 'Failed to save Purchase Order')` if failed.
- [ ] Extract created PO code from `resultCode(response.data?.[0])`.
- [ ] Navigate with `nav.goTo('view', { code })` when a code exists; otherwise use `nav.goTo('list')`.
- [ ] In `cancel`, replace navigation with `nav.goTo('list')`.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
**Pattern**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow.js`, `FRONTENT/src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload.js`, `FRONTENT/src/stores/workflow.js`
**Rule**: Do not invent batch/composite payload shapes.

### Step 5: Fix PO view resource/action setup
- [ ] Open `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`.
- [ ] Change `import { isActionVisible } from '../../resources/useActionResolver.js'` to import `isActionVisible` from `../../resources/useResourceConfig.js`.
- [ ] Replace `const { resourceName, routeCode, additionalActions } = useResourceConfig('PurchaseOrders')` with current no-argument `useResourceConfig()` and destructure `code` and `additionalActions`.
- [ ] Replace all `routeCode.value` reads with `code.value`.
- [ ] Replace `const { fetchResource, getRecords } = useResourceData()` with resource instances for `PurchaseOrders`, `PurchaseOrderItems`, `SupplierQuotations`, `SupplierQuotationItems`, `Suppliers`, `Warehouses`, and `RFQs`.
- [ ] Replace all `getRecords('<ResourceName>')` reads with the relevant `.items.value`.
- [ ] Replace `const { navigateTo } = useResourceNav()` with `const nav = useResourceNav()`.
- [ ] Update `loadData(forceSync = false)` to call each resource instance `.reload(forceSync)`.
- [ ] In `goToList`, use `nav.goTo('list')`.
- [ ] Do not edit `ViewPage.vue` unless the composable return names change.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
**Pattern**: `FRONTENT/src/composables/operations/supplierQuotations/useSupplierQuotationView.js`, `FRONTENT/src/composables/resources/useResourceConfig.js`
**Rule**: Use current route config and action visibility helpers.

### Step 6: Fix PO action execution contract
- [ ] In `usePurchaseOrderView.js`, replace the raw `workflowStore.runBatchRequests` action payload for PO actions.
- [ ] Use `workflowStore.executeResourceAction('PurchaseOrders', record.value.Code, actionConfig, fields)`.
- [ ] Build `fields` from the action target value: `SENT -> ProgressSentComment`, `ACKNOWLEDGED -> ProgressAcknowledgedComment`, `ACCEPTED -> ProgressAcceptedComment`, `CANCELLED -> ProgressCancelledComment`.
- [ ] If `actionComment.value.trim()` is blank and the action field is not required, either omit the comment field or set it to an empty string consistently with existing action behavior. Prefer omitting optional blank fields.
- [ ] Preserve required comment validation for Cancel by checking `actionConfig.fields`.
- [ ] After a successful action, clear `actionComment.value` and run `purchaseOrders.reload(true)`.
- [ ] Remove the extra raw grouped `get` action from `runAction`; `executeResourceAction` already returns a write response and reload handles local refresh.
- [ ] Notify success/failure with existing `$q.notify` style.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
**Pattern**: `FRONTENT/src/stores/workflow.js`, `FRONTENT/src/services/ResourceCrudService.js`
**Rule**: Do not call `executeAction` with raw unsupported `id/actionConfig/data` payloads.

### Step 7: Fix object charge parsing if needed
- [ ] Open `FRONTENT/src/composables/operations/purchaseOrders/purchaseOrderPayload.js`.
- [ ] Update `parseCharges` only if object-valued `ExtraChargesBreakup` currently returns blank charges.
- [ ] If modifying, make `parseCharges(value)` return merged blank charges for object input before attempting `JSON.parse`.
- [ ] Keep invalid JSON fallback as `blankCharges()`.
- [ ] Do not change payload field names or stored JSON format.
**Files**: `FRONTENT/src/composables/operations/purchaseOrders/purchaseOrderPayload.js`
**Pattern**: `FRONTENT/src/composables/operations/supplierQuotations/supplierQuotationPayload.js`
**Rule**: Stored PO charges remain JSON strings; form-state charges may be objects.

### Step 8: Registry check
- [ ] Open `FRONTENT/src/composables/REGISTRY.md`.
- [ ] Confirm PO entries still match actual exported return names.
- [ ] Update only rows whose arguments or return names changed.
- [ ] Do not edit `FRONTENT/src/components/REGISTRY.md`.
**Files**: `FRONTENT/src/composables/REGISTRY.md`
**Pattern**: existing PO registry rows.
**Rule**: Registry follows actual reusable API, not desired API.

### Step 9: Targeted validation
- [ ] Run `npm --prefix FRONTENT run build`.
- [ ] If build fails, fix only errors directly caused by the PO runtime-contract files in this plan.
- [ ] Run `git status --short` after validation.
- [ ] Do not run GAS push; no GAS files should change.
**Files**: no additional files unless build exposes direct PO contract errors.
**Pattern**: frontend-only targeted verification.
**Rule**: No backend deployment required.

## Validation Plan
Commands:
- `git status --short`
- `npm --prefix FRONTENT run build`

Manual checks:
- Open `/operations/purchase-orders`; the index loads without `fetchResource is not a function`, `getRecords is not a function`, `navigateTo is not a function`, or `navigateToAdd is not a function`.
- Click PO index refresh; PO/supplier/warehouse resources reload.
- Click PO add FAB; route goes to the add page through `useResourceNav`.
- Select an eligible SupplierQuotation; items populate from `SupplierQuotationItems`.
- Save a valid PO; request uses `compositeSave` with child `records`.
- Created PO navigates to `view` using the returned parent code.
- Linked Procurement update uses `payload.code` and only applies from `QUOTATIONS_RECEIVED`.
- View page loads by route code and resolves PO items by `PurchaseOrderCode`.
- Send/Acknowledge/Accept/Cancel action buttons call `executeResourceAction`, update progress, and reload the PO.
- Cancel action requires a comment; optional actions do not require one.

Expected outputs:
- Build passes.
- No GAS files changed.
- No changes to `useResourceData`, `useResourceNav`, `workflow.js`, or generic services.
- No raw `fetchResource` or `getRecords` references remain in `FRONTENT/src/composables/operations/purchaseOrders/`, and no PO composable destructures `navigateTo` or `navigateToAdd` from `useResourceNav`.
- No `payload.id` remains in PO create/update/action requests.
- No PO action request sends raw `actionConfig` or `data` inside a batch `executeAction` payload.

Failure signs:
- `TypeError: fetchResource is not a function`: at least one old resource API call remains.
- `TypeError: navigateTo is not a function`: old navigation alias remains.
- PO child rows not created: composite child group still uses `data` instead of `records`.
- Created PO does not navigate to view: code extraction still uses `response.data.results`.
- Procurement update fails: update request still uses `id`.
- PO action says record code or action name missing: raw action payload shape is still wrong.

## Regression Checklist
- [ ] PO schema, AppOptions, `APP.Resources`, and docs from the completed PO module plan remain unchanged.
- [ ] SupplierQuotation, RFQ, PR, and Procurement flows are not refactored.
- [ ] Generic resource composables/stores/services are not changed.
- [ ] PO pages remain thin and continue consuming only PO composables.
- [ ] PO remaining quantity rules still exclude cancelled POs and include closed POs.
- [ ] PO item payload still does not store `LineTotal`, `TotalPrice`, or `POCode`.
- [ ] Navigation still goes through `useResourceNav`.

## Acceptance Criteria
- [ ] `usePurchaseOrderIndex.js` uses resource instances and `nav.goTo`.
- [ ] `usePurchaseOrderCreateFlow.js` uses resource instances and `nav.goTo`.
- [ ] `usePurchaseOrderView.js` uses resource instances, `code`, `isActionVisible` from `useResourceConfig`, and `nav.goTo`.
- [ ] PO create composite child payload uses `records`.
- [ ] PO create procurement update uses `payload.code`.
- [ ] PO create result code is read from `response.data?.[0]`.
- [ ] PO action execution uses `workflowStore.executeResourceAction`.
- [ ] Frontend build passes.
- [ ] No backend deployment is required.

## Documentation Updates Required
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` only if return signatures are changed.
- [ ] Do not update `Documents/MODULE_WORKFLOWS.md`; behavior does not change.
- [ ] Do not update `Documents/CONTEXT_HANDOFF.md`; this is a bug fix to an already documented PO module unless Build Agent changes architecture or workflow behavior.

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
- [x] Step 7 completed or confirmed unnecessary
- [x] Step 8 completed or confirmed unnecessary
- [x] Step 9 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderIndex.js`
- `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js`
- `FRONTENT/src/composables/operations/purchaseOrders/usePurchaseOrderView.js`
- `FRONTENT/src/composables/operations/purchaseOrders/purchaseOrderPayload.js`
- `PLANS/purchase-order-runtime-contract-fixes.md`

### Validation Performed
- [x] `npm --prefix FRONTENT run build`
- [ ] PO index smoke check
- [ ] PO create smoke check
- [ ] PO action smoke check
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] None expected.
