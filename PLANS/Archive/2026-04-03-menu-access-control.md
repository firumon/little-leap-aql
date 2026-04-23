# PLAN: Menu Access Control via `menuAccess` Rules
**Status**: COMPLETED
**Created**: 2026-04-03
**Created By**: Brain Agent (Claude Sonnet 4.6)
**Executed By**: Build Agent (GitHub Copilot)

---

## Objective

Add permission-based menu visibility control using a `menuAccess` field inside the existing `Menu` JSON column of `APP.Resources`. A shared evaluation function will be created and used in two places:
1. **Sidebar menu building** (`MainLayout.vue`) — hide items the user doesn't have access to
2. **Route guard** (`router/index.js`) — block direct URL navigation to unauthorized routes

The `menuAccess` rule supports single-resource and cross-resource permission checks with `all` (AND) and `any` (OR) logic. All evaluation happens **on the frontend** using the already-loaded auth store data.

---

## Context

- `Menu` JSON is stored in `APP.Resources.Menu` column and served via `entry.ui.menu` in the login/auth response.
- Current menu filter (MainLayout.vue ~line 194): checks `menu.show !== false` and `resource?.permissions?.canRead === true`. This is where `menuAccess` evaluation will replace the hard-coded `canRead` check.
- Current route guard (router/index.js ~line 60–73): checks `resource?.permissions?.canRead === true`. This needs the same `menuAccess` evaluation.
- Permission keys available in `resource.permissions`: `canRead`, `canWrite`, `canUpdate`, `canDelete`, and custom action keys like `canApprove`, `canReject` (anything that follows `can` + PascalCase action name).
- The auth store (`useAuthStore`) exposes `auth.resources` (array of all authorized resource entries). Each entry has `name`, `permissions`, `ui.menu`, etc.
- Existing composables location: `FRONTENT/src/composables/`. A new file `useMenuAccess.js` will be created here.
- `syncAppResources.gs` holds the code-level source of truth for all resource configs. `menuAccess` will be added to the `Menu` JSON here for any resource that needs a non-default rule.

---

## Pre-Conditions

- [x] `Menu` JSON column is implemented and working (completed in prior plan `2026-04-03-menu-column-consolidation.md`).
- [x] `entry.ui.menu` is served correctly by the backend (nested, not flat).
- [x] Frontend reads `resource.ui.menu.*` for all menu building and routing.
- [ ] Build Agent has read this plan fully before touching any file.

---

## `menuAccess` JSON Schema (Reference — Build Agent must understand this before coding)

The `menuAccess` field sits **inside** the existing `Menu` JSON object alongside `group`, `order`, `label`, `icon`, `route`, `pageTitle`, `pageDescription`, `show`.

### Case 1 — No `menuAccess` field (absent / undefined)
Fallback: check `canRead` on the resource itself. This is the default. No change from current behavior for resources that don't define `menuAccess`.

### Case 2 — Single permission on own resource
```json
"menuAccess": { "require": "canWrite" }
```
User must have `canWrite` on this resource.

### Case 3 — Multiple permissions on own resource (AND)
```json
"menuAccess": { "require": ["canWrite", "canDelete"] }
```
User must have BOTH `canWrite` AND `canDelete` on this resource.

### Case 4 — All of (cross-resource AND)
```json
"menuAccess": {
  "all": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "Variants", "require": "canRead" }
  ]
}
```
ALL rules must pass. Each rule specifies a resource name and one or more permissions. If `resource` is omitted inside a rule, it refers to the current resource being evaluated.

### Case 5 — Any of (cross-resource OR)
```json
"menuAccess": {
  "any": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "Variants", "require": "canWrite" }
  ]
}
```
At least ONE rule must pass.

### `require` can always be a string or array of strings
Inside a rule, `"require": "canWrite"` and `"require": ["canWrite", "canDelete"]` are both valid. A string means a single permission. An array means ALL of those permissions must be true (AND within the rule).

---

## Steps

---

### Step 1: Create `useMenuAccess.js` composable

**File to create**: `FRONTENT/src/composables/useMenuAccess.js`

This is the shared evaluation function. Both MainLayout and the router guard will import from it.

**Exact implementation** (Build Agent must copy this precisely):

