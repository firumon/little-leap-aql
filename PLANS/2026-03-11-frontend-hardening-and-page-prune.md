# PLAN: Frontend Hardening And Page Prune
**Status**: COMPLETED
**Created**: 2026-03-11
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Remove duplicate API toasts, protect loading flags, and simplify the frontend to only the currently approved production pages: `LoginPage.vue`, `ProfilePage.vue`, and `ProductsPage.vue`. Also formalize execution-plan status update rules so completion metadata is always maintained.

## Context
- User confirmed only these pages are needed now:
  - `FRONTENT/src/pages/AuthPage/LoginPage.vue`
  - `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`
  - `FRONTENT/src/pages/Masters/ProductsPage.vue`
- Other pages were test pages and must be removed.
- Review identified duplicate toast risk because `callGasApi` now emits centralized notifications while some pages still emit local error/success notifications for the same API result.
- Review also flagged loading-state hardening gaps where async flows are not protected with `try/finally`.
- Current Multi-Agent protocol requires checklist progress updates but does not explicitly require plan header status transition (`IN_PROGRESS`/`COMPLETED`) and `Executed By` finalization after execution.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Remove duplicate toast behavior while preserving UX clarity
- [x] Standardize notification ownership:
  - Keep API transport-level error notification in `callGasApi`.
  - Prevent duplicate page-level error toasts for the same API failure in active pages.
- [x] Refactor `LoginPage.vue`, `ProfilePage.vue`, and `ProductsPage.vue` so each API failure/success emits exactly one user-visible message.
- [x] Keep local validation toasts (form validation before API call) if needed; only remove duplicated server-response toasts.
**Files**: `FRONTENT/src/services/gasApi.js`, `FRONTENT/src/pages/AuthPage/LoginPage.vue`, `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`, `FRONTENT/src/pages/Masters/ProductsPage.vue`
**Pattern**: Centralized API lifecycle through `callGasApi` and component-level validation feedback.
**Rule**: No duplicate notifications for a single backend outcome.

### Step 2: Add loading-flag protection in active pages
- [x] Ensure async actions in active pages always reset loading flags via `try/finally` (or equivalent robust guard).
- [x] Verify all user-visible loaders in the 3 retained pages cannot remain stuck on unexpected runtime exceptions.
**Files**: `FRONTENT/src/pages/AuthPage/LoginPage.vue`, `FRONTENT/src/pages/ProfilePage/ProfilePage.vue`, `FRONTENT/src/pages/Masters/ProductsPage.vue`
**Pattern**: Existing `finally` usage in login and master save/reload flows.
**Rule**: Loading state must be fail-safe.

### Step 3: Delete all non-approved pages and rewire routes
- [x] Delete all page files except the three approved pages.
- [x] Update router definitions so no route imports deleted files.
- [x] Keep app navigable with only the approved pages:
  - Auth route to Login page.
  - Protected routes to Products and Profile.
  - Catch-all path should redirect to a valid retained route (do not import deleted `ErrorNotFound` page).
- [x] Remove obsolete route references and any stale imports/comments tied to deleted pages.
- [x] Refactor related navigation/guards/layout usage to remove dead branches and route metadata no longer used.
- [x] Remove now-unused files created only for deleted routes/pages (components/config/store helpers), and remove leftover unused imports to keep codebase clean.
**Files**: `FRONTENT/src/pages/**` (delete all except the 3 approved), `FRONTENT/src/router/routes.js`, `FRONTENT/src/router/index.js` (if needed), `FRONTENT/src/layouts/MainLayout/MainLayout.vue` (if needed for nav cleanup)
**Pattern**: Existing Quasar route/lazy-import pattern.
**Rule**: Project must compile with only approved production pages.

### Step 4: Codify execution completion metadata rule
- [x] Update collaboration protocol so execution includes mandatory plan header updates:
  - Set `**Status**` to `IN_PROGRESS` at start of execution.
  - Set `**Status**` to `COMPLETED` (or `BLOCKED`) at the end.
  - Set `**Executed By**` with actual executor identity when done.
