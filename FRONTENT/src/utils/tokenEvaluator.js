/**
 * Dynamic token registry + condition evaluator.
 *
 * A condition value may be a token string (e.g. "$startOfMonth", "$daysIn:30") instead of a
 * literal. Tokens resolve at evaluation time against the clock and the logged-in user, so a
 * single sheet-authored rule stays correct as the date rolls over or a different user signs in.
 *
 * This module is deliberately generic — it is NOT list-view specific. Two grammars share it:
 *   - `APP.Resources.ListViews` filter trees — `{ column, operator, value }` inside group nodes.
 *   - `AdditionalActions[].visibleWhen` — a flat AND list of `{ column, op, value }`.
 * Both spellings of the operator key are accepted, and the legacy `ne` / `nin` aliases are
 * folded onto `neq` / `not_in` so schemas already saved in the sheet keep working.
 *
 * Two-sided coercion
 * ------------------
 * Comparing a token against a sheet column only works when both sides sit in the same space.
 * Each token therefore declares:
 *   - `coerce`      — pipeline applied to the COLUMN value.
 *   - `coerceToken` — pipeline applied to the RESOLVED TOKEN value; defaults to `coerce`.
 *
 * Most tokens are symmetric (both sides get the same treatment). The relative-day tokens are
 * deliberately not: the column is converted into "signed days from today" while the token is
 * just a number, so `{ column: 'DueDate', operator: 'lte', value: '$daysIn:7' }` compares
 * day-offset against day-offset.
 *
 * Pipelines are arrays of `COERCES` key names rather than functions so they stay serialisable —
 * a future revision can author them directly in the sheet.
 */

import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import {
  parseAnyDate,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  toDateOnly,
  addDays,
  addMonths,
  dayOfYear,
  isoWeek,
  daysFromToday
} from 'src/utils/dateHelpers'

/**
 * Named coercion primitives. Composable — a pipeline applies them left to right.
 */
export const COERCES = {
  text: (v) => String(v ?? ''),
  trim: (v) => String(v ?? '').trim(),
  lowercase: (v) => String(v ?? '').toLowerCase(),
  slug: (v) => String(v ?? '').trim().toLowerCase(),
  number: (v) => Number(v),
  /** Any supported date shape → epoch milliseconds. NaN when unparseable. */
  epoch: (v) => {
    const date = parseAnyDate(v)
    return date ? date.getTime() : NaN
  },
  /** Any supported date shape → 'YYYY-MM-DD'. */
  dateOnly: (v) => toDateOnly(v),
  /** Any supported date shape → day of year, 1-366. */
  dayOfYear: (v) => dayOfYear(v),
  /** Any supported date shape → zero-padded month, '01'-'12'. */
  month2: (v) => {
    const date = parseAnyDate(v)
    return date ? String(date.getMonth() + 1).padStart(2, '0') : ''
  },
  /** Any supported date shape → four-digit year as a number. */
  year: (v) => {
    const date = parseAnyDate(v)
    return date ? date.getFullYear() : NaN
  },
  /** Any supported date shape → ISO week number, 1-53. */
  week: (v) => isoWeek(v),
  /** Any supported date shape → signed whole days from today (future positive). */
  dayNum: (v) => daysFromToday(v)
}

const nowMs = () => Date.now()

/**
 * Token registry.
 *
 * `value(params, ctx)` receives the colon-separated params after the token name (always an
 * array of strings) and the evaluation context `{ user }`. It returns the raw value; the
 * `coerceToken` pipeline converts it — resolvers stay dumb extractors.
 *
 * Tokens returning an array are intended for the `in` / `not_in` operators.
 */
