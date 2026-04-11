# PLAN: Convert APP.Resources.Menu Column from JSON Object to JSON Array
**Status**: COMPLETED
**Created**: 2026-04-06
**Created By**: Brain Agent (Claude Sonnet 4.6)
**Executed By**: Build Agent (Codex)

## Objective
Convert the `Menu` column in `APP.Resources` from storing a single JSON **object** (`{...}`) to a JSON **array** (`[{...}]`). This enables any resource to expose multiple sidebar menu items (e.g., `StockMovements` can have both a "Stock Movements" list page AND a "Manage Stock" wizard page).

Every backend parser, admin dialog, auth payload builder, auth sorter, and every frontend consumer must be updated atomically so nothing breaks.

## Context
- Currently all 33 resources in `GAS/syncAppResources.gs` define `Menu: JSON.stringify({...})` (single object).
- `GAS/resourceRegistry.gs` parses this as a single object (`parseJsonCell(..., {})`) and normalizes it at lines 93-102.
- `GAS/auth.gs` sorts resources by `a.ui.menu.order` (single value).
- `GAS/appMenu.gs` decomposes the object into flat form fields (lines 344-357) and recomposes them back (lines 429-438).
- Frontend reads `resource.ui.menu.*` in 7+ files (MainLayout, router, useResourceConfig, useMenuAccess, ResourcePageShell, MasterListHeader, MasterAddHeader, MasterEditHeader, MasterViewChildren, MasterAddChildren, MasterEditChildren, useCompositeForm).
- The auth payload currently delivers `entry.ui.menu` as a single object; this will become `entry.ui.menus` (array).

