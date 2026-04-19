# Frontend Strict Architecture Review Report
**Scope Reviewed**: `FRONTENT/src/*`
**Rule Baseline**: `Documents/ARCHITECTURE RULES.md`
**Review Date**: 2026-04-19

## 1. Overall Architecture Health

- **Rating**: 4.5 / 10 (At Risk)
- **Key Problems**:
  - Layer boundary leaks are widespread (pages/composables directly using services and stores).
  - Navigation contract is not consistently enforced (`useResourceNav` bypassed).
  - Service contract is inconsistent (mixed response shapes and uncontrolled logging).
  - Multiple oversized files increase regression risk and block maintainability.
  - Styling architecture is incomplete (`custom.scss` contract missing).
- **Risk Level**: **High** (especially around sync/data consistency due to cross-layer direct calls).

---

## 2. Global Violations

1. **Components/pages directly use services (Critical)**
   - Violates: Components must use composables only; no API/IDB in components.
   - Evidence:
     - `FRONTENT/src/pages/Masters/_common/ActionPage.vue:80`
     - `FRONTENT/src/pages/Operations/_common/ActionPage.vue:86`
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue:287`
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue:288`
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue:178`

2. **Composables directly use services and IDB (Critical)**
   - Violates: Composables must not call services/API/IDB directly.
   - Evidence:
     - `FRONTENT/src/composables/useAuthLogic.js:10-13`
     - `FRONTENT/src/composables/useStockMovements.js:20`
     - `FRONTENT/src/composables/useReports.js:3`
     - `FRONTENT/src/composables/useResourceSync.js:15-16`
     - `FRONTENT/src/composables/useCompositeForm.js:219`
     - `FRONTENT/src/composables/useBulkUpload.js:5-12`
     - `FRONTENT/src/composables/useResourceData.js:131`

3. **Pages/layouts directly use stores (High)**
   - Violates: Components can only use composables.
   - Evidence:
     - `FRONTENT/src/pages/AuthPage/LoginPage.vue:38`
     - `FRONTENT/src/pages/ProfilePage/ProfilePage.vue:223`
     - `FRONTENT/src/pages/Dashboard/DashboardIndex.vue:23`
     - `FRONTENT/src/layouts/MainLayout/MainLayout.vue:120`
     - `FRONTENT/src/pages/Masters/_common/ViewPage.vue:80`
     - `FRONTENT/src/pages/Masters/_common/EditPage.vue:62`
     - `FRONTENT/src/pages/Masters/Products/ViewPage.vue:103`
     - `FRONTENT/src/pages/Operations/_common/ViewPage.vue:74`
     - `FRONTENT/src/pages/Operations/_common/EditPage.vue:62`
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue:474`
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue:290`

4. **Navigation contract bypassed (High)**
   - Violates: all navigation through `useResourceNav`; direct `router.push()` not allowed.
   - Evidence:
     - `FRONTENT/src/pages/AuthPage/LoginPage.vue:64`
     - `FRONTENT/src/pages/ProfilePage/ProfilePage.vue:82`

5. **Service logging and response standardization inconsistent (High)**
   - Violates: service logs must be env-controlled; services must return standardized `{ success, data, error }`.
   - Evidence:
     - `FRONTENT/src/services/_logger.js:28-35` (warn/error always log, not env-controlled)
     - `FRONTENT/src/services/IndexedDbService.js:21,44,47,207` (raw console logging)
     - `FRONTENT/src/services/ResourceRecordsService.js:71-80` (legacy non-standard response shape)
     - `FRONTENT/src/services/IndexedDbService.js:64-220` (raw values/arrays, not standardized envelope)

6. **File size rule broken (Medium)**
   - Violates: no file should exceed ~400 lines.
   - Evidence:
     - `FRONTENT/src/css/hero.scss` (1196)
     - `FRONTENT/src/services/ResourceFetchService.js` (431)
     - `FRONTENT/src/pages/Masters/Products/AddPage.vue` (412)
     - `FRONTENT/src/pages/Masters/Products/EditPage.vue` (475)
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue` (511)
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue` (540)
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue` (407)
     - `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue` (872)