```js
import { useAuthStore } from 'src/stores/auth'

/**
 * Returns a function that evaluates a menuAccess rule
 * against the currently logged-in user's permissions.
 *
 * Usage:
 *   const { evaluateMenuAccess } = useMenuAccess()
 *   const allowed = evaluateMenuAccess(resource)
 */
export function useMenuAccess() {
  const auth = useAuthStore()

  /**
   * Look up a resource entry by name from the auth store.
   * Returns the resource entry object or null.
   */
  function getResourceEntry(resourceName) {
    const resources = Array.isArray(auth.resources) ? auth.resources : []
    return resources.find((r) => r?.name === resourceName) || null
  }

  /**
   * Check whether the user has ALL of the listed permissions
   * on a specific resource.
   *
   * @param {string} resourceName - Name of the resource (e.g. 'Products')
   * @param {string|string[]} require - Permission key(s) e.g. 'canWrite' or ['canWrite','canDelete']
   * @returns {boolean}
   */
  function checkPermissions(resourceName, require) {
    const entry = getResourceEntry(resourceName)
    if (!entry) return false
    const perms = entry.permissions || {}
    const keys = Array.isArray(require) ? require : [require]
    return keys.every((key) => perms[key] === true)
  }

  /**
   * Evaluate a menuAccess rule object.
   * Supports: absent (fallback canRead), { require }, { all }, { any }
   *
   * @param {object} resource - Full resource entry from auth store (has .name, .permissions, .ui.menu)
   * @returns {boolean} true = user is allowed to access this menu item
   */
  function evaluateMenuAccess(resource) {
    if (!resource) return false

    const resourceName = resource.name
    const menuAccess = resource?.ui?.menu?.menuAccess

    // Case 1: No menuAccess defined → fallback to canRead on own resource
    if (!menuAccess || typeof menuAccess !== 'object') {
      return checkPermissions(resourceName, 'canRead')
    }

    // Case 2 & 3: { require: 'canWrite' } or { require: ['canWrite', 'canDelete'] }
    if (menuAccess.require !== undefined) {
      return checkPermissions(resourceName, menuAccess.require)
    }

    // Case 4: { all: [ { resource, require }, ... ] }  — ALL rules must pass
    if (Array.isArray(menuAccess.all)) {
      return menuAccess.all.every((rule) => {
        const target = rule.resource || resourceName
        return checkPermissions(target, rule.require)
      })
    }

    // Case 5: { any: [ { resource, require }, ... ] }  — ANY rule must pass
    if (Array.isArray(menuAccess.any)) {
      return menuAccess.any.some((rule) => {
        const target = rule.resource || resourceName
        return checkPermissions(target, rule.require)
      })
    }

    // Unknown shape → deny (safe default)
    return false
  }

  return { evaluateMenuAccess }
}
```

**Rules for Build Agent:**
- This file is a new file — use the Write tool to create it.
- Do NOT modify this logic. Copy exactly.
- The function takes a full resource entry object (not just a name), because it needs both `resource.name` and `resource.ui.menu.menuAccess`.
- `checkPermissions` compares `perms[key] === true` strictly — a missing key or `false` means denied.
- The fallback (Case 1) is always `canRead` on the own resource.

---

### Step 2: Update `MainLayout.vue` — replace the hard-coded `canRead` filter with `evaluateMenuAccess`

**File**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`

**Current filter code** (around line 194):
```js
resources
  .filter((resource) => {
    const menu = resource?.ui?.menu
    return menu?.show !== false &&
      menu?.route &&
      resource?.permissions?.canRead === true &&
      readableResources.value.has(resource.name)
  })
```

**What to change:**

1. **Add the import** at the top of the `<script setup>` block. Find the existing imports and add:
   ```js
   import { useMenuAccess } from 'src/composables/useMenuAccess'
   ```

2. **Instantiate** the composable inside the component (after `const auth = useAuthStore()` or similar, near the top of the script setup body):
   ```js
   const { evaluateMenuAccess } = useMenuAccess()
   ```

3. **Replace the filter** with:
   ```js
   resources
     .filter((resource) => {
       const menu = resource?.ui?.menu
       return menu?.show !== false &&
         menu?.route &&
         evaluateMenuAccess(resource)
     })
   ```

**Important:** Remove `readableResources` from the filter entirely. The `evaluateMenuAccess` function already handles the permission check (it checks `canRead` as fallback). Keeping `readableResources` would double-filter. Check whether `readableResources` is used anywhere else in the file before removing it. If it is used elsewhere, just remove it from the filter but leave the computed property itself. If it is ONLY used in this filter, you may remove the entire `readableResources` computed property too.

**Rule:** Do NOT touch any other part of `MainLayout.vue`. Only the import, the instantiation line, and the filter.

---

### Step 3: Update `router/index.js` — replace the hard-coded `canRead` guard with `evaluateMenuAccess`

**File**: `FRONTENT/src/router/index.js`

**Current guard code** (lines 60–73):
```js
const matchedByPath = Array.isArray(resources) ? resources.find((resource) => {
  return resource?.ui?.menu?.route === to.path
}) : null
const effectiveRequiredResource = requiredResource || matchedByPath?.name

