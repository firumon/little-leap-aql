/**
 * ============================================================
 * Little Leap AQL - Access Region Helpers
 * ============================================================
 * Access Region is a hierarchical data-access boundary.
 * - User with empty AccessRegion => universe access
 * - User with AccessRegion=X => access X + all descendants
 * - Record with empty AccessRegion => universe record
 */

let __accessRegionContextCache = null;

function getAccessRegionContext() {
  if (__accessRegionContextCache) {
    return __accessRegionContextCache;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ACCESS_REGIONS);
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
  return normalizeAccessRegionCode(userRow.AccessRegion || userRow.ServiceRegion || '');
}

function buildUserAccessRegionScope(userRow) {
  const assignedCode = resolveUserAccessRegionCode(userRow);
  const context = getAccessRegionContext();

  if (!assignedCode) {
    return {
      assignedCode: '',
      isUniverse: true,
      accessibleCodes: [],
      accessibleRegions: []
    };
  }

  const descendants = expandAccessRegionCodes(assignedCode, context);
  const normalized = descendants.length ? descendants : [assignedCode];
  const deduped = [];
  const seen = {};
  normalized.forEach(function(code) {
    if (!code || seen[code]) return;
    seen[code] = true;
    deduped.push(code);
  });

  const accessibleRegions = deduped.map(function(code) {
    const node = context.byCode[code];
    return {
      code: code,
      name: node ? node.name : '',
      parent: node ? node.parent : ''
    };
  });

  return {
    assignedCode: assignedCode,
    isUniverse: false,
    accessibleCodes: deduped,
    accessibleRegions: accessibleRegions
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
    return { assignedCode: '', isUniverse: true, accessibleCodes: [], accessibleRegions: [] };
  }

  if (auth.accessRegionScope && typeof auth.accessRegionScope === 'object') {
    return auth.accessRegionScope;
  }

  const scope = buildUserAccessRegionScope(auth.user || {});
  auth.accessRegionScope = scope;
  return scope;
}

function canAuthAccessRegionCode(auth, targetCode) {
  const code = normalizeAccessRegionCode(targetCode);
  if (!code) return true;

  const scope = buildAuthAccessRegionScope(auth);
  if (scope.isUniverse) return true;
  return scope.accessibleCodes.indexOf(code) !== -1;
}

function validateAccessRegionCodeExists(code) {
  const normalized = normalizeAccessRegionCode(code);
  if (!normalized) return true;
  if (!isValidAccessRegionCodeFormat(normalized)) {
    throw new Error('Invalid AccessRegion format: ' + normalized + ' (expected AAA999)');
  }

  const context = getAccessRegionContext();
  if (!context.exists) return true;
  if (!context.byCode[normalized]) {
    throw new Error('Invalid AccessRegion: ' + normalized);
  }
  return true;
}

function buildUserAccessRegionPayload(userRow) {
  const scope = buildUserAccessRegionScope(userRow || {});
  return {
    code: scope.assignedCode,
    isUniverse: scope.isUniverse,
    accessibleCodes: scope.accessibleCodes,
    accessibleRegions: scope.accessibleRegions
  };
}
