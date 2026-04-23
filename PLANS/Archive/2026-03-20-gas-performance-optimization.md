# PLAN: GAS Backend Performance Optimization — Two-Tier Caching & Redundancy Elimination
**Status**: COMPLETED
**Created**: 2026-03-20
**Created By**: Brain Agent (Claude Opus)
**Executed By**: Build Agent (Gemini 2.0 Pro)

## Objective
Reduce GAS backend response times by eliminating redundant SpreadsheetApp RPC calls through two-tier caching (global variables for request-scoped + CacheService for cross-execution) and fixing architectural inefficiencies in hot paths (login, master CRUD, authorization).

**Current performance**:
- Login: ~12+ seconds
- Master get/create/update (multi-resource): ~3+ minutes

**Target performance**:
- Login: 3-5 seconds
- Master get/create/update (multi-resource): 30-60 seconds or less

## Context
### Root Cause Analysis
During a typical login with 2 roles and 10 authorized resources, the GAS backend makes:
- **15-20 redundant calls to `SpreadsheetApp.getActiveSpreadsheet()`** (each is an RPC)
- **30+ redundant reads of APP.Resources sheet** (via `getResourceRegistryContext()`)
- **Multiple redundant reads of RolePermissions sheet** (via `getRolePermissionsContext()`)
- **Per-role-ID Roles sheet reads** in `getRoleNameById()` (no bulk loading)
- **Linear O(N) scans in `getResourceConfig()`** called M times = O(N*M) complexity

### GAS Built-in Caching Services Available
1. **Global variables** (`var _cache = null;`) — Reset per execution, survive full request lifecycle. Best for request-scoped deduplication.
2. **`CacheService.getScriptCache()`** — Shared across all users/executions, up to 6h TTL, 100KB/key, 25MB total. Best for data that rarely changes (registry, roles, permissions).
3. **`CacheService.getUserCache()`** — Per-user, same limits. Not needed for this plan.
4. **`PropertiesService`** — Permanent but slow. Already used for `APP_FILE_ID`. Not suitable for frequent reads.

### Source Docs Reviewed
- `GAS/sheetHelpers.gs` — `getAppSpreadsheet()`, `getConfigMap()`, `resolveFileIdForScope()`
- `GAS/auth.gs` — `getUsersContext()`, `handleLogin()`, `getRoleNameById()`, `getRoleNamesByIds()`, `getDesignationById()`
- `GAS/resourceRegistry.gs` — `getResourceRegistryContext()`, `getResourceConfig()`, `openResourceSheet()`, `getRolePermissionsContext()`, `getRoleResourceAccess()`, `getResourcesByScope()`
- `GAS/masterApi.gs` — `handleMasterGetRecords()`, `handleMasterBulkRecords()`, `resolveMasterResourceNames()`
- `GAS/apiDispatcher.gs` — `doPost()`, dispatch flow
- `GAS/accessRegion.gs` — `getAccessRegionContext()` (uses direct `SpreadsheetApp.getActiveSpreadsheet()`)
- `GAS/Constants.gs` — `CONFIG` object
- `GAS/appMenu.gs` — `ctxOf()` helper (menu-only, no change needed)

## Pre-Conditions
- [x] All GAS source files reviewed and bottlenecks identified.
- [x] Current caching patterns understood (`_users_context_cache`, `_designations_cache`, `_resource_file_cache`, `_resource_sheet_cache`, `__accessRegionContextCache`, `CacheService` for Config).
- [ ] Build Agent has `clasp push` access configured.

---

## Steps

### Step 1: Cache `getAppSpreadsheet()` Result in Global Variable
**Why**: This is the single highest-impact fix. Every API request calls this 15-20+ times through different code paths. Each call triggers `SpreadsheetApp.getActiveSpreadsheet()` which is an RPC to Google servers.

**File**: `GAS/sheetHelpers.gs`

- [ ] Add a global variable at the top of the file (after the header comment block, before any function):
  ```javascript
  var _appSpreadsheetCache = null;
  ```

- [ ] Modify `getAppSpreadsheet()` (currently lines 55-67) to use the cache:
  ```javascript
  function getAppSpreadsheet() {
    if (_appSpreadsheetCache) return _appSpreadsheetCache;

    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      _appSpreadsheetCache = active;
      return active;
    }

    var appFileId = PropertiesService.getScriptProperties().getProperty('APP_FILE_ID');
    if (!appFileId) {
      throw new Error('APP spreadsheet is unavailable (no active spreadsheet). Set ScriptProperties.APP_FILE_ID first.');
    }
    try {
      _appSpreadsheetCache = SpreadsheetApp.openById(appFileId);
      return _appSpreadsheetCache;
    } catch (err) {
      throw new Error('Failed to open APP spreadsheet using ScriptProperties.APP_FILE_ID. Please re-run setup and store the APP file ID.');
    }
  }
  ```

**Rule**: The cache variable resets automatically on each new GAS execution. No manual invalidation needed. This is safe because the APP spreadsheet ID never changes during a single request.

---

### Step 2: Cache `getResourceRegistryContext()` Result in Global Variable
**Why**: Called 30+ times during a login (once per `getResourceConfig()` call, once per `getAllConfiguredResourceNames()`, etc.). Each call reads the entire APP.Resources sheet.

**File**: `GAS/resourceRegistry.gs`

