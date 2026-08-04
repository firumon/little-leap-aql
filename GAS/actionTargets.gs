/**
 * Action Targets — server-side multi-record execution for AdditionalActions.
 *
 * An AdditionalActions entry may carry a `targets[]` array alongside its own
 * `fields[]`. Each target is ONE extra write (create or update) performed in the
 * same request as the action's own column mutation. A single "Postpone" can
 * therefore stamp the current visit AND schedule its replacement.
 *
 * The target list is read from the trusted APP.Resources config, never from the
 * client — the client sends only the values a user actually typed. That is what
 * lets a target write be authorized by the action's own permission on the SOURCE
 * resource instead of canWrite/canUpdate on the target resource, and it means a
 * client cannot inject a target that the config does not declare.
 *
 * Execution is two-pass: every target is resolved and validated before any row
 * is written, so a bad expression or a missing required field fails the whole
 * action rather than leaving a half-applied write behind.
 *
 * Config shape (one target):
 *   {
 *     "resource": "OutletVisits",
 *     "mode": "create",              // 'create' | 'update'
 *     "key": "newVisit",             // optional; addresses form values + $target
 *     "code": "$record.ParentCode",  // required when mode = 'update'
 *     "label": "New Visit",
 *     "fields": [
 *       { "name": "OutletCode", "from": "$record.OutletCode" },
 *       { "name": "Progress",   "value": "PLANNED" },
 *       { "name": "Date",       "type": "date", "required": true }
 *     ]
 *   }
 *
 * Field semantics — `type` decides visibility, `from`/`value` decide seeding:
 *   type only         → user enters it, nothing pre-filled
 *   from / value only → resolved server-side, never shown, not user-editable
 *   type + from/value → pre-filled for the user, whatever they submit wins
 *
 * Canonical spec: Documents/AQL_ACTION_SYSTEM.md
 */

// ==========================================================================
// Config lookup
// ==========================================================================

/**
 * Finds one AdditionalActions entry on a resource config by its action key.
 * Matching is case-insensitive so a client sending 'postpone' still resolves
 * the configured 'Postpone'.
 *
 * @param {Object} resourceConfig
 * @param {string} actionName
 * @returns {Object|null}
 */
function findAdditionalActionConfig(resourceConfig, actionName) {
  var actions = resourceConfig && Array.isArray(resourceConfig.additionalActions)
    ? resourceConfig.additionalActions
    : [];
  var wanted = (actionName || '').toString().trim().toLowerCase();
  if (!wanted) return null;

  for (var i = 0; i < actions.length; i++) {
    var entry = actions[i];
    var name = (entry && entry.action ? entry.action : '').toString().trim().toLowerCase();
    if (name && name === wanted) return entry;
  }
  return null;
}

/**
 * The addressing key for a target: an explicit `key`, else its array index.
 * Used both for form-value addressing (`newVisit.Date`) and `$target.<key>.X`.
 *
 * @param {Object} target
 * @param {number} index
 * @returns {string}
 */
function resolveActionTargetKey(target, index) {
  var key = (target && target.key ? target.key : '').toString().trim();
  return key || String(index);
}

// ==========================================================================
// Expression resolution
// ==========================================================================

/**
 * Resolves one configured expression against the action context.
 *
 * Grammar:
 *   $record.<Column>         value on the source record, as it was BEFORE this
 *                            action mutated it
 *   $field.<Name>            a value the user typed into the action's own
 *                            fields[]; accepts the short name or the derived
 *                            header
 *   $target.<key>.<Column>   a value on an EARLIER target in the same run —
 *                            `$target.newVisit.Code` is how a second target
 *                            references the record the first one created
 *   $userName, $date:7, …    restricted token set (see resolveActionToken)
 *   $$anything               escape hatch — yields the literal "$anything"
 *   anything else            literal, returned unchanged
 *
 * An unrecognised `$token` throws rather than silently degrading to a literal,
 * so a typo in a config surfaces as a failed action instead of a row containing
 * the string "$usrName".
 *
 * @param {*} expression
 * @param {Object} ctx
 * @returns {*}
 */
