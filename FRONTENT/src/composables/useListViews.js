import { ref, computed, watch } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { singularize } from 'src/utils/appHelpers'
import { COERCES, applyCoerces, parseToken } from 'src/utils/listViewTokens'

// Headers an auto-generated "categorical" view should never be built from.
const AUTO_VIEW_EXCLUDED_HEADERS = new Set([
  'Code', 'Name', 'Status', 'Progress', 'Type',
  'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy', 'AccessRegion'
])

const POSITIVE_TOKENS = new Set([
  'ACTIVE', 'APPROVED', 'COMPLETED', 'DELIVERED', 'PAID', 'CONFIRMED', 'RECEIVED', 'DONE'
])
const NEGATIVE_TOKENS = new Set([
  'INACTIVE', 'REJECTED', 'CANCELLED', 'CANCELED', 'DECLINED', 'FAILED'
])
const WARNING_TOKENS = new Set([
  'PENDING', 'DRAFT', 'INITIATED', 'SENT', 'ASSIGNED', 'CREATED', 'PARTIAL'
])

function colorForToken(token) {
  const val = (token ?? '').toString().trim().toUpperCase()
  if (!val) return 'grey'
  if (POSITIVE_TOKENS.has(val)) return 'positive'
  if (NEGATIVE_TOKENS.has(val)) return 'negative'
  if (WARNING_TOKENS.has(val)) return 'warning'
  return 'primary'
}

/**
 * "IN_PROGRESS" / "in-progress" / "inProgress" → "In Progress"
 */
