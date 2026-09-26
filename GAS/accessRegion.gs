/**
 * ============================================================
 * AQL - Access Region Helpers
 * ============================================================
 * Access Region is a hierarchical data-access boundary.
 * - User with empty AccessRegion => universe access
 * - User with AccessRegion=X => access X + all descendants
 * - Record with empty AccessRegion => universe record
 */

let __accessRegionContextCache = null;
let __universeNameToCodeMemoryCache = null;

function clearAccessRegionsCache() {
  __accessRegionContextCache = null;
  __universeNameToCodeMemoryCache = null;
  try {
    var ssId = getAppSpreadsheet().getId();
    removeChunkedCache('AQL_UNIVERSE_NAME_TO_REGION_' + ssId);
  } catch (e) { /* non-fatal */ }
}

function getAccessRegionContext() {
  if (__accessRegionContextCache) {
    return __accessRegionContextCache;
  }

  const sheet = getAppSpreadsheet().getSheetByName(CONFIG.SHEETS.ACCESS_REGIONS);
  if (!sheet) {
    __accessRegionContextCache = {
      exists: false,
      rows: [],
      byCode: {},
      childMap: {}
    };
    return __accessRegionContextCache;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values && values.length ? values[0] : [];
  const idx = getHeaderIndexMap(headers);
  const rows = [];
  const byCode = {};
  const childMap = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const code = normalizeAccessRegionCode(readOptionalCell(row, idx.Code, ''));
    if (!code) continue;

    const parent = normalizeAccessRegionCode(readOptionalCell(row, idx.Parent, ''));
    const entry = {
      code: code,
      name: (readOptionalCell(row, idx.Name, '') || '').toString().trim(),
      parent: parent
    };

    rows.push(entry);
    byCode[code] = entry;
    if (!childMap[parent]) childMap[parent] = [];
    childMap[parent].push(code);
  }

  __accessRegionContextCache = {
    exists: true,
    rows: rows,
    byCode: byCode,
    childMap: childMap
  };

  return __accessRegionContextCache;
}


function normalizeAccessRegionCode(value) {
  return (value || '').toString().trim().toUpperCase();
}

function isValidAccessRegionCodeFormat(code) {
  return /^[A-Z]{3}[0-9]{3}$/.test(normalizeAccessRegionCode(code));
}

function resolveUserAccessRegionCode(userRow) {
  if (!userRow || typeof userRow !== 'object') return '';

  if (userRow.DesignationID && typeof getDesignationById === 'function') {
    const desig = getDesignationById(userRow.DesignationID);
    const desigRegion = desig && desig.accessRegion ? normalizeAccessRegionCode(desig.accessRegion) : '';
    if (desigRegion) return desigRegion;
  }

  // During transition, a designation set to Universe falls back to the user region.
  // LEGACY: delete in next release.
  return normalizeAccessRegionCode(userRow.AccessRegion || '');
}

function buildUserAccessRegionScope(userRow) {
  const assignedCode = resolveUserAccessRegionCode(userRow);

  if (!assignedCode) {
    return {
      assignedCode: '',
      isUniverse: true,
      children: [],
      parents: [],
      regionNames: {}
    };
  }

  const context = getAccessRegionContext();
  const descendants = expandAccessRegionCodes(assignedCode, context);
  const normalized = descendants.length ? descendants : [assignedCode];
  const deduped = [];
  const seen = {};
  normalized.forEach(function(code) {
    if (!code || seen[code]) return;
    seen[code] = true;
    deduped.push(code);
  });

  const ancestors = getAncestorRegionCodes(assignedCode, context);
  const children = deduped.filter(function (code) { return code !== assignedCode; });
  const parents = ancestors.filter(function (code) { return code !== assignedCode; });

  const regionNames = {};
  const allCodes = [assignedCode].concat(children).concat(parents);
  allCodes.forEach(function(code) {
    if (code && context.byCode && context.byCode[code] && context.byCode[code].name) {
      regionNames[context.byCode[code].name.toLowerCase()] = code;
    }
  });

  return {
    assignedCode: assignedCode,
    isUniverse: false,
    children: children,
    parents: parents,
    regionNames: regionNames
  };
}

function expandAccessRegionCodes(rootCode, contextInput) {
  const root = normalizeAccessRegionCode(rootCode);
  if (!root) return [];

  const context = contextInput || getAccessRegionContext();
  const queue = [root];
  const out = [];
  const seen = {};

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen[current]) continue;
    seen[current] = true;
    out.push(current);

    const children = context.childMap[current] || [];
    children.forEach(function(childCode) {
      if (!seen[childCode]) {
        queue.push(childCode);
      }
    });
  }

  return out;
}