- [x] Update plan template to include a brief “Status Update Discipline” note for executors.
**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`, `PLANS/_TEMPLATE.md`
**Pattern**: Existing phase/rule sections in Multi-Agent protocol.
**Rule**: Execution is not complete without final plan metadata state update.

### Step 5: Validate and synchronize documentation
- [x] Run frontend build and confirm no missing page imports or route targets.
- [x] Run a project-wide unused-reference check (`rg`) to confirm removed pages/routes leave no stale imports/usages.
- [x] Update docs to reflect retained page scope and removed test pages.
- [x] Update handoff with current “serious implementation starts now” baseline and retained-page set.
**Files**: `Documents/FRONTENT_README.md`, `Documents/CONTEXT_HANDOFF.md`, `Documents/README.md` (if page list/progress section references removed pages)
**Pattern**: Documentation discipline from collaboration protocol.
**Rule**: Code and docs must stay aligned after page-prune.

## Documentation Updates Required
- [x] Update `Documents/MULTI_AGENT_PROTOCOL.md` with explicit plan status transition responsibilities for Build Agent.
- [x] Update `PLANS/_TEMPLATE.md` to reinforce execution metadata update behavior.
- [x] Update `Documents/FRONTENT_README.md` to remove references to deleted test pages/routes.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with new active-page baseline.
- [x] Update `Documents/README.md` if route/page status summary now differs.

## Acceptance Criteria
- [x] No duplicate toasts occur for a single API response in Login, Profile, and Products flows.
- [x] Loading flags in retained pages always reset after failed/successful async flows.
- [x] Only `LoginPage.vue`, `ProfilePage.vue`, and `ProductsPage.vue` remain under `FRONTENT/src/pages`.
- [x] `npm run build` succeeds with current routing after page deletion.
- [x] No stale route imports/usages for deleted pages remain in frontend codebase.
- [x] Protocol and template clearly require final plan status (`COMPLETED/BLOCKED`) and `Executed By` update.
- [x] Handoff/docs reflect new active-page scope.

## Post-Execution Notes (Build Agent fills this)
### Progress Log
- [x] Step 1 completed: Updated auth.js to pass successMessage and showLoading via `callAuthApi` config to allow gasApi intercept. Dropped ad-hoc notification handlers in LoginPage, ProfilePage, and ProductsPage.
- [x] Step 2 completed: Encased updating actions in ProfilePage within try/finally to secure loaders, allowing gasApi error handling scope precedence.
- [x] Step 3 completed: Erased `LandingPage`, `DashboardIndex`, `MasterEntityPage`, `ShipmentsPage`, `GoodsReceiptsPage`, `ErrorNotFound` entirely and wired router mapping `/dashboard` and `/` defaults correctly over retained paths.
- [x] Step 4 completed: Overhauled `MULTI_AGENT_PROTOCOL.md` and `PLANS/_TEMPLATE.md`.
- [x] Step 5 completed: Verified frontend UI using `-m pwa` build context test. Rehashed `FRONTENT_README` and `CONTEXT_HANDOFF`.

### Deviations / Decisions
- [x] `[?]` Decision needed: Redirected NotFound routing straight to `/dashboard` instead of deleting routing wildcard entirely to prevent hanging UX anomalies in Quasar.
- [x] `[!]` Issue/blocker: None

### Files Actually Changed
- `f:\LITTLE LEAP\AQL\FRONTENT\src\stores\auth.js`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\AuthPage\LoginPage.vue`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\ProfilePage\ProfilePage.vue`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\Masters\ProductsPage.vue`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\router\routes.js`
- `f:\LITTLE LEAP\AQL\Documents\MULTI_AGENT_PROTOCOL.md`
- `f:\LITTLE LEAP\AQL\PLANS\_TEMPLATE.md`
- `f:\LITTLE LEAP\AQL\Documents\CONTEXT_HANDOFF.md`
- `f:\LITTLE LEAP\AQL\Documents\FRONTENT_README.md`
- Deleted extraneous `.vue` files.

### Validation Performed
- [x] Unit/manual validation completed: `npm run build` returns exit level `0`.
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] Wait for browser Hot Module Reload or restart Node server manually to refresh route dependencies.