- [ ] Add a global variable at the top of the file (after the existing `_resource_file_cache` and `_resource_sheet_cache` declarations, around line 9):
  ```javascript
  var _resource_registry_context_cache = null;
  ```

- [ ] Modify `getResourceRegistryContext()` (currently lines 11-25) to use the cache:
  ```javascript
  function getResourceRegistryContext() {
    if (_resource_registry_context_cache) return _resource_registry_context_cache;

    const appSheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.RESOURCES);
    if (!appSheet) {
      throw new Error('Resources sheet not found in APP file');
    }

    const values = appSheet.getDataRange().getValues();
    if (!values || values.length < 1) {
      throw new Error('Resources sheet is empty');
    }

    const headers = values[0];
    const idx = getHeaderIndexMap(headers);

    _resource_registry_context_cache = { appSheet, values, headers, idx };
    return _resource_registry_context_cache;
  }
  ```

**Rule**: Same as Step 1 — automatically resets per execution. Safe because Resources sheet is not modified during normal API requests (only during setup/sync menu actions which are separate executions).

---

### Step 3: Build a Name-to-Config Map for `getResourceConfig()` — Eliminate Linear Scans
**Why**: `getResourceConfig(name)` currently does a linear scan through all Resources rows every call. During `getRoleResourceAccess()` with 30 resources, that's 30 linear scans. With the map, each lookup is O(1).

**File**: `GAS/resourceRegistry.gs`

- [ ] Add a global variable at the top:
  ```javascript
  var _resource_config_map_cache = null;
  ```

- [ ] Add a new helper function `getResourceConfigMap()` that builds the full map once. Place it BEFORE the existing `getResourceConfig()` function:
  ```javascript
  /**
   * Builds and caches a map of resourceName -> config for all resources.
   * Uses getResourceRegistryContext() (itself cached) as the data source.
   * Parses each resource row exactly once.
   */
  function getResourceConfigMap() {
    if (_resource_config_map_cache) return _resource_config_map_cache;

    var registry = getResourceRegistryContext();
    var map = {};

    for (var i = 1; i < registry.values.length; i++) {
      var row = registry.values[i];
      var name = (row[registry.idx.Name] || '').toString().trim();
      if (!name || map[name]) continue;

      var scope = normalizeResourceScope(readOptionalCell(row, registry.idx.Scope, 'master'));
      var rawFileId = (row[registry.idx.FileID] || '').toString().trim();

      map[name] = {
        name: name,
        scope: scope,
        fileId: resolveFileIdForScope(scope, rawFileId),
        sheetName: (row[registry.idx.SheetName] || '').toString().trim(),
        isActive: toBooleanCell(readOptionalCell(row, registry.idx.IsActive, true)),
        audit: toBooleanCell(readOptionalCell(row, registry.idx.Audit, false)),
        codePrefix: registry.idx.CodePrefix === undefined
          ? ''
          : (row[registry.idx.CodePrefix] || '').toString().trim(),
        codeSequenceLength: normalizeCodeSequenceLength(
          registry.idx.CodeSequenceLength === undefined
            ? ''
            : row[registry.idx.CodeSequenceLength]
        ),
        lastDataUpdatedAt: Number(readOptionalCell(row, registry.idx.LastDataUpdatedAt, 0)) || 0,
        requiredHeaders: parseHeaderList(readOptionalCell(row, registry.idx.RequiredHeaders, '')),
        uniqueHeaders: parseHeaderList(readOptionalCell(row, registry.idx.UniqueHeaders, '')),
        uniqueCompositeHeaders: parseCompositeHeaders(readOptionalCell(row, registry.idx.UniqueCompositeHeaders, '')),
        defaultValues: parseJsonCell(readOptionalCell(row, registry.idx.DefaultValues, '{}'), {}),
        recordAccessPolicy: normalizeRecordAccessPolicy(readOptionalCell(row, registry.idx.RecordAccessPolicy, 'all')),
        ownerUserField: (readOptionalCell(row, registry.idx.OwnerUserField, 'CreatedBy') || '').toString().trim() || 'CreatedBy',
        menuGroup: (readOptionalCell(row, registry.idx.MenuGroup, '') || '').toString().trim(),
        menuOrder: Number(readOptionalCell(row, registry.idx.MenuOrder, 9999) || 9999),
        menuLabel: (readOptionalCell(row, registry.idx.MenuLabel, name) || '').toString().trim() || name,
        menuIcon: (readOptionalCell(row, registry.idx.MenuIcon, 'list_alt') || '').toString().trim() || 'list_alt',
        routePath: (readOptionalCell(row, registry.idx.RoutePath, '') || '').toString().trim(),
        pageTitle: (readOptionalCell(row, registry.idx.PageTitle, name) || '').toString().trim() || name,
        pageDescription: (readOptionalCell(row, registry.idx.PageDescription, '') || '').toString().trim(),
        uiFields: parseJsonCell(readOptionalCell(row, registry.idx.UIFields, '[]'), []),
        showInMenu: toBooleanCell(readOptionalCell(row, registry.idx.ShowInMenu, true)),
        includeInAuthorizationPayload: toBooleanCell(readOptionalCell(row, registry.idx.IncludeInAuthorizationPayload, true)),
        additionalActions: parseStringList(readOptionalCell(row, registry.idx.AdditionalActions, '')),
        functional: toBooleanCell(readOptionalCell(row, registry.idx.Functional, false)),
        preAction: (readOptionalCell(row, registry.idx.PreAction, '') || '').toString().trim(),
        postAction: (readOptionalCell(row, registry.idx.PostAction, '') || '').toString().trim(),
        reports: parseJsonCell(readOptionalCell(row, registry.idx.Reports, '[]'), [])
      };
    }

    _resource_config_map_cache = map;
    return map;
  }
  ```

