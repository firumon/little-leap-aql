# PLAN: Operations Route & Navigation Refactor
**Status**: COMPLETED
**Created**: 2026-04-15
**Created By**: Brain Agent (Claude Sonnet 4.6)
**Executed By**: Build Agent (Gemini)

## Objective
1. Introduce unambiguous prefixed route paths for both Masters and Operations scopes.
2. Add `:pageSlug` (resource-level) and `:code/:pageSlug` (record-level) routes to support custom pages without special-casing.
3. Create `useResourceNav()` composable with `goTo(target, params?)` API — resolves scope, resourceSlug, and code internally from route/config.
4. Replace all hardcoded `router.push` string calls with `nav.goTo(...)` across Masters and Operations pages.
5. Extend `ActionResolverPage` (both scopes) to handle `resource-page` and `record-page` meta action types.
6. Migrate existing Procurement pages to their new resolved paths; drop `PRViewPage.vue`.

## Context
- Current routes use ambiguous paths: bare `add`, `:code`, `:code/edit`, `:code/:action` — these can collide with custom page slugs.
- Procurement special routes (`direct-entry`, `initiate-purchase-requisitions`, `:code/draft`, `:code/view`) are hardcoded at top of `routes.js`. These will be removed and resolved generically via the new route patterns.
- `ActionResolverPage` currently handles: `index`, `add`, `view`, `edit`, and fallthrough `action`. It does not handle `resource-page` or `record-page` meta types.
- `router.push` call sites: ~14 in `pages/Masters/_common/`, ~14 in `pages/Operations/_common/`, ~7 in `pages/Procurement/`.
- `useResourceConfig()` provides `scope`, `resourceSlug`, `code`. `useRoute()` provides current `code` param. Both available inside composables.
- Named routes exist for masters (`resource-list`, `resource-add`, `resource-view`, `resource-edit`, `resource-action`) and operations (`operations-list`, `operations-add`, `operations-view`, `operations-edit`, `operations-action`).

## Pre-Conditions
- [x] Operations `_common` pages exist under `pages/Operations/_common/`.
- [x] Operations `ActionResolverPage.vue` exists.
- [x] Masters scope pages are stable.
- [x] No other open plan touches `routes.js` or `ActionResolverPage`.

---

## Steps

### Step 1: Update `routes.js` — prefixed paths + new route patterns

#### 1a. Masters route children (`/masters/:resourceSlug`)
Replace the five existing children with seven:

| Path | Name | Meta |
|---|---|---|
| `` | `resource-list` | `{ action: 'index', level: 'resource' }` |
| `_add` | `resource-add` | `{ action: 'add', level: 'resource' }` |
| `:pageSlug` | `resource-resource-page` | `{ action: 'resource-page', level: 'resource' }` |
| `:code/_view` | `resource-view` | `{ action: 'view', level: 'record' }` |
| `:code/_edit` | `resource-edit` | `{ action: 'edit', level: 'record' }` |
| `:code/_action/:action` | `resource-action` | `{ action: 'action', level: 'record' }` |
| `:code/:pageSlug` | `resource-record-page` | `{ action: 'record-page', level: 'record' }` |

**Static routes (`_view`, `_edit`) must be declared before `:code/:pageSlug` in children array** so Vue Router matches them first.

#### 1b. Operations route children (`/operations/:resourceSlug`)
Same seven pattern — identical to Masters but with `operations-*` named routes:

| Path | Name | Meta |
|---|---|---|
| `` | `operations-list` | `{ action: 'index', level: 'resource' }` |
| `_add` | `operations-add` | `{ action: 'add', level: 'resource' }` |
| `:pageSlug` | `operations-resource-page` | `{ action: 'resource-page', level: 'resource' }` |
| `:code/_view` | `operations-view` | `{ action: 'view', level: 'record' }` |
| `:code/_edit` | `operations-edit` | `{ action: 'edit', level: 'record' }` |
| `:code/_action/:action` | `operations-action` | `{ action: 'action', level: 'record' }` |
| `:code/:pageSlug` | `operations-record-page` | `{ action: 'record-page', level: 'record' }` |

#### 1c. Remove all four Procurement special-case routes
These are now resolved generically:
- `/operations/stock-movements/direct-entry` → `:pageSlug` = `direct-entry`
- `/operations/purchase-requisitions/initiate-purchase-requisitions` → `:pageSlug` = `initiate-purchase-requisitions`
- `/operations/purchase-requisitions/:code/draft` → `:code/:pageSlug` = `draft`
- `/operations/purchase-requisitions/:code/view` → `:code/_view`

Also remove `requiresAuth: true` from all Operations child route `meta` objects — inherited from parent `/dashboard`.

