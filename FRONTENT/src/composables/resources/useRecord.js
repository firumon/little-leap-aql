import { ref, computed, watch, unref, reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from './useResourceConfig'
import { useRouteConfig } from './useRouteConfig'
import { useListViews, evaluateFilter } from 'src/composables/useListViews'
import {singularize} from "src/utils/appHelpers.js";
// Shared cache across all useRecord instances — keyed by "ResourceName::Code"
const _enrichedCache = new Map()
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
export function clearEnrichmentCache() {
  _enrichedCache.clear()
}
function _resolveTargetCode(dataStore, resourceName, targetHeader, value) {
  if (!targetHeader || targetHeader === 'Code') return value
  const match = dataStore.getRecords(resourceName).find(r => r[targetHeader] === value)
  return match?.Code || null
}
export function enrichRecord(resourceName, code, dataStore) {
  if (!resourceName || !code) return null

  const cacheKey = `${resourceName}::${code}`
  if (_enrichedCache.has(cacheKey)) return _enrichedCache.get(cacheKey)

  const enriched = reactive({})
  _enrichedCache.set(cacheKey, enriched)   // Cache BEFORE building — prevents circular loops

  const live = computed(() => {
    return dataStore.getRecords(resourceName).find(r => r.Code === code) || null
  })

  const allHeaders = dataStore.headers[resourceName] || []
  for (const h of allHeaders) {
    Object.defineProperty(enriched, h, {
      get() { return live.value?.[h] },
      enumerable: true, configurable: true
    })
  }

  const meta = dataStore.getRelations(resourceName)

  const parentKeys = []
  for (const p of meta.parents) {
    const key = `$${p.singular.toLowerCase()}`
    parentKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const parentValue = live.value?.[p.codeField]
        if (!parentValue) return null
        const parentCode = _resolveTargetCode(dataStore, p.resourceName, p.targetHeader, parentValue)
        if (!parentCode) return null
        return enrichRecord(p.resourceName, parentCode, dataStore)
      },
      enumerable: false, configurable: true
    })
  }

  const childKeys = []
  for (const c of meta.children) {
    const key = `$${c.name}`
    childKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const selfValue = live.value?.[c.targetHeader || 'Code']
        if (!selfValue) return []
        return dataStore.getRecords(c.name)
          .filter(row => row[c.codeField] === selfValue)
          .map(row => enrichRecord(c.name, row.Code, dataStore))
      },
      enumerable: false, configurable: true
    })
  }

  // Link refs (cross-references via relation columns not already keyed as parent/child)
  const linkKeys = []
  for (const rel of Object.values(meta.refs || {})) {
    const singular = singularize(rel.resource).toLowerCase()
    const key = `$${singular}`
    if (parentKeys.includes(key) || childKeys.includes(key)) continue
    linkKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const refValue = live.value?.[rel.header]
        if (!refValue) return null
        const refCode = _resolveTargetCode(dataStore, rel.resource, rel.targetHeader, refValue)
        if (!refCode) return null
        return enrichRecord(rel.resource, refCode, dataStore)
      },
      enumerable: false, configurable: true
    })
  }

  Object.defineProperty(enriched, '_Parents', {
    get() { return [...parentKeys, ...linkKeys] },
    enumerable: false, configurable: true
  })
  Object.defineProperty(enriched, '_Parent', {
    get() {
      const map = {}
      for (const key of parentKeys) map[key] = enriched[key]
      for (const key of linkKeys) map[key] = enriched[key]
      return map
    },
    enumerable: false, configurable: true
  })
  Object.defineProperty(enriched, '_Children', {
    get() { return [...childKeys] },
    enumerable: false, configurable: true
  })
  Object.defineProperty(enriched, '_Child', {
    get() {
      const map = {}
      for (const key of childKeys) map[key] = enriched[key]
      return map
    },
    enumerable: false, configurable: true
  })
  Object.defineProperty(enriched, '_relation', {
    value: meta,
    enumerable: false, configurable: true
  })

  // Enrichment materializes ONE GETTER PER SHEET HEADER, once. Only the values
  // behind those getters are live — the property set itself is frozen at build
  // time. So an object built before `dataStore.headers[resourceName]` has arrived
  // carries no properties at all, and caching it makes that permanent: every later
  // read returns the same empty shell no matter how much data lands afterwards.
  //
  // That window is reachable. `usePageResolver` preloads nothing for a custom
  // `_action/:action` sub-route (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3), so a cold
  // deep link enriches during the first render, ahead of the page's own fetch. The
  // only escape was `clearEnrichmentCache()`, which fires on an `authStore.resources`
  // change and may never come.
  //
  // The entry is still written BEFORE the build above — that is the circular-relation
  // guard and it must stay — so an un-headered result is evicted here instead, and
  // rebuilt on the next read once the headers exist.
  if (!allHeaders.length) _enrichedCache.delete(cacheKey)

  return enriched
}
export function useRecord(resourceNameOverride, codeOverride) {
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
    return enrichRecord(name, code, dataStore)
  })

  const records = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return []
    return dataStore.getRecords(name).map(r =>
      enrichRecord(name, r.Code, dataStore)
    )
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

  async function loadRelations() {
    const rels = relations.value
    if (!rels) return

    const resourceNames = new Set()
    for (const p of rels.parents) resourceNames.add(p.resourceName)
    for (const c of rels.children) resourceNames.add(c.name)
    for (const refRes of Object.values(rels.linkRefs)) resourceNames.add(refRes)

    const tasks = Array.from(resourceNames).map(name =>
      resourceIoStore.fetchResource(name).catch(() => {})
    )
    await Promise.all(tasks)
  }

  function getRecordByCode(code) {
    if (!code) return null
    const name = resolvedResourceName.value
    if (!name) return null
    return enrichRecord(name, code, dataStore)
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

  watch(() => authStore.resources, () => clearEnrichmentCache(), { deep: false })

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
    loadRelations,
    getRecordByCode,
    updateLocalRecord,
    notify,
    reset: runReset
  }
}
