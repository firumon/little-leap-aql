/**
 * ============================================================
 * Little Leap AQL - Resource Registry Helpers
 * ============================================================
 * Reads the APP.Resources sheet to resolve target file/sheet dynamically.
 */

function getResourceRegistryContext() {
  const appSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.RESOURCES);
  if (!appSheet) {
    throw new Error('Resources sheet not found in APP file');
  }

  const values = appSheet.getDataRange().getValues();
  if (!values || values.length < 1) {
    throw new Error('Resources sheet is empty');
  }

  const headers = values[0];
  const idx = getHeaderIndexMap(headers);
  return { appSheet, values, headers, idx };
}

function getResourceConfig(resourceName) {
  const name = (resourceName || '').toString().trim();
  if (!name) {
    throw new Error('Resource name is required');
  }

  const registry = getResourceRegistryContext();

  for (let i = 1; i < registry.values.length; i++) {
    const row = registry.values[i];
    if ((row[registry.idx.Name] || '').toString().trim() === name) {
      return {
        name,
        fileId: (row[registry.idx.FileID] || '').toString().trim(),
        sheetName: (row[registry.idx.SheetName] || '').toString().trim(),
        scope: normalizeResourceScope(readOptionalCell(row, registry.idx.Scope, 'master')),
        isActive: toBooleanCell(readOptionalCell(row, registry.idx.IsActive, true)),
        skipColumns: Number(row[registry.idx.SkipColumns] || 0),
        audit: toBooleanCell(readOptionalCell(row, registry.idx.Audit, false)),
        codePrefix: registry.idx.CodePrefix === undefined
          ? ''
          : (row[registry.idx.CodePrefix] || '').toString().trim(),
        codeSequenceLength: normalizeCodeSequenceLength(
          registry.idx.CodeSequenceLength === undefined
            ? ''
            : row[registry.idx.CodeSequenceLength]
        ),
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
        additionalActions: parseStringList(readOptionalCell(row, registry.idx.AdditionalActions, ''))
      };
    }
  }

  throw new Error('Resource not configured: ' + name);
}

function openResourceSheet(resourceName) {
  const config = getResourceConfig(resourceName);
  if (!config.fileId) {
    throw new Error('Resource fileId is missing for: ' + resourceName);
  }
  if (!config.sheetName) {
    throw new Error('Resource sheetName is missing for: ' + resourceName);
  }

  const file = SpreadsheetApp.openById(config.fileId);
  const sheet = file.getSheetByName(config.sheetName);
  if (!sheet) {
    throw new Error('Sheet not found for resource ' + resourceName + ': ' + config.sheetName);
  }

  return { config, file, sheet };
}

function normalizeCodeSequenceLength(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 6;
  }
  return Math.floor(num);
}

function normalizeResourceScope(value) {
  const normalized = (value || 'master').toString().trim().toLowerCase();
  if (normalized === 'transaction') return 'transaction';
  if (normalized === 'report') return 'report';
  if (normalized === 'system') return 'system';
  return 'master';
}

function normalizeRecordAccessPolicy(value) {
  const normalized = (value || 'all').toString().trim().toUpperCase();
  if (normalized === 'OWNER') return 'OWNER';
  if (normalized === 'OWNER_GROUP') return 'OWNER_GROUP';
  if (normalized === 'OWNER_AND_UPLINE') return 'OWNER_AND_UPLINE';
  return 'ALL';
}

function readOptionalCell(row, index, fallback) {
  if (index === undefined) return fallback;
  const value = row[index];
  return value === undefined ? fallback : value;
}

function parseJsonCell(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function parseHeaderList(value) {
  return parseStringList(value);
}

function parseStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(function(entry) {
      return (entry || '').toString().trim();
    }).filter(function(entry) {
      return !!entry;
    });
  }

  return value.toString().split(',').map(function(entry) {
    return (entry || '').toString().trim();
  }).filter(function(entry) {
    return !!entry;
  });
}

function parseCompositeHeaders(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().startsWith('[')) {
    return parseJsonCell(value, []);
  }

  return value.toString().split(';').map(function(group) {
    return group.split('+').map(function(item) {
      return (item || '').toString().trim();
    }).filter(function(item) {
      return !!item;
    });
  }).filter(function(group) {
    return group.length > 1;
  });
}