**Files**: `FRONTENT/src/router/routes.js`
**Rule**: `_view` and `_edit` children must appear before `:code/:pageSlug` in the array.

---

### Step 2: Create `useResourceNav` composable

- [x] Create `FRONTENT/src/composables/useResourceNav.js`.
- [x] Internally call `useResourceConfig()` for `scope`, `resourceSlug`, `code` and `useRouter()`.
- [x] Export a single `goTo(target, params?)` function. `params` is optional and overrides route-resolved values.
- [x] Supported targets and their named route mappings:

| Target | Named route (masters) | Named route (operations) | Params used |
|---|---|---|---|
| `'list'` | `resource-list` | `operations-list` | `scope`, `resourceSlug` |
| `'add'` | `resource-add` | `operations-add` | `scope`, `resourceSlug` |
| `'view'` | `resource-view` | `operations-view` | `scope`, `resourceSlug`, `code` |
| `'edit'` | `resource-edit` | `operations-edit` | `scope`, `resourceSlug`, `code` |
| `'action'` | `resource-action` | `operations-action` | `scope`, `resourceSlug`, `code`, `action` |
| `'resource-page'` | `resource-resource-page` | `operations-resource-page` | `scope`, `resourceSlug`, `pageSlug` |
| `'record-page'` | `resource-record-page` | `operations-record-page` | `scope`, `resourceSlug`, `code`, `pageSlug` |

- [x] Scope routing: if `scope.value === 'operations'` use `operations-*` named routes, otherwise `resource-*`.
- [x] `params` arg always overrides resolved values — e.g. `goTo('view', { code: newCode })` after save.
- [x] `goTo('action', { action: 'approve' })` uses route-resolved `code`.

**Files**: `FRONTENT/src/composables/useResourceNav.js`
**Rule**: `code`, `scope`, `resourceSlug` are always resolved from `useResourceConfig()` first. `params` is shallow-merged on top. Never require callers to pass `scope` or `resourceSlug`.

---

### Step 3: Replace all `router.push` call sites — Masters `_common` pages

For each file, remove `useRouter` import (replaced by `useResourceNav`), add `useResourceNav` import, replace all `router.push(...)` calls with `nav.goTo(...)`.

#### `pages/Masters/_common/IndexPage.vue`
- [x] `navigateToView(row)` — remove hardcoded PR-specific draft/view logic. Replace with `nav.goTo('view', { code: row.Code })`. (PR-specific navigation is now handled by the `_common/ActionPage` action system or entity-custom override — not the generic IndexPage.)
- [x] `navigateToAdd()` → `nav.goTo('add')`

#### `pages/Masters/_common/AddPage.vue`
- [x] After save success with `newCode` → `nav.goTo('view', { code: newCode })`
- [x] After save success without code → `nav.goTo('list')`
- [x] `navigateBack()` → `nav.goTo('list')`

#### `pages/Masters/_common/EditPage.vue`
- [x] After save → `nav.goTo('view')`
- [x] `navigateBack()` → `nav.goTo('view')`
- [x] `navigateToList()` → `nav.goTo('list')`

#### `pages/Masters/_common/ViewPage.vue`
- [x] `navigateToList()` → `nav.goTo('list')`
- [x] `navigateToEdit()` → `nav.goTo('edit')`
- [x] `navigateToAction(action)` → `nav.goTo('action', { action: action.action.toLowerCase() })`

#### `pages/Masters/_common/ActionPage.vue`
- [x] After submit success → `nav.goTo('view')`
- [x] `navigateToView()` → `nav.goTo('view')`
- [x] `navigateToList()` → `nav.goTo('list')`

**Files**: 5 files under `FRONTENT/src/pages/Masters/_common/`

---

### Step 4: Replace all `router.push` call sites — Operations `_common` pages

Same substitutions as Step 3, applied to Operations pages.

#### `pages/Operations/_common/IndexPage.vue`
- [x] `navigateToView(row)` → `nav.goTo('view', { code: row.Code })`
- [x] `navigateToAdd()` → `nav.goTo('add')`

#### `pages/Operations/_common/AddPage.vue`
- [x] After save with `newCode` → `nav.goTo('view', { code: newCode })`
- [x] After save without code → `nav.goTo('list')`
- [x] `navigateBack()` → `nav.goTo('list')`

#### `pages/Operations/_common/EditPage.vue`
- [x] After save → `nav.goTo('view')`
- [x] `navigateBack()` → `nav.goTo('view')`
- [x] `navigateToList()` → `nav.goTo('list')`