export const TOKENS = {
  // ---- Date / time ----------------------------------------------------------
  $now: {
    label: 'Now (timestamp)',
    group: 'Date & Time',
    value: () => nowMs(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $date: {
    label: 'Date (YYYY-MM-DD)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const days = Number.isNaN(offset) ? 0 : offset
      return toDateOnly(addDays(new Date(), days))
    },
    coerce: ['dateOnly'],
    coerceToken: ['text']
  },
  $day: {
    label: 'Day of year (1-366)',
    group: 'Date & Time',
    value: () => dayOfYear(new Date()),
    coerce: ['dayOfYear'],
    coerceToken: ['number']
  },
  $month: {
    label: 'Month (01-12)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const months = Number.isNaN(offset) ? 0 : offset
      const targetDate = addMonths(new Date(), months)
      return targetDate ? String(targetDate.getMonth() + 1).padStart(2, '0') : ''
    },
    coerce: ['month2'],
    coerceToken: ['text']
  },
  $year: {
    label: 'Current year (YYYY)',
    group: 'Date & Time',
    value: () => new Date().getFullYear(),
    coerce: ['year'],
    coerceToken: ['number']
  },
  $week: {
    label: 'Current ISO week (1-53)',
    group: 'Date & Time',
    value: () => isoWeek(new Date()),
    coerce: ['week'],
    coerceToken: ['number']
  },
  $startOfDay: {
    label: 'Start of day (timestamp)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const days = Number.isNaN(offset) ? 0 : offset
      return startOfDay(addDays(new Date(), days))?.getTime()
    },
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $endOfDay: {
    label: 'End of day (timestamp)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const days = Number.isNaN(offset) ? 0 : offset
      return endOfDay(addDays(new Date(), days))?.getTime()
    },
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $startOfMonth: {
    label: 'Start of month (timestamp)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const months = Number.isNaN(offset) ? 0 : offset
      return startOfMonth(addMonths(new Date(), months))?.getTime()
    },
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $endOfMonth: {
    label: 'End of month (timestamp)',
    group: 'Date & Time',
    param: 'N',
    paramDefault: '0',
    value: (params) => {
      const offset = params && params[0] !== undefined ? Number(params[0]) : 0
      const months = Number.isNaN(offset) ? 0 : offset
      return endOfMonth(addMonths(new Date(), months))?.getTime()
    },
    coerce: ['epoch'],
    coerceToken: ['number']
  },

  // ---- Relative days (parameterised) ----------------------------------------
  // Column is converted to signed days from today, so these compare offset-to-offset.
  $daysAgo: {
    label: 'N days ago',
    group: 'Relative Days',
    param: 'N',
    paramDefault: '7',
    value: (params) => -Math.abs(Number(params[0])),
    coerce: ['dayNum'],
    coerceToken: ['number']
  },
  $daysIn: {
    label: 'In N days',
    group: 'Relative Days',
    param: 'N',
    paramDefault: '30',
    value: (params) => Math.abs(Number(params[0])),
    coerce: ['dayNum'],
    coerceToken: ['number']
  },

  // ---- Logged-in user -------------------------------------------------------
  $userCode: {
    label: 'My user code',
    group: 'Current User',
    // buildAuthUserPayload (GAS/auth.gs) maps UserID → `id`; `code` is tolerated if ever added.
    value: (params, ctx) => ctx.user?.code ?? ctx.user?.id,
    coerce: ['slug']
  },
  $userEmail: {
    label: 'My email',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.email,
    coerce: ['slug']
  },
  $userName: {
    label: 'My name',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.name,
    coerce: ['slug']
  },
  $userDesignation: {
    label: 'My designation',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.designation?.name,
    coerce: ['slug']
  },
  $userRole: {
    label: 'My primary role',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.role,
    coerce: ['slug']
  },
  $userRoles: {
    label: 'My roles (list — use with "is one of")',
    group: 'Current User',
    array: true,
    value: (params, ctx) => {
      const roles = ctx.user?.roles
      if (!Array.isArray(roles)) return []
      return roles.map((entry) => (typeof entry === 'string' ? entry : entry?.name)).filter(Boolean)
    },
    coerce: ['slug']
  },
  $userRegion: {
    label: 'My region code',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.accessRegion?.code,
    coerce: ['slug']
  },
  $userRegions: {
    label: 'My accessible regions (list — use with "is one of")',
    group: 'Current User',
    array: true,
    value: (params, ctx) => {
      const codes = ctx.user?.accessRegion?.accessibleCodes
      return Array.isArray(codes) ? codes.filter(Boolean) : []
    },
    coerce: ['slug']
  }
}

