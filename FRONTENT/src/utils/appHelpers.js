import { effectScope } from 'vue'

/**
 * Converts a camelCase or PascalCase string to a human-readable label.
 * e.g. "purchaseRequisition" → "Purchase Requisition"
 */
export function humanizeString(str) {
  if (!str) return ''
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

/**
 * Converts a slug or any string to PascalCase (no spaces, first char of each word capitalised).
 * Handles hyphens, underscores and spaces as word separators.
 * e.g. "purchase-requisition-items" → "PurchaseRequisitionItems"
 * e.g. "Revision Required"          → "RevisionRequired"
 * e.g. "REVISION_REQUIRED"          → "RevisionRequired"
 *
 * Underscores are separators because workflow outcome values are authored in
 * SCREAMING_SNAKE (`PENDING_APPROVAL`, `INVOICE_GENERATED`) and the sheet columns
 * derived from them are PascalCase (`ProgressPendingApprovalComment`). Without
 * it, `deriveActionStampHeaders` produced `ProgressRevision_requiredAt`, which
 * matched no real column — so those stamp columns leaked into detail views on
 * every underscored outcome.
 *
 * Kept in sync with `toActionHeaderSuffix` in GAS/resourceApi.gs, which splits on
 * any non-alphanumeric. The two agree for every separator AQL actually uses.
 * Where a byte-exact match with the server is required rather than merely likely,
 * use `actionHeaderSuffix` in composables/resources/additionalActionsSchema.js.
 */
export function toPascalCase(str) {
  if (!str) return ''
  return str
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Set of audit column headers always hidden in detail views.
 */
export const AUDIT_HEADERS = new Set(['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'])

/**
 * Derives the set of action stamp column headers to hide from a resource's additionalActions config.
 * Sources: action.columnValue + each entry in action.columnValueOptions[]
 * Each value is converted to PascalCase (spaces stripped) then suffixed with By/At.
 *
 * @param {Array} additionalActions - parsed array from useResourceConfig
 * @returns {Set<string>}
 */
export function deriveActionStampHeaders(additionalActions) {
  const stamps = new Set()
  if (!Array.isArray(additionalActions)) return stamps

  additionalActions.forEach((action) => {
    const column = action.column ? toPascalCase(action.column) : ''
    const values = []
    if (action.columnValue) values.push(action.columnValue)
    if (Array.isArray(action.columnValueOptions)) values.push(...action.columnValueOptions)

    values.forEach((val) => {
      const pascal = toPascalCase(val)
      const prefix = column ? `${column}${pascal}` : pascal
      stamps.add(`${prefix}By`)
      stamps.add(`${prefix}At`)
    })
  })

  return stamps
}


/**
 * Default human-readable rendering of a raw record cell value.
 *
 * Relation columns hydrate into an object (`{ Code, Name, ... }`); everything
 * else is a primitive. Shared by every container that feeds `displayValue` into
 * a `_fields/<type>/View.vue` component (ViewRecord, ViewChildCompact) so the
 * detail grid and the compact child table never disagree on a cell.
 *
 * @param {*} value
 * @param {string} emptyText
 * @returns {*} primitive value, composed relation label, or `emptyText`
 */
export function resolveDisplayValue(value, emptyText = '-') {
  if (value && typeof value === 'object') {
    if (value.Name != null) return `${value.Name} (${value.Code})`
    if (value.Code != null) return `${value.Code}`
    return emptyText
  }
  return value ?? emptyText
}

/**
 * Filters resolvedFields for display in a detail view:
 * - Excludes Code
 * - Excludes AUDIT_HEADERS
 * - Excludes derived action stamp headers
 *
 * @param {Array} resolvedFields
 * @param {Set<string>} actionStampHeaders
 * @returns {Array}
 */
export function filterDetailFields(resolvedFields, actionStampHeaders) {
  if (!Array.isArray(resolvedFields)) return []
  return resolvedFields.filter((f) => {
    if (f.header === 'Code') return false
    if (AUDIT_HEADERS.has(f.header)) return false
    if (actionStampHeaders && actionStampHeaders.has(f.header)) return false
    return true
  })
}

/**
 * Filters a raw record object for display as a parent data card:
 * - Excludes Code
 * - Excludes AUDIT_HEADERS
 * - Excludes derived action stamp headers
 * - Excludes keys starting with '_'
 *
 * @param {Object} record
 * @param {Set<string>} actionStampHeaders
 * @returns {Object}
 */
export function filterParentFields(record, actionStampHeaders) {
  if (!record) return {}
  const filtered = {}
  for (const [key, value] of Object.entries(record)) {
    if (key === 'Code') continue
    if (key.startsWith('_')) continue
    if (AUDIT_HEADERS.has(key)) continue
    if (actionStampHeaders && actionStampHeaders.has(key)) continue
    filtered[key] = value
  }
  return filtered
}

/**
 * True when a raw column header carries no display value of its own in a child
 * grid/card. Codes identify rows rather than describe them, and audit/action
 * stamps are metadata — counting them inflates the column count that routes a
 * child group between the condensed grid (<= 5) and expanded cards (> 5).
 *
 * Excluded:
 * 1. The primary key `Code`.
 * 2. The parent reference column (`ParentCode`, or `<ParentResource>Code`).
 * 3. Any header suffixed with `Code` (relation references, e.g. `WarehouseCode`).
 * 4. AUDIT_HEADERS.
 * 5. Action stamps suffixed with `By` / `At` (e.g. `SubmittedBy`, `VerifiedAt`).
 *
 * Rule 3 subsumes 1–2 and rule 5 subsumes 4; each stays spelled out so the
 * intent survives if a narrower rule is ever needed.
 *
 * @param {string} header
 * @param {string} parentResourceName - APP.Resources.ParentResource of the child
 * @returns {boolean}
 */
export function isDisplayableHeader(header, parentResourceName = '') {
  if (!header) return false
  if (header === 'Code') return false
  if (header === 'ParentCode') return false
  if (parentResourceName) {
    const parent = String(parentResourceName)
    if (header === `${parent}Code` || header === `${singularize(parent)}Code`) return false
  }
  if (header.endsWith('Code')) return false
  if (AUDIT_HEADERS.has(header)) return false
  if (header.endsWith('By') || header.endsWith('At')) return false
  return true
}

/**
 * Filters raw column headers down to the displayable ones.
 *
 * @param {Array<string>} headers
 * @param {string} parentResourceName
 * @returns {Array<string>}
 */
export function filterDisplayableHeaders(headers, parentResourceName = '') {
  if (!Array.isArray(headers)) return []
  return headers.filter((h) => isDisplayableHeader(h, parentResourceName))
}

/**
 * Filters resolved field objects down to the displayable ones. Applies to both
 * what a child view *renders* and the column count that routes it between
 * compact and expanded mode, so an explicit `ui.fields` list is treated on the
 * same basis as a header-derived one.
 *
 * @param {Array<{header: string}>} fields
 * @param {string} parentResourceName
 * @returns {Array}
 */
export function filterDisplayableFields(fields, parentResourceName = '') {
  if (!Array.isArray(fields)) return []
  return fields.filter((f) => isDisplayableHeader(f?.header, parentResourceName))
}

/**
 * Resolves the display fields for a child resource config.
 *
 * `ui.fields` still takes precedence as the field *source* (order, labels,
 * types, options), but the displayable filter applies to it too: a code or
 * audit/stamp column is never a display column, whichever source declared it.
 * Falls back to deriving fields from the displayable headers.
 *
 * @param {Object} childResourceConfig
 * @returns {Array<{header, label, type}>}
 */
export function resolveChildFields(childResourceConfig) {
  if (!childResourceConfig) return []
  const parentResourceName = childResourceConfig.parentResource
  const uiFields = childResourceConfig.ui?.fields
  if (Array.isArray(uiFields) && uiFields.length) {
    return filterDisplayableFields(uiFields, parentResourceName)
  }

  return filterDisplayableHeaders(
    childResourceConfig.headers || [],
    parentResourceName
  ).map((h) => ({
    header: h,
    label: humanizeString(h),
    type: 'text' // Fallback type
  }))
}

/**
 * Entry-form counterpart of `resolveChildFields`, for contexts that describe a
 * record being *edited* rather than laying out a read-only grid: relation code
 * columns (`ProductCode`, `WarehouseCode`) are usually the most identifying
 * value on an added row, so they stay in. Excludes only the primary key, the
 * parent reference, and audit metadata.
 *
 * @param {Object} childResourceConfig
 * @returns {Array<{header, label, type}>}
 */
export function resolveChildEntryFields(childResourceConfig) {
  if (!childResourceConfig) return []
  const uiFields = childResourceConfig.ui?.fields
  if (Array.isArray(uiFields) && uiFields.length) return uiFields

  const headers = childResourceConfig.headers || []
  return headers
    .filter((h) => h !== 'Code' && h !== 'ParentCode' && !AUDIT_HEADERS.has(h))
    .map((h) => ({
      header: h,
      label: humanizeString(h),
      type: 'text' // Fallback type
    }))
}

/**
 * Resolves a child resource's display title.
 * Uses ui.menus[0].pageTitle if available, else humanizes the resource name.
 *
 * @param {Object} childResourceConfig
 * @returns {string}
 */
export function resolveChildTitle(childResourceConfig) {
  if (!childResourceConfig) return ''
  if (childResourceConfig.ui?.menus?.[0]?.pageTitle) {
    return childResourceConfig.ui.menus[0].pageTitle
  }
  return humanizeString(childResourceConfig.name || '')
}

/**
 * Converts a hyphen-separated slug to a Title Case human-readable string.
 * e.g. "purchase-requisition-items" → "Purchase Requisition Items"
 *
 * @param {string} slug
 * @returns {string}
 */
export function humanizeSlug(slug) {
  if (!slug) return ''
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Joins SKU variant fields (Variant1..Variant5) into a display string.
 * @param {Object} sku
 * @returns {string}
 */
export function formatSkuVariants(sku) {
  if (!sku) return ''
  const vars = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].filter(Boolean)
  return vars.length ? vars.join(' | ') : 'No variants'
}

/**
 * Today as ISO date string (yyyy-MM-dd) using a slash separator (yyyy/MM/dd).
 * Useful for q-date min-date comparisons.
 */
export function todayIsoSlash() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '/')
}