7. **Styling architecture gap (Medium)**
   - Violates: shared styles must live in `src/css/custom.scss`, imported by `app.scss`.
   - Evidence:
     - `FRONTENT/src/css/app.scss` imports `hero` and `transitions` but no `custom.scss` entry.

---

## 3. File-by-File Action Plan

File: `FRONTENT/src/pages/Masters/_common/ActionPage.vue`
- Issue: Direct service/API call in page (`executeGasApi`).
- Action: Move submit action execution into a composable facade (page consumes only composable API).
- Refactor Type: Layer extraction.
- Target: `src/composables/useMasterActions.js` (new) + page simplification.
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Operations/_common/ActionPage.vue`
- Issue: Direct service/API call in page.
- Action: Same as masters action page through operations action composable.
- Refactor Type: Layer extraction.
- Target: `src/composables/useOperationActions.js` (new).
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- Issue: Direct API and IDB calls in page; oversized file.
- Action: Split into page shell + PR domain composables; route API/IDB through composable -> service wrappers only.
- Refactor Type: Decompose + boundary fix.
- Target: `usePurchaseRequisitionCreateFlow`, `usePurchaseRequisitionCatalog`, `usePurchaseRequisitionPersistence`.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
- Issue: Direct service call in page; oversized file.
- Action: Move save/submit payload orchestration into dedicated composable.
- Refactor Type: Layer extraction + split.
- Target: `usePurchaseRequisitionDraftFlow`.
- Priority: **P1 / High**.

File: `FRONTENT/src/composables/useAuthLogic.js`
- Issue: Composable directly accesses services + IDB; mixed UI/service responsibilities.
- Action: Introduce intermediary auth workflow service facade and keep composable as business orchestration only.
- Refactor Type: Responsibility split.
- Target: `AuthWorkflowService` + narrowed composable.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/composables/useStockMovements.js`
- Issue: Direct `executeGasApi` usage.
- Action: Use a stock-movements service wrapper and keep composable for workflow logic.
- Refactor Type: Layer compliance.
- Target: `StockMovementsService` (new).
- Priority: **P1 / High**.

File: `FRONTENT/src/composables/useReports.js`
- Issue: Direct report service invocation from composable.
- Action: Route through store-backed or facade composable boundary agreed for reports.
- Refactor Type: Boundary normalization.
- Target: `useReportActions` / reports gateway composable.
- Priority: **P2 / Medium**.