/** Case-insensitive lookup, so sheet authors can write `$startofmonth`. */
const TOKEN_INDEX = Object.keys(TOKENS).reduce((acc, key) => {
  acc[key.slice(1).toLowerCase()] = TOKENS[key]
  return acc
}, {})

// Fail loudly in dev if a pipeline references a primitive that does not exist — a typo'd
// pipeline name would otherwise surface only as a silently empty tab.
Object.entries(TOKENS).forEach(([name, spec]) => {
  const pipelines = [spec.coerce, spec.coerceToken].filter(Boolean)
  pipelines.forEach((pipeline) => {
    pipeline.forEach((step) => {
      if (!COERCES[step]) {
        throw new Error(`[tokenEvaluator] Token "${name}" references unknown coerce "${step}".`)
      }
    })
  })
})

/**
 * Legacy operator spellings folded onto the canonical set. `ne`/`nin` are what the action
 * manager wrote before the operator list was standardised, and they are all over the seed
 * configs in `GAS/syncAppResources.gs` — normalising here keeps those schemas evaluating.
 */
export const OPERATOR_ALIASES = {
  ne: 'neq',
  nin: 'not_in',
  notin: 'not_in',
  not_empty: 'notEmpty',
  notempty: 'notEmpty'
}

/** The canonical operator set both grammars share. */
export const OPERATORS = [
  'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'contains', 'empty', 'notEmpty'
]

const VALUELESS_OPERATORS = new Set(['empty', 'notEmpty'])

/** Canonicalises an operator, resolving the `ne`/`nin` aliases. Unknown input passes through. */
export function normalizeOperator(op) {
  const raw = (op ?? '').toString().trim()
  if (!raw) return ''
  if (OPERATOR_ALIASES[raw]) return OPERATOR_ALIASES[raw]
  const lower = raw.toLowerCase()
  if (OPERATOR_ALIASES[lower]) return OPERATOR_ALIASES[lower]
  // `notEmpty` is the only camelCase member, so a case-insensitive match is safe here.
  return OPERATORS.find((known) => known.toLowerCase() === lower) || raw
}

/** Runs a pipeline of COERCES names over a value, left to right. */
export function applyCoerces(value, pipeline) {
  return (pipeline || []).reduce((acc, step) => COERCES[step](acc), value)
}

/**
 * Parses a token string into its spec and params.
 * Accepts `$name` and `$name:p1:p2` (params may be negative or decimal).
 *
 * @returns {{ spec: Object, params: String[] }|null} null when `value` is not a known token.
 */
export function parseToken(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^\$([A-Za-z][A-Za-z0-9]*)((?::-?[\w.-]+)*)$/)
  if (!match) return null
  const spec = TOKEN_INDEX[match[1].toLowerCase()]
  if (!spec) return null
  const params = match[2] ? match[2].slice(1).split(':') : []
  return { spec, params }
}

/** True when the value looks like a registered token string. */
export function isToken(value) {
  return parseToken(value) !== null
}

const isBlank = (v) => v === undefined || v === null || v === ''

/**
 * Compares two already-coerced values. Both sides are assumed to sit in the same space.
 */
function compareCoerced(operator, a, b) {
  const asArray = Array.isArray(b) ? b : [b]

  switch (operator) {
    case 'eq':
      return a === asArray[0]
    case 'neq':
      return a !== asArray[0]
    case 'in':
      return asArray.some((v) => v === a)
    case 'not_in':
      return !asArray.some((v) => v === a)
    case 'gt':
      return a > asArray[0]
    case 'gte':
      return a >= asArray[0]
    case 'lt':
      return a < asArray[0]
    case 'lte':
      return a <= asArray[0]
    case 'contains':
      // Substring matching is only meaningful on strings, whatever the declared pipeline.
      return COERCES.lowercase(a).includes(COERCES.lowercase(asArray[0]))
    default:
      return false
  }
}