/**
 * Today formatted as "DD MMM YYYY" (e.g. "18 Apr 2026").
 */
export function todayLongLabel() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Resolves the parent code field name for a child resource.
 * Checks for 'ParentCode', then derives a candidate from the parent resource name.
 *
 * @param {Object} childResource - child resource config (must have .headers array)
 * @param {Object} parentResource - parent resource config (must have .name string)
 * @returns {string}
 */
export function findParentCodeField(childResource, parentResource) {
  const headers = Array.isArray(childResource?.headers) ? childResource.headers : []
  if (headers.includes('ParentCode')) return 'ParentCode'
  const parentName = parentResource?.name || ''
  const singularParent = parentName.replace(/s$/, '')
  const candidate = `${singularParent}Code`
  if (headers.includes(candidate)) return candidate
  return 'ParentCode'
}

export function getHeaderIndexMap(headers = []) {
  const map = {}
  headers.forEach((header, index) => {
    map[header] = index
  })
  return map
}

export function mapObjectsToRows(records = [], headers = []) {
  return records.map((record) => headers.map((header) => record?.[header]))
}

export function mapRowsToObjects(rows = [], headers = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return []
  }

  if (!Array.isArray(rows[0])) {
    return rows.map((entry) => ({ ...entry }))
  }

  const idx = getHeaderIndexMap(headers)
  return rows.map((row) => {
    const obj = {}
    headers.forEach((header) => {
      obj[header] = row[idx[header]]
    })
    return obj
  })
}

