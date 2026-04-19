## Implementation Plan (Brain-Agent Draft)

**Suggested plan file name:** `PLANS/2026-04-20-pr-fix-composable-reorg-and-sass-color-adjust.md`  
**Created By:** Brain Agent  
**Executed By:** Build Agent (GitHub Copilot)

### 1) Goal
Stabilize the PR initiation page runtime, remove Sass color-function deprecations, reduce composable sprawl through selective merge + categorized structure, and fix composable registry drift.

### 2) Scope
- Frontend only (`FRONTENT/`)
- No GAS/backend/API contract changes
- No sheet/schema changes
- No menu/auth payload changes

### 3) Decisions Locked (per user request)
1. Implement **Option 1** for runtime fix: page-level import of `formatSkuVariants`.
2. Migrate Sass deprecated `lighten()` usages to `color.adjust(..., $lightness: X%)`.
3. Merge only where files are tightly coupled and not independently meaningful.
4. For Purchase Requisitions, follow selective extraction/merge pattern (not one giant file).
5. Reorganize remaining composables by purpose exactly as requested.
6. Update `FRONTENT/src/composables/REGISTRY.md` to remove drift.

---

### 4) Work Breakdown

#### A. Runtime crash fix (highest priority)
- File: `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- Add direct import:
  - `import { formatSkuVariants } from 'src/utils/appHelpers'`
- Keep composable return untouched for this helper.
- Validate the page no longer throws `_ctx.formatSkuVariants is not a function`.

#### B. Sass deprecation migration (`lighten` -> `color.adjust`)
- Files (confirmed current usages):
  - `FRONTENT/src/css/hero/_tokens.scss`
  - `FRONTENT/src/css/hero/_hero-card.scss`
- Add `@use 'sass:color';` where needed.
- Replace every `lighten($x, N%)` with `color.adjust($x, $lightness: N%)`.
- Preserve current visual intent (no `color.scale` conversion in this pass).
- Verify dev server logs no longer show deprecation for these files.

#### C. Purchase Requisition composables: selective merge/extract
Current files:
- `usePurchaseRequisitionCreateFlow.js`
- `usePurchaseRequisitionDraftFlow.js`
- `usePurchaseRequisitionReviewFlow.js`
- `usePurchaseRequisitionIndex.js`

Implementation direction:
1. Keep `Index` standalone.
2. Keep `Create`, `Draft`, `Review` as separate flow composables.
3. Extract tightly coupled shared logic into local feature helpers under PR feature folder, e.g.:
   - catalog/warehouse/SKU loading helpers
   - item editing helpers (add/remove/filter)
   - common payload/format helpers
4. Merge only tiny page-private files if they are always co-used and not meaningful independently.
5. Avoid mega-composable.

#### D. Composable directory reorganization
Target structure (post-merge/extract):

- `FRONTENT/src/composables/layout/`
  - `useMenuAccess.js`
  - `useMainLayoutNavTree.js`
  - `useLoginPage.js`
  - `useProfilePage.js`

- `FRONTENT/src/composables/core/`
  - `useAppNav.js`
  - `useAuthLogic.js`

- `FRONTENT/src/composables/resources/`
  - `useResourceConfig.js`
  - `useResourceData.js`
  - `useResourceNav.js`
  - `useResourceRelations.js`
  - `useResourceRelationsData.js`
  - `useResourceSync.js`
  - `useSectionResolver.js`
  - `useActionResolver.js`
  - `useActionFields.js`
  - `useCompositeForm.js`
  - `_resolveTieredComponent.js`

- `FRONTENT/src/composables/operations/purchaseRequisitions/`
  - PR flow files + extracted shared PR internals

- `FRONTENT/src/composables/operations/stock/`
  - `useStockMovements.js`

- `FRONTENT/src/composables/masters/products/`
  - product-specific composables

- `FRONTENT/src/composables/reports/`
  - `useReports.js`

- `FRONTENT/src/composables/upload/`
  - `useBulkUpload.js`

Also update all affected import paths across pages/composables.

#### E. Registry drift correction
- File: `FRONTENT/src/composables/REGISTRY.md`
- Update each moved path.
- Correct stale signatures/returns (especially PR flow entries that no longer match actual API).
- Add entries for any newly extracted PR helper composables (if public/reusable).
- Keep page-private internal helpers documented minimally or in feature README (optional).

---

### 5) Verification Plan (targeted)
1. Navigate to PR initiate flow and confirm:
   - no Vue warning for `formatSkuVariants`
   - no render crash on Step 2
2. Check dev logs for Sass warning disappearance for migrated files.
3. Smoke test impacted routes:
   - PR index/create/draft/review pages
   - login/profile/layout navigation
   - one generic resource page using `useSectionResolver`/`useActionResolver`
4. Run lint/type/build only if reorg touches many imports and risk rises (likely yes for this task).

---

### 6) Risks & Mitigations
- **Risk:** path breakage after composable moves.  
  **Mitigation:** do move in batches + immediate import-fix sweep.
- **Risk:** over-merging PR logic leads to complexity.  
  **Mitigation:** extract common internals only; preserve flow-level entry composables.
- **Risk:** visual drift after Sass function migration.  
  **Mitigation:** keep same percentages using `color.adjust`; quick visual check on hero components.
- **Risk:** registry gets stale again.  
  **Mitigation:** update registry in same PR and cross-check file paths.

---

### 7) Deliverables
- Runtime bug fixed in `InitiatePurchaseRequisitionsPage.vue`
- Sass deprecations removed from hero styles using `color.adjust`
- Reorganized composables tree + updated imports
- PR feature logic selectively merged/extracted
- `FRONTENT/src/composables/REGISTRY.md` updated and accurate

---

## 8) Execution Status (Build Agent)
- Status: Completed on 2026-04-20
- Completed:
  - Preserved the page-level `formatSkuVariants` import in `InitiatePurchaseRequisitionsPage.vue` and verified the PR initiate page now references the utility directly.
  - Verified hero Sass files already use `color.adjust(...)` and kept that migration intact.
  - Reorganized the planned composables into purpose-based directories under `layout/`, `core/`, `resources/`, `operations/`, `masters/products/`, `reports/`, and `upload/`.
  - Updated affected frontend import paths to match the new composable layout.
  - Extracted feature-local Purchase Requisition helpers for metadata, SKU-option shaping, and payload construction while keeping the main PR flow composables separate.
  - Updated `FRONTENT/src/composables/REGISTRY.md` to match current paths and actual public returns.
- Validation performed:
  - Direct file error checks for the new PR helpers and updated PR flow composables.
  - Frontend production build after the reorg/import updates.

---

## Guide-Agent Explanation: Purpose of the requested files

### `_resolveTieredComponent.js`
- Utility resolver used by section/action resolution flow.
- Purpose: choose the best component implementation from override tiers (tenant custom -> entity custom -> default).
- Keeps dynamic import + fallback logic centralized so `useSectionResolver` / `useActionResolver` stay cleaner.

### `FRONTENT/src/stores/clientCache` (Pinia store)
- Cache boundary for client-side data already fetched/normalized for UI reuse.
- Purpose: reduce duplicate network work, share reactive cached slices across pages, and provide cache-friendly UX.
- Works alongside IndexedDB layer but typically represents in-memory app state contract.

### `FRONTENT/src/stores/sync.js`
- Sync orchestration facade store.
- From your attached file:
  - wraps `queueMasterResourceSync`, `flushMasterSyncQueue`, `syncAllMasterResources`
  - normalizes responses into a consistent `{ success, data, error, message }` shape
- Purpose: expose simple app-level sync actions for UI/composables without coupling to service internals.

### `FRONTENT/src/stores/workflow` (Pinia store)
- Workflow boundary for higher-level business operations (often multi-step/batch/composite actions).
- Purpose: centralize orchestration and transactional request sequencing (e.g., parent-child save flows), so pages/composables don’t directly script low-level API choreography repeatedly.

### `FRONTENT/src/services/IndexedDBCacheService`
- Persistence service for offline/cache-first local database operations (IndexedDB).
- Purpose: durable client cache for resource records/meta, fast first paint, and background sync patterns.
- Usually acts below stores/composables; stores consume this service rather than implementing IDB details directly.