#### `pages/Operations/_common/ViewPage.vue`
- [x] `navigateToList()` → `nav.goTo('list')`
- [x] `navigateToEdit()` → `nav.goTo('edit')`
- [x] `navigateToAction(action)` → `nav.goTo('action', { action: action.action })`
- [x] `navigateToChildView(childResource, childRecordCode)` — this navigates to a **different** resource's view. Cannot use `nav.goTo` (wrong scope/slug). Keep as a direct named route call: `router.push({ name: childResource.scope === 'operations' ? 'operations-view' : 'resource-view', params: { resourceSlug: childResource.slug, code: childRecordCode } })`.

#### `pages/Operations/_common/ActionPage.vue`
- [x] After submit → `nav.goTo('view')`
- [x] `navigateToView()` → `nav.goTo('view')`
- [x] `navigateToList()` → `nav.goTo('list')`

**Files**: 5 files under `FRONTENT/src/pages/Operations/_common/`

---

### Step 5: Extend `ActionResolverPage` — both scopes — for `resource-page` and `record-page`

Currently `resolveComponent` maps action names to `{Entity}/{ActionName}Page.vue`. Two new meta action types need different file name conventions.

- [x] In both `pages/Masters/ActionResolverPage.vue` and `pages/Operations/ActionResolverPage.vue`:
  - Read `route.meta.action` to detect `'resource-page'` or `'record-page'`.
  - Read `route.params.pageSlug` for the slug value.
  - **`resource-page`**: look for `{Entity}/{PascalCase(pageSlug)}Page.vue` (tier-2 entity-custom only — no `_common` fallback, no tenant-custom). If not found → render a `NotFoundPage` component (or inline not-found card).
  - **`record-page`**: look for `{Entity}/Record{PascalCase(pageSlug)}Page.vue` (tier-2 entity-custom only). If not found → render not-found card.
  - Tenant-custom (tier-1) still applies for both: `_custom/{CustomUIName}/{Entity}{PascalCase(pageSlug)}.vue` and `_custom/{CustomUIName}/{Entity}Record{PascalCase(pageSlug)}.vue`.

**Files**:
- `FRONTENT/src/pages/Masters/ActionResolverPage.vue`
- `FRONTENT/src/pages/Operations/ActionResolverPage.vue`

**Rule**: No `_common` fallback for custom pages — if the file doesn't exist, show not-found. Do not fall through to `ActionPage`.

---

### Step 6: Migrate Procurement pages to new resolved paths

#### `PRInitiationPage.vue` → `pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- [x] Move the file to the new path.
- [x] Update internal `router.push` calls using `nav.goTo`:
  - After save → `nav.goTo('record-page', { code: response.data.parentCode, pageSlug: 'draft' })`
- [x] Add `useResourceNav` import; remove hardcoded paths.

#### `PRDraftViewPage.vue` → `pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`
- [x] Move the file to the new path.
- [x] Update internal `router.push` calls:
  - Back to list → `nav.goTo('list')`
  - After submit → `nav.goTo('view')` (standard `_view`)
  - `/operations/prs` hardcoded path → replace with `nav.goTo('list')` (relies on `useResourceConfig` for slug)

#### `PRViewPage.vue`
- [x] Delete the file entirely. Standard `_common/ViewPage.vue` handles this route via `:code/_view`.

**Files**:
- Delete: `FRONTENT/src/pages/Procurement/PRViewPage.vue`
- Move+edit: `FRONTENT/src/pages/Procurement/PRInitiationPage.vue` → `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`
- Move+edit: `FRONTENT/src/pages/Procurement/PRDraftViewPage.vue` → `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue`

**Rule**: After moves, verify `pages/Procurement/` directory is empty and can be deleted if no other files remain.

---

### Step 7: Update `ResourcePageShell.vue` — Operations — `actionLabel` for new meta actions

The shell's `actionLabel` computed currently checks for `add`, `view`, `edit`. With new meta action values (`resource-page`, `record-page`, `action`):

- [x] In `pages/Operations/ResourcePageShell.vue`, update `actionLabel`:
  - `action === 'resource-page'` → humanize `route.params.pageSlug`
  - `action === 'record-page'` → humanize `route.params.pageSlug`
  - `action === 'action'` → look up label from `additionalActions` by `route.params.action`
- [x] Apply same fix to `pages/Masters/ResourcePageShell.vue` for consistency.

**Files**:
- `FRONTENT/src/pages/Operations/ResourcePageShell.vue`
- `FRONTENT/src/pages/Masters/ResourcePageShell.vue`

---

### Step 8: Update `FRONTENT/src/composables/REGISTRY.md`

- [x] Add entry for `useResourceNav`:
  - Description, signature, `goTo` target table, file path.

**Files**: `FRONTENT/src/composables/REGISTRY.md`

---

