import { ref, computed, watch } from 'vue'
import { useResourceConfig } from './resources/useResourceConfig'
import { useTokenEvaluator, evaluatePreparedFilter } from 'src/utils/tokenEvaluator'

// Re-exported so existing importers of the filter evaluator keep their import path. The
// implementation now lives in `tokenEvaluator.js`, which `visibleWhen` shares.
export { prepareFilter, evaluatePreparedFilter, evaluateFilter } from 'src/utils/tokenEvaluator'

// Headers an auto-generated "categorical" view should never be built from.
const AUTO_VIEW_EXCLUDED_HEADERS = new Set([
  'Code', 'Name', 'Status', 'Progress', 'Type',
  'CreatedAt', 'UpdatedAt', 'Revision', 'CreatedBy', 'UpdatedBy', 'AccessRegion'
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

function appOptionValuesFor(resourceNameVal, column) {
  if (!resourceNameVal || !column) return null
  const opts = useResourceConfig(resourceNameVal).options(column)
  return Array.isArray(opts) && opts.length ? opts : null
}

function resolveColumnValues(column, { itemsRef, headers, resourceNameVal }) {
  if (!headers.includes(column)) return []
  const optionValues = appOptionValuesFor(resourceNameVal, column)
  return optionValues || uniqueColumnValues(itemsRef, column)
}

function findAppOptionColumn(headers, resourceNameVal) {
  if (!resourceNameVal) return null
  const allOptions = useResourceConfig(resourceNameVal).options()
  if (!allOptions || typeof allOptions !== 'object') return null
  for (const header of headers) {
    if (AUTO_VIEW_EXCLUDED_HEADERS.has(header)) continue
    if (header.endsWith('Code') && header !== 'Code') continue
    const values = allOptions[header]
    if (Array.isArray(values) && values.length) return { column: header, values }
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

  const { prepareFilter: prepareViewFilter } = useTokenEvaluator()

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

    if (scopeVal === 'master') {
      if (headers.includes('Status')) return buildStatusViews()
      return []
    }

    const progressValues = resolveColumnValues('Progress', { itemsRef: items, headers, resourceNameVal })
    if (progressValues.length) return autoViewsFromValues('Progress', progressValues)

    const typeValues = resolveColumnValues('Type', { itemsRef: items, headers, resourceNameVal })
    if (typeValues.length) return autoViewsFromValues('Type', typeValues)

    const matched = findAppOptionColumn(headers, resourceNameVal)
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
    for (const view of effectiveViews.value) {
      const prepared = prepareViewFilter(view.filter)
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
    const prepared = prepareViewFilter(activeView.value.filter)
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