export function normalizeCursorValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const timestamp = Number(value)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp
  }

  const parsedTime = new Date(value).getTime()
  return Number.isFinite(parsedTime) ? parsedTime : null
}

export function resolveSyncRows(responseData, headers) {
  if (Array.isArray(responseData?.rows)) {
    return responseData.rows
  }

  if (Array.isArray(responseData?.records)) {
    return mapObjectsToRows(responseData.records, headers)
  }

  if (Array.isArray(responseData?.data)) {
    return Array.isArray(responseData.data[0])
      ? responseData.data
      : mapObjectsToRows(responseData.data, headers)
  }

  return []
}

const IRREGULAR_PLURALS = {
  man: 'men', woman: 'women', child: 'children', person: 'people',
  tooth: 'teeth', foot: 'feet', mouse: 'mice', goose: 'geese',
  ox: 'oxen', louse: 'lice', die: 'dice',
  cactus: 'cacti', focus: 'foci', fungus: 'fungi', nucleus: 'nuclei',
  syllabus: 'syllabi', analysis: 'analyses', diagnosis: 'diagnoses',
  thesis: 'theses', crisis: 'crises', phenomenon: 'phenomena',
  criterion: 'criteria', datum: 'data', curriculum: 'curricula',
  index: 'indices', matrix: 'matrices', vertex: 'vertices',
  appendix: 'appendices', axis: 'axes',
  quiz: 'quizzes',
}