/**
 * Compiles one condition against the current clock/user.
 *
 * Everything that does not depend on the row is resolved here — token parsing, `spec.value`,
 * the `coerceToken` pipeline, and the lowercase/numeric forms of literal values — so a pass
 * over thousands of rows only runs the column-side coercion and the comparison.
 *
 * A token anywhere in the value governs coercion for the whole condition. The list-views
 * manager splits `in`/`not_in` values on commas, so a token can arrive wrapped in an array.
 *
 * @param {Object} condition - `{ column, operator|op, value }`
 * @param {Object} [ctx] - token evaluation context, `{ user }`. Required only by user tokens.
 * @param {Object} [options]
 * @param {Boolean} [options.strictColumn=true] - when false, a column absent from the row is
 *        evaluated as an empty value instead of failing the condition outright. List views need
 *        the strict form (a filter on a column this resource does not have must match nothing);
 *        `visibleWhen` needs the lenient one, which is what its original evaluator did.
 */
export function prepareCondition(condition, ctx = {}, options = {}) {
  const { column, value } = condition
  const operator = normalizeOperator(condition.operator ?? condition.op)
  const strictColumn = options.strictColumn !== false
  const base = { type: 'condition', column, operator, strictColumn }

  // `empty` / `notEmpty` test the column alone — there is no right-hand side to resolve, so
  // a token sitting in `value` (or no value at all) is simply irrelevant.
  if (VALUELESS_OPERATORS.has(operator)) return base

  const values = Array.isArray(value) ? value : [value]
  const parsed = values.map((entry) => parseToken(entry))
  const governing = parsed.find(Boolean)

  if (governing) {
    const tokenPipeline = governing.spec.coerceToken || governing.spec.coerce || []
    const right = []
    parsed.forEach((token, idx) => {
      const resolved = token ? token.spec.value(token.params, ctx) : values[idx]
      // Array-valued tokens ($userRoles) coerce per element — coercing the array whole
      // would yield "auditor,approver" and match nothing.
      if (Array.isArray(resolved)) {
        resolved.forEach((item) => right.push(applyCoerces(item, tokenPipeline)))
      } else {
        right.push(applyCoerces(resolved, tokenPipeline))
      }
    })
    return { ...base, columnPipeline: governing.spec.coerce || [], right }
  }

  // Literal condition: pre-normalise both the whole value (`eq`/`contains`/ordered operators
  // stringify the raw value, arrays included) and its per-entry list form (`in`/`not_in`).
  return {
    ...base,
    literalStr: String(value).toLowerCase(),
    literalList: values.map((entry) => String(entry).toLowerCase()),
    literalNum: Number(value)
  }
}

/**
 * Compiles a filter tree (group or condition) once per evaluation pass.
 *
 * @param {Object} filter - group or condition node
 * @param {Object} [ctx] - token evaluation context, `{ user }`. Required only by user tokens.
 * @param {Object} [options] - see `prepareCondition`.
 * @returns {Object|null} prepared tree for `evaluatePreparedFilter`
 */
export function prepareFilter(filter, ctx = {}, options = {}) {
  if (!filter) return null
  if (filter.type === 'condition') return prepareCondition(filter, ctx, options)
  if (filter.type === 'group') {
    return {
      type: 'group',
      logic: filter.logic,
      items: (filter.items || []).map((item) => prepareFilter(item, ctx, options))
    }
  }
  return null // unknown node = match all
}

/**
 * Evaluates a prepared condition against a row. No token parsing happens here.
 */