**Key document references:**
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/APP_SHEET_STRUCTURE.md`

## Pre-Conditions
- [x] Required access/credentials for `clasp push` are available.
- [x] `Documents/LOGIN_RESPONSE.md` exists (created in previous plan).
- [ ] No other plan is currently modifying Menu-related code.

## Steps

### Step 1: Update All 33 Resource Definitions in `syncAppResources.gs`
- [ ] Open `GAS/syncAppResources.gs`.
- [ ] For every resource entry in the `APP_RESOURCES_CODE_CONFIG` array (33 entries total), change:
  ```javascript
  // BEFORE (single object)
  Menu: JSON.stringify({ group: '...', order: N, label: '...', ... })
  // AFTER (array wrapping the same object)
  Menu: JSON.stringify([{ group: '...', order: N, label: '...', ... }])
  ```
- [ ] The ManageStock entry (lines 689-723) should ALSO be wrapped in array for now. (Plan 2 will remove it entirely.)
- [ ] Do NOT change any other field in any resource entry.

**Files**: `GAS/syncAppResources.gs`
**Rule**: Every `Menu:` value must become `JSON.stringify([{...}])`. No exceptions. Zero resources should remain with bare `{...}`.

---

### Step 2: Update `resourceRegistry.gs` — Parse Menu as Array
- [ ] Open `GAS/resourceRegistry.gs`.
- [ ] At line 69, change the parse from object to array:
  ```javascript
  // BEFORE
  var menuObj = parseJsonCell(readOptionalCell(row, registry.idx.Menu, '{}'), {});
  // AFTER
  var menuRaw = parseJsonCell(readOptionalCell(row, registry.idx.Menu, '[]'), []);
  var menuArr = Array.isArray(menuRaw) ? menuRaw : (menuRaw && typeof menuRaw === 'object' ? [menuRaw] : []);
  ```
  The fallback `(menuRaw && typeof menuRaw === 'object' ? [menuRaw] : [])` provides backwards compatibility if any sheet cell still has an old-format object.
- [ ] At lines 93-102, replace the single-object normalization with array normalization. Replace:
  ```javascript
  menu: Object.assign({}, menuObj, {
    group: menuObj.group || '',
    order: Number(menuObj.order) || 9999,
    label: menuObj.label || name,
    icon: menuObj.icon || 'list_alt',
    route: menuObj.route || '',
    pageTitle: menuObj.pageTitle || name,
    pageDescription: menuObj.pageDescription || '',
    show: menuObj.show !== undefined ? toBooleanCell(menuObj.show) : true
  }),
  ```
  With:
  ```javascript
  menus: menuArr.map(function(m) {
    return {
      group: m.group || '',
      order: Number(m.order) || 9999,
      label: m.label || name,
      icon: m.icon || 'list_alt',
      route: m.route || '',
      pageTitle: m.pageTitle || name,
      pageDescription: m.pageDescription || '',
      show: m.show !== undefined ? toBooleanCell(m.show) : true,
      menuAccess: m.menuAccess || null
    };
  }),
  ```
  Note: the property name changes from `menu` (singular) to `menus` (plural).

**Files**: `GAS/resourceRegistry.gs` (lines 69, 93-102)
**Rule**: The config object property name is now `config.menus` (array), NOT `config.menu` (object). All downstream code must use `menus`.

---

### Step 3: Update `resourceRegistry.gs` — Auth Payload Builder
- [ ] In `buildAuthorizedResourceEntry()` function (around line 524-526), change:
  ```javascript
  // BEFORE
  entry.ui = {
    menu: config.menu || {},
    ...
  };
  // AFTER
  entry.ui = {
    menus: Array.isArray(config.menus) ? config.menus : [],
    fields: ...,
    ...
  };
  ```
  Specifically change line 526 from `menu: config.menu || {}` to `menus: Array.isArray(config.menus) ? config.menus : []`.

**Files**: `GAS/resourceRegistry.gs` (line 526)
**Rule**: Auth payload shape changes from `entry.ui.menu` (object) to `entry.ui.menus` (array of objects).

---

### Step 4: Update `auth.gs` — Resource Sorting
- [ ] Open `GAS/auth.gs`.
- [ ] In `sortAuthorizedResources()` (lines 218-229), the sort currently reads `a.ui.menu.order`. Change to use the **minimum order** across all menu items:
  ```javascript
  // BEFORE
  const aOrder = Number(a && a.ui && a.ui.menu ? a.ui.menu.order : 9999);
  const bOrder = Number(b && b.ui && b.ui.menu ? b.ui.menu.order : 9999);
  // AFTER
  function minOrder(entry) {
    var menus = entry && entry.ui && Array.isArray(entry.ui.menus) ? entry.ui.menus : [];
    if (menus.length === 0) return 9999;
    return menus.reduce(function(min, m) { var o = Number(m.order) || 9999; return o < min ? o : min; }, 9999);
  }
  const aOrder = minOrder(a);
  const bOrder = minOrder(b);
  ```
  The `minOrder` helper can be defined inside `sortAuthorizedResources` or just above the sort callback. The rest of the sort logic (name fallback) stays the same.

**Files**: `GAS/auth.gs` (lines 218-229)
**Rule**: Resource-level sort uses the lowest `order` among that resource's menu items.

---

### Step 5: Update `appMenu.gs` — Admin Dialog: `getResourceDetails()`
- [ ] Open `GAS/appMenu.gs`.
- [ ] In `getResourceDetails()` (lines 344-357), the code parses the Menu JSON into flat form fields (`menuGroup`, `menuOrder`, etc.). Since the admin dialog currently supports editing **one** menu item at a time, read the **first** element of the array:
  ```javascript
  // BEFORE
  if (out.menu) {
    try {
      var menuObj = typeof out.menu === 'object' ? out.menu : JSON.parse(out.menu);
      out.menuGroup = menuObj.group || '';
      ...
    } catch (e) { }
    delete out.menu;
  }
  // AFTER
  if (out.menu) {
    try {
      var menuParsed = typeof out.menu === 'string' ? JSON.parse(out.menu) : out.menu;
      var menuArr = Array.isArray(menuParsed) ? menuParsed : (menuParsed && typeof menuParsed === 'object' ? [menuParsed] : []);
      var menuObj = menuArr[0] || {};
      out.menuGroup = menuObj.group || '';
      out.menuOrder = menuObj.order || '';
      out.menuLabel = menuObj.label || '';
      out.menuIcon = menuObj.icon || '';
      out.routePath = menuObj.route || '';
      out.pageTitle = menuObj.pageTitle || '';
      out.pageDescription = menuObj.pageDescription || '';
      out.showInMenu = menuObj.show === true || menuObj.show === 'true';
      out._menuArrayFull = menuArr;   // preserve remaining items for re-save
    } catch (e) { /* invalid JSON */ }
    delete out.menu;
  }
  ```
  The `_menuArrayFull` stash preserves any additional menu items beyond the first, so `mapResource()` can recompose correctly.

**Files**: `GAS/appMenu.gs` (lines 344-357)
**Rule**: Admin form always edits the FIRST menu item. Additional menu items are preserved silently.

---

### Step 6: Update `appMenu.gs` — Admin Dialog: `mapResource()`
- [ ] In `mapResource()` (lines 429-438), change from writing a single object to writing an array:
  ```javascript
  // BEFORE
  Menu: JSON.stringify({
    group: txt(form.menuGroup),
    order: Number(form.menuOrder) || 0,
    ...
    show: boolText(form.showInMenu, true) === 'TRUE'
  }),
  // AFTER
  Menu: (function() {
    var editedItem = {
      group: txt(form.menuGroup),
      order: Number(form.menuOrder) || 0,
      label: txt(form.menuLabel),
      icon: txt(form.menuIcon),
      route: txt(form.routePath),
      pageTitle: txt(form.pageTitle),
      pageDescription: txt(form.pageDescription),
      show: boolText(form.showInMenu, true) === 'TRUE'
    };
    // Preserve additional menu items beyond the first
    var existing = Array.isArray(form._menuArrayFull) ? form._menuArrayFull.slice(1) : [];
    return JSON.stringify([editedItem].concat(existing));
  })(),
  ```
  This ensures that if a resource has 2+ menu items (like StockMovements will after Plan 2), editing via the admin dialog only modifies the first item and preserves the rest.

**Files**: `GAS/appMenu.gs` (lines 429-438)
**Rule**: Output is always `JSON.stringify([...])`. Never a bare object.

---

### Step 7: Update `appMenu.gs` — Action Manager Label
- [ ] At line 639 in `app_getActionManagerData()`, change:
  ```javascript
  // BEFORE
  label: (res.menu && res.menu.label) || res.name,
  // AFTER
  label: (Array.isArray(res.menus) && res.menus.length > 0 && res.menus[0].label) || res.name,
  ```

**Files**: `GAS/appMenu.gs` (line 639)

---

### Step 8: Update Frontend — `MainLayout.vue` Sidebar Menu Building
- [ ] Open `FRONTENT/src/layouts/MainLayout/MainLayout.vue`.
- [ ] In the `computed` or `function` that builds the grouped sidebar (lines 185-216), change from iterating resources with a single `resource.ui.menu` to iterating resources and then their `menus` array:
  ```javascript
  // BEFORE
  resources
    .filter((resource) => {
      const menu = resource?.ui?.menu
      return menu?.show !== false && menu?.route && evaluateMenuAccess(resource)
    })
    .forEach((resource) => {
      const menu = resource.ui?.menu || {}
      // ... build sidebar item from menu
    })

  // AFTER
  resources.forEach((resource) => {
    const menus = Array.isArray(resource?.ui?.menus) ? resource.ui.menus : []
    menus.forEach((menu) => {
      if (menu.show === false || !menu.route) return
      if (!evaluateMenuAccess(resource, menu)) return

      const navLabel = menu.label || resource.name
      if (menuSearchQuery.value && !navLabel.toLowerCase().includes(menuSearchQuery.value)) {
        return
      }

      const groupLabel = menu.group || 'General'
      if (!grouped[groupLabel]) {
        grouped[groupLabel] = []
      }

      grouped[groupLabel].push({
        resource: resource.name,
        routePath: menu.route,
        navLabel,
        navIcon: menu.icon || 'list_alt',
        order: Number(menu.order || 9999)
      })
    })
  })
  ```

**Files**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue` (lines 185-216)
**Rule**: Each menu item in the array becomes its own sidebar entry. Resources with an empty menus array produce no sidebar items.

