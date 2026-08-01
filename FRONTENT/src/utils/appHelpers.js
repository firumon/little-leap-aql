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
 * Handles hyphens and spaces as word separators.
 * e.g. "purchase-requisition-items" → "PurchaseRequisitionItems"
 * e.g. "Revision Required" → "RevisionRequired"
 */
export function toPascalCase(str) {
  if (!str) return ''
  return str
    .split(/[- ]+/)
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
 * Resolves display fields for a child resource config:
 * Uses ui.fields if present; otherwise derives from headers, filtering out
 * Code, ParentCode, and AUDIT_HEADERS.
 *
 * @param {Object} childResourceConfig
 * @returns {Array<{header, label, type}>}
 */
export function resolveChildFields(childResourceConfig) {
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
 * Returns a $ref as-is, otherwise coerces a value to a trimmed string.
 * Used by the canonical request builders so optional refs pass through untouched.
 */
export function textOrRef (value) { return isBatchRef(value) ? value : String(value || '').trim() }

/**
 * Normalizes a code-or-$ref to its string/ref form (alias of textOrRef).
 */
export function normalizeCodeOrRef (value) { return textOrRef(value) }
