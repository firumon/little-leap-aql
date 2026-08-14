# AQL Frontend Menu System — App.Resources.Menu

> **Scope:** This document covers **only** the frontend web app sidebar menu driven by the `Menu` JSON column in `APP.Resources`. It does **not** cover the `AQL 🚀` Google Sheets toolbar menu — see `Documents/SHEET_TOOLBAR_MENU_GUIDE.md` for that.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Complete JSON Schema](#2-complete-json-schema)
3. [End-to-End Data Flow](#3-end-to-end-data-flow)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [menuAccess Evaluation Reference](#6-menuaccess-evaluation-reference)
7. [Admin operation](#7-admin-operation)
8. [Multi-Tenant Considerations](#8-multi-tenant-considerations)
9. [Common Patterns & Gotchas](#9-common-patterns--gotchas)
10. [Related Documents](#10-related-documents)

---

## 1. Overview

The AQL web app sidebar menu is **dynamically generated** from the `Menu` JSON column in the `APP.Resources` Google Sheet. Each resource can define one or more sidebar entries with nested folder hierarchy, icon, route, and **permission gates** (`menuAccess`). The frontend fetches these during login, filters them against the logged-in user's role permissions, builds a nested tree, and renders it recursively.

Key principles:
- **No hardcoded sidebar**: Every entry is data-driven from `APP.Resources.Menu`
- **Role-driven visibility**: What a user sees depends entirely on their `APP.RolePermissions`
- **Fine-grained gating**: Each menu entry can have its own `menuAccess` rule, independent of the resource's base permissions
- **Route guard double-check**: The router re-evaluates `menuAccess` on every navigation — no URL bypass possible

---

## 2. Complete JSON Schema

Each entry inside the `Menu` JSON array:

```json
{
  "group":           ["master", "Product"],
  "order":           1,
  "label":           "Products",
  "icon":            "inventory_2",
  "route":           "/master/products",
  "pageTitle":       "Products",
  "pageDescription": "Manage product master records",
  "show":            true,
  "menuAccess":      { "require": "canWrite" }
}
```

### 2.1 Field Reference

| Key | Type | Required | Default | Purpose |
|-----|------|----------|---------|---------|
| `group` | `string[]` | No | `["General"]` | Folder hierarchy path. Each string becomes a nested `q-expansion-item` group in the sidebar. Empty array or missing defaults to `["General"]`. |
| `order` | `number` | No | `9999` | Sort priority within a group. Lower numbers appear higher. Groups inherit the minimum `order` of their children for inter-group sorting. |
| `label` | `string` | No | Resource `Name` | Visible text rendered on the sidebar link. |
| `icon` | `string` | No | `"list_alt"` | Material Design icon name shown next to the label. |
| `route` | `string` | **Yes** | — | Vue Router path (e.g. `/master/products`). Must match a defined route in `FRONTENT/src/router/routes.js`. Empty or missing causes the entry to be **skipped entirely**. |
| `pageTitle` | `string` | No | Resource `Name` | Page title metadata (used in admin dialogs, not rendered in sidebar). |
| `pageDescription` | `string` | No | `""` | Page description metadata (used in admin dialogs). |
| `show` | `boolean` | No | `true` | Master visibility toggle. Set to `false` to hide an entry without deleting it from config. |
| `menuAccess` | `object` | No | `null` | Permission gate (see §2.2 below). Absent → falls back to checking if the user has ANY permission/action on the owning resource. |

### 2.2 `menuAccess` Rule Formats

#### Format A — Absent (default)
```json
// No menuAccess field at all
// → evaluates if user has ANY permission on the owning resource
```

#### Format B — Single permission on own resource
```json
"menuAccess": { "require": "canWrite" }
// User must have canWrite on the resource that owns this menu entry

"menuAccess": { "require": ["canWrite", "canDelete"] }
// User must have ALL listed permissions (AND logic)
```

#### Format C — ALL rules must pass (AND)
```json
"menuAccess": {
  "all": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "SKUs",     "require": "canRead" }
  ]
}
// If ANY rule fails, access is denied
```

#### Format D — ANY rule must pass (OR)
```json
"menuAccess": {
  "any": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "Variants", "require": "canWrite" }
  ]
}
// If at least ONE rule passes, access is granted
```

**Rule object structure:**
| Key | Type | Required | Default | Purpose |
|-----|------|----------|---------|---------|
| `resource` | `string` | No | Own resource name | Target resource to check permissions against |
| `require` | `string` \| `string[]` | **Yes** | — | Permission key(s) to check (e.g. `"canRead"`, `["canWrite","canDelete"]`) |

### 2.3 Role-Aware Customization (Overrides per Role)

Since June 2026, every presentation field (`group`, `order`, `label`, `icon`, `pageTitle`, `pageDescription`) can accept either a **static value** (backward compatible) or an **object keyed by role ID** with a `"default"` fallback.

#### Shape

```json
{
  "group": {
    "default": ["master", "Product"],
    "R001":    "",                     // empty → renders at root level for this role
    "R002":    "Product",              // single string (still valid, wraps to ["Product"])
    "R003":    ["Master", "Manage"]    // full override for this role
  },
  "label": {
    "default": "Products",
    "R001": "Manage Products",
    "R002": "Product Catalog"
  },
  "icon": {
    "default": "inventory_2",
    "R001": "admin_panel_settings",
    "R002": "catalog"
  },
  "order": {
    "default": 1,
    "R001": 10
  }
}
```

#### Resolution Priority

At frontend tree-build time, the `resolveRoleAwareField()` function in `useMainLayoutNavTree.js` resolves in this order:

1. **User ID match** — if key matches `auth.user.id`, use that value (reserved for future user-specific overrides)
2. **Role ID match** — iterate `auth.user.roles[]` in order, first matching `role.id` wins
3. **`"default"`** — fallback when no role/user matches
4. **Value itself** — if none of the above exist, the object itself is returned (rare edge case)

If the resolved value is `""` or `[]` for `group`, the entry renders **at the sidebar root level** (no expansion-item wrapper).

#### Backend Handling

The parser in `GAS/resourceRegistry.gs:94-116` detects role-aware objects (plain objects that aren't arrays) and passes them through **without normalization**. All other values follow the existing normalization path. This ensures backward compatibility — existing `Menu` JSON with simple values continues to work unchanged.



Derived from `APP.RolePermissions` action columns:
- `canRead`, `canWrite`, `canUpdate`, `canDelete` (standard CRUD)
- `canApprove`, `canReject`, `canCancel`, etc. (custom workflow actions)
- Any key matching the pattern `can<ActionName>`

---

## 3. End-to-End Data Flow

```
GAS/syncAppResources.gs              ← Canonical config (code)
       ↓  (AQL 🚀 > Sync APP.Resources from Code)
APP.Resources sheet, Menu column      ← Storage (sheet)
       ↓  (GAS/resourceRegistry.gs parser)
GAS in-memory config.menus            ← Parsed runtime config
       ↓  (GAS/resourceRegistry.gs buildAuthorizedResourceEntry)
Login response payload: ui.menus      ← Auth payload
       ↓  (HTTP response)
authStore.resources (Pinia)           ← Frontend store (also localStorage)
       ↓
useMainLayoutNavTree.js               ← Build nested tree, evaluate menuAccess
       ↓
visibleResourceMenuGroups             ← Computed tree (sorted, filtered)
       ↓
MainLayout.vue → MenuTreeNode.vue    ← Recursive render
                                      ← Route guard (router/index.js)
```

### Step-by-step

1. **Canonical config** — Developer defines menu entries in `GAS/syncAppResources.gs` inside `initAppResourcesCodeConfig()`, each resource's config object includes a `Menu` field with `JSON.stringify(...)`.

2. **Sync to sheet** — Admin runs `AQL 🚀 > Resources > Sync APP.Resources from Code` to write code config into the `APP.Resources` sheet's `Menu` column.

3. **Parsing** — `GAS/resourceRegistry.gs` reads each row, parses the `Menu` JSON cell, normalizes legacy fields (`groupPath` → `group`), applies defaults, and stores as `config.menus` array.

4. **Auth payload** — `buildAuthorizedResourceEntry()` at `GAS/resourceRegistry.gs:507` packages `config.menus` into `entry.ui.menus` for the login response.

5. **Login** — `GAS/auth.gs:handleLogin()` calls `getLoginAuthorizedResources()` which filters resources by user's role permissions and includes `ui.menus` for each authorized resource.

6. **Frontend storage** — Login response stored in Pinia `authStore.resources` (also persisted to `localStorage`).

7. **Tree building** — `useMainLayoutNavTree.js` iterates every `resource.ui.menus` entry, skips `show: false` and invalid routes, evaluates `menuAccess`, builds nested group/leaf structure, sorts by `order`.

8. **Rendering** — `MainLayout.vue` draws the sidebar using `MenuTreeNode.vue` recursively.

9. **Route guard** — `router/index.js` `beforeEach` matches the target path to a menu entry, re-evaluates `menuAccess`, redirects to `/dashboard` on failure.

---

## 4. Backend Architecture

### 4.1 Files Involved

| File | Line(s) | Role |
|------|---------|------|
| `GAS/syncAppResources.gs` | Various | Canonical `Menu` JSON definitions inside `initAppResourcesCodeConfig()` — one object per resource |
| `GAS/resourceRegistry.gs` | 69-116 | Parses `Menu` cell from sheet row: legacy migration, defaults, normalization |
| `GAS/resourceRegistry.gs` | 507-562 | `buildAuthorizedResourceEntry()` packages `menus` into `entry.ui.menus` |
| `GAS/auth.gs` | ~196-256 | `getLoginAuthorizedResources()`, `sortAuthorizedResources()` by menu order |

### 4.2 Parsing & Normalization (`resourceRegistry.gs:69-116`)

```js
// Legacy handling: "groupPath" → "group"
var rawGroup = m.group;
if (!rawGroup && m.groupPath) rawGroup = m.groupPath;

// Array normalization
var group = [];
if (Array.isArray(rawGroup)) {
  group = rawGroup.map(function(part) { return (part || '').toString().trim(); }).filter(Boolean);
} else if (rawGroup) {
  group = [(rawGroup || '').toString().trim()].filter(Boolean);
}
if (!group.length) group = ['General'];

// Full normalized entry:
return {
  group: group,
  order: Number(m.order) || 9999,
  label: m.label || name,
  icon: m.icon || 'list_alt',
  route: m.route || '',
  pageTitle: m.pageTitle || name,
  pageDescription: m.pageDescription || '',
  show: m.show !== undefined ? toBooleanCell(m.show) : true,
  menuAccess: m.menuAccess || null
};
```

### 4.3 Auth Payload Packaging (`resourceRegistry.gs:549-553`)

```js
if (opts.includeUiConfig) {
  entry.ui = {
    menus: Array.isArray(config.menus) ? config.menus : [],
    fields: Array.isArray(config.uiFields) ? config.uiFields : [],
    customUIName: config.customUIName || '',
    listViews: Array.isArray(config.listViews) ? config.listViews : [],
    listViewsMode: (config.listViewsMode || 'auto').toString()
  };
}
```

### 4.4 Order-Based Sorting (`auth.gs:218-241`)

Resources are sorted by the minimum `order` value across all their menu entries, ensuring predictable sidebar group ordering.

---

## 5. Frontend Architecture

### 5.1 Files Involved

| File | Role |
|------|------|
| `FRONTENT/src/layouts/MainLayout/MainLayout.vue` | Sidebar container — renders `MenuTreeNode` for each node in `visibleResourceMenuGroups` |
| `FRONTENT/src/components/MenuTreeNode.vue` | Recursive component — renders `group` as `q-expansion-item`, `leaf` as `q-item` with router-link |
| `FRONTENT/src/composables/layout/useMainLayoutNavTree.js` | Builds the nested tree from `authStore.resources` — grouping, sorting, deduplication |
| `FRONTENT/src/composables/layout/useMenuAccess.js` | Evaluates `menuAccess` rules against the auth store |
| `FRONTENT/src/router/index.js` | Route guard — `evaluateMenuAccessInline()` mirrors `useMenuAccess` without composable context |
| `FRONTENT/src/stores/auth.js` | Holds `resources` array (source of truth for menus) — Pinia + localStorage |
| `FRONTENT/src/css/hero/_sidebar.scss` | Sidebar styling — dark theme, active route highlighting |

### 5.2 Tree Building Algorithm (`useMainLayoutNavTree.js`)

```
for each resource in authStore.resources:
  for each menu in resource.ui.menus:
    1. Skip if menu.show === false
    2. Skip if menu.route is empty/invalid
    3. Evaluate evaluateMenuAccess(resource, menu) — skip if denied
    4. Determine group path from menu.group (or ["General"])
    5. Walk/create nested group nodes in root tree
    6. Add leaf node with: type, routePath, navLabel, navIcon, order

After all entries processed:
  sortNodes(root):
    - Sort each level by order (numeric), then label (alphabetical)
    - Groups inherit minimum order of their children
    - Recurse into group children
```

**Deduplication**: Uses `dedupeKey = groupPath + '::' + label + '::' + route` to prevent duplicate entries.

**Group icon resolution** (`groupIconByName`): Known group names map to specific Material icons (e.g. `procurement → shopping_cart`, `warehouse → inventory`). Unknown groups fall back to `menu_open`.

### 5.3 Permission Gating Engine (`useMenuAccess.js`)

```js
function evaluateMenuAccess(resource, menuItem = null) {
  if (!resource) return false

  const menuAccess = menuItem?.menuAccess ?? null

  // No rule → fallback to ANY permission on own resource
  if (!menuAccess || typeof menuAccess !== 'object')
    return hasAnyResourcePermission(resource.name)

  // { require: "canWrite" } or { require: ["canWrite", "canDelete"] }
  if (menuAccess.require !== undefined)
    return checkPermissions(resource.name, menuAccess.require)

  // { all: [ ... ] } — ALL rules must pass
  if (Array.isArray(menuAccess.all))
    return menuAccess.all.every(rule =>
      checkPermissions(rule.resource || resource.name, rule.require))

  // { any: [ ... ] } — ANY rule must pass
  if (Array.isArray(menuAccess.any))
    return menuAccess.any.some(rule =>
      checkPermissions(rule.resource || resource.name, rule.require))

  return false // unknown shape → deny
}

function checkPermissions(resourceName, require) {
  const entry = auth.resources.find(r => r.name === resourceName)
  if (!entry) return false
  const keys = Array.isArray(require) ? require : [require]
  return keys.every(key => entry.permissions[key] === true)
}
```

### 5.4 Route Guard (`router/index.js:24-57`)

The `beforeEach` guard uses an inline version of `evaluateMenuAccess` (no Vue composable context):

```
1. Match to.path against all resource.ui.menus[].route values
2. Find the first resource that both:
   a. Has a menu entry with matching route
   b. Passes evaluateMenuAccessInline(resource, allResources, to.path)
3. If no match found OR access denied → redirect to /dashboard
```

### 5.5 Rendering Component (`MenuTreeNode.vue`)

```vue
<!-- Leaf node → clickable router-link -->
<q-item :to="node.routePath" clickable v-ripple>
  <q-item-section avatar>
    <q-icon :name="node.navIcon" size="xs" />
  </q-item-section>
  <q-item-section>{{ node.navLabel }}</q-item-section>
</q-item>

<!-- Group node → expandable folder -->
<q-expansion-item :icon="node.icon" :label="node.label" dark>
  <q-list class="q-pl-md">
    <MenuTreeNode v-for="child in node.children" :key="child.key" :node="child" />
  </q-list>
</q-expansion-item>
```

### 5.6 Node Object Shape

**Leaf node:**
```js
{
  type: 'leaf',           // discriminator
  key: 'Products::/master/products',
  resource: 'Products',   // owning resource name
  routePath: '/master/products',
  navLabel: 'Products',
  navIcon: 'inventory_2',
  order: 1
}
```

**Group node:**
```js
{
  type: 'group',
  key: 'master/Product',     // unique path key
  label: 'Product',
  icon: 'inventory',           // resolved group icon
  order: 1,                    // inherited min child order
  children: [ /* leaf or group nodes */ ]
}
```

---

## 6. `menuAccess` Evaluation Reference

| Scenario | `menuAccess` value | Behavior |
|----------|-------------------|----------|
| No permission gate | `null` / absent | Checks if user has ANY permission/action on the owning resource |
| Elevated permission | `{ "require": "canWrite" }` | Entry visible only if user has `canWrite` on owning resource |
| Multi-permission (AND) | `{ "require": ["canWrite","canApprove"] }` | User must have ALL listed permissions |
| Cross-resource (AND) | `{ "all": [{ "resource":"X", "require":"canRead" }, { "resource":"Y", "require":"canWrite" }] }` | All specified rules must pass |
| Cross-resource (OR) | `{ "any": [{ "resource":"X", "require":"canWrite" }, { "resource":"Y", "require":"canWrite" }] }` | At least one rule must pass |
| Malformed | any non-object / unknown shape | Safe default: **deny** |
| Resource not found in auth store | any rule referencing a non-existent resource | That rule → **deny** |

### Fallback Chain

```
menuAccess defined?
  ├── No  → hasAnyResourcePermission(ownResource)
  ├── Yes → has 'require'?  → checkPermissions(ownResource, require)
  ├── Yes → has 'all'?      → every rule passes? → allow : deny
  ├── Yes → has 'any'?      → some rule passes?  → allow : deny
  └── Yes → unknown shape   → deny (safe default)
```

---

## 7. Admin operation

### 7.1 Adding a New Menu Entry

1. Edit the target resource's config in `GAS/syncAppResources.gs` → update its `Menu` JSON array
2. Run `clasp push` to deploy GAS changes
3. In APP sheet: `AQL 🚀 > Resources > Sync APP.Resources from Code`
4. In APP sheet: `AQL 🚀 > Resources > Regenerate App Cache`
5. Create a new Web App deployment in Apps Script IDE
6. User re-logs in to see the updated menu

### 7.2 Editing Menu in Sheet Directly

1. Open `APP.Resources` sheet
2. Locate the resource row
3. Edit the `Menu` cell JSON directly
4. Run `AQL 🚀 > Resources > Regenerate App Cache`
5. Users re-login to see changes

### 7.3 Adding Multiple Sidebar Entries per Resource

The `Menu` cell stores a **JSON array**, so a resource can have multiple entries:

```json
[
  { "group": ["Warehouse"], "order": 1, "label": "Manage Warehouses", "icon": "warehouse", "route": "/master/warehouses" },
  { "group": ["Warehouse"], "order": 2, "label": "Stock List", "icon": "inventory_2", "route": "/master/warehouses/stock-list" },
  { "group": ["Warehouse"], "order": 3, "label": "Stock Movements", "icon": "inventory", "route": "/operation/stock-movements", "menuAccess": { "require": "canWrite" } }
]
```

The admin dialog in the sheet only edits the **first entry**; subsequent entries are preserved via a `_menuArrayFull` hidden field. To add extra rows, edit the cell directly in the sheet or via `syncAppResources.gs`.

### 7.4 Hiding a Menu Entry Without Deleting

Set `"show": false` in the entry. The frontend skips entries with `show === false` during tree building.

---

## 8. Multi-Tenant Considerations

In a multi-tenant setup, each tenant has its own `APP.Resources` sheet with its own `Menu` JSON values. The canonical config in `GAS/syncAppResources.gs` serves as the baseline, but tenants can override by:

1. Editing `Menu` cells directly in their tenant's APP sheet
2. Running `AQL 🚀 > Sync APP.Resources from Code` to reset to code defaults

The frontend is tenant-agnostic — it receives whatever `resources[].ui.menus` the tenant's backend serves. Menu rendering works identically across all tenants.

---

## 9. Common Patterns & Gotchas

### 9.1 DOs
- **DO** use `menuAccess` for admin-only menu items (e.g. `{ "require": "canWrite" }`)
- **DO** use `order` values in increments of 1-10 to leave room for future insertions
- **DO** ensure every `route` has a matching route definition in `FRONTENT/src/router/routes.js`
- **DO** run cache regeneration + new deployment after changing menu config
- **DO** use the `all`/`any` cross-resource variants when a menu item depends on another resource's permissions

### 9.2 DON'Ts
- **DON'T** hardcode sidebar paths, labels, or icons in Vue templates — always use the data-driven `Menu` JSON
- **DON'T** bypass `useMenuAccess` — both sidebar rendering AND route guard must evaluate permissions
- **DON'T** omit `menuAccess` on sensitive entries — it defaults to checking for any permission, which may be too permissive
- **DON'T** edit the `Menu` JSON array in the sheet with invalid JSON — the parser will return an empty array
- **DON'T** rename resources casually — `menuAccess` cross-resource rules reference resources by name
- **DON'T** nest role-aware objects inside `menuAccess` rules — `menuAccess` evaluates permissions, not presentation

### 9.3 Role-Aware Gotchas

- **Role IDs must match `APP.Roles` RoleID column** — the resolver looks up `auth.user.roles[].id`. If the sheet uses role names instead of IDs, the override won't match.
- **First role match wins** — if a user has multiple roles, the **first** matching role's value in the user's `roles` array order takes precedence. Order your `menuAccess` gating accordingly.
- **Empty group = root level** — setting `"R001": ""` or `"R001": []` for `group` renders the entry as a root-level link (no expansion item). Use this for single-role users to avoid a lonely one-item folder.
- **Backend caches raw objects** — `resourceRegistry.gs` passes role-aware objects through without normalization. The frontend resolves them at render time using the current user's session data. No backend changes needed when adding new role override keys.
- **Can't override `route` or `show`** — these remain static per entry. Route changes per role would break router consistency. Use `menuAccess` for role-based show/hide.

### 9.4 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Menu item not appearing in sidebar | `show: false` or invalid/empty `route` or `menuAccess` denying access | Check each condition in the tree-building pipeline |
| Route redirects to `/dashboard` | Route guard found the menu entry but `menuAccess` evaluated to false | Check the user's permissions for the required resource+action |
| Menu item appears but navigation fails | Route path doesn't match any defined route in `routes.js` | Add the route or fix the `route` value |
| Wrong group icon | `groupIconByName` doesn't have an entry for the group name | Add an entry to `groupIconByName` in `useMainLayoutNavTree.js` or use a custom icon in the menu entry (the icon from the entry itself takes priority over group resolution — actually check: currently the group node uses `resolveGroupIcon()` which only uses `groupIconByName`, not the entry's icon. The leaf node uses `menu.icon`. So if you want a specific group icon, add it to `groupIconByName`.) |
| Changes not reflecting after config update | Stale cache or old deployment | Run Regenerate App Cache + create new deployment |
| Duplicate sidebar entries | Multiple resources have menu entries with the same `group+label+route` | Check `dedupeKey` — ensure uniqueness |

### 9.4 Legacy Compatibility

The sheet may contain entries with the legacy `groupPath` field (a single string or array) instead of `group`. The parser in `resourceRegistry.gs:96-97` handles this:
```js
var rawGroup = m.group;
if (!rawGroup && m.groupPath) rawGroup = m.groupPath;
```
New entries should always use `group`.

---

## 10. Related Documents

| Document | What it covers |
|----------|---------------|
| `Documents/SHEET_TOOLBAR_MENU_GUIDE.md` | `AQL 🚀` sheet toolbar menu + sidebar taxonomy (Section 9) |
| `Documents/WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md` §5 | Menu Access Control — architecture, rule formats, evaluation flow |
| `Documents/API_LOGIN_RESPONSE.md` §4 | `ui.menus` payload shape in login response |
| `Documents/SCHEMA_RESOURCE_COLUMNS.md` | The `Menu` column definition in `APP.Resources` |
| `Documents/CORE_OVERVIEW.md` | Notes that authorized resources drive menu visibility |
| `Documents/CORE_ARCHITECTURE_RULES.md` | Frontend rendering rules and constraints |
| `Documents/CORE_DOC_ROUTING.md` | Routing guide — which docs to read for which task type |

---

## Maintenance Rule

When any of the following changes:
- A `menuAccess` rule format is added, removed, or behavior-changed
- A new menu entry field is added to the JSON schema
- The tree-building, permission gating, or route guard logic is modified
- The backend parsing/normalization of `Menu` JSON changes

...update this document AND the init prompt at `References/Prompt Library/Initialization/frontend_menu_system.md` in the same task. Do not close the task until both are aligned.