### Step 9: Update `Documents/MODULE_WORKFLOWS.md`

- [x] Update Section 2 route diagram to show new prefixed paths (`_add`, `:code/_view`, etc.) for Masters.
- [x] Update Section 3 (Operations) route diagram identically.
- [x] Add a note on `resource-page` and `record-page` meta action types and file naming conventions.
- [x] Add `useResourceNav` to the "Files Involved" table in both sections.

**Files**: `Documents/MODULE_WORKFLOWS.md`

---

## Acceptance Criteria
- [x] `/masters/products/_add` routes to AddPage; `/masters/products` routes to IndexPage.
- [x] `/masters/products/P001/_view` routes to ViewPage; `/masters/products/P001/_edit` to EditPage.
- [x] `/masters/products/P001/_action/deactivate` routes to ActionPage with `action = deactivate`.
- [x] `/operations/stock-movements/direct-entry` routes to `StockMovements/DirectEntryPage.vue` via `resource-page`.
- [x] `/operations/purchase-requisitions/initiate-purchase-requisitions` routes to `PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue`.
- [x] `/operations/purchase-requisitions/PR001/draft` routes to `PurchaseRequisitions/RecordDraftPage.vue`.
- [x] `/operations/purchase-requisitions/PR001/_view` routes to `_common/ViewPage.vue`.
- [x] `nav.goTo('view')` from any masters page navigates to `:code/_view` using route-resolved code.
- [x] `nav.goTo('view', { code: newCode })` navigates to `newCode/_view`.
- [x] `nav.goTo('action', { action: 'approve' })` navigates to `:code/_action/approve`.
- [x] No `router.push` string concatenation remains in any `_common` page.
- [x] Masters scope navigation is unbroken — existing test paths still resolve correctly.
- [x] Full frontend build passes (cross-cutting: router, composable, ~12 touched files).

## Documentation Updates Required
- [x] `FRONTENT/src/composables/REGISTRY.md` — add `useResourceNav`.
- [x] `Documents/MODULE_WORKFLOWS.md` — update route diagrams for both scopes; add custom page file naming conventions.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` before finishing.)*
*(Identity Discipline: Replace `[AgentName]` with concrete agent/runtime identity. Remove `| pending` when done.)*

### Progress Log
- [x] Step 1 — routes.js prefixed paths + new route patterns
- [x] Step 2 — useResourceNav composable
- [x] Step 3 — Masters _common router.push → nav.goTo
- [x] Step 4 — Operations _common router.push → nav.goTo
- [x] Step 5 — ActionResolverPage resource-page / record-page handling
- [x] Step 6 — Procurement file migrations + PRViewPage deletion
- [x] Step 7 — ResourcePageShell actionLabel fix (both scopes)
- [x] Step 8 — composables REGISTRY.md update
- [x] Step 9 — MODULE_WORKFLOWS.md update

### Deviations / Decisions
- [x] `[?]` Git 'mv' and 'rm' not supported by default_api, so deleted files were just cleared, and code was manually copied to newly created files for Procurement migrations. This was verified and implemented.

### Files Actually Changed
- FRONTENT/src/router/routes.js
- FRONTENT/src/composables/useResourceNav.js
- FRONTENT/src/pages/Masters/_common/IndexPage.vue
- FRONTENT/src/pages/Masters/_common/AddPage.vue
- FRONTENT/src/pages/Masters/_common/EditPage.vue
- FRONTENT/src/pages/Masters/_common/ViewPage.vue
- FRONTENT/src/pages/Masters/_common/ActionPage.vue
- FRONTENT/src/pages/Operations/_common/IndexPage.vue
- FRONTENT/src/pages/Operations/_common/AddPage.vue
- FRONTENT/src/pages/Operations/_common/EditPage.vue
- FRONTENT/src/pages/Operations/_common/ViewPage.vue
- FRONTENT/src/pages/Operations/_common/ActionPage.vue
- FRONTENT/src/pages/Masters/ActionResolverPage.vue
- FRONTENT/src/pages/Operations/ActionResolverPage.vue
- FRONTENT/src/pages/Procurement/PRInitiationPage.vue (Cleared)
- FRONTENT/src/pages/Procurement/PRDraftViewPage.vue (Cleared)
- FRONTENT/src/pages/Procurement/PRViewPage.vue (Cleared)
- FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue
- FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordDraftPage.vue
- FRONTENT/src/pages/Operations/ResourcePageShell.vue
- FRONTENT/src/pages/Masters/ResourcePageShell.vue
- FRONTENT/src/composables/REGISTRY.md
- Documents/MODULE_WORKFLOWS.md

### Validation Performed
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] None anticipated — no GAS changes, no sheet changes, no Web App redeployment.
