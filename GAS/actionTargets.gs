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
 *     "when": { "field": "Date", "op": "notEmpty" },   // optional gate
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
 * A target may carry a `when` gate. When it evaluates false the target is
 * skipped ENTIRELY — no expression resolution, no sheet read, no validation, no
 * write — which is what lets one action express an OPTIONAL follow-up record
 * (cancel a visit, and create its replacement only if a date was supplied)
 * instead of splitting into two near-duplicate config entries. Absent or empty
 * `when` always runs, so every pre-existing config is unaffected.
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
 *   $userName, $dateTime,   restricted token set (see resolveActionToken)
 *   $date:7, …
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

  // A `${...}` tag makes the whole string a TEMPLATE: each tag resolves on its own
  // and the text around it is kept verbatim, so a header can be assembled from
  // several tokens (`---POSTPONED ON ${$today}---`).
  if (/\$\{[^}]*\}/.test(expression)) {
    return expression.replace(/\$\{([^}]*)\}/g, function (match, inner) {
      var value = resolveActionExpression(String(inner).trim(), ctx);
      return value === undefined || value === null ? '' : String(value);
    });
  }

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
 *
 * Two distinct failure modes, deliberately given different messages: a target
 * that has not run YET is an ordering mistake (move it earlier), while a target
 * SKIPPED by its `when` gate is a design mistake — a conditional target can
 * never be a dependency, because the run in which it is skipped has no record
 * for the expression to read.
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
    var skipped = (ctx && ctx.skippedTargets) || {};
    if (skipped[key]) {
      throw new Error(
        'Action expression "$target.' + key + '" refers to target "' + key + '", which was SKIPPED ' +
        'by its "when" condition on this run, so it produced no record. A target that other targets ' +
        'or fields read from must not be conditional — remove its "when", or drop the dependency.'
      );
    }
    throw new Error('Action expression "$target.' + key + '" refers to a target that has not run yet');
  }

  var record = resolved[key].record || {};
  return record[column] === undefined ? '' : record[column];
}

/**
 * The restricted token set available to target expressions.
 *
 * Deliberately a SUBSET of the frontend's tokenEvaluator.js table: targets need
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
  var key = token.toLowerCase();

  var auth = (ctx && ctx.auth) || {};
  var user = auth.user || {};

  switch (key) {
    case '$usercode': return user.UserID || '';
    case '$username': return user.Name || user.UserID || '';
    case '$useremail': return user.Email || '';
    case '$userrole': return resolveActionUserRole(user);
    case '$userdesignation': return resolveActionUserDesignation(user);
    case '$userregion': return resolveActionUserRegion(auth);
    case '$now': return Date.now();
    case '$datetime': return formatDateTime24();
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
// Target conditions (`when`)
// ==========================================================================

/**
 * The ops a target's `when` accepts — exactly the `visibleWhen` set, so an
 * author never has to learn a second comparison vocabulary.
 */
var ACTION_TARGET_CONDITION_OPS = ['eq', 'ne', 'in', 'nin', 'empty', 'notEmpty'];

function isActionTargetConditionOp(op) {
  return ACTION_TARGET_CONDITION_OPS.indexOf((op === undefined || op === null) ? '' : op.toString()) !== -1;
}

// An operand KEY is present only when it names something. `{ field: '' }` is an
// unfinished condition, not a condition on a column called ''.
function hasActionConditionOperand(value) {
  return value !== undefined && value !== null && value.toString().trim() !== '';
}

// null/undefined collapse to '' so a comparison against a blank cell behaves the
// same whichever side is blank. Mirrors the frontend's `String(cell ?? '')`.
function actionConditionText(value) {
  return (value === undefined || value === null) ? '' : String(value);
}

// in/nin coerce with a bare String() on both sides, matching the frontend's
// `arr.map(String).includes(String(cell ?? ''))` exactly — including its quirk
// that a null INSIDE the list stringifies to "null" while a null cell is ''.
function actionConditionList(value) {
  var arr = Array.isArray(value) ? value : [value];
  return arr.map(function (item) { return String(item); });
}