function getRolePermissionsContext() {
  const rolePermSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ROLE_PERMISSIONS);
  if (!rolePermSheet) {
    throw new Error('RolePermissions sheet not found in APP file');
  }

  const values = rolePermSheet.getDataRange().getValues();
  const headers = values && values.length ? values[0] : [];
  const idx = getHeaderIndexMap(headers);
  return { rolePermSheet, values, headers, idx };
}

function getRoleResourceAccess(roleId, options) {
  const roleIds = normalizeRoleIds(roleId);
  if (!roleIds.length) return [];

  const includeHeaders = options && options.includeHeaders === true;
  const includeUiConfig = !(options && options.includeUiConfig === false);
  const scopeFilter = options && options.scope ? normalizeResourceScope(options.scope) : '';
  const permissionsContext = getRolePermissionsContext();
  const resourceMap = {};

  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    if (roleIds.indexOf(rowRoleId) === -1) continue;

    const resourceName = (row[permissionsContext.idx.Resource] || '').toString().trim();
    if (!resourceName) continue;

    const actionList = parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, ''));
    const permissionSet = buildPermissionSetFromActions(actionList);

    const hasAnyPermission = permissionSet.canRead || permissionSet.canWrite || permissionSet.canUpdate || permissionSet.canDelete;
    if (!hasAnyPermission) continue;

    if (!resourceMap[resourceName]) {
      const entry = buildAuthorizedResourceEntry(resourceName, {
        includeHeaders: includeHeaders,
        includeUiConfig: includeUiConfig,
        scopeFilter: scopeFilter
      });
      if (!entry) continue;
      resourceMap[resourceName] = entry;
      if (includeUiConfig) {
        resourceMap[resourceName].allowedActions = [];
      }
    }

    resourceMap[resourceName].permissions.canRead = resourceMap[resourceName].permissions.canRead || permissionSet.canRead;
    resourceMap[resourceName].permissions.canWrite = resourceMap[resourceName].permissions.canWrite || permissionSet.canWrite;
    resourceMap[resourceName].permissions.canUpdate = resourceMap[resourceName].permissions.canUpdate || permissionSet.canUpdate;
    resourceMap[resourceName].permissions.canDelete = resourceMap[resourceName].permissions.canDelete || permissionSet.canDelete;
    if (permissionSet.actions && permissionSet.actions.length) {
      resourceMap[resourceName].allowedActions = mergeStringLists(resourceMap[resourceName].allowedActions, permissionSet.actions);
    }
  }

  return Object.keys(resourceMap).map(function(resourceName) {
    return resourceMap[resourceName];
  });
}

function buildAuthorizedResourceEntry(resourceName, options) {
  const opts = options || {};
  let config;

  try {
    config = getResourceConfig(resourceName);
  } catch (err) {
    return null;
  }

  if (!config.isActive) return null;
  if (opts.scopeFilter && config.scope !== opts.scopeFilter) return null;
  if (!config.includeInAuthorizationPayload) return null;

  const entry = {
    name: resourceName,
    scope: config.scope,
    fileId: config.fileId,
    sheetName: config.sheetName,
    codePrefix: config.codePrefix,
    codeSequenceLength: config.codeSequenceLength,
    permissions: {
      canRead: false,
      canWrite: false,
      canUpdate: false,
      canDelete: false
    }
  };

  if (opts.includeHeaders) {
    try {
      const resource = openResourceSheet(resourceName);
      entry.headers = getSheetHeaders(resource.sheet);
    } catch (err) {
      entry.headers = [];
    }
  }

  if (opts.includeUiConfig) {
    entry.ui = {
      menuGroup: config.menuGroup,
      menuOrder: config.menuOrder,
      menuLabel: config.menuLabel,
      menuIcon: config.menuIcon,
      routePath: config.routePath,
      pageTitle: config.pageTitle,
      pageDescription: config.pageDescription,
      fields: Array.isArray(config.uiFields) ? config.uiFields : [],
      showInMenu: config.showInMenu
    };
    entry.actions = config.additionalActions || [];
    entry.allowedActions = [];
  }

  return entry;
}

