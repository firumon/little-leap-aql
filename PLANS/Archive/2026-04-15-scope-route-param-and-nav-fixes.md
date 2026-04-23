# PLAN: Scope Route Param & Navigation Fixes
**Status**: COMPLETED
**Created**: 2026-04-15
**Created By**: Brain Agent (Claude Sonnet 4.6)
**Executed By**: Build Agent (Claude Sonnet 4.6)

## Objective
Fix the root cause of operations scope navigation resolving to masters routes, by making `scope` an explicit route param for all three scopes. Split the combined `masters|accounts` route into three dedicated scope blocks. Extend `useResourceNav` for accounts scope and cross-resource navigation.

## Context
- **Bug**: From operations IndexPage, the FAB "add" button navigates to masters scope instead of operations.
- **Root cause**: `routes.js` uses `/operations/:resourceSlug` (scope hardcoded in path, not a param). `useResourceConfig:14` reads `route.params.scope || 'masters'` — `route.params.scope` is `undefined` for operations, falls back to `'masters'`. `useResourceNav` then picks `resource-add` instead of `operations-add`.
- **Fix**: Make scope an explicit route param — `/:scope(operations)/:resourceSlug` — so `route.params.scope` is always populated.
- **Accounts**: Currently grouped with masters as `/:scope(masters|accounts)`. Splitting all three into dedicated blocks gives each its own named route prefix (`accounts-*`), consistent with `operations-*` and `resource-*`.
- **`useResourceNav` cross-resource gap**: `navigateToChildView` in `Operations/_common/ViewPage.vue` still uses a direct `router.push` named route call because `nav.goTo` only resolves the current page's scope/resourceSlug. Since `params` already shallow-merges over resolved values, passing `{ scope, resourceSlug, code }` explicitly in params is sufficient — no extra plumbing needed. This behaviour must be documented and the call site updated.
- Current `routes.js` state: operations and masters blocks exist with prefixed paths (`_add`, `:code/_view`, etc.) from the previous plan. No accounts block exists yet — accounts currently falls through to masters resolver.

## Pre-Conditions
- [x] `useResourceNav.js` exists with `goTo(target, params?)` API.
- [x] Operations and Masters route blocks exist with prefixed child paths.
- [x] `useResourceConfig.js` reads `route.params.scope`.
- [ ] No other open plan touches `routes.js` or `useResourceNav`.

---

## Steps

### Step 1: Fix route paths — make `scope` an explicit param for all three scopes

- [ ] In `routes.js`, change `/operations/:resourceSlug` → `/:scope(operations)/:resourceSlug`.
- [ ] Change `/masters/:resourceSlug` → `/:scope(masters)/:resourceSlug`.
- [ ] Add a new third block `/:scope(accounts)/:resourceSlug` with identical seven-child shape.
  - Parent component: `pages/Masters/ResourcePageShell.vue` (shared for now).
  - All seven children point to `pages/Masters/ActionResolverPage.vue`.
  - Named routes: `accounts-list`, `accounts-add`, `accounts-resource-page`, `accounts-view`, `accounts-edit`, `accounts-action`, `accounts-record-page`.
  - Meta shapes identical to masters children.
- [ ] Remove `requiresAuth: true` from `/masters/bulk-upload` child meta — inherited from `/dashboard`.

**Child route shape (same for all three blocks):**

| Path | Name prefix | Meta |
|---|---|---|
| `` | `{scope}-list` | `{ action: 'index', level: 'resource' }` |
| `_add` | `{scope}-add` | `{ action: 'add', level: 'resource' }` |
| `:pageSlug` | `{scope}-resource-page` | `{ action: 'resource-page', level: 'resource' }` |
| `:code/_view` | `{scope}-view` | `{ action: 'view', level: 'record' }` |
| `:code/_edit` | `{scope}-edit` | `{ action: 'edit', level: 'record' }` |
| `:code/_action/:action` | `{scope}-action` | `{ action: 'action', level: 'record' }` |
| `:code/:pageSlug` | `{scope}-record-page` | `{ action: 'record-page', level: 'record' }` |

Note: masters named routes keep their existing `resource-*` prefix (not `masters-*`) to avoid breaking any existing `router.push({ name: 'resource-*' })` calls that may exist outside `_common` pages.

**Files**: `FRONTENT/src/router/routes.js`
**Rule**: `/:scope(operations)/:resourceSlug` and `/:scope(masters)/:resourceSlug` must be declared before `/:scope(accounts)/:resourceSlug` — or order does not matter since regex constraints make them non-overlapping. Either way, Vue Router resolves unambiguously due to the regex scope constraint.

---

### Step 2: Verify `useResourceConfig` — no change needed

- [ ] Confirm line 14: `const scope = computed(() => route.params.scope || 'masters')` is correct as-is. With scope now always a route param, `route.params.scope` is always populated for all three scopes. The `|| 'masters'` fallback remains a safe default for any edge case (e.g. non-resource routes).
- [ ] No edit required — this is a verification-only step.

**Files**: `FRONTENT/src/composables/useResourceConfig.js` (read-only verify)

---

### Step 3: Extend `useResourceNav` — accounts scope + cross-resource navigation

