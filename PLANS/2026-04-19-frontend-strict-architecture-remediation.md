# PLAN: Frontend Strict Architecture Remediation
**Status**: COMPLETED
**Created**: 2026-04-19
**Created By**: Brain Agent (GitHub Copilot)
**Executed By**: Build Agent (GitHub Copilot)

## Objective
Bring `FRONTENT/src/*` into strict compliance with `Documents/ARCHITECTURE RULES.md` by removing layer violations, standardizing service contracts/logging, enforcing navigation rules, and splitting oversized files while preserving existing sync/data flow behavior.

## Context
`REVIEW REPORT.md` identified critical violations:
- direct service/IDB access from pages and composables,
- direct store access from pages/layouts,
- direct `router.push`/`$router.back` usage,
- non-uniform service response contracts and uncontrolled logging,
- missing style contract (`custom.scss`),
- multiple files over the 400-line threshold.

The highest-risk functional chain to preserve is:
`useResourceData` -> `useDataStore` -> `ResourceRecordsService`/`ResourceFetchService` -> `IndexedDbService`.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Establish boundary-safe facades and migration contracts
- [x] Define page-facing composables for action execution, auth screens, and PR workflows so pages stop importing stores/services directly.
- [x] Define composable-facing service wrappers for stock movements, bulk upload, and report execution.
- [x] Keep existing sync queue and IDB hydration flow untouched while adding adapters.
**Files**: `FRONTENT/src/composables/REGISTRY.md`, `FRONTENT/src/composables/useMasterActions.js`, `FRONTENT/src/composables/useOperationActions.js`, `FRONTENT/src/composables/useLoginPage.js`, `FRONTENT/src/composables/useProfilePage.js`
**Pattern**: Existing thin-page + composable orchestration pattern (`useResourceConfig`, `useResourceData`, `useResourceNav`)
**Rule**: Components/pages use composables only

### Step 2: Remove direct service usage from pages
- [x] Refactor action pages to call action composables instead of `executeGasApi` directly.
- [x] Refactor PR initiate and draft pages to use PR domain composables and wrapper methods for persistence.
- [x] Ensure payload composition and notifications still match current behavior.
**Files**: `FRONTENT/src/pages/Masters/_common/ActionPage.vue`, `FRONTENT/src/pages/Operations/_common/ActionPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
**Pattern**: Move IO calls behind composable APIs returning standardized result objects
**Rule**: No API/IDB operations in components/pages

### Step 3: Remove direct store usage from pages/layouts
- [x] Replace `useAuthStore` and `useDataStore` usage in pages/layouts with dedicated composables.
- [x] Consolidate shared parent/child loading behavior into reusable composables.
- [x] Keep navigation behavior and rendered UI unchanged.
**Files**: `FRONTENT/src/pages/AuthPage/LoginPage.vue`, `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`, `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`, `FRONTENT/src/layouts/MainLayout/MainLayout.vue`, `FRONTENT/src/pages/Masters/_common/ViewPage.vue`, `FRONTENT/src/pages/Masters/_common/EditPage.vue`, `FRONTENT/src/pages/Masters/Products/ViewPage.vue`, `FRONTENT/src/pages/Operations/_common/ViewPage.vue`, `FRONTENT/src/pages/Operations/_common/EditPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
**Pattern**: Page shell + domain composable view-model pattern
**Rule**: Components must not use stores directly

### Step 4: Enforce navigation contract
- [x] Replace direct `router.push('/dashboard')` and `$router.back()` with standardized helper navigation calls.
- [x] Keep all resource navigation through `useResourceNav`.
- [x] Introduce a small app-level nav helper for non-resource routes (e.g. auth/profile) if needed.
**Files**: `FRONTENT/src/pages/AuthPage/LoginPage.vue`, `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`, `FRONTENT/src/composables/useResourceNav.js`, `FRONTENT/src/composables/useAppNav.js`
**Pattern**: `nav.goTo(...)` route intent APIs
**Rule**: No direct `router.push()` usage in pages

### Step 5: Standardize service logging and response shape
- [x] Make service logging fully env-controlled through a single policy in `_logger.js`.
- [x] Remove raw `console.*` usage from service internals and route through logger.
- [x] Normalize all service public APIs to `{ success, data, error }`, including legacy adapters.
**Files**: `FRONTENT/src/services/_logger.js`, `FRONTENT/src/services/IndexedDbService.js`, `FRONTENT/src/services/ResourceRecordsService.js`, `FRONTENT/src/services/IndexedDbCacheService.js`
**Pattern**: `standardizeResponse(success, data, error)`
**Rule**: Logging/env and response contract are mandatory for services

### Step 6: Split oversized files and apply styling architecture contract
- [x] Decompose oversized pages/services into focused composables/components/partials under 400 lines.
- [x] Split `hero.scss` into partials and move reusable shared styles to `custom.scss`.
- [x] Import `custom.scss` in `app.scss`.
**Files**: `FRONTENT/src/css/hero.scss`, `FRONTENT/src/services/ResourceFetchService.js`, `FRONTENT/src/pages/Masters/Products/AddPage.vue`, `FRONTENT/src/pages/Masters/Products/EditPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`, `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`, `FRONTENT/src/css/custom.scss`, `FRONTENT/src/css/app.scss`
**Pattern**: thin page shell + shared style entrypoint
**Rule**: file size rule and styling rule compliance