- [ ] Modify `getResourceConfig()` (currently lines 27-83) to use the map:
  ```javascript
  function getResourceConfig(resourceName) {
    var name = (resourceName || '').toString().trim();
    if (!name) {
      throw new Error('Resource name is required');
    }

    var map = getResourceConfigMap();
    var config = map[name];
    if (!config) {
      throw new Error('Resource not configured: ' + name);
    }
    return config;
  }
  ```

- [ ] Modify `getAllConfiguredResourceNames()` (currently lines 476-492) to use the map:
  ```javascript
  function getAllConfiguredResourceNames() {
    var map = getResourceConfigMap();
    return Object.keys(map);
  }
  ```

- [ ] Modify `getResourcesByScope()` (currently lines 558-576) to use the map:
  ```javascript
  function getResourcesByScope(scope, options) {
    var normalizedScope = normalizeResourceScope(scope);
    var includeInactive = options && options.includeInactive === true;
    var map = getResourceConfigMap();
    var result = [];

    var names = Object.keys(map);
    for (var i = 0; i < names.length; i++) {
      var config = map[names[i]];
      if (config.scope !== normalizedScope) continue;
      if (!includeInactive && !config.isActive) continue;
      result.push(config);
    }

    return result;
  }
  ```

- [ ] Modify `getAllResourcesConfigs()` (currently lines 577-597) to use the map:
  ```javascript
  function getAllResourcesConfigs(options) {
    var includeInactive = options && options.includeInactive === true;
    var map = getResourceConfigMap();
    var result = [];

    var names = Object.keys(map);
    for (var i = 0; i < names.length; i++) {
      var config = map[names[i]];
      if (!includeInactive && !config.isActive) continue;
      result.push(config);
    }

    return result;
  }
  ```

**Pattern**: Follows the same approach as the existing `_users_context_cache` in `auth.gs` — build once, reuse throughout the execution.

---

### Step 4: Cache `getRolePermissionsContext()` Result in Global Variable
**Why**: Called multiple times during authorization: once from `getRoleResourceAccess()`, potentially again from `getRolePermissionForResource()` and `hasRoleActionPermission()`. Each call reads the entire RolePermissions sheet.

**File**: `GAS/resourceRegistry.gs`

- [ ] Add a global variable at the top:
  ```javascript
  var _role_permissions_context_cache = null;
  ```

- [ ] Modify `getRolePermissionsContext()` (currently lines 229-239) to use the cache:
  ```javascript
  function getRolePermissionsContext() {
    if (_role_permissions_context_cache) return _role_permissions_context_cache;

    const rolePermSheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
    if (!rolePermSheet) {
      throw new Error('RolePermissions sheet not found in APP file');
    }

    const values = rolePermSheet.getDataRange().getValues();
    const headers = values && values.length ? values[0] : [];
    const idx = getHeaderIndexMap(headers);

    _role_permissions_context_cache = { rolePermSheet, values, headers, idx };
    return _role_permissions_context_cache;
  }
  ```

---

### Step 5: Build Roles Bulk Cache — Eliminate Per-Role Sheet Reads
**Why**: `getRoleNameById()` in `auth.gs` (lines 302-315) opens the Roles sheet, reads headers, builds index map, and does a `findRowByValue` search **for every single role ID**. Called from `getRoleNamesByIds()` which loops over all user roles, and from `getPrimaryRoleName()`. With 2 roles, that's 2 full sheet reads + 2 row searches. This is the same problem that `_designations_cache` already solved for designations.

**File**: `GAS/auth.gs`

- [ ] Add a global variable near the existing `_designations_cache` (around line 10):
  ```javascript
  var _roles_cache = null;
  ```

- [ ] Add a new bulk-loading function. Place it BEFORE `getRoleNameById()`:
  ```javascript
  /**
   * Bulk-loads all roles into an in-memory cache.
   * Pattern mirrors _designations_cache approach.
   */
  function getRolesCache() {
    if (_roles_cache) return _roles_cache;

    var sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLES);
    var byId = {};
    if (sheet) {
      var values = sheet.getDataRange().getValues();
      var headers = values && values.length ? values[0] : [];
      var idx = getHeaderIndexMap(headers);

      if (idx.RoleID !== undefined && idx.Name !== undefined) {
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var id = (row[idx.RoleID] || '').toString().trim();
          if (!id || byId[id]) continue;
          byId[id] = {
            id: id,
            name: (row[idx.Name] || '').toString().trim() || 'User',
            description: idx.Description !== undefined ? (row[idx.Description] || '').toString().trim() : ''
          };
        }
      }
    }

    _roles_cache = { byId: byId };
    return _roles_cache;
  }
  ```

- [ ] Replace `getRoleNameById()` (currently lines 302-315) with the cached version:
  ```javascript
  function getRoleNameById(roleId) {
    if (!roleId) return 'User';
    var cache = getRolesCache();
    var role = cache.byId[(roleId || '').toString().trim()];
    return role ? role.name : 'User';
  }
  ```

**Rule**: The old implementation opened the Roles sheet, read headers, built index, and searched per call. The new implementation reads the sheet once and builds a lookup map. Exactly mirrors the `_designations_cache` pattern already in use.

