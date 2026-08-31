import { resolveFieldComponent, resolveFieldType } from 'src/_fields/useFieldResolver'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { evaluateConditionOp } from './useResourceConfig'

/**
 * Field-schema builders for the AdditionalActions system.
 *
 * Turns an `AdditionalActions` config entry into the render-ready descriptors
 * the action dialog mounts through `_fields/`. Everything here is pure — record
 * data and option records arrive as arguments — so the composable that owns the
 * store access stays thin and this stays testable.
 *
 * Two field families, deliberately asymmetric:
 *
 *   action.fields[]    write columns on the SOURCE record. Authored with short
 *                      names (`Comment`) that derive to
 *                      `{column}{PascalCase(columnValue)}{name}`.
 *   target.fields[]    write columns on ANOTHER record. Authored with LITERAL
 *                      column names — nothing is derived, because a target's
 *                      columns have no relationship to the source's outcome.
 *
 * Visibility follows one rule: a field renders if and only if it carries a
 * `type`. `from` / `value` fields are resolved server-side and never travel to
 * the client as inputs — see GAS/actionTargets.gs.
 */

/**
 * Mirrors `toActionHeaderSuffix` in GAS/resourceApi.gs.
 *
 * NOT `appHelpers.toPascalCase`: that splits on `[- ]` only, so an underscored
 * outcome like `REVISION_REQUIRED` becomes `Revision_required` there but
 * `RevisionRequired` on the server. The derived header must match the sheet
 * column the backend writes, so this splits on any non-alphanumeric exactly as
 * GAS does. `toPascalCase` is load-bearing for the section/column resolvers, so
 * it is left alone rather than widened.
 */