function resolveActionExpression(expression, ctx) {
  if (expression === undefined || expression === null) return '';
  // Numbers, booleans and dates are already literal values.
  if (typeof expression !== 'string') return expression;

  var expr = expression.trim();
  if (!expr || expr.charAt(0) !== '$') return expression;
  if (expr.indexOf('$$') === 0) return expr.slice(1);

  var dot = expr.indexOf('.');
  var head = dot === -1 ? expr : expr.slice(0, dot);
  var tail = dot === -1 ? '' : expr.slice(dot + 1);

  if (head === '$record') return readActionRecordValue(ctx, tail);
  if (head === '$field') return readActionFieldValue(ctx, tail);
  if (head === '$target') return readActionTargetValue(ctx, tail);

  return resolveActionToken(expr, ctx);
}

function readActionRecordValue(ctx, column) {
  var name = (column || '').toString().trim();
  if (!name) throw new Error('Action expression "$record" requires a column, e.g. $record.OutletCode');
  var record = (ctx && ctx.record) || {};
  return record[name] === undefined ? '' : record[name];
}

/**
 * Reads a value the user typed into the action's OWN fields[].
 *
 * The wire payload keys these by their derived header (`ProgressPostponedComment`),
 * because that is the long-standing executeAction contract. A config author
 * writing `$field.Comment` means the short name, so both spellings resolve.
 */
function readActionFieldValue(ctx, name) {
  var key = (name || '').toString().trim();
  if (!key) throw new Error('Action expression "$field" requires a field name, e.g. $field.Comment');

  var fields = (ctx && ctx.fields) || {};
  if (fields[key] !== undefined) return fields[key];

  var derived = (ctx.column || '') + (ctx.stampSuffix || '') + key;
  if (fields[derived] !== undefined) return fields[derived];

  return '';
}

/**
 * Reads a column off an earlier target in the same run. Targets execute in
 * array order, so only a target declared BEFORE this one is addressable —
 * referencing a later one throws rather than silently yielding ''.
 */
function readActionTargetValue(ctx, path) {
  var parts = (path || '').toString().split('.');
  var key = (parts.shift() || '').trim();
  var column = parts.join('.').trim();

  if (!key || !column) {
    throw new Error('Action expression "$target" requires a key and a column, e.g. $target.newVisit.Code');
  }

  var resolved = (ctx && ctx.targets) || {};
  if (resolved[key] === undefined) {
    throw new Error('Action expression "$target.' + key + '" refers to a target that has not run yet');
  }

  var record = resolved[key].record || {};
  return record[column] === undefined ? '' : record[column];
}

/**
 * The restricted token set available to target expressions.
 *
 * Deliberately a SUBSET of the frontend's listViewTokens.js table: targets need
 * identity and today's date, not the full filter-comparison vocabulary. Adding
 * a token here does not require touching the frontend, because target
 * expressions are only ever evaluated server-side.
 *
 * @param {string} expr - e.g. '$userName', '$date:7'
 * @param {Object} ctx
 * @returns {*}
 */
function resolveActionToken(expr, ctx) {
  var parts = (expr || '').toString().split(':');
  var token = parts[0];
  var param = parts.length > 1 ? parts[1] : '';

  var auth = (ctx && ctx.auth) || {};
  var user = auth.user || {};

  switch (token) {
    case '$userCode': return user.UserID || '';
    case '$userName': return user.Name || '';
    case '$userEmail': return user.Email || '';
    case '$userRole': return resolveActionUserRole(user);
    case '$userDesignation': return resolveActionUserDesignation(user);
    case '$userRegion': return resolveActionUserRegion(auth);
    case '$now': return Date.now();
    case '$today': return actionDateOnly(0);
    case '$date': return actionDateOnly(Number(param) || 0);
    default:
      throw new Error('Unknown action expression token: ' + token);
  }
}