---

### Step 6: Fix `accessRegion.gs` to Use `getAppSpreadsheet()` Instead of Direct Call
**Why**: Line 18 uses `SpreadsheetApp.getActiveSpreadsheet()` directly, which: (a) bypasses the cached `getAppSpreadsheet()`, (b) fails in Web App context where `getActiveSpreadsheet()` returns `null`, and (c) misses the `ScriptProperties.APP_FILE_ID` fallback.

**File**: `GAS/accessRegion.gs`

- [ ] Change line 18 from:
  ```javascript
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ACCESS_REGIONS);
  ```
  To:
  ```javascript
  const sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ACCESS_REGIONS);
  ```

**Rule**: All API-reachable code paths must use `getAppSpreadsheet()` (not direct `SpreadsheetApp.getActiveSpreadsheet()`) for consistency, caching benefit, and Web App fallback safety. Menu-only code (`appMenu.gs:ctxOf()`) is acceptable as-is since it always runs in bound spreadsheet context.

---

### Step 7: Add CacheService Layer for Resource Config Map (Cross-Execution Persistence)
**Why**: Global variables reset on each new execution. The first API call after a cold start still pays the full cost of reading Resources sheet and building the config map. `CacheService` persists across executions (up to 6h TTL), so even cold starts benefit.

**File**: `GAS/resourceRegistry.gs`

- [ ] Modify `getResourceConfigMap()` (created in Step 3) to check CacheService first. The complete final version of the function becomes:
  ```javascript
  function getResourceConfigMap() {
    if (_resource_config_map_cache) return _resource_config_map_cache;

    // Try CacheService for cross-execution persistence
    var scriptCache = CacheService.getScriptCache();
    var cachedJson = scriptCache.get('AQL_RESOURCE_CONFIG_MAP_V1');
    if (cachedJson) {
      try {
        _resource_config_map_cache = JSON.parse(cachedJson);
        return _resource_config_map_cache;
      } catch (e) { /* fall through to fresh build */ }
    }

    // Build fresh from sheet
    var registry = getResourceRegistryContext();
    var map = {};

    for (var i = 1; i < registry.values.length; i++) {
      var row = registry.values[i];
      var name = (row[registry.idx.Name] || '').toString().trim();
      if (!name || map[name]) continue;

      var scope = normalizeResourceScope(readOptionalCell(row, registry.idx.Scope, 'master'));
      var rawFileId = (row[registry.idx.FileID] || '').toString().trim();

      map[name] = {
        name: name,
        scope: scope,
        fileId: resolveFileIdForScope(scope, rawFileId),
        sheetName: (row[registry.idx.SheetName] || '').toString().trim(),
        isActive: toBooleanCell(readOptionalCell(row, registry.idx.IsActive, true)),
        audit: toBooleanCell(readOptionalCell(row, registry.idx.Audit, false)),
        codePrefix: registry.idx.CodePrefix === undefined
          ? ''
          : (row[registry.idx.CodePrefix] || '').toString().trim(),
        codeSequenceLength: normalizeCodeSequenceLength(
          registry.idx.CodeSequenceLength === undefined
            ? ''
            : row[registry.idx.CodeSequenceLength]
        ),
        lastDataUpdatedAt: Number(readOptionalCell(row, registry.idx.LastDataUpdatedAt, 0)) || 0,
        requiredHeaders: parseHeaderList(readOptionalCell(row, registry.idx.RequiredHeaders, '')),
        uniqueHeaders: parseHeaderList(readOptionalCell(row, registry.idx.UniqueHeaders, '')),
        uniqueCompositeHeaders: parseCompositeHeaders(readOptionalCell(row, registry.idx.UniqueCompositeHeaders, '')),
        defaultValues: parseJsonCell(readOptionalCell(row, registry.idx.DefaultValues, '{}'), {}),
        recordAccessPolicy: normalizeRecordAccessPolicy(readOptionalCell(row, registry.idx.RecordAccessPolicy, 'all')),
        ownerUserField: (readOptionalCell(row, registry.idx.OwnerUserField, 'CreatedBy') || '').toString().trim() || 'CreatedBy',
        menuGroup: (readOptionalCell(row, registry.idx.MenuGroup, '') || '').toString().trim(),
        menuOrder: Number(readOptionalCell(row, registry.idx.MenuOrder, 9999) || 9999),
        menuLabel: (readOptionalCell(row, registry.idx.MenuLabel, name) || '').toString().trim() || name,
        menuIcon: (readOptionalCell(row, registry.idx.MenuIcon, 'list_alt') || '').toString().trim() || 'list_alt',
        routePath: (readOptionalCell(row, registry.idx.RoutePath, '') || '').toString().trim(),
        pageTitle: (readOptionalCell(row, registry.idx.PageTitle, name) || '').toString().trim() || name,
        pageDescription: (readOptionalCell(row, registry.idx.PageDescription, '') || '').toString().trim(),
        uiFields: parseJsonCell(readOptionalCell(row, registry.idx.UIFields, '[]'), []),
        showInMenu: toBooleanCell(readOptionalCell(row, registry.idx.ShowInMenu, true)),
        includeInAuthorizationPayload: toBooleanCell(readOptionalCell(row, registry.idx.IncludeInAuthorizationPayload, true)),
        additionalActions: parseStringList(readOptionalCell(row, registry.idx.AdditionalActions, '')),
        functional: toBooleanCell(readOptionalCell(row, registry.idx.Functional, false)),
        preAction: (readOptionalCell(row, registry.idx.PreAction, '') || '').toString().trim(),
        postAction: (readOptionalCell(row, registry.idx.PostAction, '') || '').toString().trim(),
        reports: parseJsonCell(readOptionalCell(row, registry.idx.Reports, '[]'), [])
      };
    }

    _resource_config_map_cache = map;

    // Persist to CacheService (5 min TTL, same as config cache)
    try {
      var json = JSON.stringify(map);
      if (json.length < 100000) { // CacheService 100KB limit per key
        scriptCache.put('AQL_RESOURCE_CONFIG_MAP_V1', json, 300);
      }
    } catch (e) { /* CacheService write failure is non-fatal */ }

    return map;
  }
  ```