function evaluatePreparedCondition(node, row) {
  const { column, operator } = node
  if (!column) return false
  if (node.strictColumn !== false && !(column in row)) return false

  const rowValue = row[column]

  if (operator === 'empty') return isBlank(rowValue)
  if (operator === 'notEmpty') return !isBlank(rowValue)

  if (node.right) {
    const left = applyCoerces(rowValue, node.columnPipeline)
    // A column that cannot be parsed into the comparison space is never a match — returning
    // false explicitly rather than relying on NaN comparison semantics keeps `neq`/`not_in`
    // from silently sweeping in every unparseable row.
    if (typeof left === 'number' && Number.isNaN(left)) return false
    return compareCoerced(operator, left, node.right)
  }

  const rowStr = (rowValue ?? '').toString().toLowerCase()

  switch (operator) {
    case 'eq':
      return rowStr === node.literalStr
    case 'neq':
      return rowStr !== node.literalStr
    case 'in':
      return node.literalList.some((v) => rowStr === v)
    case 'not_in':
      return !node.literalList.some((v) => rowStr === v)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      // Numeric comparison only when BOTH sides coerce, else lowercase strings.
      const numA = Number(rowValue)
      const numeric = Number.isFinite(numA) && Number.isFinite(node.literalNum)
      const a = numeric ? numA : String(rowValue).toLowerCase()
      const b = numeric ? node.literalNum : node.literalStr
      if (operator === 'gt') return a > b
      if (operator === 'gte') return a >= b
      if (operator === 'lt') return a < b
      return a <= b
    }
    case 'contains':
      return rowStr.includes(node.literalStr)
    default:
      return false
  }
}

/**
 * Recursively evaluates a prepared filter tree against a row.
 */
export function evaluatePreparedFilter(prepared, row) {
  if (!prepared) return true
  if (prepared.type === 'condition') return evaluatePreparedCondition(prepared, row)
  if (prepared.type === 'group') {
    const items = prepared.items
    if (!items.length) return true // empty group = match all
    if (prepared.logic === 'OR') {
      return items.some((item) => evaluatePreparedFilter(item, row))
    }
    // Default AND
    return items.every((item) => evaluatePreparedFilter(item, row))
  }
  return true
}

/**
 * Evaluates a filter tree against a single row.
 *
 * Backwards-compatible entry point — prepares the filter for this one row. Filtering a
 * collection should call `prepareFilter` once and then `evaluatePreparedFilter` per row.
 *
 * @param {Object} filter - group or condition node
 * @param {Object} row - the record under test
 * @param {Object} [ctx] - token evaluation context, `{ user }`. Required only by user tokens.
 * @param {Object} [options] - see `prepareCondition`.
 */
export function evaluateFilter(filter, row, ctx = {}, options = {}) {
  return evaluatePreparedFilter(prepareFilter(filter, ctx, options), row)
}

/**
 * The evaluation context outside a component `setup()`.
 *
 * `isActionVisible` is a plain exported function called from computeds, guards and pipelines,
 * so it cannot hold a composable. Pinia resolves the active store fine in those positions, but
 * a call made before the store is installed (module init, an isolated unit harness) would
 * throw — a logged-out context is the correct answer there, not a crash.
 */
export function resolveTokenContext() {
  try {
    const authStore = useAuthStore()
    return { user: authStore?.user ?? null }
  } catch {
    return { user: null }
  }
}

/**
 * Composable: the token evaluator with the logged-in user pre-bound.
 *
 * Every returned function drops the `ctx` argument — it is supplied from the auth store and
 * re-read on each call, so a user switch is picked up without re-creating the evaluator. Call
 * the module-level functions directly when an explicit context is needed instead.
 */
export function useTokenEvaluator() {
  const authStore = useAuthStore()

  /** Evaluation context for user-aware tokens ($userCode, $userRoles, ...). */
  const tokenContext = computed(() => ({ user: authStore.user }))

  return {
    tokenContext,
    TOKENS,
    COERCES,
    isToken,
    parseToken,
    applyCoerces,
    normalizeOperator,
    prepareCondition: (condition, options) => prepareCondition(condition, tokenContext.value, options),
    prepareFilter: (filter, options) => prepareFilter(filter, tokenContext.value, options),
    evaluatePreparedFilter,
    evaluateFilter: (filter, row, options) => evaluateFilter(filter, row, tokenContext.value, options)
  }
}
