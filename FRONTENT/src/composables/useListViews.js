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
 */
function prepareCondition(condition, ctx) {
  const { column, operator, value } = condition
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
    return { type: 'condition', column, operator, columnPipeline: governing.spec.coerce || [], right }
  }

  // Literal condition: pre-normalise both the whole value (`eq`/`contains`/ordered operators
  // stringify the raw value, arrays included) and its per-entry list form (`in`/`not_in`).
  return {
    type: 'condition',
    column,
    operator,
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
 * @returns {Object|null} prepared tree for `evaluatePreparedFilter`
 */
export function prepareFilter(filter, ctx = {}) {
  if (!filter) return null
  if (filter.type === 'condition') return prepareCondition(filter, ctx)
  if (filter.type === 'group') {
    return {
      type: 'group',
      logic: filter.logic,
      items: (filter.items || []).map((item) => prepareFilter(item, ctx))
    }
  }
  return null // unknown node = match all
}

/**
 * Evaluates a prepared condition against a row. No token parsing happens here.
 */
function evaluatePreparedCondition(node, row) {
  const { column, operator } = node
  if (!column || !(column in row)) return false

  const rowValue = row[column]

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
 */
export function evaluateFilter(filter, row, ctx = {}) {
  return evaluatePreparedFilter(prepareFilter(filter, ctx), row)
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
      const prepared = prepareFilter(view.filter, ctx)
      counts[view.name] = allItems.filter((row) => evaluatePreparedFilter(prepared, row)).length
    }
    return counts
  })

  /**
   * Items filtered by the active view (before search).
   */
  const viewFilteredItems = computed(() => {
    const allItems = items?.value || []
    if (!activeView.value) return allItems
    const prepared = prepareFilter(activeView.value.filter, tokenContext.value)
    return allItems.filter((row) => evaluatePreparedFilter(prepared, row))
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