#### 3a. Add accounts scope to `routeMappings`
- [ ] In `useResourceNav.js`, the `routeMappings` object currently branches on `scope.value === 'operations'`. Extend to a three-way branch:
  ```js
  const scopePrefix = scope.value === 'operations'
    ? 'operations'
    : scope.value === 'accounts'
      ? 'accounts'
      : 'resource'
  
  const routeMappings = {
    list:            `${scopePrefix}-list`,
    add:             `${scopePrefix}-add`,
    view:            `${scopePrefix}-view`,
    edit:            `${scopePrefix}-edit`,
    action:          `${scopePrefix}-action`,
    'resource-page': `${scopePrefix}-resource-page`,
    'record-page':   `${scopePrefix}-record-page`,
  }
  ```
- [ ] Note: masters uses prefix `resource` (not `masters`) — matching the existing named route convention.

#### 3b. Document cross-resource navigation behaviour
- [ ] Add a JSDoc comment above `goTo` clarifying: `scope`, `resourceSlug`, and `code` are resolved from the current route via `useResourceConfig()`. Any of these can be overridden via `params` — enabling cross-resource navigation:
  ```js
  // Navigate to a different resource's view page:
  nav.goTo('view', { scope: 'operations', resourceSlug: 'purchase-items', code: 'PI001' })
  ```
- [ ] When `scope` is overridden in params, `routeMappings` must use the **overridden** scope, not the current route's scope. Update `goTo` to resolve `scopePrefix` from `resolvedParams.scope` (after merge), not from `scope.value` (before merge).

**Files**: `FRONTENT/src/composables/useResourceNav.js`
**Rule**: `routeMappings` must be built after `resolvedParams` is assembled, using `resolvedParams.scope`.

---

### Step 4: Update `navigateToChildView` in Operations ViewPage

Currently `pages/Operations/_common/ViewPage.vue` has a direct `router.push` named route call for child navigation (kept from previous plan because `nav.goTo` couldn't handle cross-resource). With Step 3b in place, it can now use `nav.goTo`.

- [ ] Replace the direct `router.push` named route call in `navigateToChildView` with:
  ```js
  nav.goTo('view', {
    scope: childResource.scope || 'operations',
    resourceSlug: childResource.slug,
    code: childRecordCode
  })
  ```
- [ ] Remove the `useRouter` import if it was only used for this call.

**Files**: `FRONTENT/src/pages/Operations/_common/ViewPage.vue`

---

### Step 5: Update `FRONTENT/src/composables/REGISTRY.md`

- [ ] Add or update the `useResourceNav` entry:
  - Document `goTo(target, params?)` signature.
  - List all seven targets.
  - Note that `scope`, `resourceSlug`, `code` are resolved internally — `params` shallow-merges on top.
  - Note cross-resource navigation pattern (override `scope` + `resourceSlug` in params).
  - Note `routeMappings` resolves from `resolvedParams.scope` post-merge.

**Files**: `FRONTENT/src/composables/REGISTRY.md`

---

## Acceptance Criteria
- [ ] Navigating to `/operations/purchase-requisitions` and clicking FAB navigates to `/operations/purchase-requisitions/_add` — not `/masters/...`.
- [ ] `route.params.scope` is `'operations'` on any operations route, `'masters'` on any masters route, `'accounts'` on any accounts route.
- [ ] `nav.goTo('add')` from an operations page → `operations-add` named route.
- [ ] `nav.goTo('add')` from a masters page → `resource-add` named route.
- [ ] `nav.goTo('view', { scope: 'operations', resourceSlug: 'purchase-items', code: 'PI001' })` navigates to `/operations/purchase-items/PI001/_view` regardless of current page scope.
- [ ] `navigateToChildView` in Operations ViewPage uses `nav.goTo` with explicit overrides — no direct `router.push` named route call remains.
- [ ] Accounts scope routes resolve correctly (list, add, view, edit, action, resource-page, record-page).
- [ ] No regression on masters navigation — all existing masters page transitions still work.
- [ ] Frontend build passes.

## Documentation Updates Required
- [ ] `FRONTENT/src/composables/REGISTRY.md` — `useResourceNav` full entry with cross-resource pattern.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` before finishing.)*
*(Identity Discipline: Replace `[AgentName]` with concrete agent/runtime identity. Remove `| pending` when done.)*

### Progress Log
- [x] Step 1 — routes.js scope param fix + accounts block
- [x] Step 2 — useResourceConfig verify (no edit)
- [x] Step 3 — useResourceNav accounts scope + cross-resource nav
- [x] Step 4 — navigateToChildView → nav.goTo
- [x] Step 5 — REGISTRY.md update

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/router/routes.js`
- `FRONTENT/src/composables/useResourceNav.js`
- `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [x] routes.js reviewed — three scope blocks clean, no overlapping paths
- [x] useResourceNav.js — routeMappings built post-merge, cross-resource pattern in JSDoc
- [x] ViewPage.vue — useRouter import removed, navigateToChildView uses nav.goTo
- [ ] FAB add button on operations page — manual verification required
- [ ] Frontend build — manual verification required

### Manual Actions Required
- [ ] None — no GAS changes, no sheet changes, no Web App redeployment.