// The helpers below live in auth.gs / accessRegion.gs. They are wrapped so a
// lookup failure degrades to '' instead of failing the whole action — an
// optional descriptor is never worth losing a write over.
function resolveActionUserRole(user) {
  try {
    return getPrimaryRoleName(user) || '';
  } catch (e) {
    return '';
  }
}

function resolveActionUserDesignation(user) {
  try {
    var designation = getDesignationById(user.DesignationID);
    return (designation && designation.name) ? designation.name : '';
  } catch (e) {
    return '';
  }
}

function resolveActionUserRegion(auth) {
  try {
    var scope = auth.accessRegionScope || buildUserAccessRegionScope(auth.user);
    return (scope && scope.assignedCode) ? scope.assignedCode : '';
  } catch (e) {
    return '';
  }
}

/**
 * Today (+/- N days) as a YYYY-MM-DD string in the script's timezone.
 * Date-only columns are stored as text throughout AQL, so this must not return
 * a Date object.
 */
function actionDateOnly(offsetDays) {
  var date = new Date();
  date.setDate(date.getDate() + (Number(offsetDays) || 0));
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ==========================================================================
// Sheet context cache
// ==========================================================================

/**
 * Opens a target resource once per run and keeps the snapshot alive across both
 * passes.
 *
 * `values` intentionally GROWS as creates are prepared: appending each pending
 * row means the next generated code does not collide with it, and uniqueness
 * validation sees rows that are queued but not yet written. Without this, two
 * creates against the same resource in one action would both claim the same
 * next code.
 *
 * @param {Object} cache - per-run map, keyed by resource name
 * @param {string} resourceName
 * @returns {Object}
 */
function getActionSheetContext(cache, resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!name) throw new Error('Action target is missing a resource name');
  if (cache[name]) return cache[name];

  var resource = openResourceSheet(name);
  var values = resource.sheet.getDataRange().getValues();
  var headers = values[0] || [];

  cache[name] = {
    resourceName: name,
    config: resource.config,
    sheet: resource.sheet,
    values: values,
    headers: headers,
    idx: getHeaderIndexMap(headers),
    schema: buildMasterSchemaFromResourceConfig(resource.config),
    appendRows: [],
    updateRows: [],
    writtenRows: []
  };
  return cache[name];
}

// ==========================================================================
// Target preparation (pass 1 — resolve + validate, no writes)
// ==========================================================================

/**
 * Turns one target's `fields[]` into a plain { header: value } record.
 *
 * Precedence per field: a user-submitted value wins, then `from`, then `value`.
 * A field with no `type` is never user-submittable, so its config value always
 * stands regardless of what the client sent.
 *
 * @param {Object} target
 * @param {string} targetKey
 * @param {Object} ctx
 * @returns {Object}
 */
function buildActionTargetRecord(target, targetKey, ctx) {
  var fields = Array.isArray(target.fields) ? target.fields : [];
  var submitted = (ctx.targetFields && ctx.targetFields[targetKey]) || {};
  var record = {};

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name) return;

    var isUserFacing = !!(field.type && field.type.toString().trim());
    var userValue = submitted[name];
    var hasUserValue = isUserFacing && userValue !== undefined && userValue !== null && userValue !== '';

    if (hasUserValue) {
      record[name] = userValue;
      return;
    }

    if (field.from !== undefined) {
      record[name] = resolveActionExpression(field.from, ctx);
      return;
    }

    if (field.value !== undefined) {
      record[name] = resolveActionExpression(field.value, ctx);
      return;
    }

    if (isUserFacing) record[name] = '';
  });

  return record;
}

/**
 * Enforces `required` on a target's user-facing fields.
 *
 * Only fields carrying a `type` are checked: a `from`/`value` field marked
 * required is a config mistake, not something the user can act on, and failing
 * the action for it would be unactionable.
 */