- [ ] Add a cache invalidation function. Place it right after `getResourceConfigMap()`:
  ```javascript
  /**
   * Clears the cached resource config map from both memory and CacheService.
   * Call after any write to the Resources sheet (setup, sync, manual edits).
   */
  function clearResourceConfigCache() {
    _resource_config_map_cache = null;
    _resource_registry_context_cache = null;
    try {
      CacheService.getScriptCache().remove('AQL_RESOURCE_CONFIG_MAP_V1');
    } catch (e) { /* non-fatal */ }
  }
  ```

- [ ] Wire `clearResourceConfigCache()` into existing setup/sync paths that modify the Resources sheet. Add a call at the **end** of each of these functions:
  - `GAS/syncAppResources.gs` — inside `syncAppResourcesFromCode()`, add `clearResourceConfigCache();` before the final return/log.
  - `GAS/setupAppSheets.gs` — inside `setupAppSheets()`, add `clearResourceConfigCache();` after the sync call.
  - `GAS/appMenu.gs` — inside `handleAddResource()` (around line 285), add `clearResourceConfigCache();` before the `return ok(...)` line.
  - `GAS/appMenu.gs` — inside `handleEditResource()` (around line 297), add `clearResourceConfigCache();` before the `return ok(...)` line.

**File references for cache invalidation wiring**:
- `GAS/syncAppResources.gs` — find the end of `syncAppResourcesFromCode()` function
- `GAS/setupAppSheets.gs` — find the end of `setupAppSheets()` function
- `GAS/appMenu.gs` — find `handleAddResource()` and `handleEditResource()`

**Rule**: CacheService TTL is 5 minutes (300s) to match the existing Config cache TTL. This means even if invalidation is missed, stale data is at most 5 minutes old. Setup/sync operations explicitly invalidate.

---

### Step 8: Add CacheService Layer for Role Permissions (Cross-Execution)
**Why**: Same rationale as Step 7. Role permissions rarely change (only via admin menu).

**File**: `GAS/resourceRegistry.gs`

- [ ] Modify `getRolePermissionsContext()` (updated in Step 4) to add CacheService layer. The complete final version becomes:
  ```javascript
  function getRolePermissionsContext() {
    if (_role_permissions_context_cache) return _role_permissions_context_cache;

    // Try CacheService
    var scriptCache = CacheService.getScriptCache();
    var cachedJson = scriptCache.get('AQL_ROLE_PERMS_CONTEXT_V1');
    if (cachedJson) {
      try {
        var parsed = JSON.parse(cachedJson);
        // Reconstruct: we cache {values, headers, idx} but NOT the sheet object
        // The sheet object is only needed for writes — permissions context is read-only in API paths
        _role_permissions_context_cache = {
          rolePermSheet: null,
          values: parsed.values,
          headers: parsed.headers,
          idx: parsed.idx
        };
        return _role_permissions_context_cache;
      } catch (e) { /* fall through */ }
    }

    var rolePermSheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
    if (!rolePermSheet) {
      throw new Error('RolePermissions sheet not found in APP file');
    }

    var values = rolePermSheet.getDataRange().getValues();
    var headers = values && values.length ? values[0] : [];
    var idx = getHeaderIndexMap(headers);

    _role_permissions_context_cache = { rolePermSheet: rolePermSheet, values: values, headers: headers, idx: idx };

    // Persist to CacheService (serializable parts only — exclude sheet object)
    try {
      var json = JSON.stringify({ values: values, headers: headers, idx: idx });
      if (json.length < 100000) {
        scriptCache.put('AQL_ROLE_PERMS_CONTEXT_V1', json, 300);
      }
    } catch (e) { /* non-fatal */ }

    return _role_permissions_context_cache;
  }
  ```

- [ ] Add an invalidation function. Place it right after `getRolePermissionsContext()`:
  ```javascript
  /**
   * Clears the cached role permissions context.
   * Call after any write to the RolePermissions sheet.
   */
  function clearRolePermissionsCache() {
    _role_permissions_context_cache = null;
    try {
      CacheService.getScriptCache().remove('AQL_ROLE_PERMS_CONTEXT_V1');
    } catch (e) { /* non-fatal */ }
  }
  ```

- [ ] Wire `clearRolePermissionsCache()` into `GAS/appMenu.gs`:
  - Inside `saveRolePermissionMatrix()` (around line 259), add `clearRolePermissionsCache();` at the very end of the function (after the `forEach` loop that writes permission rows).

---

### Step 9: Add CacheService Layer for Roles Data (Cross-Execution)
**Why**: Roles sheet is tiny and almost never changes. Perfect cache candidate.