/**
 * Evaluates ONE `when` condition for a target.
 *
 * Exactly one left-operand key, in this precedence:
 *   field       a value the user typed into THIS target's own inputs, addressed
 *               by literal column name — ctx.targetFields[targetKey][field]
 *   column      a column on the SOURCE record, as it was BEFORE this action
 *               mutated it
 *   expression  any from/value expression — $record.X, $field.X,
 *               $target.<key>.<Column>, $today, …
 *
 * A condition carrying none of the three, or an op outside the set, is DROPPED
 * rather than failing the action — the same forgiving posture as
 * `normalizeVisibleWhen` on the client. Returns null for "dropped", true/false
 * for a real verdict.
 *
 * An unrecognised `$token` inside an `expression` still THROWS, exactly as it
 * does in a field's `from`/`value`: a typo is a config bug, not a soft "false".
 *
 * >> MATCHED PAIR. The comparison semantics below mirror `evalCondition` /
 * >> `isActionVisible` in FRONTENT/src/composables/resources/useResourceConfig.js,
 * >> which is also what the client mirror `isTargetActive`
 * >> (additionalActionsSchema.js) evaluates. The client decides only what to
 * >> VALIDATE; this decides what EXECUTES. Change one, change the other.
 *
 * @param {Object} condition
 * @param {string} targetKey
 * @param {Object} ctx
 * @returns {boolean|null}
 */
function evaluateActionTargetCondition(condition, targetKey, ctx) {
  if (!condition || typeof condition !== 'object') return null;
  if (!isActionTargetConditionOp(condition.op)) return null;

  var cell;
  if (hasActionConditionOperand(condition.field)) {
    var submitted = (ctx && ctx.targetFields && ctx.targetFields[targetKey]) || {};
    cell = submitted[condition.field.toString().trim()];
  } else if (hasActionConditionOperand(condition.column)) {
    var record = (ctx && ctx.record) || {};
    cell = record[condition.column.toString().trim()];
  } else if (hasActionConditionOperand(condition.expression)) {
    cell = resolveActionExpression(condition.expression, ctx);
  } else {
    return null;
  }

  var isEmpty = (cell === undefined || cell === null || cell === '');
  var text = actionConditionText(cell);

  switch (condition.op) {
    case 'eq': return text === actionConditionText(condition.value);
    case 'ne': return text !== actionConditionText(condition.value);
    case 'in': return actionConditionList(condition.value).indexOf(text) !== -1;
    case 'nin': return actionConditionList(condition.value).indexOf(text) === -1;
    case 'empty': return isEmpty;
    case 'notEmpty': return !isEmpty;
    default: return null;
  }
}

/**
 * Whether a target runs at all on this pass.
 *
 * An absent or empty `when` yields true, so every config authored before this
 * feature keeps its exact behaviour. A single object or an array are both
 * accepted; an array is ANDed. Dropped (malformed) conditions simply do not
 * constrain — a typo runs the target rather than silently suppressing it, which
 * is the safer failure for a gate whose whole job is to skip work.
 *
 * @param {Object} target
 * @param {string} targetKey
 * @param {Object} ctx
 * @returns {boolean}
 */
