# AQL Frontend Menu System — Agent Initialization

> **Scope boundary**: This document covers **only** the frontend web app sidebar menu driven by the `Menu` JSON column in `APP.Resources`. It does **not** cover the `AQL 🚀` Google Sheets toolbar menu — see `References/Prompt Library/Initialization/sheet_menu_actions.md` for that.

Use this document to initialize an AI agent session when the task involves:
- Adding, removing, reordering, or modifying sidebar menu entries
- Changing `menuAccess` permission gates for sidebar items
- Debugging why a menu item appears or doesn't appear for a user
- Implementing a new feature that touches sidebar rendering, route guards, or menu-related composables
- Querying how the menu system works end-to-end

---

## 1. Mandatory Pre-Read

Read **only** this single document for a complete understanding of the menu system:

- `Documents/AQL_FRONTEND_MENU_SYSTEM.md` — Complete canonical document covering:
  - JSON schema (every key, every variant)
  - End-to-end data flow (code → sheet → auth payload → frontend render)
  - Backend architecture (parse, normalize, package)
  - Frontend architecture (tree building, permission gating, route guard, rendering)
  - `menuAccess` evaluation reference
  - Admin operations
  - Multi-tenant considerations
  - Common patterns & gotchas
  - Related documents with links

No other init prompt or canonical doc is needed for menu-specific tasks. If the task crosses into other domains (e.g., creating a new page for the route), load the appropriate init prompt for that domain as well.

---

## 2. System Architecture

The AQL web app sidebar menu is **dynamically generated** from the `Menu` JSON column in `APP.Resources`. The runtime frontend fetches this resource list during login, filters it by the user's role permissions, structures it into a nested group tree, and renders it recursively.

### Core File Coordinates

| Layer | File | What it does |
|-------|------|-------------|
| **Backend Config** | `GAS/syncAppResources.gs` | Canonical `Menu` JSON definitions inside `initAppResourcesCodeConfig()` |
| **Backend Parser** | `GAS/resourceRegistry.gs:69-116` | Reads `Menu` cell, parses JSON, normalizes fields, sets defaults |
| **Backend Packager** | `GAS/resourceRegistry.gs:507-562` | `buildAuthorizedResourceEntry()` packages `menus` into `entry.ui.menus` |
| **Backend Auth** | `GAS/auth.gs:196-256` | Filters resources by user role, sorts by menu order, builds login payload |
| **Frontend Store** | `FRONTENT/src/stores/auth.js` | Holds `resources` array (source of truth) in Pinia + localStorage |
| **Frontend Tree Builder** | `FRONTENT/src/composables/layout/useMainLayoutNavTree.js` | Groups entries by path, evaluates access, sorts, deduplicates |
| **Frontend Permission Gate** | `FRONTENT/src/composables/layout/useMenuAccess.js` | `evaluateMenuAccess()` — evaluates `menuAccess` rules |
| **Frontend Route Guard** | `FRONTENT/src/router/index.js:24-57` | `evaluateMenuAccessInline()` — re-evaluates on every navigation |
| **Frontend Sidebar Renderer** | `FRONTENT/src/components/MenuTreeNode.vue` | Recursively renders group/leaf nodes via `q-expansion-item` / `q-item` |
| **Frontend Sidebar Layout** | `FRONTENT/src/layouts/MainLayout/MainLayout.vue:63-113` | `q-drawer` container that iterates `visibleResourceMenuGroups` |
| **Frontend Styles** | `FRONTENT/src/css/hero/_sidebar.scss` | Dark theme, active route highlighting |

---

## 3. Data Flow Summary

```
GAS/syncAppResources.gs              ← Canonical config (code)
       ↓  (AQL 🚀 > Sync APP.Resources from Code)
APP.Resources sheet, Menu column      ← Storage (sheet)
       ↓  (GAS/resourceRegistry.gs parser)
config.menus                          ← Parsed runtime config
       ↓  (buildAuthorizedResourceEntry)
Login response: resources[].ui.menus  ← Auth payload
       ↓  (HTTP response → Pinia authStore)
FRONTENT: useMainLayoutNavTree        ← Build tree, evaluate menuAccess
       ↓
visibleResourceMenuGroups             ← Computed tree (sorted, filtered)
       ↓
MainLayout.vue → MenuTreeNode.vue    ← Render sidebar
Router.beforeEach                     ← Route guard (double-check)
```