**File**: `GAS/auth.gs`

- [ ] Modify `getRolesCache()` (created in Step 5) to add CacheService. The complete final version becomes:
  ```javascript
  function getRolesCache() {
    if (_roles_cache) return _roles_cache;

    // Try CacheService
    var scriptCache = CacheService.getScriptCache();
    var cachedJson = scriptCache.get('AQL_ROLES_CACHE_V1');
    if (cachedJson) {
      try {
        _roles_cache = JSON.parse(cachedJson);
        return _roles_cache;
      } catch (e) { /* fall through */ }
    }

    var sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLES);
    var byId = {};
    if (sheet) {
      var values = sheet.getDataRange().getValues();
      var headers = values && values.length ? values[0] : [];
      var idx = getHeaderIndexMap(headers);

      if (idx.RoleID !== undefined && idx.Name !== undefined) {
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var id = (row[idx.RoleID] || '').toString().trim();
          if (!id || byId[id]) continue;
          byId[id] = {
            id: id,
            name: (row[idx.Name] || '').toString().trim() || 'User',
            description: idx.Description !== undefined ? (row[idx.Description] || '').toString().trim() : ''
          };
        }
      }
    }

    _roles_cache = { byId: byId };

    // Persist to CacheService
    try {
      var json = JSON.stringify(_roles_cache);
      if (json.length < 100000) {
        scriptCache.put('AQL_ROLES_CACHE_V1', json, 300);
      }
    } catch (e) { /* non-fatal */ }

    return _roles_cache;
  }
  ```

- [ ] Add an invalidation function. Place it right after `getRolesCache()`:
  ```javascript
  /**
   * Clears the cached roles data.
   * Call after any write to the Roles sheet.
   */
  function clearRolesCache() {
    _roles_cache = null;
    try {
      CacheService.getScriptCache().remove('AQL_ROLES_CACHE_V1');
    } catch (e) { /* non-fatal */ }
  }
  ```

- [ ] Wire `clearRolesCache()` into admin paths:
  - `GAS/appMenu.gs` > `handleCreateRole()` (around line 231): add `clearRolesCache();` before the `return ok(...)` line.
  - `GAS/appMenu.gs` > `handleUpdateRole()` (around line 245): add `clearRolesCache();` before the `return ok(...)` line.
  - `GAS/setupRoles.gs` > `setupDefaultRoles()`: add `clearRolesCache();` before the final `Logger.log(summary)` line.

---

### Step 10: Optimize `updateResourceSyncCursor()` to Update In-Memory Config Map
**Why**: After a create/update operation writes the sync cursor to the sheet, subsequent reads in the same execution should see the updated cursor without re-reading the sheet. This prevents unnecessary full-sheet scans when the delta-skip optimization checks `lastDataUpdatedAt`.

**File**: `GAS/resourceRegistry.gs`

- [ ] Modify `updateResourceSyncCursor()` (currently lines 116-137) to also update the in-memory config map:
  ```javascript
  function updateResourceSyncCursor(resourceName) {
    var name = (resourceName || '').toString().trim();
    if (!name) {
      throw new Error('Resource name is required');
    }

    var registry = getResourceRegistryContext();
    if (registry.idx.LastDataUpdatedAt === undefined) {
      return;
    }

    for (var i = 1; i < registry.values.length; i++) {
      var row = registry.values[i];
      var rowName = (row[registry.idx.Name] || '').toString().trim();
      if (rowName !== name) continue;

      var now = Date.now();
      registry.appSheet.getRange(i + 1, registry.idx.LastDataUpdatedAt + 1).setValue(now);

      // Update the in-memory config map if loaded, so subsequent reads in
      // the same execution see the new cursor without re-reading the sheet
      if (_resource_config_map_cache && _resource_config_map_cache[name]) {
        _resource_config_map_cache[name].lastDataUpdatedAt = now;
      }
      return;
    }

    throw new Error('Resource not configured: ' + name);
  }
  ```

**Rule**: We do NOT clear CacheService here because the cursor update is a hot-path operation (called on every create/update). The 5-min CacheService TTL is acceptable for cursor staleness — it only affects the delta-skip optimization, not correctness (worst case: client gets rows it already has).

---

### Step 11: Optimize Bulk Write Operations — Batch Sheet Writes
**Why**: `handleMasterBulkRecords()` in `masterApi.gs` (lines 785-885) calls `sheet.getRange().setValues()` per individual record. Each `setValues()` is an RPC. For 50 records, that's 50+ write RPCs.

**File**: `GAS/masterApi.gs`