function validateActionTargetFields(target, targetKey, record) {
  var fields = Array.isArray(target.fields) ? target.fields : [];
  var label = (target.label || target.resource || targetKey || 'Target').toString();

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name || !field.required) return;
    if (!field.type || !field.type.toString().trim()) return;

    var value = record[name];
    if (value === undefined || value === null || value.toString().trim() === '') {
      throw new Error(label + ': ' + (field.label || name) + ' is required');
    }
  });
}

/**
 * Resolves and validates one target without touching the sheet.
 *
 * Returns a descriptor the write pass consumes, plus the record object that
 * later targets can address through `$target.<key>.<Column>`.
 */
function prepareActionTarget(auth, target, targetKey, ctx, cache) {
  var resourceName = (target.resource || '').toString().trim();
  if (!resourceName) throw new Error('Action target "' + targetKey + '" is missing a resource');

  var mode = (target.mode || '').toString().trim().toLowerCase();
  if (mode !== 'create' && mode !== 'update') {
    throw new Error('Action target "' + targetKey + '" needs mode "create" or "update"');
  }

  var sheetCtx = getActionSheetContext(cache, resourceName);
  var record = buildActionTargetRecord(target, targetKey, ctx);
  validateActionTargetFields(target, targetKey, record);

  var providedValues = extractProvidedHeaderValues(sheetCtx.headers, { record: record });

  return mode === 'create'
    ? prepareActionTargetCreate(auth, target, targetKey, sheetCtx, providedValues)
    : prepareActionTargetUpdate(auth, target, targetKey, ctx, sheetCtx, providedValues);
}

function prepareActionTargetCreate(auth, target, targetKey, sheetCtx, providedValues) {
  var config = sheetCtx.config;
  var idx = sheetCtx.idx;

  var code = (providedValues.Code || '').toString().trim();
  if (!code) {
    var codePrefix = (config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      throw new Error('CodePrefix is missing for resource: ' + sheetCtx.resourceName);
    }
    var seqLength = config.codeSequenceLength || 6;
    code = config.scope === 'operation'
      ? generateNextYearScopedCode(sheetCtx.values, idx, codePrefix, seqLength)
      : generateNextCode(sheetCtx.values, idx, codePrefix, seqLength);
  }

  var rowData = buildNewResourceRow(sheetCtx.headers, idx, providedValues, sheetCtx.schema);
  rowData[idx.Code] = code;

  applyAccessRegionOnWrite(rowData, idx, auth);
  applyAuditFields(rowData, idx, auth, config, true);
  validateRequiredFields(rowData, idx, sheetCtx.schema.requiredHeaders, sheetCtx.resourceName);
  validateMasterUniqueness(sheetCtx.values, idx, rowData, sheetCtx.schema, -1, sheetCtx.resourceName);

  // Visible to the next target's code generation + uniqueness check.
  sheetCtx.values.push(rowData);
  sheetCtx.appendRows.push(rowData);

  return {
    key: targetKey,
    mode: 'create',
    resourceName: sheetCtx.resourceName,
    code: code,
    row: rowData,
    record: rowArrayToObject(sheetCtx.headers, rowData)
  };
}