## Documentation Updates Required
- [x] Update `FRONTENT/src/composables/REGISTRY.md` with newly introduced composables and moved responsibilities.
- [x] Update `FRONTENT/src/components/REGISTRY.md` if new reusable page-section components are created.
- [x] Update `Documents/CONTEXT_HANDOFF.md` if the layer contracts or sync safety constraints materially change.

## Acceptance Criteria
- [x] No page/layout in the review list imports from `src/stores/*` or `src/services/*`.
- [x] No composable in the review list directly imports raw service/IDB methods outside approved boundary wrappers.
- [x] Navigation violations are removed (`router.push` and `$router.back` removed from pages).
- [x] Service methods used by frontend flows return standardized `{ success, data, error }`.
- [x] Logging in services is controllable by env without code changes.
- [x] All flagged oversized files are reduced below 400 lines.
- [x] `src/css/custom.scss` exists and is imported by `src/css/app.scss`.
- [x] Sync/data flow behavior remains intact (cache-first load, background sync, IDB hydration).

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
- [x] Non-resource navigation standardized via `useAppNav`; resource routes remain in `useResourceNav`.
- [x] Legacy response adapters normalized to `{ success, data, error }` contract.
- [x] No execution blockers remained at completion.

### Files Actually Changed
- `FRONTENT/src/composables/REGISTRY.md`
- `FRONTENT/src/components/REGISTRY.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/composables/useAppNav.js`
- `FRONTENT/src/composables/useLoginPage.js`
- `FRONTENT/src/composables/useProfilePage.js`
- `FRONTENT/src/composables/useDashboardWidgets.js`
- `FRONTENT/src/composables/useMainLayoutNavTree.js`
- `FRONTENT/src/composables/useMasterActions.js`
- `FRONTENT/src/composables/useOperationActions.js`
- `FRONTENT/src/composables/useResourceRelationsData.js`
- `FRONTENT/src/composables/usePurchaseRequisitionIndex.js`
- `FRONTENT/src/composables/usePurchaseRequisitionCreateFlow.js`
- `FRONTENT/src/composables/usePurchaseRequisitionDraftFlow.js`
- `FRONTENT/src/composables/usePurchaseRequisitionReviewFlow.js`
- `FRONTENT/src/composables/useProductCreateForm.js`
- `FRONTENT/src/composables/useProductEditForm.js`
- `FRONTENT/src/stores/clientCache.js`
- `FRONTENT/src/stores/workflow.js`
- `FRONTENT/src/stores/sync.js`
- `FRONTENT/src/services/_logger.js`
- `FRONTENT/src/services/IndexedDbService.js`
- `FRONTENT/src/services/ResourceFetchService.js`
- `FRONTENT/src/services/ResourceCrudService.js`
- `FRONTENT/src/css/custom.scss`
- `FRONTENT/src/css/app.scss`
- `FRONTENT/src/css/hero.scss`
- `FRONTENT/src/css/hero/_tokens.scss`
- `FRONTENT/src/css/hero/_hero-card.scss`
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `FRONTENT/src/pages/AuthPage/LoginPage.vue`
- `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`
- `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`
- `FRONTENT/src/pages/Masters/_common/ActionPage.vue`
- `FRONTENT/src/pages/Masters/_common/ViewPage.vue`
- `FRONTENT/src/pages/Masters/_common/EditPage.vue`
- `FRONTENT/src/pages/Masters/Products/ViewPage.vue`
- `FRONTENT/src/pages/Masters/Products/AddPage.vue`
- `FRONTENT/src/pages/Masters/Products/EditPage.vue`
- `FRONTENT/src/pages/Operations/_common/ActionPage.vue`
- `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
- `FRONTENT/src/pages/Operations/_common/EditPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/IndexPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
- `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewHero.vue`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewItemsCard.vue`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewActionBar.vue`
- `FRONTENT/src/components/Operations/PurchaseRequisitions/PurchaseRequisitionAddItemDialog.vue`

### Validation Performed
- [x] Unit/manual validation completed
- [x] Acceptance criteria verified
- Validation evidence:
  - `grep` checks in `FRONTENT/src/pages/**/*.vue` found no `from 'src/stores/` imports.
  - `grep` checks in `FRONTENT/src/pages/**/*.vue` found no `from 'src/services/` imports.
  - `grep` checks in `FRONTENT/src/pages/**/*.vue` found no `router.push(...)` or `$router.back(...)` usage.
  - Line-count sweep across `FRONTENT/src` reported `OVER_400 0`.
  - `npm run build` (Quasar PWA build) succeeded; only Sass `lighten()` deprecation warnings remained.

### Manual Actions Required
- [x] None.