function buildAuthAccessRegionScope(auth) {
  if (!auth) {
    return { assignedCode: '', isUniverse: true, children: [], parents: [], regionNames: {} };
  }

  if (auth.accessRegionScope && typeof auth.accessRegionScope === 'object') {
    return auth.accessRegionScope;
  }

  const scope = buildUserAccessRegionScope(auth.user || {});
  auth.accessRegionScope = scope;
  return scope;
}


function resolveRegionAccessFlags(resourceConfig) {
  let policy = resourceConfig && resourceConfig.accessPolicy;
  if (!isValidAccessPolicyString(policy)) {
    const scope = resourceConfig && resourceConfig.scope;
    policy = getDefaultAccessPolicyForScope(scope || 'master');
  }
  const r = parseInt(policy.charAt(0), 10) || 0;
  return { same: (r & 1) === 1, down: (r & 2) === 2, up: (r & 4) === 4 };
}

function buildUserRegions(scope, resourceNames) {
  if (!scope || scope.isUniverse) return {};

  const names = Array.isArray(resourceNames) ? resourceNames : [];
  const allowed = {};

  names.forEach(function (name) {
    if (!name) return;
    let config = null;
    try {
      config = getResourceConfig(name);
    } catch (e) { /* ignore */ }

    const flags = resolveRegionAccessFlags(config);
    const map = {};

    if (flags.same && scope.assignedCode) {
      map[scope.assignedCode] = true;
    }
    if (flags.down && Array.isArray(scope.children)) {
      scope.children.forEach(function (code) {
        if (code) map[code] = true;
      });
    }
    if (flags.up && Array.isArray(scope.parents)) {
      scope.parents.forEach(function (code) {
        if (code) map[code] = true;
      });
    }

    allowed[name] = map;
  });

  return allowed;
}

function buildUserNameToRegionCodeMap(scope) {
  if (!scope || scope.isUniverse) {
    if (__universeNameToCodeMemoryCache) {
      return __universeNameToCodeMemoryCache;
    }

    try {
      var ssId = getAppSpreadsheet().getId();
      var cachedJson = getChunkedCache('AQL_UNIVERSE_NAME_TO_REGION_' + ssId);
      if (cachedJson) {
        var parsed = JSON.parse(cachedJson);
        if (parsed && typeof parsed === 'object') {
          __universeNameToCodeMemoryCache = parsed;
          return parsed;
        }
      }
    } catch (e) { /* fall through to build from sheet */ }

    const context = getAccessRegionContext();
    const universeMap = {};
    if (context && Array.isArray(context.rows)) {
      context.rows.forEach(function (r) {
        if (r && r.code && r.name) {
          const lower = r.name.toString().trim().toLowerCase();
          if (lower && universeMap[lower] === undefined) {
            universeMap[lower] = r.code;
          }
        }
      });
    }

    __universeNameToCodeMemoryCache = universeMap;
    try {
      var ssId = getAppSpreadsheet().getId();
      putChunkedCache('AQL_UNIVERSE_NAME_TO_REGION_' + ssId, JSON.stringify(universeMap), CACHE_TTL_SEC);
    } catch (e) { /* non-fatal */ }

    return universeMap;
  }

  return scope.regionNames || {};
}

function buildUserAccessRegionPayload(userRow, regions) {
  const scope = buildUserAccessRegionScope(userRow || {});
  return {
    code: scope.assignedCode,
    isUniverse: scope.isUniverse,
    children: scope.children || [],
    parents: scope.parents || [],
    regions: regions || {},
    regionNames: scope.regionNames || {}
  };
}

function getAncestorRegionCodes(regionCode, contextInput) {
  const context = contextInput || getAccessRegionContext();
  const out = [];
  let current = normalizeAccessRegionCode(regionCode);
  if (!current) return out;

  let safetyCounter = 0;
  while (current && safetyCounter < 100) {
    out.push(current);
    const node = context.byCode[current];
    if (node && node.parent) {
      current = normalizeAccessRegionCode(node.parent);
    } else {
      break;
    }
    safetyCounter++;
  }

  return out;
}

function getDefaultAccessPolicyForScope(scope) {
  const s = (scope || '').toString().trim().toLowerCase();
  if (s === 'operation') return '37111';
  if (s === 'accounts') return '37010';
  if (s === 'view' || s === 'report') return '71111';
  return '77111'; // master and fallback
}

function isValidAccessPolicyString(policy) {
  return /^[0-7]{5}$/.test((policy || '').toString().trim());
}
