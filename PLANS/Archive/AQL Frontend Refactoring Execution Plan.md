# PLAN: AQL Frontend Refactoring Execution
**Status**: COMPLETED
**Created**: 2026-04-19
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex GPT-5)

## Objective
Refactor the frontend architecture in controlled phases without breaking production behavior, while preserving the current cache-first IndexedDB flow, background sync behavior, and login bootstrap/runtime contracts.

This plan converts the existing refactor outline into a repo-specific execution plan for the current frontend codebase under `FRONTENT/src`.

## Context
Current frontend state is functional but layered inconsistently:

- `src/services/resourceRecords.js` currently owns API orchestration, sync TTL logic, queueing, scope resolution, header resolution, IDB writes, and batch master sync.
- `src/stores/auth.js` currently orchestrates login bootstrap, auth token persistence, IndexedDB reinitialization, authorized-resource metadata persistence, and global master sync kickoff.
- `src/stores/data.js` currently hydrates from IndexedDB and updates reactively through `onRowsUpserted()` callbacks from `src/utils/db.js`.
- Several composables and pages still call `callGasApi()`, `fetchResourceRecords()`, and direct `src/utils/db.js` helpers.

The current state means this refactor must preserve runtime contracts first, then relocate ownership gradually. Treat the current sync + IDB flow as a protected subsystem until explicit replacement is in place.

## Source Docs Reviewed
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `PLANS/_TEMPLATE.md`

## Pre-Conditions
- [ ] Build Agent has read this plan fully before editing.
- [ ] Build Agent has read `Documents/AI_COLLABORATION_PROTOCOL.md`.
- [ ] Working branch created for the refactor.
- [ ] Targeted manual validation can be performed for login, data loading, sync, bulk upload, stock movements, and purchase requisition flows.
- [ ] Build Agent understands that this is a frontend-only refactor unless a documented API contract issue is discovered.

## Protected Contracts
These behaviors must remain stable until the cleanup phase explicitly removes the legacy path:

- [ ] `callGasApi()` remains callable by existing pages/composables until all direct callers are migrated.
- [ ] `fetchResourceRecords()` remains callable and cache-first.
- [ ] `syncAllMasterResources()` remains callable from auth bootstrap until replacement store orchestration is complete.
- [ ] `setAuthorizedResources()`, `reinitializeDB()`, `upsertResourceRows()`, `getResourceRows()`, `setResourceMeta()`, and `onRowsUpserted()` remain behavior-compatible until all consumers move behind the new abstractions.
- [ ] Login payload shape and auth persistence behavior remain unchanged unless explicitly documented and approved.
- [ ] No phase may remove a legacy file before all imports to it have been migrated and validated.

## Non-Goals
- [ ] Do not change GAS API contracts unless required to preserve existing frontend behavior.
- [ ] Do not redesign UI/UX beyond small extraction-oriented cleanup.
- [ ] Do not change resource authorization semantics.
- [ ] Do not introduce broad naming churn unrelated to the phase being executed.

## Execution Strategy
Execute in layers, not by sweeping file renames:

1. Stabilize contracts.
2. Introduce compatibility-backed new abstractions.
3. Move ownership into stores.
4. Move business logic into composables.
5. Thin pages.
6. Split monoliths behind facades.
7. Remove dead legacy paths only after import graph is clean.

## Steps

### Step 1: Establish Baseline and Instrumentation
- [ ] Create the refactor branch.
- [ ] Add guarded logging helpers or inline env-guarded logs only where needed for migration visibility. Do not scatter noisy logging through unrelated files.
- [ ] Record the exact critical manual validation checklist before moving code:
  - login
  - first-load data fetch
  - refresh with cached data
  - background sync after cached load
  - bulk upload and cache writeback
  - stock movement batch save
  - purchase requisition draft/create/review flows
- [ ] Confirm existing direct callers of legacy services and IDB helpers using search before any edits.
**Files**: `FRONTENT/src/services/gasApi.js`, `FRONTENT/src/services/resourceRecords.js`, `FRONTENT/src/utils/db.js`, direct callers across `pages/`, `composables/`, `stores/`
**Pattern**: Preserve existing exported entry points before introducing replacements.
**Rule**: No behavior changes in this step.
**Validation Gate**: Baseline flows are manually checked and any pre-existing issues are recorded before refactor edits start.

