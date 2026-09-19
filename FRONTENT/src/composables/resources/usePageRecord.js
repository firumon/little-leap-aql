import { ref, computed, watch, unref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from './useResourceConfig'
import { useRouteConfig } from './useRouteConfig'
import { useListViews, evaluateFilter } from 'src/composables/useListViews'
import { singularize } from 'src/utils/appHelpers'
import { useRecord } from './useRecord'

const resourcePageMap = new Map()

function _collectSearchValues(r, visited = new Set()) {
  if (!r || visited.has(r)) return []
  visited.add(r)
  const values = Object.keys(r)
    .filter(k => !k.startsWith('$') && !k.startsWith('_'))
    .map(k => (r[k] ?? '').toString().toLowerCase())
  const parentKeys = Array.isArray(r._Parents) ? r._Parents : []
  for (const key of parentKeys) {
    const parent = r._Parent?.[key]
    if (parent) values.push(..._collectSearchValues(parent, visited))
  }
  return values
}

export function usePageRecord(resourceNameOverride, codeOverride) {
  const recordSource = useRecord()
  const $q = useQuasar()
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()
  const {
    resourceName: routeResourceName,
    config, resourceHeaders: routeHeaders, scope
  } = useResourceConfig()
  const { code: routeCode } = useRouteConfig()

  const resolvedResourceName = computed(() => {
    if (resourceNameOverride) {
      return typeof resourceNameOverride === 'function'
        ? resourceNameOverride()
        : unref(resourceNameOverride)
    }
    return routeResourceName.value
  })

  const resolvedCode = computed(() => {
    if (codeOverride !== undefined) {
      return typeof codeOverride === 'function'
        ? codeOverride()
        : unref(codeOverride)
    }
    return routeCode.value
  })

  const loading = ref(false)
  const backgroundSyncing = ref(false)
  const filterTerm = ref('')
  const currentPage = ref(1)
  const showInactive = ref(false)
  const loadRequestId = ref(0)

  const restorePage = name => { currentPage.value = name ? (resourcePageMap.get(name) || 1) : 1 }
  const resetPage = () => { currentPage.value = 1; if (resolvedResourceName.value) resourcePageMap.set(resolvedResourceName.value, 1) }
  watch(resolvedResourceName, restorePage, { immediate: true })
  watch([resolvedResourceName, currentPage], ([name, page]) => { if (name) resourcePageMap.set(name, page) })

  const record = computed(() => {
    const name = resolvedResourceName.value
    const code = resolvedCode.value
    if (!name || !code) return null
    return recordSource.enrich(name, code)
  })

  const records = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return []
    return recordSource.enriched(name)
  })

  const headers = computed(() => dataStore.headers[resolvedResourceName.value] || [])

  const {
    effectiveViews,
    activeViewName,
    activeView,
    viewFilteredItems,
    setActiveView
  } = useListViews({
    items: records,
    resourceHeaders: headers,
    configuredListViews: computed(() => config.value?.ui?.listViews),
    configuredListViewsMode: computed(() => config.value?.ui?.listViewsMode),
    scope,
    resourceName: resolvedResourceName,
    enableUrlSync: false
  })

  const defaultViewName = computed(() => {
    const views = effectiveViews.value
    if (!views.length) return ''
    const def = views.find((v) => v.default)
    return def ? def.name : views[0].name
  })

  const filteredRecords = computed(() => {
    let list = viewFilteredItems.value

    if (!activeView.value && !effectiveViews.value.length) {
      if (!showInactive.value) {
        list = list.filter(r => (r.Status || 'Active') === 'Active')
      }
    }

    const keyword = (filterTerm.value || '').toString().trim().toLowerCase()
    if (!keyword) return list
    return list.filter(r => {
      const aggregate = _collectSearchValues(r).join(' ')
      return aggregate.includes(keyword)
    })
  })

  watch([filterTerm, activeViewName], resetPage)

  const relations = computed(() => dataStore.getRelations(resolvedResourceName.value))

  const childResources = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return []
    const allResources = Array.isArray(authStore.resources) ? authStore.resources : []
    const relChildren = (relations.value?.children || []).map(c => c.name)
    return allResources.filter(r => r?.parentResource === name || relChildren.includes(r?.name))
  })

  const parentResource = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return null
    const allResources = Array.isArray(authStore.resources) ? authStore.resources : []
    const self = allResources.find(r => r?.name === name)
    if (!self?.parentResource) return null
    return allResources.find(r => r?.name === self.parentResource) || null
  })

  const hasChildren = computed(() => childResources.value.length > 0)
  const hasParent = computed(() => !!parentResource.value)

  const childRecordsByResource = computed(() => {
    const rec = record.value
    if (!rec) return {}
    const map = {}
    for (const key of rec._Children || []) {
      const childName = key.replace(/^\$/, '')
      if (Array.isArray(rec[key]) && rec[key].length) {
        map[childName] = rec[key]
      }
    }
    for (const childRes of childResources.value) {
      if (!map[childRes.name] || !map[childRes.name].length) {
        const parentCodeKey = singularize(resolvedResourceName.value) + 'Code'
        const records = dataStore.getRecords(childRes.name) || []
        const matched = records.filter(r => r[parentCodeKey] === rec.Code || r.ParentCode === rec.Code)
        if (matched.length) {
          map[childRes.name] = matched
        }
      }
    }
    return map
  })

  async function reload() {
    const resourceName = resolvedResourceName.value
    if (!resourceName) return

    const requestId = ++loadRequestId.value
    const hasData = records.value.length > 0
    loading.value = !hasData
    backgroundSyncing.value = hasData

    try {
      await resourceIoStore.fetchResource(resourceName)
      if (requestId !== loadRequestId.value) return
    } finally {
      if (requestId === loadRequestId.value) {
        loading.value = false
        backgroundSyncing.value = false
      }
    }
  }

  function getRecordByCode(code) {
    if (!code) return null
    const name = resolvedResourceName.value
    if (!name) return null
    return recordSource.enrich(name, code)
  }

  async function updateLocalRecord(updatedRecord) {
    if (!updatedRecord?.Code) return
    const resourceName = resolvedResourceName.value
    const hdrs = headers.value
    if (!resourceName || !hdrs.length) return

    const existing = dataStore.getRecord(resourceName, updatedRecord.Code) || {}
    const merged = { ...existing, ...updatedRecord }
    const row = hdrs.map(h => merged[h] ?? '')
    dataStore.setRows(resourceName, [row])

    try {
      await dataStore.cacheResourceRows(resourceName, hdrs, [row])
    } catch (_) { /* non-critical */ }
  }

  function notify(type, message) {
    $q.notify({ type, message, timeout: 2200 })
  }

  function runReset() {
    filterTerm.value = ''
    resetPage()
    showInactive.value = false
    activeViewName.value = defaultViewName.value
    loading.value = false
    backgroundSyncing.value = false
    loadRequestId.value++
  }

  watch(() => authStore.isGlobalSyncing, (syncing, wasSyncing) => {
    if (wasSyncing && !syncing && records.value.length === 0) reload()
  })

  return {
    resourceName: resolvedResourceName,
    code: resolvedCode,

    record,
    records,
    items: records,
    filteredRecords,
    filteredItems: filteredRecords,
    headers,
    lastHeaders: headers,

    relations,
    childResources,
    parentResource,
    hasChildren,
    hasParent,
    childRecordsByResource,

    loading,
    backgroundSyncing,
    filterTerm,
    currentPage,
    showInactive,

    effectiveViews,
    activeViewName,
    activeView,
    setActiveView,

    reload,
    getRecordByCode,
    updateLocalRecord,
    notify,
    reset: runReset
  }
}