function prepareActionTargetUpdate(auth, target, targetKey, ctx, sheetCtx, providedValues) {
  var code = resolveActionExpression(target.code, ctx);
  code = (code === undefined || code === null) ? '' : code.toString().trim();
  if (!code) {
    throw new Error('Action target "' + targetKey + '" is mode "update" but resolved an empty code');
  }

  var idx = sheetCtx.idx;
  var rowNumber = findRowByValue(sheetCtx.sheet, idx.Code, code, 2, true);
  if (rowNumber === -1) {
    throw new Error(sheetCtx.resourceName + ' record not found: ' + code);
  }

  var existingRow = sheetCtx.sheet.getRange(rowNumber, 1, 1, sheetCtx.headers.length).getValues()[0];
  enforceRecordLevelAccess(auth, sheetCtx.config, sheetCtx.headers, existingRow);

  var rowData = mergeMasterRow(existingRow, idx, providedValues, sheetCtx.schema);
  applyAuditFields(rowData, idx, auth, sheetCtx.config, false);
  validateRequiredFields(rowData, idx, sheetCtx.schema.requiredHeaders, sheetCtx.resourceName);
  validateMasterUniqueness(sheetCtx.values, idx, rowData, sheetCtx.schema, rowNumber, sheetCtx.resourceName);

  sheetCtx.updateRows.push({ rowNumber: rowNumber, row: rowData });

  return {
    key: targetKey,
    mode: 'update',
    resourceName: sheetCtx.resourceName,
    code: code,
    rowNumber: rowNumber,
    row: rowData,
    record: rowArrayToObject(sheetCtx.headers, rowData)
  };
}

// ==========================================================================
// Execution
// ==========================================================================

/**
 * Runs every target declared on an action config.
 *
 * Pass 1 resolves and validates all targets; pass 2 writes them. Nothing is
 * written until every target has passed, so an unresolvable expression or a
 * missing required field aborts the action cleanly.
 *
 * Creates are batched into a single setValues per resource — appending them one
 * at a time would need a flush between each to keep getLastRow() honest.
 *
 * @param {Object} auth
 * @param {Array}  targets - actionConfig.targets
 * @param {Object} ctx     - { record, fields, targetFields, column, stampSuffix, auth, targets }
 * @returns {Object} { resources: { name: {config, headers, rows} }, results: [] }
 */
function executeActionTargets(auth, targets, ctx) {
  var list = Array.isArray(targets) ? targets : [];
  if (!list.length) return { resources: {}, results: [] };

  var cache = {};
  var results = [];

  // ---- Pass 1 — resolve + validate everything -----------------------------
  ctx.targets = ctx.targets || {};
  for (var i = 0; i < list.length; i++) {
    var target = list[i];
    var key = resolveActionTargetKey(target, i);
    var prepared = prepareActionTarget(auth, target, key, ctx, cache);
    results.push(prepared);
    // Registered immediately so a later target can read $target.<key>.<Column>.
    ctx.targets[key] = { code: prepared.code, record: prepared.record };
  }

  // ---- Pass 2 — write -----------------------------------------------------
  var resources = {};
  Object.keys(cache).forEach(function (resourceName) {
    var sheetCtx = cache[resourceName];
    var width = sheetCtx.headers.length;

    sheetCtx.updateRows.forEach(function (entry) {
      sheetCtx.sheet.getRange(entry.rowNumber, 1, 1, width).setValues([entry.row]);
      sheetCtx.writtenRows.push(entry.row);
    });

    if (sheetCtx.appendRows.length) {
      var startRow = sheetCtx.sheet.getLastRow() + 1;
      sheetCtx.sheet.getRange(startRow, 1, sheetCtx.appendRows.length, width).setValues(sheetCtx.appendRows);
      sheetCtx.appendRows.forEach(function (row) { sheetCtx.writtenRows.push(row); });
    }

    updateResourceSyncCursor(resourceName);
    resources[resourceName] = {
      config: sheetCtx.config,
      headers: sheetCtx.headers,
      rows: sheetCtx.writtenRows
    };
  });

  return { resources: resources, results: results };
}

/**
 * Trims prepared-target descriptors down to what a client can act on.
 *
 * The full rows already travel in the response's direct-write payloads, so
 * echoing each target's whole record here would double the response size for
 * no gain. What a caller actually needs is which record each target produced.
 *
 * @param {Array} results
 * @returns {Array} [{ key, mode, resource, code }]
 */
function summarizeActionTargetResults(results) {
  return (Array.isArray(results) ? results : []).map(function (entry) {
    return {
      key: entry.key,
      mode: entry.mode,
      resource: entry.resourceName,
      code: entry.code
    };
  });
}