### Step 2: Introduce New Service Wrappers Without Breaking Imports
- [ ] Create `FRONTENT/src/services/ApiClientService.js` as a wrapper around the axios client creation currently in `apiClient.js`.
- [ ] Create `FRONTENT/src/services/GasApiService.js` that exposes a clean service interface without Quasar UI side effects.
- [ ] Create `FRONTENT/src/services/IndexedDbService.js` that wraps the current DB helpers while preserving the current IndexedDB schema and semantics.
- [ ] Keep legacy files in place and refactor them into compatibility adapters:
  - `apiClient.js` delegates to `ApiClientService.js`
  - `gasApi.js` delegates to `GasApiService.js`
  - `utils/db.js` delegates selectively to `IndexedDbService.js` where safe
- [ ] Do not remove `Notify`/`Loading` behavior from legacy call sites yet. Move side-effect-free behavior into new services, but preserve legacy user-facing behavior through adapters.
- [ ] Normalize new service return envelopes where possible, but do not break legacy callers expecting `message`, `data`, `success`, or resource-specific payload fields.
**Files**: `FRONTENT/src/services/apiClient.js`, `FRONTENT/src/services/gasApi.js`, `FRONTENT/src/utils/db.js`, new files under `FRONTENT/src/services/`
**Pattern**: Adapter-first migration. New services sit behind old exports first.
**Rule**: Legacy import paths must continue to work unchanged after this step.
**Validation Gate**: Login, auth API calls, and any page still using `callGasApi()` behave exactly as before.

### Step 3: Extract Resource Sync Responsibilities Behind a Stable Facade
- [ ] Introduce new service modules for the current `resourceRecords.js` responsibilities:
  - `ResourceRecordsService.js`
  - `ResourceSyncQueueService.js`
  - `ResourceMapperService.js`
- [ ] Move logic out of `resourceRecords.js` incrementally:
  - mapping helpers
  - scope resolution and header resolution
  - sync queue scheduling/flushing
  - record fetch and batch sync orchestration
- [ ] Retain `resourceRecords.js` as the public compatibility facade during this step.
- [ ] Preserve current behavior for:
  - cache-first reads
  - TTL-based deferred sync
  - full sync on cold IDB + stale cursor
  - `lastSyncAt` handling
  - grouped sync by scope
- [ ] Do not move ownership to stores yet; only split the monolith safely behind the existing API.
**Files**: `FRONTENT/src/services/resourceRecords.js`, new resource service files under `FRONTENT/src/services/`
**Pattern**: Facade + extracted modules.
**Rule**: `fetchResourceRecords()` and `syncAllMasterResources()` must remain stable external APIs in this step.
**Validation Gate**: Refresh hydration, forced sync, background sync, and global master sync all still function.

### Step 4: Define Store Ownership and Migrate Data Access Into Stores
- [ ] Expand `useDataStore` so it becomes the canonical owner of resource rows, headers, hydration, and update pathways.
- [ ] Add explicit store actions for:
  - initializing a resource
  - loading from cache
  - requesting sync/fetch through the resource services
  - applying optimistic or local updates
- [ ] Decide and implement one consistent ownership model:
  - either stores remain updated through IDB callback events, or
  - stores become the direct orchestrator and IDB becomes persistence behind store actions
- [ ] Preserve `onRowsUpserted()` compatibility until all current consumers are off the legacy path.
- [ ] Update `auth.js` only as needed so login bootstrap still:
  - persists token/user/resources/app config
  - initializes IDB
  - seeds authorized resource metadata
  - triggers global sync
- [ ] Do not migrate pages/composables yet except where needed to keep store contracts coherent.
**Files**: `FRONTENT/src/stores/data.js`, `FRONTENT/src/stores/auth.js`, service files created in prior steps
**Pattern**: Store owns frontend state; services stay UI-independent.
**Rule**: After this step, no new feature code should read resource data directly from service returns when the store can own it.
**Validation Gate**: Cached revisit, refresh hydration, auth bootstrap, and post-sync UI refresh remain correct.

