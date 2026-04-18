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