---

### Step 9: Update Frontend — `useMenuAccess.js`
- [ ] Open `FRONTENT/src/composables/useMenuAccess.js`.
- [ ] The `evaluateMenuAccess(resource)` function currently reads `resource?.ui?.menu?.menuAccess` (line 50). It must now accept a **second parameter** for the specific menu item:
  ```javascript
  // BEFORE
  function evaluateMenuAccess(resource) {
    ...
    const menuAccess = resource?.ui?.menu?.menuAccess
    ...
  }
  // AFTER
  function evaluateMenuAccess(resource, menuItem = null) {
    ...
    const menuAccess = menuItem?.menuAccess ?? null
    ...
  }
  ```
  The logic after extracting `menuAccess` stays the same. The key change is: `menuAccess` comes from the specific `menuItem` parameter, not from `resource.ui.menu`.
- [ ] If `menuItem` is `null` (called from router guard or other places that don't have the specific menu item), fall back to checking `canRead` on the resource (the existing default behavior).

**Files**: `FRONTENT/src/composables/useMenuAccess.js` (line 50)
**Rule**: `menuAccess` is per-menu-item, not per-resource.

---

### Step 10: Update Frontend — `router/index.js` — Route Guard
- [ ] Open `FRONTENT/src/router/index.js`.
- [ ] At line 27, `evaluateMenuAccessInline()` reads `resource?.ui?.menu?.menuAccess`. Change to search the `menus` array for the menu item matching the current route, then read `menuAccess` from that matched item:
  ```javascript
  // BEFORE
  const menuAccess = resource?.ui?.menu?.menuAccess
  // AFTER
  const menus = Array.isArray(resource?.ui?.menus) ? resource.ui.menus : []
  const matchedMenu = menus.find(m => m.route === /* need the route path here */)
  const menuAccess = matchedMenu?.menuAccess ?? null
  ```
  However, `evaluateMenuAccessInline` doesn't currently receive the route path. There are two approaches:

  **Approach A (Recommended):** Add `routePath` as a third parameter to `evaluateMenuAccessInline`:
  ```javascript
  function evaluateMenuAccessInline(resource, allResources, routePath) {
    if (!resource) return false
    const resourceName = resource.name
    const menus = Array.isArray(resource?.ui?.menus) ? resource.ui.menus : []
    const matchedMenu = routePath ? menus.find(m => m.route === routePath) : menus[0]
    const menuAccess = matchedMenu?.menuAccess ?? null
    // ... rest stays the same
  }
  ```

- [ ] At line 103, the route matching currently does:
  ```javascript
  resources.find((r) => r?.ui?.menu?.route === to.path)
  ```
  Change to search across all menu items in each resource:
  ```javascript
  resources.find((r) => {
    const menus = Array.isArray(r?.ui?.menus) ? r.ui.menus : []
    return menus.some(m => m.route === to.path)
  })
  ```
- [ ] At line 114, pass `to.path` to `evaluateMenuAccessInline`:
  ```javascript
  // BEFORE
  const allowed = targetEntry ? evaluateMenuAccessInline(targetEntry, resources) : false
  // AFTER
  const allowed = targetEntry ? evaluateMenuAccessInline(targetEntry, resources, to.path) : false
  ```

**Files**: `FRONTENT/src/router/index.js` (lines 23-27, 103, 114)
**Rule**: Route matching must check across ALL menu items, not just a single route.

---

### Step 11: Update Frontend — `useResourceConfig.js`
- [ ] Open `FRONTENT/src/composables/useResourceConfig.js`.
- [ ] At line 25, change route matching from single menu object to scanning the array:
  ```javascript
  // BEFORE
  const entryPath = entry?.ui?.menu?.route || ''
  return entryPath === currentPath
  // AFTER
  const menus = Array.isArray(entry?.ui?.menus) ? entry.ui.menus : []
  return menus.some(m => m.route === currentPath)
  ```

**Files**: `FRONTENT/src/composables/useResourceConfig.js` (lines 24-27)
**Rule**: Route lookup scans the entire menus array.

---

### Step 12: Update Frontend — `ResourcePageShell.vue`
- [ ] Open `FRONTENT/src/pages/Masters/ResourcePageShell.vue`.
- [ ] At line 24, change:
  ```javascript
  // BEFORE
  const resourceTitle = computed(() => config.value?.ui?.menu?.pageTitle || config.value?.name || resourceSlug.value)
  // AFTER
  const resourceTitle = computed(() => {
    const menus = config.value?.ui?.menus || []
    const route = `/${scope.value}/${resourceSlug.value}`
    const matched = menus.find(m => m.route === route)
    return matched?.pageTitle || menus[0]?.pageTitle || config.value?.name || resourceSlug.value
  })
  ```
  This finds the menu item matching the current route to get the right page title.

**Files**: `FRONTENT/src/pages/Masters/ResourcePageShell.vue` (line 24)

---

### Step 13: Update Frontend — Master Components (pageTitle / pageDescription references)
The following files reference `config?.ui?.menu?.pageTitle` or `config?.ui?.menu?.pageDescription` or `resource.ui?.menu?.pageTitle`. Each must be updated to read from the `menus` array (typically the first item, since these are CRUD views that correspond to the primary menu item):

- [ ] `FRONTENT/src/components/Masters/MasterListHeader.vue` (lines 6-7):
  ```javascript
  // BEFORE
  config?.ui?.menu?.pageTitle
  config?.ui?.menu?.pageDescription
  // AFTER
  config?.ui?.menus?.[0]?.pageTitle || config?.name
  config?.ui?.menus?.[0]?.pageDescription || 'Manage records'
  ```

- [ ] `FRONTENT/src/components/Masters/MasterAddHeader.vue` (line 6):
  ```javascript
  // BEFORE
  config?.ui?.menu?.pageTitle
  // AFTER
  config?.ui?.menus?.[0]?.pageTitle || config?.name
  ```

- [ ] `FRONTENT/src/components/Masters/MasterEditHeader.vue` (line 6):
  ```javascript
  // BEFORE
  config?.ui?.menu?.pageTitle
  // AFTER
  config?.ui?.menus?.[0]?.pageTitle || config?.name
  ```

- [ ] `FRONTENT/src/components/Masters/MasterViewChildren.vue` (lines 5, 7):
  ```javascript
  // BEFORE
  childRes.ui?.menu?.pageTitle
  // AFTER
  childRes.ui?.menus?.[0]?.pageTitle || childRes.name
  ```

- [ ] `FRONTENT/src/components/Masters/MasterAddChildren.vue` (line 5):
  ```javascript
  // BEFORE
  group.resource.ui?.menu?.pageTitle
  // AFTER
  group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name
  ```

- [ ] `FRONTENT/src/components/Masters/MasterEditChildren.vue` (line 5):
  ```javascript
  // BEFORE
  group.resource.ui?.menu?.pageTitle
  // AFTER
  group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name
  ```

- [ ] `FRONTENT/src/composables/useCompositeForm.js` (line 160):
  ```javascript
  // BEFORE
  group.resource.ui?.menu?.pageTitle
  // AFTER
  group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name
  ```

**Files**: 7 files listed above
**Rule**: CRUD-context components use `menus[0]` (the primary menu item). This is safe because CRUD views always correspond to the first/primary menu entry.

---

### Step 14: Deploy GAS Changes
- [ ] Run `cd GAS && clasp push --force` to deploy all backend changes.
- [ ] Verify no push errors.

**Files**: Terminal command
**Rule**: Must use `--force` flag as this project requires it.

---

### Step 15: Sync APP.Resources Sheet
- [ ] Instruct user to open the APP spreadsheet.
- [ ] Instruct user to run `AQL > Setup & Refactor > Sync APP.Resources from Code` to apply the new array-format Menu values to the sheet.
- [ ] After sync, spot-check 2-3 resources in the sheet to confirm Menu column now contains `[{...}]` instead of `{...}`.

**Rule**: This is a user-performed manual action (Google Sheet menu click).

---

### Step 16: Smoke Test
- [ ] Instruct user to reload the frontend app.
- [ ] Verify sidebar renders correctly with all expected menu groups and items.
- [ ] Verify clicking a menu item navigates to the correct page.
- [ ] Verify page titles display correctly on list/add/edit pages.
- [ ] Verify the admin "Edit Resource" dialog still works (loads first menu item, saves without losing data).
- [ ] Verify route guard blocks unauthorized access correctly.

**Rule**: All existing behavior must be preserved. The only visual change is the data format — UI behavior is identical.

## Documentation Updates Required
- [x] Update `Documents/LOGIN_RESPONSE.md`: Change `entry.ui.menu` (object) documentation to `entry.ui.menus` (array). Update the field reference table and example payload.
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md`: Update the `Menu` column description to document the array format `[{...}, {...}]` and explain that multiple menu items per resource are now supported.
- [x] Update `Documents/APP_SHEET_STRUCTURE.md`: If the `Menu` column schema is described there, update it to array format.
- [x] Update `Documents/CONTEXT_HANDOFF.md`: Add dated entry documenting the Menu column format change.
- [x] Update `Documents/MODULE_WORKFLOWS.md`: If any workflow references `ui.menu.*`, update to `ui.menus[0].*` or `ui.menus`.

## Acceptance Criteria
- [x] All 33 resource entries in `syncAppResources.gs` use `JSON.stringify([{...}])` format.
- [x] `resourceRegistry.gs` parses Menu as array and stores `config.menus` (array).
- [x] Auth payload delivers `entry.ui.menus` (array) instead of `entry.ui.menu` (object).
- [ ] Frontend sidebar renders all menu items from all resources correctly.
- [ ] Resources with a single menu item behave identically to before (no visual change).
- [x] Route guard correctly matches routes against any menu item in the array.
- [ ] Admin "Edit Resource" dialog loads/saves correctly, preserving multi-item arrays.
- [x] `clasp push` succeeds without errors.
- [x] No `ui.menu` references remain in frontend code (all changed to `ui.menus`).
- [x] No `config.menu` references remain in GAS code (all changed to `config.menus`).

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed (syncAppResources.gs — 33 resources)
- [x] Step 2 completed (resourceRegistry.gs — parse)
- [x] Step 3 completed (resourceRegistry.gs — auth payload)
- [x] Step 4 completed (auth.gs — sorting)
- [x] Step 5 completed (appMenu.gs — getResourceDetails)
- [x] Step 6 completed (appMenu.gs — mapResource)
- [x] Step 7 completed (appMenu.gs — action manager label)
- [x] Step 8 completed (MainLayout.vue — sidebar)
- [x] Step 9 completed (useMenuAccess.js)
- [x] Step 10 completed (router/index.js — guard + route match)
- [x] Step 11 completed (useResourceConfig.js)
- [x] Step 12 completed (ResourcePageShell.vue)
- [x] Step 13 completed (7 Master components)
- [x] Step 14 completed (clasp push)
- [ ] Step 15 completed (user sync)
- [ ] Step 16 completed (smoke test)

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `GAS/resourceRegistry.gs`
- `GAS/auth.gs`
- `GAS/appMenu.gs`
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `FRONTENT/src/composables/useMenuAccess.js`
- `FRONTENT/src/router/index.js`
- `FRONTENT/src/composables/useResourceConfig.js`
- `FRONTENT/src/pages/Masters/ResourcePageShell.vue`
- `FRONTENT/src/components/Masters/MasterListHeader.vue`
- `FRONTENT/src/components/Masters/MasterAddHeader.vue`
- `FRONTENT/src/components/Masters/MasterEditHeader.vue`
- `FRONTENT/src/components/Masters/MasterViewChildren.vue`
- `FRONTENT/src/components/Masters/MasterAddChildren.vue`
- `FRONTENT/src/components/Masters/MasterEditChildren.vue`
- `FRONTENT/src/composables/useCompositeForm.js`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/APP_SHEET_STRUCTURE.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`
- `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- `Documents/QUASAR_SETUP.md`

### Validation Performed
- [x] All GAS code references `config.menus` (array), zero references to `config.menu` (object)
- [x] All frontend code references `ui.menus` (array), zero references to `ui.menu` (object)
- [x] clasp push succeeded
- [ ] Sidebar renders correctly
- [ ] Admin dialog works correctly

### Manual Actions Required
- [ ] User: Run `AQL > Setup & Refactor > Sync APP.Resources from Code` in APP spreadsheet
- [ ] User: Reload frontend app and verify sidebar
- [ ] User: Test admin "Edit Resource" dialog on any resource