function toBooleanCell(value) {
  if (value === true) return true;
  if (value === false) return false;

  const normalized = (value || '').toString().trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function getRolePermissionForResource(roleId, resourceName) {
  const normalizedRoleIds = normalizeRoleIds(roleId);
  const normalizedResourceName = (resourceName || '').toString().trim();
  const emptyPermissions = {
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false
  };

  if (!normalizedRoleIds.length || !normalizedResourceName) {
    return emptyPermissions;
  }

  const permissionsContext = getRolePermissionsContext();
  const result = {
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false
  };

  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    const rowResource = (row[permissionsContext.idx.Resource] || '').toString().trim();

    if (normalizedRoleIds.indexOf(rowRoleId) === -1 || rowResource !== normalizedResourceName) {
      continue;
    }

    const permissionSet = buildPermissionSetFromActions(
      parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, ''))
    );
    result.canRead = result.canRead || permissionSet.canRead;
    result.canWrite = result.canWrite || permissionSet.canWrite;
    result.canUpdate = result.canUpdate || permissionSet.canUpdate;
    result.canDelete = result.canDelete || permissionSet.canDelete;
  }

  return result;
}

function hasRolePermission(roleId, resourceName, permissionName) {
  const permissions = getRolePermissionForResource(roleId, resourceName);
  return permissions && permissions[permissionName] === true;
}

function hasRoleActionPermission(roleId, resourceName, actionName) {
  const normalizedAction = normalizeActionName(actionName);
  if (!normalizedAction) return false;

  const roleIds = normalizeRoleIds(roleId);
  if (!roleIds.length) return false;

  const permissionsContext = getRolePermissionsContext();
  for (let i = 1; i < permissionsContext.values.length; i++) {
    const row = permissionsContext.values[i];
    const rowRoleId = (row[permissionsContext.idx.RoleID] || '').toString().trim();
    const rowResource = (row[permissionsContext.idx.Resource] || '').toString().trim();
    if (roleIds.indexOf(rowRoleId) === -1 || rowResource !== resourceName) {
      continue;
    }

    const actions = parseStringList(readOptionalCell(row, permissionsContext.idx.Actions, '')).map(function(action) {
      return normalizeActionName(action);
    });
    if (actions.indexOf(normalizedAction) !== -1) {
      return true;
    }
  }

  return false;
}

function normalizeRoleIds(roleIdsOrSingle) {
  if (Array.isArray(roleIdsOrSingle)) {
    return roleIdsOrSingle.map(function(roleId) {
      return (roleId || '').toString().trim();
    }).filter(function(roleId) {
      return !!roleId;
    });
  }

  const single = (roleIdsOrSingle || '').toString().trim();
  if (!single) return [];
  return [single];
}

function mergeStringLists(currentList, incomingList) {
  const set = {};
  (currentList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) set[key] = true;
  });
  (incomingList || []).forEach(function(entry) {
    const key = (entry || '').toString().trim();
    if (key) set[key] = true;
  });
  return Object.keys(set);
}

function buildPermissionSetFromActions(actions) {
  const normalizedActions = (actions || []).map(function(action) {
    return normalizeActionName(action);
  });

  return {
    canRead: normalizedActions.indexOf('READ') !== -1,
    canWrite: normalizedActions.indexOf('WRITE') !== -1 || normalizedActions.indexOf('CREATE') !== -1,
    canUpdate: normalizedActions.indexOf('UPDATE') !== -1,
    canDelete: normalizedActions.indexOf('DELETE') !== -1,
    actions: normalizedActions
  };
}

function normalizeActionName(value) {
  return (value || '').toString().trim().toUpperCase();
}

function getResourcesByScope(scope, options) {
  const normalizedScope = normalizeResourceScope(scope);
  const includeInactive = options && options.includeInactive === true;
  const registry = getResourceRegistryContext();
  const result = [];

  for (let i = 1; i < registry.values.length; i++) {
    const row = registry.values[i];
    const name = (row[registry.idx.Name] || '').toString().trim();
    if (!name) continue;

    const config = getResourceConfig(name);
    if (config.scope !== normalizedScope) continue;
    if (!includeInactive && !config.isActive) continue;
    result.push(config);
  }

  return result;
}