File: `FRONTENT/src/composables/useResourceSync.js`
- Issue: Queue orchestration and service coupling in composable; sync logic duplicated across layers.
- Action: Keep queue/sync mechanics inside services, composable only exposes UI-safe hooks/state.
- Refactor Type: Sync centralization.
- Target: extend `ResourceRecordsService`/`ResourceSyncQueueService`; thin composable adapter.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/composables/useCompositeForm.js`
- Issue: Dynamic import of service (`compositeSave`) from composable.
- Action: inject save action via composable dependency contract or store action.
- Refactor Type: Dependency inversion.
- Target: `useCompositeForm({ saveHandler })` contract.
- Priority: **P1 / High**.

File: `FRONTENT/src/composables/useBulkUpload.js`
- Issue: Direct IDB operations and bulk service access from composable.
- Action: Replace direct IDB calls with `IndexedDbCacheService` wrapper methods and dedicated bulk workflow facade.
- Refactor Type: Layer compliance.
- Target: `BulkUploadService` + cache wrapper usage.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/composables/useResourceData.js`
- Issue: Direct IDB write call (`upsertResourceRows`) in composable; undeclared dependency risk.
- Action: Delegate optimistic persistence to store/service; composable only coordinates state.
- Refactor Type: Boundary cleanup.
- Target: `useDataStore.cacheResourceRows` or a dedicated mutation action.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/pages/AuthPage/LoginPage.vue`
- Issue: Page directly uses store and `router.push`.
- Action: Use auth view-model composable + navigation helper (`useResourceNav`/app nav abstraction).
- Refactor Type: Component thinning + nav compliance.
- Target: `useLoginPage` (new).
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`
- Issue: Page directly uses store and `$router.back()`.
- Action: Move auth interactions into composable and replace back navigation with helper route intent.
- Refactor Type: Boundary + navigation compliance.
- Target: `useProfilePage` (new).
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`
- Issue: Page directly uses store for role logic.
- Action: Encapsulate widget resolution into composable.
- Refactor Type: Component thinning.
- Target: `useDashboardWidgets` (new).
- Priority: **P2 / Medium**.

File: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- Issue: Layout directly uses auth store and contains dense menu business logic.
- Action: Move menu tree derivation + auth reads into composable.
- Refactor Type: Layout orchestration split.
- Target: `useMainLayoutNavTree` (new).
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Masters/_common/ViewPage.vue`
- Issue: Direct `useDataStore` usage in page.
- Action: Move child record loading to composable service adapter.
- Refactor Type: Layer alignment.
- Target: `useChildResourceRecords` (shared).
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Masters/_common/EditPage.vue`
- Issue: Direct `useDataStore` usage in page.
- Action: Same shared composable extraction for child records.
- Refactor Type: Layer alignment.
- Target: `useChildResourceRecords`.
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Masters/Products/ViewPage.vue`
- Issue: Direct `useDataStore` usage in page.
- Action: Move SKU loading/sync behavior into composable.
- Refactor Type: Component thinning.
- Target: `useProductSkuViewData` (new).
- Priority: **P2 / Medium**.

File: `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
- Issue: Direct `useDataStore` usage in page.
- Action: Move parent/children fetch logic into composable.
- Refactor Type: Layer alignment.
- Target: `useOperationRelationsData`.
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Operations/_common/EditPage.vue`
- Issue: Direct `useDataStore` usage in page.
- Action: Move child fetch logic into composable.
- Refactor Type: Layer alignment.
- Target: `useOperationRelationsData`.
- Priority: **P1 / High**.

File: `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`
- Issue: Direct store usage and oversized page containing heavy workflow/business logic.
- Action: Extract PR review workflow into composables and split visual sections into components.
- Refactor Type: Major decomposition.
- Target: `usePurchaseRequisitionReviewFlow`, `components/Operations/PurchaseRequisitions/*`.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/services/_logger.js`
- Issue: warn/error logs are always on; env control incomplete.
- Action: centralize level gating via env-configured policy and avoid unconditional console writes.
- Refactor Type: Logging policy hardening.
- Target: `_logger.js` + adoption in all services.
- Priority: **P1 / High**.

File: `FRONTENT/src/services/IndexedDbService.js`
- Issue: raw console logging + raw return shapes.
- Action: move logging to logger service; expose standardized wrappers for external callers.
- Refactor Type: Service contract normalization.
- Target: keep raw internals private, export standardized public API.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/services/ResourceRecordsService.js`
- Issue: compatibility responses deviate from standard contract.
- Action: enforce single standardized response and adapt callers once.
- Refactor Type: Contract unification.
- Target: `{ success, data, error }` consistently.
- Priority: **P0 / Critical**.

File: `FRONTENT/src/services/ResourceFetchService.js`
- Issue: >400 lines and mixed responsibilities.
- Action: split by concern (headers, sync batch, CRUD actions).
- Refactor Type: Service modularization.
- Target: `ResourceHeadersService`, `ResourceSyncService`, `ResourceCrudService` (or equivalent).
- Priority: **P2 / Medium**.

