import { ref, computed, watch } from 'vue'

/**
 * Token resolver map — extensible for future tokens.
 */
const TOKEN_RESOLVERS = {
  $now: () => Date.now()
}

function normalizeListViewsMode(mode) {
  const m = (mode || '').toString().trim().toLowerCase()
  if (m === 'off' || m === 'custom' || m === 'auto') return m
  return ''
}

function resolveTokenValue(value) {
  if (typeof value === 'string' && TOKEN_RESOLVERS[value]) {
    return TOKEN_RESOLVERS[value]()
  }
  return value
}

/**
 * Attempts numeric coercion for comparison operators.
 * Returns { a, b } as numbers if both coerce, otherwise as lowercase strings.
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
 * Evaluates a single condition against a row.
 */
function evaluateCondition(condition, row) {
  const { column, operator, value } = condition
  if (!column || !(column in row)) return false

  const rowValue = row[column]
  const rowStr = (rowValue ?? '').toString().toLowerCase()
  const resolved = resolveTokenValue(value)

  switch (operator) {
    case 'eq':
      return rowStr === String(resolved).toLowerCase()
    case 'neq':
      return rowStr !== String(resolved).toLowerCase()
    case 'in': {
      const arr = Array.isArray(resolved) ? resolved : [resolved]
      return arr.some((v) => rowStr === String(v).toLowerCase())
    }
    case 'not_in': {
      const arr = Array.isArray(resolved) ? resolved : [resolved]
      return !arr.some((v) => rowStr === String(v).toLowerCase())
    }
    case 'gt': {
      const c = coerceForComparison(rowValue, resolved)
      return c.a > c.b
    }
    case 'gte': {
      const c = coerceForComparison(rowValue, resolved)
      return c.a >= c.b
    }
    case 'lt': {
      const c = coerceForComparison(rowValue, resolved)
      return c.a < c.b
    }
    case 'lte': {
      const c = coerceForComparison(rowValue, resolved)
      return c.a <= c.b
    }
    case 'contains':
      return rowStr.includes(String(resolved).toLowerCase())
    default:
      return false
  }
}

/**
 * Recursively evaluates a filter tree (group or condition) against a row.
 */
function evaluateFilter(filter, row) {
  if (!filter) return true
  if (filter.type === 'condition') return evaluateCondition(filter, row)
  if (filter.type === 'group') {
    const items = filter.items || []
    if (!items.length) return true // empty group = match all
    if (filter.logic === 'OR') {
      return items.some((item) => evaluateFilter(item, row))
    }
    // Default AND
    return items.every((item) => evaluateFilter(item, row))
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
 * @param {Boolean} [options.enableUrlSync=false] - optional URL sync mode
 * @param {import('vue-router').RouteLocationNormalized} [options.route]
 * @param {import('vue-router').Router} [options.router]
 */
export function useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync = false,
  route,
  router
}) {
  const activeViewName = ref('')

  /**
   * Build effective views:
   * - If configuredListViews is non-empty array, use it (full override).
   * - Else if resource has a 'Status' header, auto-create Active + Inactive views.
   * - Else no views.
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
    if (headers.includes('Status')) {
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
      counts[view.name] = allItems.filter((row) => evaluateFilter(view.filter, row)).length
    }
    return counts
  })

  /**
   * Items filtered by the active view (before search).
   */
  const viewFilteredItems = computed(() => {
    const allItems = items?.value || []
    if (!activeView.value) return allItems
    return allItems.filter((row) => evaluateFilter(activeView.value.filter, row))
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