function isActionTargetActive(target, targetKey, ctx) {
  if (!target || target.when === undefined || target.when === null) return true;

  var list = Array.isArray(target.when) ? target.when : [target.when];
  for (var i = 0; i < list.length; i++) {
    if (evaluateActionTargetCondition(list[i], targetKey, ctx) === false) return false;
  }
  return true;
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
    writtenRows: [],
    // Newest audit timestamp stamped against this resource in this action;
    // handed to updateResourceSyncCursor so the cursor matches the rows.
    maxTimestamp: 0
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
 * The sheet header one of an action's OWN `fields[]` writes to.
 *
 * Mirrors `deriveActionFieldHeader` in additionalActionsSchema.js: the outcome-scoped
 * header first, then the plain column. Null when neither exists, so a config typo
 * writes nothing instead of creating a stray column.
 */
function deriveActionSourceHeader(name, column, stampSuffix, idx) {
  if (!name) return null;
  var derived = column + stampSuffix + name;
  if (idx[derived] !== undefined) return derived;
  if (idx[name] !== undefined) return name;
  return null;
}

/**
 * Turns an action's own `fields[]` into a plain { header: value } record.
 *
 * Same rule as `buildActionTargetRecord`, applied to the SOURCE row: `type` decides
 * visibility, `from`/`value` decide seeding. A field with no `type` is never shown and
 * never user-submittable, so its config value always stands and the client is ignored —
 * which is what makes a hidden stamp trustworthy.
 *
 * A typed field the client did not send is left out entirely rather than blanked, so
 * this cannot clear a column an older caller never knew about.
 */
function buildActionSourceFields(actionConfig, ctx) {
  var fields = (actionConfig && Array.isArray(actionConfig.fields)) ? actionConfig.fields : [];
  var submitted = (ctx && ctx.fields) || {};
  var record = {};

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name) return;

    var header = deriveActionSourceHeader(name, ctx.column, ctx.stampSuffix, ctx.idx);
    if (!header) return;

    var isUserFacing = !!(field.type && field.type.toString().trim());
    if (isUserFacing) {
      if (submitted[header] !== undefined) record[header] = submitted[header];
      else if (submitted[name] !== undefined) record[header] = submitted[name];
      else if (field.from !== undefined) record[header] = resolveActionExpression(field.from, ctx);
      else if (field.value !== undefined) record[header] = resolveActionExpression(field.value, ctx);
      return;
    }

    if (field.from !== undefined) record[header] = resolveActionExpression(field.from, ctx);
    else if (field.value !== undefined) record[header] = resolveActionExpression(field.value, ctx);
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
  var createTimestamp = applyAuditFields(rowData, idx, auth, config, true);
  if (createTimestamp > sheetCtx.maxTimestamp) sheetCtx.maxTimestamp = createTimestamp;
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
  var updateTimestamp = applyAuditFields(rowData, idx, auth, sheetCtx.config, false);
  if (updateTimestamp > sheetCtx.maxTimestamp) sheetCtx.maxTimestamp = updateTimestamp;
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
  ctx.skippedTargets = ctx.skippedTargets || {};
  for (var i = 0; i < list.length; i++) {
    var target = list[i];
    var key = resolveActionTargetKey(target, i);

    // The `when` gate runs BEFORE prepareActionTarget, so a skipped target never
    // opens a sheet context, resolves an expression, or validates. Skipping late
    // would defeat the point: a target left blank cannot pass its own resource's
    // validateRequiredFields.
    if (!isActionTargetActive(target, key, ctx)) {
      ctx.skippedTargets[key] = true;
      results.push({
        key: key,
        mode: (target && target.mode ? target.mode : 'create').toString().trim().toLowerCase(),
        resourceName: (target && target.resource ? target.resource : '').toString().trim(),
        skipped: true
      });
      // Deliberately NOT registered in ctx.targets — $target.<key> must fail
      // loudly rather than read an empty record.
      continue;
    }

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

    updateResourceSyncCursor(resourceName, sheetCtx.maxTimestamp);
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
 * A target skipped by its `when` gate is reported as `skipped: true` WITHOUT a
 * code, so a caller can tell "this action did not create a replacement" from
 * "this action created one" — an omitted entry would be indistinguishable from
 * a config that never declared the target.
 *
 * @param {Array} results
 * @returns {Array} [{ key, mode, resource, code }] | [{ key, mode, resource, skipped: true }]
 */
function summarizeActionTargetResults(results) {
  return (Array.isArray(results) ? results : []).map(function (entry) {
    if (entry && entry.skipped) {
      return {
        key: entry.key,
        mode: entry.mode,
        resource: entry.resourceName,
        skipped: true
      };
    }
    return {
      key: entry.key,
      mode: entry.mode,
      resource: entry.resourceName,
      code: entry.code
    };
  });
}