File: `FRONTENT/src/css/app.scss`
- Issue: missing mandatory shared style entrypoint.
- Action: import `custom.scss` and move reusable shared styles there.
- Refactor Type: Styling contract compliance.
- Target: `src/css/custom.scss` + `app.scss` import.
- Priority: **P2 / Medium**.

File: `FRONTENT/src/css/hero.scss`
- Issue: 1196 lines, high concentration of style logic.
- Action: split into domain partials and keep shared primitives in `custom.scss`.
- Refactor Type: SCSS decomposition.
- Target: `css/hero/*.scss` partials (or equivalent).
- Priority: **P2 / Medium**.

File: `FRONTENT/src/pages/Masters/Products/AddPage.vue`
- Issue: >400 lines.
- Action: split into component sections + supporting composables.
- Refactor Type: Page decomposition.
- Target: thin page shell.
- Priority: **P2 / Medium**.

File: `FRONTENT/src/pages/Masters/Products/EditPage.vue`
- Issue: >400 lines, dense mixed responsibilities.
- Action: extract variant management logic into dedicated composables/components.
- Refactor Type: Page decomposition.
- Target: `useProductEditVariants`, section components.
- Priority: **P2 / Medium**.

File: `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`
- Issue: >400 lines.
- Action: split filters, list, and action bars into components and composables.
- Refactor Type: Page decomposition.
- Target: thin page shell.
- Priority: **P2 / Medium**.

---

## 4. New Files

- `FRONTENT/src/composables/useMasterActions.js`
- `FRONTENT/src/composables/useOperationActions.js`
- `FRONTENT/src/composables/usePurchaseRequisitionCreateFlow.js`
- `FRONTENT/src/composables/usePurchaseRequisitionDraftFlow.js`
- `FRONTENT/src/composables/usePurchaseRequisitionReviewFlow.js`
- `FRONTENT/src/composables/useDashboardWidgets.js`
- `FRONTENT/src/composables/useMainLayoutNavTree.js`
- `FRONTENT/src/composables/useChildResourceRecords.js`
- `FRONTENT/src/composables/useOperationRelationsData.js`
- `FRONTENT/src/composables/useProductSkuViewData.js`
- `FRONTENT/src/composables/useLoginPage.js`
- `FRONTENT/src/composables/useProfilePage.js`
- `FRONTENT/src/services/StockMovementsService.js`
- `FRONTENT/src/services/BulkUploadService.js`
- `FRONTENT/src/css/custom.scss`

---

## 5. Files to Remove/Merge

- Merge direct callers of raw IDB methods into standardized cache wrapper usage:
  - `FRONTENT/src/composables/useBulkUpload.js` -> wrapper-based persistence.
  - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue` -> composable facade.
- Merge repeated parent/child loading code into shared composables:
  - `FRONTENT/src/pages/Masters/_common/ViewPage.vue`
  - `FRONTENT/src/pages/Masters/_common/EditPage.vue`
  - `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
  - `FRONTENT/src/pages/Operations/_common/EditPage.vue`
- Split/retire monolithic sections from oversized PR pages after extraction:
  - `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
  - `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`

---

## 6. Refactoring Plan

1. Freeze contracts first: define strict boundaries for page/composable/store/service usage and response envelope.
2. Introduce missing facades/composables for action pages and PR workflows; keep old code paths until parity is validated.
3. Remove direct service usage from pages, then remove direct store usage from pages/layouts.
4. Enforce navigation contract (`useResourceNav`/single nav helper), replacing direct `router.push` and `$router.back`.
5. Normalize services: logging policy + standardized `{ success, data, error }` responses.
6. Split oversized files incrementally, validating each extraction against current behavior.
7. Add `src/css/custom.scss`, import in `app.scss`, and migrate reusable styles from monolith files.
8. Run targeted regression checks per refactor slice (auth/login, action execution, PR create/draft/review, bulk upload, sync hydration).
9. Update registries/docs only for changed reusable surfaces.
10. Final architecture pass: verify no remaining direct page->store/service or composable->service calls.