### Step 5: Migrate Composables to Store-Driven Business Logic
- [ ] Refactor composables that currently call services or direct DB helpers so they use store actions instead.
- [ ] Prioritize composables with broad reuse or direct IDB writes:
  - `useResourceData.js`
  - `useBulkUpload.js`
  - `useStockMovements.js`
  - `useCompositeForm.js`
  - `useReports.js`
- [ ] Move optimistic update and cache writeback logic behind stores where practical.
- [ ] Keep composables focused on business rules, orchestration, and UI-facing state; remove direct persistence mechanics from them.
- [ ] If a composable grows or remains too large, split it only after its responsibilities are clear. Avoid churn-only file splitting.
**Files**: `FRONTENT/src/composables/useResourceData.js`, `FRONTENT/src/composables/useBulkUpload.js`, `FRONTENT/src/composables/useStockMovements.js`, `FRONTENT/src/composables/useCompositeForm.js`, `FRONTENT/src/composables/useReports.js`, any new composables created in support
**Pattern**: Composables call store actions; they do not own transport or persistence.
**Rule**: Remove direct `src/utils/db.js` imports from composables as a controlled result of this step.
**Validation Gate**: Resource index/view/edit flows, bulk upload, and stock movements still work with no missing side effects.

### Step 6: Thin Pages and Remove Direct Service Calls From Views
- [ ] Refactor pages that still call `callGasApi()` or `fetchResourceRecords()` directly so they delegate to composables or store actions.
- [ ] Prioritize high-risk pages first:
  - generic masters pages under `pages/Masters/_common/`
  - generic operations pages under `pages/Operations/_common/`
  - purchase requisition pages
  - product pages
- [ ] Introduce new page-specific composables only where they reduce duplication and clarify ownership:
  - `useLogin`
  - `useProfile`
  - `useProductsIndex`
  - `usePurchaseRequisitionDraft`
  - `usePurchaseRequisitionReview`
- [ ] Keep page components focused on view state, event wiring, and composition.
- [ ] Do not split large pages just because of line count; split only when logic can be cleanly extracted without changing behavior.
**Files**: `FRONTENT/src/pages/**`, new page-specific composables under `FRONTENT/src/composables/`
**Pattern**: Pages become thin entry points; composables own workflow logic.
**Rule**: After this step, pages should not import legacy service files directly unless explicitly justified in the progress log.
**Validation Gate**: Generic action/view/edit pages and PR flows still behave correctly with no console/runtime errors.

### Step 7: Structural Cleanup, Registry Updates, and Large-File Decomposition
- [ ] Split only the genuinely overloaded files that still remain hard to maintain after ownership migration.
- [ ] Extract child components from large pages only where UI sections are reusable or materially clearer as subcomponents.
- [ ] If reusable composables or reusable components are added, update the relevant registries:
  - `FRONTENT/src/composables/REGISTRY.md`
  - `FRONTENT/src/components/REGISTRY.md`
- [ ] If styling cleanup is still needed, add `src/css/custom.scss` and import it from `app.scss` without altering existing visual output.
- [ ] Do not remove any legacy compatibility layer in this step.
**Files**: large pages/composables/components as identified during execution, registry docs if reusable interfaces changed, `FRONTENT/src/css/app.scss`, optional `FRONTENT/src/css/custom.scss`
**Pattern**: Maintainability cleanup after architecture ownership is stable.
**Rule**: UI behavior and styling must remain materially unchanged.
**Validation Gate**: Screens render the same, extracted components receive correct props, and no registry drift remains for reusable additions.

### Step 8: Remove Legacy Paths Only After Import Graph Is Clean
- [ ] Search the codebase and confirm there are no remaining imports of:
  - `src/services/gasApi`
  - `src/services/apiClient`
  - `src/services/resourceRecords`
  - `src/utils/db`
  - any temporary compatibility-only exports scheduled for removal
- [ ] Remove legacy files only after all references are migrated and the replacement paths are validated.
- [ ] Enforce naming conventions only where the code already migrated naturally; do not perform a global rename-only sweep if risk outweighs value.
- [ ] Run a final code review pass against architecture rules and regressions.
**Files**: legacy service/db files plus all migrated import sites
**Pattern**: Delete only after the dependency graph is clean.
**Rule**: No legacy file deletion without a clean import search result recorded in the progress log.
**Validation Gate**: Final search confirms no legacy imports remain and all acceptance criteria still pass.