const UNCHANGED = new Set([
  'sheep', 'fish', 'deer', 'species', 'series', 'moose', 'aircraft',
  'salmon', 'trout', 'swine', 'bison', 'shrimp', 'offspring',
])

const O_TAKES_S = new Set([
  'photo', 'piano', 'halo', 'video', 'zoo', 'studio', 'radio',
  'kilo', 'memo', 'logo', 'solo', 'silo', 'taco', 'avocado',
])

const F_TAKES_S = new Set([
  'roof', 'chef', 'chief', 'cliff', 'proof', 'belief', 'gulf',
  'safe', 'cafe',
])

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

function applyCase(word, suffix) {
  return word + suffix
}

/**
 * Pluralize an English word.
 * Handles regular rules and irregular/exception lookups.
 * @param {string} word
 * @returns {string}
 */
export function pluralize(word) {
  if (!word) return word
  const lower = word.toLowerCase()

  if (UNCHANGED.has(lower)) return word
  if (IRREGULAR_PLURALS[lower]) {
    const plural = IRREGULAR_PLURALS[lower]
    return word[0] === word[0].toUpperCase()
      ? plural[0].toUpperCase() + plural.slice(1)
      : plural
  }

  if (lower.endsWith('y')) {
    const beforeY = lower[lower.length - 2]
    if (!VOWELS.has(beforeY)) return applyCase(word.slice(0, -1), 'ies')
    return applyCase(word, 's')
  }

  if (/(s|x|z|ch|sh)$/.test(lower)) return applyCase(word, 'es')

  if (lower.endsWith('fe') && !F_TAKES_S.has(lower)) return applyCase(word.slice(0, -2), 'ves')
  if (lower.endsWith('f') && !F_TAKES_S.has(lower)) return applyCase(word.slice(0, -1), 'ves')

  if (lower.endsWith('o')) {
    const beforeO = lower[lower.length - 2]
    if (!VOWELS.has(beforeO) && !O_TAKES_S.has(lower)) return applyCase(word, 'es')
    return applyCase(word, 's')
  }

  return applyCase(word, 's')
}

const IRREGULAR_SINGULARS = Object.fromEntries(
  Object.entries(IRREGULAR_PLURALS).map(([k, v]) => [v, k])
)

/**
 * Best-effort singularize an English plural word.
 * English pluralization is lossy to reverse; covers common cases.
 * @param {string} word
 * @returns {string}
 */