export function actionHeaderSuffix (value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

// Free-text names that warrant a multiline control. The Manage Actions admin
// dialog stamps `type: 'text'` onto every field it creates, so 'text' is its
// DEFAULT rather than a deliberate choice — a field called `Comment` would
// otherwise render as a cramped single-line input.
const TEXTAREA_NAME_HINTS = ['comment', 'reason', 'remark', 'note', 'description']

function isTextareaName (name) {
  const lower = String(name ?? '').toLowerCase()
  // `date` wins so e.g. `CommentDate` stays a date picker.
  if (lower.includes('date')) return false
  return TEXTAREA_NAME_HINTS.some((hint) => lower.includes(hint))
}

function hasOptionSource (field) {
  if (Array.isArray(field?.options) && field.options.length) return true
  return !!(field?.source?.resource && field?.source?.field)
}

/**
 * Resolves a configured field's control type.
 *
 * An explicit `date` / `number` / `select` / `file` / … is always respected. The
 * stamped `text` default is allowed to upgrade to `textarea` (comment-ish name)
 * or `select` (the field carries option sourcing), since neither could have been
 * a deliberate authoring choice.
 */
export function resolveActionFieldType (field, header) {
  const configured = String(field?.type ?? '').trim().toLowerCase()
  if (hasOptionSource(field) && (!configured || configured === 'text')) return 'select'
  if (configured === 'text' && isTextareaName(field?.name)) return 'textarea'
  if (!configured) return resolveFieldType({ header })
  return configured
}

/**
 * Maps a source-record field name onto the sheet header backing it.
 *
 * Canonical authoring is the SHORT name, deriving to
 * `{column}{PascalCase(columnValue)}{name}`. Two fallbacks keep older configs
 * working: a fully-qualified header written out in full, and a plain resource
 * column that is not outcome-scoped at all. Returns null when nothing matches,
 * which hides the field rather than writing to a column that does not exist.
 */
export function deriveActionFieldHeader (name, column, suffix, headers) {
  if (!name) return null
  const list = Array.isArray(headers) ? headers : []
  const derived = `${column}${suffix}${name}`
  if (list.includes(derived)) return derived
  if (list.includes(name)) return name
  return null
}

/**
 * Builds `{ label, value }` options for a select field.
 *
 * A literal `options[]` wins and is used as-is. Otherwise `source` is resolved
 * against the records handed in: the value is always `record[source.field]`, the
 * label is the descriptor chosen by `resolveLabelField`.
 */
export function buildFieldOptions (field, records, headers) {
  if (Array.isArray(field.options) && field.options.length) return field.options

  const { field: valueField } = field.source || {}
  if (!valueField) return []

  const rows = Array.isArray(records) ? records : []
  const labelField = resolveLabelField(field.source, headers, rows)

  const seen = new Set()
  const options = []
  for (const record of rows) {
    const value = record?.[valueField]
    if (value === undefined || value === null || value === '') continue
    if (seen.has(value)) continue
    seen.add(value)
    options.push({ label: buildOptionLabel(record, valueField, labelField), value })
  }
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Picks the property carrying the human-readable descriptor, in precedence
 * order: an explicit `source.label`, a `Name` column, then the resource's second
 * column (index 0 is always `Code`, so index 1 is the conventional descriptor).
 */
function resolveLabelField (source, headers, records) {
  if (source?.label) return source.label
  const list = Array.isArray(headers) && headers.length ? headers : Object.keys(records[0] || {})
  if (list.includes('Name')) return 'Name'
  return list[1] || null
}

// `Warehouses` + label `Name` → "Main Warehouse (WH001)". The value is appended
// so the code stays visible and searchable; a label field that IS the value
// field, or an empty label cell, degrades to the bare value.
function buildOptionLabel (record, valueField, labelField) {
  const value = String(record[valueField])
  if (!labelField || labelField === valueField) return value
  const text = record[labelField]
  if (text === undefined || text === null || String(text).trim() === '') return value
  return `${text} (${value})`
}

// `{Code}`, `{$outlet.Name}`, `{Progress}` — one placeholder, no nesting.
const TEMPLATE_PATTERN = /\{([^{}]+)\}/g

/**
 * Resolves a display template against a record.
 *
 * Used for the dialog's `title` / `subtitle`. Deliberately a TEMPLATE rather than
 * the `from`/`value` expression grammar, for two reasons:
 *
 *   1. A heading is usually several fields plus literal text — `"{$outlet.Name}
 *      • {Code}"` — which a single-value expression cannot express.
 *   2. `$outlet.Name` would parse as an unknown TOKEN under that grammar and
 *      throw. Inside `{}` the record is the context, so it is a plain property
 *      path and `$outlet` resolves naturally as the relation getter it is.
 *
 * Record-only by design: no `$userName` / `$today` tokens, because `$outlet` (a
 * record property) and `$userName` (a token) would otherwise collide in one
 * namespace. A dialog heading describes the record.
 *
 * Purely presentational — the server never sees these.
 */
export function resolveRecordTemplate (template, record) {
  if (typeof template !== 'string' || !template.trim()) return ''
  const filled = template.replace(TEMPLATE_PATTERN, (_, path) => {
    const value = readRecordPath(record, path.trim())
    return value === undefined || value === null ? '' : String(value)
  })
  return tidySeparators(filled)
}

// Dot path walk. Tolerates a missing relation (`$outlet` undefined on an
// un-enriched record) by short-circuiting rather than throwing.
function readRecordPath (record, path) {
  if (!record || !path) return ''
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), record)
}

// An unresolved placeholder leaves its separators stranded — `"{$outlet.Name} •
// {Code}"` with no outlet would render " • OV26000018". Collapse runs of
// whitespace and separators, then trim them off both ends.
function tidySeparators (text) {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/([•\-|,])(\s*\1)+/g, '$1')
    .replace(/^[\s•\-|,]+/, '')
    .replace(/[\s•\-|,]+$/, '')
    .trim()
}

/**
 * Display-only resolution of a `from` / `value` expression.
 *
 * The server re-resolves every expression authoritatively; this exists purely so
 * a `from` + `type` field can show the user what it copied. Anything this cannot
 * resolve yields '' — the field simply renders empty and the server fills it.
 *
 * Only the subset a browser can answer is handled: `$record.*` and the identity
 * / date tokens. `$target.*` is deliberately absent — it refers to a record that
 * does not exist until the server runs.
 */
const TEMPLATE_TAG = /\$\{([^}]*)\}/g