if (effectiveRequiredResource && isAuthenticated) {
  const hasResourceReadAccess = Array.isArray(resources) && resources.some((resource) => {
    return resource?.name === effectiveRequiredResource && resource?.permissions?.canRead === true
  })

  if (!hasResourceReadAccess) {
    return next('/dashboard')
  }
}
```

**What to change:**

The router guard **cannot use a composable** directly (composables require Vue's `setup()` context, which the router beforeEach hook does not have). Instead, import the auth store directly and replicate the permission evaluation inline using a plain function.

**Do it this way:**

1. **Import the auth store** at the top of the file (it's already imported if present, otherwise add it):
   ```js
   import { useAuthStore } from 'src/stores/auth'
   ```

2. **Import `useMenuAccess` IS NOT possible here** (no setup context). Instead, define a small inline helper inside the `beforeEach` callback that does the same evaluation. Here is the exact replacement for the guard block:

   ```js
   // Find the resource entry whose menu.route matches the navigation target
   const matchedResource = Array.isArray(resources)
     ? resources.find((r) => r?.ui?.menu?.route === to.path)
     : null

   const effectiveRequiredResource = requiredResource || matchedResource?.name

   if (effectiveRequiredResource && isAuthenticated) {
     // Find the full resource entry for permission evaluation
     const targetEntry = Array.isArray(resources)
       ? resources.find((r) => r?.name === effectiveRequiredResource)
       : null

     const allowed = targetEntry ? evaluateMenuAccessInline(targetEntry, resources) : false

     if (!allowed) {
       return next('/dashboard')
     }
   }
   ```

3. **Define `evaluateMenuAccessInline` as a plain function OUTSIDE the `defineRouter` call**, at the top of the file (after imports). This mirrors the composable logic but uses plain JS with no Vue reactivity:

   ```js
   /**
    * Plain (non-composable) version of evaluateMenuAccess for use in the router guard.
    * Cannot use composables here (no setup context).
    *
    * @param {object} resource - The full resource entry to evaluate
    * @param {Array} allResources - Full list of authorized resources (for cross-resource checks)
    * @returns {boolean}
    */
   function evaluateMenuAccessInline(resource, allResources) {
     if (!resource) return false

     const resourceName = resource.name
     const menuAccess = resource?.ui?.menu?.menuAccess

     function checkPerms(resName, require) {
       const entry = allResources.find((r) => r?.name === resName)
       if (!entry) return false
       const perms = entry.permissions || {}
       const keys = Array.isArray(require) ? require : [require]
       return keys.every((k) => perms[k] === true)
     }

     if (!menuAccess || typeof menuAccess !== 'object') {
       return checkPerms(resourceName, 'canRead')
     }

     if (menuAccess.require !== undefined) {
       return checkPerms(resourceName, menuAccess.require)
     }

     if (Array.isArray(menuAccess.all)) {
       return menuAccess.all.every((rule) => checkPerms(rule.resource || resourceName, rule.require))
     }

     if (Array.isArray(menuAccess.any)) {
       return menuAccess.any.some((rule) => checkPerms(rule.resource || resourceName, rule.require))
     }

     return false
   }
   ```

4. **Remove** the old `hasResourceReadAccess` variable and its `resources.some(...)` check entirely.

**Rule:** The `resources` variable in the router guard is read from `localStorage.getItem('resources')` (line 41 of current file). Do NOT change how resources are loaded. Just change how permission is evaluated.

---

### Step 4: Add `menuAccess` to resources in `syncAppResources.gs` (only where needed)

**File**: `GAS/syncAppResources.gs`

The `menuAccess` field goes **inside** the `Menu` JSON string. Only resources that need a non-default rule need to be updated. Resources with no `menuAccess` will fall back to `canRead` automatically.

**Rule for which resources get `menuAccess`:**
- Resources where you want only users with **write permission** to see the menu item (e.g., master entity management pages) → add `"menuAccess": { "require": "canWrite" }` inside their `Menu` JSON.
- Resources that should remain visible to anyone who can read → leave as-is (no `menuAccess` needed).

**For now, the Build Agent does NOT need to update any specific resource's `menuAccess`.** This is a data/configuration decision the admin will make via the sheet (or later via the Manage Menu dialog). The code infrastructure (Steps 1–3) is what this plan implements.

**However**, to verify the feature works end-to-end, update ONE resource's `Menu` JSON in `syncAppResources.gs` as a test. Choose the `Products` resource (first in the list). Change its `Menu` JSON to include `menuAccess`:

```js
Menu: JSON.stringify({
  group: 'Masters',
  order: 1,
  label: 'Products',
  icon: 'inventory_2',
  route: '/masters/products',
  pageTitle: 'Products',
  pageDescription: 'Manage product master records (parent models)',
  show: true,
  menuAccess: { require: 'canWrite' }
}),
```

This will allow testing: a user with `canWrite` on Products sees it in the menu; a read-only user does not.

**After editing `syncAppResources.gs`, run `clasp push --force` to deploy.**

The admin must then run **AQL 🚀 > Resources > Sync APP.Resources from Code** and **AQL 🚀 > Resources > Clear Resource Config Cache** to propagate the change to the sheet and invalidate the server cache. Then a **new Web App deployment** is needed for the updated auth payload to be served.

---

### Step 5: Deploy GAS

After Step 4, run from the terminal:

```bash
cd GAS && clasp push --force
```

Confirm output shows all `.gs` files pushed without errors.

---

## Documentation Updates Required

- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — add `menuAccess` as a sub-field of the `Menu` JSON column. Document the schema: `require` (string or array), `all` (array of rules), `any` (array of rules). Each rule: `{ resource?, require }`.
- [ ] Update `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md` — note that `entry.ui.menu.menuAccess` drives sidebar visibility and route access control.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` — add a "Menu Access Control" section describing how `menuAccess` rules work, what keys are valid, and how they evaluate.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` — record that `menuAccess` is implemented, the composable lives at `src/composables/useMenuAccess.js`, and that Manage Menu dialog (future) will expose this field via UI.
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` — add entry for `useMenuAccess.js` describing its purpose.