export function singularize(word) {
  if (!word) return word
  const lower = word.toLowerCase()

  if (UNCHANGED.has(lower)) return word
  if (IRREGULAR_SINGULARS[lower]) {
    const singular = IRREGULAR_SINGULARS[lower]
    return word[0] === word[0].toUpperCase()
      ? singular[0].toUpperCase() + singular.slice(1)
      : singular
  }

  if (lower.endsWith('ies') && lower.length > 3) return word.slice(0, -3) + 'y'

  if (lower.endsWith('ves')) {
    const stem = word.slice(0, -3)
    if (['kni', 'li', 'wi'].some(s => stem.toLowerCase().endsWith(s))) return stem + 'fe'
    return stem + 'f'
  }

  if (/(ses|xes|zes|ches|shes)$/.test(lower)) return word.slice(0, -2)

  if (lower.endsWith('oes') && !O_TAKES_S.has(lower.slice(0, -2))) return word.slice(0, -2)

  if (lower.endsWith('s') && !lower.endsWith('ss')) return word.slice(0, -1)

  return word
}

/**
 * $ref linking for batched GAS requests. A $ref object lets a later sub-request
 * reference a value (e.g. a generated code) produced by an earlier one.
 * The $ref object is never stringified on the front-end — GAS resolves it.
 */
export function batchRef (path) { return { $ref: path } }
export function isBatchRef (value) { return !!(value && typeof value === 'object' && value.$ref) }

/**
 * A $ref JOINED to literal codes the caller already holds, for a column that stores a
 * separated LIST — e.g. an invoice bundling the consumption this batch is about to create
 * together with several earlier ones.
 *
 * The join is performed by GAS at resolution time (`apiDispatcher.gs` ›
 * `resolveBatchReferencesDeep`), never here: concatenating on the front-end would mean
 * guessing the generated code before the batch has produced it, which is exactly what the
 * transport contract's "do not stringify/concatenate $ref values" rule forbids
 * (CORE_ARCHITECTURE_RULES §3). Duplicates are dropped server-side, so passing a list that
 * happens to include the new record's own code is safe.
 */
export function batchRefList (path, codes = [], separator = ',') {
  return { $ref: path, $append: (Array.isArray(codes) ? codes : []).map((code) => String(code ?? '').trim()).filter(Boolean), $separator: separator }
}

/**
 * Returns a $ref as-is, otherwise coerces a value to a trimmed string.
 * Used by the canonical request builders so optional refs pass through untouched.
 */
export function textOrRef (value) { return isBatchRef(value) ? value : String(value || '').trim() }

/**
 * Normalizes a code-or-$ref to its string/ref form (alias of textOrRef).
 */
export function normalizeCodeOrRef (value) { return textOrRef(value) }

/**
 * ONCE PER APP, NOT ONCE PER CONSUMER (CORE_ARCHITECTURE_RULES §6).
 *
 * Wraps a composable factory so its `computed()` graph is built exactly once and
 * shared by every caller. A `computed()` declared inside a plain `use*()` function
 * is memoized PER CALL SITE, so N components calling `useSkuResource()` each run
 * the whole enrichment pass over the same rows — the work is duplicated N times
 * and so is the memory holding the result.
 *
 * This is not a cache of state: the factory returns `computed()` refs that stay
 * derived from the one reactive source, so sharing them cannot make two consumers
 * disagree. It is the opposite of a mirror copy — it removes the copies.
 *
 * `identity` is whatever the caller's own singleton depends on (in practice the
 * Pinia store instance). When it changes — a test installing a fresh Pinia, an HMR
 * reload — the graph is rebuilt rather than served stale against a dead store.
 *
 * THE DETACHED SCOPE IS THE WHOLE MECHANISM, not an optimization. A `computed()`
 * created during a component's `setup()` is registered on THAT component's effect
 * scope and is STOPPED when it unmounts. Share it, and the second consumer inherits
 * a dead ref: the first page to mount owns the graph, and every page after the first
 * unmount reads a computed that no longer recomputes — which renders as a screen
 * stuck on its loading spinner, with no error anywhere. `effectScope(true)` is
 * detached from whatever scope happens to be active at first call, so the graph
 * outlives every component that reads it.
 */
export function defineSharedComposable (factory) {
  let cachedIdentity
  let cachedValue
  let cachedScope = null
  return (identity) => {
    if (!cachedScope || identity !== cachedIdentity) {
      cachedScope?.stop()
      cachedIdentity = identity
      cachedScope = effectScope(true)
      cachedValue = cachedScope.run(() => factory(identity))
    }
    return cachedValue
  }
}