export function prefillExpression (expression, { record, user } = {}) {
  if (expression === undefined || expression === null) return ''
  if (typeof expression !== 'string') return expression

  // A `${...}` tag makes the whole string a TEMPLATE: each tag resolves on its own
  // and the text around it is kept verbatim, so a header can be assembled from
  // several tokens (`---POSTPONED ON ${$today}---`).
  if (TEMPLATE_TAG.test(expression)) {
    TEMPLATE_TAG.lastIndex = 0
    return expression.replace(TEMPLATE_TAG, (_match, inner) => {
      const value = prefillExpression(String(inner).trim(), { record, user })
      return value === undefined || value === null ? '' : String(value)
    })
  }

  const expr = expression.trim()
  if (!expr || expr[0] !== '$') return expression
  if (expr.startsWith('$$')) return expr.slice(1)

  const dot = expr.indexOf('.')
  const head = dot === -1 ? expr : expr.slice(0, dot)
  const tail = dot === -1 ? '' : expr.slice(dot + 1)

  if (head === '$record') return record?.[tail] ?? ''
  if (head === '$target' || head === '$field') return ''

  const [token, param] = expr.split(':')
  // Lowercased, mirroring `resolveActionToken` (GAS/actionTargets.gs) and
  // tokenEvaluator.js's TOKEN_INDEX: every token is case-insensitive, so `$dateTime`
  // and `$datetime` both resolve on both sides of the wire.
  switch (token.toLowerCase()) {
    case '$usercode': return user?.code ?? user?.id ?? ''
    case '$username': return user?.name ?? ''
    case '$useremail': return user?.email ?? ''
    case '$userrole': return user?.role ?? ''
    case '$userdesignation': return user?.designation?.name ?? ''
    case '$userregion': return user?.accessRegion?.code ?? ''
    case '$now': return Date.now()
    // Editable prefill of a workflow stamp: without this a target field carrying
    // `value: '$dateTime'` plus a `type` rendered BLANK in the dialog, then the server
    // silently re-resolved it on submit — the value appeared out of nowhere.
    case '$datetime': return toDateTime24(new Date())
    case '$today': return dateOnly(0)
    case '$date': return dateOnly(Number(param) || 0)
    default: return ''
  }
}

function dateOnly (offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + (Number(offsetDays) || 0))
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * The addressing key for a target: an explicit `key`, else its array index.
 * Mirrors `resolveActionTargetKey` in GAS/actionTargets.gs — the same string
 * prefixes every one of that target's form addresses (`newVisit.Date`) and
 * names it in `$target.<key>.<Column>`.
 */
export function resolveTargetKey (target, index) {
  return String(target?.key ?? '').trim() || String(index)
}

const CONDITION_OPS = new Set(['eq', 'ne', 'in', 'nin', 'empty', 'notEmpty'])

/**
 * Normalizes a target's `when` into an array of usable conditions.
 *
 * Accepts a single object or an array (ANDed). A condition with an unknown op,
 * or with none of the three left-operand keys, is DROPPED rather than treated as
 * an error — the same forgiving posture as `normalizeVisibleWhen`, and dropping
 * means it does not constrain, so a typo runs the target rather than silently
 * suppressing it.
 */
function normalizeTargetWhen (when) {
  if (when == null) return []
  return (Array.isArray(when) ? when : [when])
    .map((c) => {
      if (!c || typeof c !== 'object' || !CONDITION_OPS.has(c.op)) return null
      const key = ['field', 'column', 'expression'].find((k) => String(c[k] ?? '').trim())
      return key ? { key, ref: String(c[key]).trim(), op: c.op, value: c.value } : null
    })
    .filter(Boolean)
}

/** A target declares a `when` gate at all — the dialog labels such a group optional. */
export function targetHasCondition (target) {
  return normalizeTargetWhen(target?.when).length > 0
}

/**
 * Whether a target's `when` gate currently passes, evaluated against the LIVE
 * dialog form.
 *
 * >> PRESENTATION AND VALIDATION ONLY. The server re-decides every gate in
 * >> `isActionTargetActive` (GAS/actionTargets.gs) from the trusted config, and
 * >> that decision is the only one that governs what is written. This exists so
 * >> the dialog does not demand a `required` field inside a block the user has
 * >> chosen not to fill.
 *
 * Left operands resolve exactly as they do server-side:
 *   field       `form['<key>.<column>']` — this target's own input
 *   column      `record[column]` — the source record, pre-mutation
 *   expression  via `prefillExpression`, so the browser-answerable subset
 *               (`$record.*`, identity/date tokens) works and `$field.*` /
 *               `$target.*` yield '' here while the server resolves them fully.
 *               A gate on either therefore validates leniently and is decided
 *               for real on the server.
 */