---

## 4. JSON Schema Reference (Quick Lookup)

```json
{
  "group":           ["Masters", "Product"],
  "order":           1,
  "label":           "Products",
  "icon":            "inventory_2",
  "route":           "/masters/products",
  "pageTitle":       "Products",
  "pageDescription": "Manage product master records",
  "show":            true,
  "menuAccess":      { "require": "canWrite" }
}
```

### `menuAccess` Variants

| Format | Example |
|--------|---------|
| Absent | `null` — falls back to `canRead` on owning resource |
| Single permission | `{ "require": "canWrite" }` — also supports `["canWrite","canDelete"]` (AND) |
| ALL (AND) | `{ "all": [{ "resource":"X","require":"canRead" }, ...] }` |
| ANY (OR) | `{ "any": [{ "resource":"X","require":"canWrite" }, ...] }` |

### Role-Aware Presentation Fields (Since June 2026)

`group`, `order`, `label`, `icon`, `pageTitle`, `pageDescription` accept either a static value or an object keyed by role ID:

```json
"group": {
  "default": ["Masters", "Product"],
  "R001":    "",
  "R002":    "Product",
  "R003":    ["Master", "Manage"]
}
```

Resolution priority: `userId` > `role.id` (first match) > `"default"`. Empty `group` → root-level link (no folder).

---

## 5. Implementation Checklist

### Adding / Modifying a Menu Entry

1. [ ] Edit `Menu` JSON in `GAS/syncAppResources.gs` for the target resource
2. [ ] Verify `route` matches a defined route in `FRONTENT/src/router/routes.js`
3. [ ] Verify `menuAccess` rule spelling (permission keys must match `APP.RolePermissions` action columns)
4. [ ] Run `clasp push` to deploy GAS changes
5. [ ] In APP sheet: `AQL 🚀 > Resources > Sync APP.Resources from Code`
6. [ ] In APP sheet: `AQL 🚀 > Resources > Regenerate App Cache`
7. [ ] Create a new Web App deployment in Apps Script IDE
8. [ ] User re-logs in to see updated menu

### Debugging Visibility Issues

1. Check `show` field is not `false`
2. Check `route` is non-empty and valid
3. Check `menuAccess` evaluates correctly for the test user's role
4. Check no `dedupeKey` collision (same `group+label+route` from another resource)
5. Check the user's `APP.RolePermissions` entry has the required action
6. Check server cache is cleared (`Regenerate App Cache`) and a new deployment is active

---

## 6. Guardrails (DOs and DO NOTs)

- **DO NOT** hardcode sidebar paths, labels, or icons in Vue templates
- **DO NOT** bypass `evaluateMenuAccess` — both sidebar and route guard must check
- **DO NOT** omit `menuAccess` on sensitive entries (default is `canRead`)
- **DO NOT** rename resources that are referenced in `menuAccess.all` or `menuAccess.any` cross-resource rules
- **DO NOT** create a new GAS file for menu config — use existing `syncAppResources.gs`
- **DO** read `Documents/AQL_FRONTEND_MENU_SYSTEM.md` first for full understanding
- **DO** use `order` values with gaps (1, 10, 20) for future insertion flexibility
- **DO** verify route existence before writing the menu config

---

## 7. Verification

- Sidebar renders expected entries under correct groups
- Clicking a menu item navigates to the correct route
- A user lacking the required permissions does NOT see the entry AND is redirected to `/dashboard` if they manually navigate to the route
- After config changes: GAS pushed, sheet synced, cache regenerated, new deployment created, user re-logged

---

## 8. Related Init Prompts

| Init Prompt | When to load alongside this one |
|-------------|-------------------------------|
| `frontend_modification.md` | If the task also involves creating/modifying the target page component |
| `database_schema_alteration.md` | If the task involves adding a new resource/sheet |
| `backend_gas_implementation.md` | If the task involves new backend API actions for the page |
| `sheet_menu_actions.md` | If the task also involves modifying the `AQL 🚀` Google Sheets toolbar menu (completely separate system) |