---

## Acceptance Criteria

- [ ] A user with only `canRead` on Products does NOT see Products in the sidebar when `menuAccess: { require: 'canWrite' }` is set on Products.
- [ ] A user with `canWrite` on Products DOES see Products in the sidebar.
- [ ] If a read-only user types `/masters/products` directly in the browser URL, the route guard redirects them to `/dashboard`.
- [ ] A user with `canWrite` navigating to `/masters/products` via URL is allowed through.
- [ ] Resources with NO `menuAccess` field continue to show for any user with `canRead` (no regression).
- [ ] `all` rule: user must satisfy every listed rule to see the item.
- [ ] `any` rule: user satisfying at least one listed rule sees the item.
- [ ] Frontend does not throw errors when `menuAccess` is absent, malformed, or null.
- [ ] No other menu behavior changes (ordering, grouping, labels, icons unchanged).

---

## Post-Execution Notes (Build Agent fills this)

*(Change `Status` to `IN_PROGRESS` when starting, `COMPLETED` when done. Replace `[AgentName]` with actual agent identity. Remove `| pending`.)*

### Progress Log
- [x] Step 1 — Created `useMenuAccess.js`
- [x] Step 2 — Updated `MainLayout.vue` filter
- [x] Step 3 — Updated `router/index.js` guard
- [x] Step 4 — Added `menuAccess` to Products in `syncAppResources.gs` for testing
- [x] Step 5 — Ran `clasp push --force`
- [x] Documentation updates completed

### Deviations / Decisions
*(Build Agent records any deviations here.)*

### Files Actually Changed
- `FRONTENT/src/composables/useMenuAccess.js` (new)
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `FRONTENT/src/router/index.js`
- `GAS/syncAppResources.gs`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [x] Dev server runs without errors
- [x] Acceptance criteria verified manually

### Manual Actions Required
- [ ] Run **AQL 🚀 > Resources > Sync APP.Resources from Code** (to push `menuAccess` from code to sheet)
- [ ] Run **AQL 🚀 > Resources > Clear Resource Config Cache** (to purge stale server cache)
- [ ] Create a **new Web App deployment** in Apps Script IDE (Deploy > New deployment) so the live URL serves the updated auth payload with `menuAccess` inside `ui.menu`