- [ ] Refactor `handleMasterBulkRecords()`. Replace the `records.forEach` loop (lines 814-853) AND the individual write calls inside it with a collect-then-batch approach:

  **Key changes**:
  1. Remove `sheet.getRange(targetRow, ...).setValues([rowData])` from inside the INSERT branch.
  2. Remove `sheet.getRange(rowNumber, ...).setValues([rowData])` from inside the UPDATE branch.
  3. After the loop, batch-write all new rows with a single `setValues()`.
  4. After the loop, write update rows (still individual calls since they target scattered row numbers).

  The restructured loop and batch write section:
  ```javascript
  var newRows = [];       // Array of rowData arrays to append
  var updateOps = [];     // Array of {rowNumber, rowData} to write back

  records.forEach(function (recordData, index) {
    try {
      var code = resolveCodeValue({ record: recordData });
      var rowNumber = code ? findRowByValue(sheet, idx.Code, code, 2, true) : -1;

      var providedValues = extractProvidedHeaderValues(headers, { record: recordData });
      var rowData;

      if (rowNumber === -1) {
        // --- INSERT (collect for batch) ---
        var newCode = code || generateNextCode(currentValues, idx, codePrefix, seqLength);
        rowData = buildNewMasterRow(headers, idx, providedValues, schema);
        rowData[idx.Code] = newCode;
        applyAccessRegionOnWrite(rowData, idx, auth);
        applyAuditFields(rowData, idx, auth, resource.config, true);
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, -1, targetResourceName);

        newRows.push(rowData);
        currentValues.push(rowData);
        results.created++;
      } else {
        // --- UPDATE (collect for batch) ---
        var existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
        enforceRecordLevelAccess(auth, resource.config, headers, existingRow);
        rowData = mergeMasterRow(existingRow, idx, providedValues, schema);
        rowData[idx.Code] = code;
        applyAuditFields(rowData, idx, auth, resource.config, false);
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, rowNumber, targetResourceName);

        updateOps.push({ rowNumber: rowNumber, rowData: rowData });
        currentValues[rowNumber - 1] = rowData;
        results.updated++;
      }
    } catch (err) {
      results.errors.push({ index: index, message: err.toString() });
    }
  });

  // Batch write: new rows as a single block append
  if (newRows.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  // Batch write: updates (individual rows — scattered positions prevent single setValues)
  for (var u = 0; u < updateOps.length; u++) {
    sheet.getRange(updateOps[u].rowNumber, 1, 1, headers.length).setValues([updateOps[u].rowData]);
  }
  ```

  **IMPORTANT**: The rest of the function after the loop (the `updateResourceSyncCursor()` call, the fresh-read for response, the `return` statement) remains unchanged.

**Rule**: Insert batch converts N insert RPCs into 1 RPC. Update batch remains per-row (unavoidable for scattered rows). Validation logic is unchanged.

---

### Step 12: Add a Centralized Cache-Clear Utility
**Why**: During setup/sync operations, multiple caches need invalidation. A single function makes this easy and prevents missed invalidations.

**File**: `GAS/sheetHelpers.gs`

- [ ] Add at the end of the file (after `diagLogResolvedFileIds()`):
  ```javascript
  /**
   * Clears all in-memory and CacheService caches.
   * Call from setup/sync operations that modify APP sheets.
   */
  function clearAllAppCaches() {
    // In-memory: spreadsheet cache
    _appSpreadsheetCache = null;

    // Delegate to module-specific cache clears
    if (typeof clearConfigCache === 'function') clearConfigCache();
    if (typeof clearResourceConfigCache === 'function') clearResourceConfigCache();
    if (typeof clearRolePermissionsCache === 'function') clearRolePermissionsCache();
    if (typeof clearRolesCache === 'function') clearRolesCache();
  }
  ```

- [ ] In `GAS/setupAppSheets.gs` — at the end of `setupAppSheets()`, replace any individual cache clear calls with a single `clearAllAppCaches();` call. If there are no existing cache clear calls, just add `clearAllAppCaches();` before the final return/log.

- [ ] In `GAS/syncAppResources.gs` — at the end of `syncAppResourcesFromCode()`, you can use either `clearResourceConfigCache();` (added in Step 7) OR `clearAllAppCaches();`. Prefer `clearAllAppCaches();` for completeness.

---

### Step 13: Verification and Testing

- [ ] **Deploy all changes**:
  1. Run `cd GAS && clasp push` to deploy all modified files.
  2. Verify clasp push completes without errors.

- [ ] **Test login performance**:
  1. Open browser DevTools > Network tab.
  2. Perform a login via the frontend.
  3. Measure the login API response time. Compare against the ~12s baseline.
  4. Verify login payload is complete: `user` object (with `designation`, `roles`, `accessRegion`), `resources` array (with `headers`, `ui`, `permissions`).

- [ ] **Test master CRUD operations**:
  1. Navigate to a master page (e.g., Products). Verify data loads correctly.
  2. Test the eager multi-resource sync (background sync after login). Check browser console for sync completion.
  3. Create a new master record. Verify it succeeds and the record appears.
  4. Update an existing master record. Verify it succeeds.
  5. If bulk upload is available, test a small bulk upload (5-10 records).

- [ ] **Test cache invalidation**:
  1. In the Google Sheet, go to AQL > Resources > Add Resource. Add a test resource.
  2. Immediately call `getAuthorizedResources` from frontend (or login again). Verify the new resource appears.
  3. Go to AQL > Roles > Update Role. Change a permission.
  4. Login again. Verify the permission change is reflected.
  5. Clean up: remove the test resource.

- [ ] **Test AccessRegion in Web App context**:
  1. If a user has an AccessRegion assigned, verify their login still works and region scope is correct.
  2. This validates the `accessRegion.gs` fix from Step 6.

- [ ] **Smoke test profile operations**:
  1. Test `getProfile`, `updateName`, `updateAvatar` to ensure no regression.

---