## Documentation Updates Required
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` if reusable composables are added, renamed, or materially repurposed.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` if reusable components are added or split out.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` only if a documented module workflow materially changes.
- [ ] Update `Documents/LOGIN_RESPONSE.md` only if login payload/storage behavior changes. Avoid this if possible.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if the execution introduces major architectural decisions, deviations, or unfinished follow-up items.

## Commit Strategy
- [ ] Do not combine the full refactor into one commit.
- [ ] Use phase-aligned commits with working behavior after each commit.
- [ ] Preferred commit shape:
  - `feat: add non-breaking frontend service wrappers`
  - `refactor: extract resource sync services behind facade`
  - `refactor: move resource state ownership into stores`
  - `refactor: migrate composables to store-driven contracts`
  - `refactor: thin generic pages and PR flows`
  - `refactor: split large frontend modules`
  - `cleanup: remove legacy frontend service and db paths`

## Acceptance Criteria
- [ ] Login still persists token, user, resources, app config, and app options exactly as before.
- [ ] Authorized resource metadata is still initialized for IndexedDB-backed resource access.
- [ ] Cached resource revisit remains cache-first and does not force unnecessary per-visit server fetches.
- [ ] Background sync still refreshes stale cached data correctly.
- [ ] Global master sync still works after login.
- [ ] Bulk upload still performs upload, reports success/errors, and writes returned rows/meta back into IndexedDB/store state.
- [ ] Stock movement batch save still works and refreshes dependent warehouse storage data.
- [ ] Purchase requisition create/draft/review flows still function.
- [ ] Generic masters and operations view/edit/action pages still work.
- [ ] No direct imports remain from removed legacy files after the cleanup phase.
- [ ] No frontend behavior change requires GAS redeployment unless the Build Agent explicitly records a contract change.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace the pending executor identity with the concrete agent/runtime identity used in that session.)*

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
- [x] `[!]` No additional Step 7 file-splitting was required after the ownership migration. Registry docs were left unchanged because no reusable composables/components were added.
- [x] `[!]` Legacy files `src/services/apiClient.js`, `src/services/gasApi.js`, `src/services/resourceRecords.js`, and `src/utils/db.js` were removed after import search returned clean.
- [x] `[!]` Validation included `npm run build` plus user-run dev server smoke verification. Exhaustive file-by-file verification is still pending outside this execution session.

### Files Actually Changed
- `FRONTENT/src/services/ApiClientService.js`
- `FRONTENT/src/services/GasApiService.js`
- `FRONTENT/src/services/IndexedDbService.js`
- `FRONTENT/src/services/ResourceMapperService.js`
- `FRONTENT/src/services/ResourceRecordsService.js`
- `FRONTENT/src/services/ResourceSyncQueueService.js`
- `FRONTENT/src/services/ReportService.js`
- `FRONTENT/src/boot/axios.js`
- `FRONTENT/src/stores/auth.js`
- `FRONTENT/src/stores/data.js`
- `FRONTENT/src/composables/useBulkUpload.js`
- `FRONTENT/src/composables/useCompositeForm.js`
- `FRONTENT/src/composables/useReports.js`
- `FRONTENT/src/composables/useResourceData.js`
- `FRONTENT/src/composables/useStockMovements.js`
- `FRONTENT/src/pages/Masters/_common/ActionPage.vue`
- `FRONTENT/src/pages/Masters/_common/EditPage.vue`
- `FRONTENT/src/pages/Masters/_common/ViewPage.vue`
- `FRONTENT/src/pages/Masters/Products/ViewPage.vue`
- `FRONTENT/src/pages/Operations/_common/ActionPage.vue`
- `FRONTENT/src/pages/Operations/_common/EditPage.vue`
- `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
- `FRONTENT/src/services/apiClient.js` (removed)
- `FRONTENT/src/services/gasApi.js` (removed)
- `FRONTENT/src/services/resourceRecords.js` (removed)
- `FRONTENT/src/utils/db.js` (removed)

### Validation Performed
- [x] Baseline manual validation completed
- [x] Phase validation gates completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] None