function humanizeToken(token) {
  const str = (token ?? '').toString().trim()
  if (!str) return str
  const spaced = str.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function autoViewsFromValues(column, values) {
  return values.map((val, idx) => ({
    name: humanizeToken(val),
    default: idx === 0,
    color: colorForToken(val),
    filter: {
      type: 'group',
      logic: 'AND',
      items: [{ type: 'condition', column, operator: 'eq', value: val }]
    }
  }))
}

/**
 * Distinct, order-preserving values observed for `column` across the live item set.
 */
function uniqueColumnValues(itemsRef, column) {
  const seen = new Set()
  const ordered = []
  for (const row of itemsRef?.value || []) {
    const v = row?.[column]
    if (v === undefined || v === null || v === '') continue
    const key = v.toString()
    if (seen.has(key)) continue
    seen.add(key)
    ordered.push(v)
  }
  return ordered
}

/**
 * Looks up an AppOptions group named `<ResourceName><Column>` (or the singularized
 * resource-name variant, since seed data such as `StockMovementReferenceType` uses the
 * singular form) — e.g. `PurchaseOrdersStatus`, `StockMovementReferenceType`.
 */
function appOptionValuesFor(appOptionsMap, resourceNameVal, column) {
  if (!resourceNameVal || !column) return null
  const candidates = [`${resourceNameVal}${column}`, `${singularize(resourceNameVal)}${column}`]
  for (const key of candidates) {
    const arr = appOptionsMap?.[key]
    if (Array.isArray(arr) && arr.length) return arr
  }
  return null
}

/**
 * Values to auto-generate views for `column`: a matching AppOptions group takes
 * priority (it defines the full universe of values, including ones absent from the
 * currently loaded rows), falling back to whatever distinct values are observed live.
 */
function resolveColumnValues(column, { itemsRef, headers, appOptionsMap, resourceNameVal }) {
  if (!headers.includes(column)) return []
  const optionValues = appOptionValuesFor(appOptionsMap, resourceNameVal, column)
  return optionValues || uniqueColumnValues(itemsRef, column)
}

/**
 * Scans remaining headers for an AppOptions group keyed `<ResourceName><Header>`,
 * skipping columns already handled by Status/Progress/Type/audit logic.
 */
function findAppOptionColumn(headers, appOptionsMap, resourceNameVal) {
  for (const header of headers) {
    if (AUTO_VIEW_EXCLUDED_HEADERS.has(header)) continue
    if (header.endsWith('Code') && header !== 'Code') continue
    const values = appOptionValuesFor(appOptionsMap, resourceNameVal, header)
    if (values) return { column: header, values }
  }
  return null
}

function buildStatusViews() {
  return [
    {
      name: 'Active',
      default: true,
      color: 'positive',
      filter: {
        type: 'group',
        logic: 'AND',
        items: [{ type: 'condition', column: 'Status', operator: 'eq', value: 'Active' }]
      }
    },
    {
      name: 'Inactive',
      color: 'grey',
      filter: {
        type: 'group',
        logic: 'AND',
        items: [{ type: 'condition', column: 'Status', operator: 'eq', value: 'Inactive' }]
      }
    }
  ]
}

export function normalizeListViewsMode(mode) {
  const m = (mode || '').toString().trim().toLowerCase()
  if (m === 'off' || m === 'custom' || m === 'auto') return m
  return ''
}

/**
 * Attempts numeric coercion for comparison operators.
 * Returns { a, b } as numbers if both coerce, otherwise as lowercase strings.
 *
 * Used for literal (non-token) values only — token conditions carry their own
 * two-sided coercion pipelines. See src/utils/listViewTokens.js.
 */
function coerceForComparison(a, b) {
  const numA = Number(a)
  const numB = Number(b)
  if (Number.isFinite(numA) && Number.isFinite(numB)) {
    return { a: numA, b: numB }
  }
  return { a: String(a).toLowerCase(), b: String(b).toLowerCase() }
}

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
 * Evaluates a condition whose value references a dynamic token.
 *
 * The token's `coerce` pipeline normalises the column value and its `coerceToken` pipeline
 * (defaulting to `coerce`) normalises the resolved token value, so both sides end up
 * comparable. Array-valued tokens are flattened for `in` / `not_in`.
 */
function evaluateTokenCondition({ operator, rowValue, values, governing, ctx }) {
  const { spec } = governing
  const columnPipeline = spec.coerce || []
  const tokenPipeline = spec.coerceToken || spec.coerce || []

  const left = applyCoerces(rowValue, columnPipeline)
  // A column that cannot be parsed into the comparison space is never a match — returning
  // false explicitly rather than relying on NaN comparison semantics keeps `neq`/`not_in`
  // from silently sweeping in every unparseable row.
  if (typeof left === 'number' && Number.isNaN(left)) return false

  const right = []
  for (const entry of values) {
    const token = parseToken(entry)
    const resolved = token ? token.spec.value(token.params, ctx) : entry
    if (Array.isArray(resolved)) {
      resolved.forEach((item) => right.push(applyCoerces(item, tokenPipeline)))
    } else {
      right.push(applyCoerces(resolved, tokenPipeline))
    }
  }

  return compareCoerced(operator, left, right)
}

/**
 * Evaluates a single condition against a row.
 */
function evaluateCondition(condition, row, ctx) {
  const { column, operator, value } = condition
  if (!column || !(column in row)) return false

  const rowValue = row[column]

  // A token anywhere in the value governs coercion for the whole condition. The list-views
  // manager splits `in`/`not_in` values on commas, so a token can arrive wrapped in an array.
  const values = Array.isArray(value) ? value : [value]
  let governing = null
  for (const entry of values) {
    const token = parseToken(entry)
    if (token) {
      governing = token
      break
    }
  }

  if (governing) {
    return evaluateTokenCondition({ operator, rowValue, values, governing, ctx })
  }

  const rowStr = (rowValue ?? '').toString().toLowerCase()

  switch (operator) {
    case 'eq':
      return rowStr === String(value).toLowerCase()
    case 'neq':
      return rowStr !== String(value).toLowerCase()
    case 'in': {
      const arr = Array.isArray(value) ? value : [value]
      return arr.some((v) => rowStr === String(v).toLowerCase())
    }
    case 'not_in': {
      const arr = Array.isArray(value) ? value : [value]
      return !arr.some((v) => rowStr === String(v).toLowerCase())
    }
    case 'gt': {
      const c = coerceForComparison(rowValue, value)
      return c.a > c.b
    }
    case 'gte': {
      const c = coerceForComparison(rowValue, value)
      return c.a >= c.b
    }
    case 'lt': {
      const c = coerceForComparison(rowValue, value)
      return c.a < c.b
    }
    case 'lte': {
      const c = coerceForComparison(rowValue, value)
      return c.a <= c.b
    }
    case 'contains':
      return rowStr.includes(String(value).toLowerCase())
    default:
      return false
  }
}

/**
 * Recursively evaluates a filter tree (group or condition) against a row.
 *
 * @param {Object} filter - group or condition node
 * @param {Object} row - the record under test
 * @param {Object} [ctx] - token evaluation context, `{ user }`. Required only by user tokens.
 */
export function evaluateFilter(filter, row, ctx = {}) {
  if (!filter) return true
  if (filter.type === 'condition') return evaluateCondition(filter, row, ctx)
  if (filter.type === 'group') {
    const items = filter.items || []
    if (!items.length) return true // empty group = match all
    if (filter.logic === 'OR') {
      return items.some((item) => evaluateFilter(item, row, ctx))
    }
    // Default AND
    return items.every((item) => evaluateFilter(item, row, ctx))
  }
  return true
}

/**
 * Composable: manages list views, filter evaluation, and view counts.
 *
 * @param {Object} options
 * @param {import('vue').Ref<Array>} options.items - raw records
 * @param {import('vue').Ref<Array>} options.resourceHeaders - resource header names
 * @param {import('vue').Ref<Array>} options.configuredListViews - from config.ui.listViews
 * @param {import('vue').Ref<String>} [options.configuredListViewsMode] - from config.ui.listViewsMode
 * @param {import('vue').Ref<String>} [options.scope] - resource scope ('master' | 'operation' | 'accounts')
 * @param {import('vue').Ref<String>} [options.resourceName] - resource name, used for AppOptions lookups
 * @param {Boolean} [options.enableUrlSync=false] - optional URL sync mode
 * @param {import('vue-router').RouteLocationNormalized} [options.route]
 * @param {import('vue-router').Router} [options.router]
 */
export function useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  scope,
  resourceName,
  enableUrlSync = false,
  route,
  router
}) {
  const activeViewName = ref('')
  const authStore = useAuthStore()

  /** Evaluation context for user-aware tokens ($userCode, $userRoles, ...). */
  const tokenContext = computed(() => ({ user: authStore.user }))

  /**
   * Build effective views:
   * - If configuredListViews is non-empty array, use it (full override).
   * - Else if mode is 'off'/'custom', no auto-generation.
   * - Else auto-generate per scope:
   *   - master: Status header → Active/Inactive.
   *   - operation (or any other non-master scope): Progress header → views per Progress
   *     value; else Type header → views per Type value; else the first remaining header
   *     with a matching `<ResourceName><Header>` AppOptions group.
   *   Each of the above prefers a matching AppOptions group (the full universe of values)
   *   over the distinct values currently loaded in `items`.
   */
  const effectiveViews = computed(() => {
    const configured = configuredListViews?.value
    const mode = normalizeListViewsMode(configuredListViewsMode?.value)

    if (Array.isArray(configured) && configured.length > 0) {
      return configured
    }

    if (mode === 'off' || mode === 'custom') {
      return []
    }

    const headers = resourceHeaders?.value || []
    const scopeVal = (scope?.value || '').toString().trim().toLowerCase()
    const resourceNameVal = (resourceName?.value || '').toString().trim()
    const appOptionsMap = authStore.appOptionsMap || {}

    if (scopeVal === 'master') {
      if (headers.includes('Status')) return buildStatusViews()
      return []
    }

    // Operation (and any other non-master) scope.
    const progressValues = resolveColumnValues('Progress', { itemsRef: items, headers, appOptionsMap, resourceNameVal })
    if (progressValues.length) return autoViewsFromValues('Progress', progressValues)

    const typeValues = resolveColumnValues('Type', { itemsRef: items, headers, appOptionsMap, resourceNameVal })
    if (typeValues.length) return autoViewsFromValues('Type', typeValues)

    const matched = findAppOptionColumn(headers, appOptionsMap, resourceNameVal)
    if (matched) return autoViewsFromValues(matched.column, matched.values)

    return []
  })

  const defaultViewName = computed(() => {
    const views = effectiveViews.value
    if (!views.length) return ''
    const def = views.find((v) => v.default)
    return def ? def.name : views[0].name
  })

  const activeView = computed(() => {
    if (!activeViewName.value || !effectiveViews.value.length) return null
    return effectiveViews.value.find((v) => v.name === activeViewName.value) || null
  })

  /**
   * Per-view counts from full items (ignoring search).
   */
  const viewCounts = computed(() => {
    const counts = {}
    const allItems = items?.value || []
    const ctx = tokenContext.value
    for (const view of effectiveViews.value) {
      counts[view.name] = allItems.filter((row) => evaluateFilter(view.filter, row, ctx)).length
    }
    return counts
  })

  /**
   * Items filtered by the active view (before search).
   */
  const viewFilteredItems = computed(() => {
    const allItems = items?.value || []
    if (!activeView.value) return allItems
    const ctx = tokenContext.value
    return allItems.filter((row) => evaluateFilter(activeView.value.filter, row, ctx))
  })

  function setActiveView(name) {
    activeViewName.value = name
    if (enableUrlSync) {
      syncToUrl(name)
    }
  }

  function syncToUrl(viewName) {
    if (!enableUrlSync || !router || !route) return
    const current = (route.query.view || '').toString()
    const target = (viewName || '').toString()
    if (current === target) return
    const query = { ...route.query }
    if (viewName) {
      query.view = viewName
    } else {
      delete query.view
    }
    router.replace({ query })
  }

  function readFromUrl() {
    if (!enableUrlSync || !route) return ''
    return (route.query.view || '').toString()
  }

  function initializeView() {
    const views = effectiveViews.value
    if (!views.length) {
      activeViewName.value = ''
      if (enableUrlSync && readFromUrl()) {
        syncToUrl('')
      }
      return
    }

    const urlView = readFromUrl()
    if (urlView && views.some((v) => v.name === urlView)) {
      activeViewName.value = urlView
    } else {
      activeViewName.value = defaultViewName.value
      // Auto-correct invalid URL
      if (urlView && urlView !== defaultViewName.value) {
        syncToUrl(defaultViewName.value)
      }
    }
  }

  // Re-initialize when views change (resource switch)
  watch(effectiveViews, () => {
    initializeView()
  }, { immediate: true })

  // Optional URL sync mode.
  if (enableUrlSync) {
    watch(() => route?.query?.view, (newView) => {
      if (!effectiveViews.value.length) {
        if (newView) syncToUrl('')
        return
      }
      if (!newView) return
      const valid = effectiveViews.value.some((v) => v.name === newView)
      if (valid && newView !== activeViewName.value) {
        activeViewName.value = newView
      } else if (!valid) {
        syncToUrl(defaultViewName.value)
      }
    })
  }

  return {
    effectiveViews,
    activeViewName,
    activeView,
    viewCounts,
    viewFilteredItems,
    setActiveView
  }
}