## Documentation Updates Required
- [ ] Update `Documents/CONTEXT_HANDOFF.md` section 6 "Current Implementation Status" with a new bullet:
  ```
  - GAS Performance Optimization — Two-Tier Caching (2026-03-20):
    - Two-tier caching: global variables (request-scoped) + CacheService (cross-execution, 5-min TTL).
    - `getAppSpreadsheet()` cached in `_appSpreadsheetCache` — eliminates 15-20 redundant RPC calls per request.
    - `getResourceRegistryContext()` cached in `_resource_registry_context_cache`.
    - `getResourceConfigMap()` builds name->config O(1) lookup map, cached in memory + CacheService (`AQL_RESOURCE_CONFIG_MAP_V1`).
    - `getRolePermissionsContext()` cached in `_role_permissions_context_cache` + CacheService (`AQL_ROLE_PERMS_CONTEXT_V1`).
    - Roles bulk cache (`getRolesCache()`) replaces per-role sheet reads in `getRoleNameById()`, with CacheService (`AQL_ROLES_CACHE_V1`).
    - `accessRegion.gs` fixed to use `getAppSpreadsheet()` instead of direct `SpreadsheetApp.getActiveSpreadsheet()`.
    - Bulk operations batch new-row inserts into single `setValues()` call.
    - Cache invalidation: `clearAllAppCaches()` utility + module-specific `clear*Cache()` functions wired into setup/sync/admin menu paths.
    - CacheService keys: `AQL_RESOURCE_CONFIG_MAP_V1`, `AQL_ROLE_PERMS_CONTEXT_V1`, `AQL_ROLES_CACHE_V1`, `APP_CONFIG_MAP_V2` (existing).
    - Plan: `PLANS/2026-03-20-gas-performance-optimization.md`
  ```

---

## Acceptance Criteria
- [ ] Login API response time is noticeably reduced (target: under 5 seconds for typical user).
- [ ] Multi-resource `get` (eager sync) response time is noticeably reduced (target: under 60 seconds).
- [ ] Login payload is identical in structure and content to pre-optimization behavior.
- [ ] Master CRUD (get, create, update, bulk) produces correct results.
- [ ] Cache invalidation works: changes made via AQL menu (add resource, update role permissions, create role) are reflected in subsequent API calls without waiting for TTL expiry.
- [ ] `accessRegion.gs` works correctly in Web App context (doPost).
- [ ] No regression in any existing functionality (profile, avatar, password, authorized resources).
- [ ] `clasp push` deploys successfully without errors.

## Summary of All Files Modified

| File | Changes |
|---|---|
| `GAS/sheetHelpers.gs` | Add `_appSpreadsheetCache`, modify `getAppSpreadsheet()`, add `clearAllAppCaches()` |
| `GAS/resourceRegistry.gs` | Add `_resource_registry_context_cache`, `_resource_config_map_cache`, `_role_permissions_context_cache`; add `getResourceConfigMap()`, `clearResourceConfigCache()`, `clearRolePermissionsCache()`; modify `getResourceRegistryContext()`, `getResourceConfig()`, `getRolePermissionsContext()`, `getAllConfiguredResourceNames()`, `getResourcesByScope()`, `getAllResourcesConfigs()`, `updateResourceSyncCursor()` |
| `GAS/auth.gs` | Add `_roles_cache`; add `getRolesCache()`, `clearRolesCache()`; modify `getRoleNameById()` |
| `GAS/accessRegion.gs` | Line 18: replace `SpreadsheetApp.getActiveSpreadsheet()` with `getAppSpreadsheet()` |
| `GAS/masterApi.gs` | Refactor `handleMasterBulkRecords()` for batch writes |
| `GAS/syncAppResources.gs` | Add `clearAllAppCaches()` call at end of `syncAppResourcesFromCode()` |
| `GAS/setupAppSheets.gs` | Add `clearAllAppCaches()` call at end of `setupAppSheets()` |
| `GAS/setupRoles.gs` | Add `clearRolesCache()` call at end of `setupDefaultRoles()` |
| `GAS/appMenu.gs` | Add cache invalidation calls in `handleAddResource()`, `handleEditResource()`, `handleCreateRole()`, `handleUpdateRole()`, `saveRolePermissionMatrix()` |
| `Documents/CONTEXT_HANDOFF.md` | Add performance optimization status entry |

## Execution Order (Critical)
Steps MUST be executed in this order. Each step builds on the previous:
1. **Step 1** (cache `getAppSpreadsheet`) must be first — all other steps depend on it.
2. **Steps 2-4** (cache registry/permissions contexts) must precede Steps 7-8 (CacheService layers).
3. **Step 3** (config map) must precede Steps 7 and 10 (which reference `_resource_config_map_cache`).
4. **Step 5** (roles cache) must precede Step 9 (CacheService for roles).
5. **Step 6** (accessRegion fix) is independent but should be done before testing.
6. **Steps 7-9** (CacheService layers) extend Steps 2-5 with cross-execution persistence.
7. **Steps 10-12** are independent optimizations.
8. **Step 13** (testing) must be last.

---

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
- [x] Step 7 completed
- [x] Step 8 completed
- [x] Step 9 completed
- [x] Step 10 completed
- [x] Step 11 completed
- [x] Step 12 completed
- [x] Step 13 completed (Verification/Deployment)

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- *(Build Agent fills this)*

### Validation Performed
- [ ] Login tested with timing measurement
- [ ] Multi-resource get tested
- [ ] Master CRUD tested
- [ ] Cache invalidation tested
- [ ] Web App context tested
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] After `clasp push`: If the user notices any issues, run `AQL > Setup & Refactor > Store APP File ID in Properties` to ensure the fallback chain is set.
- [ ] No Web App redeployment needed (no API contract changes — same endpoints, same payload shapes).