export function isTargetActive (target, { record, form, key } = {}) {
  const conditions = normalizeTargetWhen(target?.when)
  if (!conditions.length) return true

  return conditions.every((c) => {
    let cell
    if (c.key === 'field') cell = (form || {})[`${key}.${c.ref}`]
    else if (c.key === 'column') cell = (record || {})[c.ref]
    else cell = prefillExpression(c.ref, { record })
    return evaluateConditionOp(c.op, cell, c.value)
  })
}

/**
 * Builds the source-record field group (the action's own `fields[]`).
 *
 * A field renders only when BOTH hold: it is listed in the config, and its
 * derived header exists on the resource. There is no auto-detection — the JSON
 * is authoritative.
 *
 * `record` / `user` are optional and drive the same `from`/`value` SEEDING the
 * target groups get (§7.2: `from` + `type` is an editable prefill, not a hidden
 * copy). Omit them and every seed is '' — which is exactly the behaviour before
 * seeding reached this group.
 *
 * @returns {Object|null} null when the action collects nothing on the record
 */
export function buildSourceFieldGroup (action, { headers, columnValue, optionsFor, record = null, user = null }) {
  const configFields = Array.isArray(action?.fields) ? action.fields : []
  if (!configFields.length || !columnValue) return null

  const column = action.column || 'Progress'
  const suffix = actionHeaderSuffix(columnValue)

  const fields = configFields
    .map((field) => {
      const header = deriveActionFieldHeader(field.name, column, suffix, headers)
      if (!header) return null
      return describeField(field, {
        address: header,
        header,
        optionsFor,
        mode: 'edit',
        seed: prefillExpression(field.from ?? field.value, { record, user })
      })
    })
    .filter(Boolean)

  return fields.length ? { key: '', label: '', fields } : null
}

/**
 * Builds one group per configured target, containing only its user-facing
 * fields. A target whose fields are entirely `from` / `value` contributes no
 * group — it still executes server-side, it just asks the user nothing.
 *
 * A conditional target's inputs are rendered like any other: a `when` keyed on
 * `field` is satisfied by TYPING into this very group, so hiding it would make
 * the condition unsatisfiable. The group is tagged `hasCondition` instead, so
 * the dialog can present it as optional.
 */
export function buildTargetFieldGroups (action, { record, user, optionsFor, headersFor }) {
  const targets = Array.isArray(action?.targets) ? action.targets : []

  return targets
    .map((target, index) => {
      const key = resolveTargetKey(target, index)
      const targetHeaders = headersFor(target.resource)
      const mode = String(target.mode ?? '').trim().toLowerCase() === 'update' ? 'edit' : 'add'

      const fields = (Array.isArray(target.fields) ? target.fields : [])
        .filter((field) => field?.name && field?.type)
        .filter((field) => !targetHeaders.length || targetHeaders.includes(field.name))
        .map((field) => describeField(field, {
          address: `${key}.${field.name}`,
          header: field.name,
          optionsFor,
          mode,
          // `from` / `value` on a typed field is a PREFILL the user may edit.
          seed: prefillExpression(field.from ?? field.value, { record, user })
        }))

      return fields.length
        ? {
            key,
            label: target.label || target.resource || '',
            hasCondition: targetHasCondition(target),
            fields
          }
        : null
    })
    .filter(Boolean)
}

/**
 * Assembles one render-ready field descriptor.
 *
 * `config` is the props bag `_fields/<type>/<Mode>.vue` consumes — the action
 * system's equivalent of `FormRecord.fieldRenderProps()`.
 */
function describeField (field, { address, header, optionsFor, mode, seed = '' }) {
  const type = resolveActionFieldType(field, header)
  const label = field.label || String(field.name ?? '').replace(/([a-z])([A-Z])/g, '$1 $2')
  const options = type === 'select' ? optionsFor(field) : null

  return {
    address,
    header,
    name: field.name,
    label,
    type,
    required: !!field.required,
    seed,
    component: resolveFieldComponent(type, mode),
    config: {
      label,
      outlined: true,
      ...(options ? { options } : {}),
      ...(field.hint ? { hint: field.hint } : {})
    }
  }
}
