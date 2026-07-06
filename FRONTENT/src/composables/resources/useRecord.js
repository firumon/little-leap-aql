import { ref, computed, watch, unref, reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from './useResourceConfig'
import { evaluateFilter, normalizeListViewsMode } from 'src/composables/useListViews'
import {singularize} from "src/utils/appHelpers.js";

// Shared cache across all useRecord instances — keyed by "ResourceName::Code"
const _enrichedCache = new Map()

export function clearEnrichmentCache() {
  _enrichedCache.clear()
}

function _enrichRecord(resourceName, code, dataStore) {
  if (!resourceName || !code) return null

  const cacheKey = `${resourceName}::${code}`
  if (_enrichedCache.has(cacheKey)) return _enrichedCache.get(cacheKey)

  const enriched = reactive({})
  _enrichedCache.set(cacheKey, enriched)   // Cache BEFORE building — prevents circular loops

  // Live computed: re-evaluates when rows/headers change in the reactive store
  const live = computed(() => {
    return dataStore.getRecords(resourceName).find(r => r.Code === code) || null
  })

  // --- Flat header field getters ---
  const allHeaders = dataStore.headers[resourceName] || []
  for (const h of allHeaders) {
    Object.defineProperty(enriched, h, {
      get() { return live.value?.[h] },
      enumerable: true, configurable: true
    })
  }

  // --- Relation getters ---
  const meta = dataStore.getRelations(resourceName)

  // Parents
  const parentKeys = []
  for (const p of meta.parents) {
    const key = `$${p.singular.toLowerCase()}`
    parentKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const parentCode = live.value?.[p.codeField]
        if (!parentCode) return null
        return _enrichRecord(p.resourceName, parentCode, dataStore)
      },
      enumerable: false, configurable: true
    })
  }

  // Children
  const childKeys = []
  for (const c of meta.children) {
    const key = `$${c.name}`
    childKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const selfCode = live.value?.Code
        if (!selfCode) return []
        return dataStore.getRecords(c.name)
          .filter(row => row[c.codeField] === selfCode)
          .map(row => _enrichRecord(c.name, row.Code, dataStore))
      },
      enumerable: false, configurable: true
    })
  }

  // Link refs (cross-references via XxxCode columns not in parent/child)
  const linkKeys = []
  for (const [header, refResource] of Object.entries(meta.linkRefs)) {
    const singular = singularize(refResource).toLowerCase()
    const key = `$${singular}`
    // Avoid collisions with parent/child keys
    if (parentKeys.includes(key) || childKeys.includes(key)) continue
    linkKeys.push(key)
    Object.defineProperty(enriched, key, {
      get() {
        const refCode = live.value?.[header]
        if (!refCode) return null
        return _enrichRecord(refResource, refCode, dataStore)
      },
      enumerable: false, configurable: true
    })
  }

  // --- Metadata getters ---
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

  return enriched
}

export function useRecord(resourceNameOverride, codeOverride) {
  const $q = useQuasar()
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()
  const {
    resourceName: routeResourceName, code: routeCode,
    resourceConfig: routeConfig, resourceHeaders: routeHeaders
  } = useResourceConfig()

  // --- Resource name & code resolution ---
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

  // --- Loading state ---
  const loading = ref(false)
  const backgroundSyncing = ref(false)
  const searchTerm = ref('')
  const showInactive = ref(false)
  const loadRequestId = ref(0)

  // --- View switcher states & logic ---
  const activeViewName = ref('')

  const effectiveViews = computed(() => {
    const cfg = routeConfig.value
    const configured = cfg?.ui?.listViews
    const mode = normalizeListViewsMode(cfg?.ui?.listViewsMode || '')

    if (Array.isArray(configured) && configured.length > 0) {
      return configured
    }

    if (mode === 'off' || mode === 'custom') {
      return []
    }

    const headers = routeHeaders.value || []
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

  function setActiveView(name) {
    activeViewName.value = name
  }

  function initializeView() {
    const views = effectiveViews.value
    if (!views.length) {
      activeViewName.value = ''
      return
    }
    activeViewName.value = defaultViewName.value
  }

  watch(effectiveViews, () => {
    initializeView()
  }, { immediate: true })

  // --- Core reactive data ---
  const record = computed(() => {
    const name = resolvedResourceName.value
    const code = resolvedCode.value
    if (!name || !code) return null
    return _enrichRecord(name, code, dataStore)
  })

  const records = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return []
    return dataStore.getRecords(name).map(r =>
      _enrichRecord(name, r.Code, dataStore)
    )
  })

  // --- Search & filter ---
  const filteredRecords = computed(() => {
    let list = records.value

    if (activeView.value?.filter) {
      list = list.filter(r => evaluateFilter(activeView.value.filter, r))
    } else if (!activeView.value && !effectiveViews.value.length) {
      if (!showInactive.value) {
        list = list.filter(r => (r.Status || 'Active') === 'Active')
      }
    }

    const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
    if (!keyword) return list
    return list.filter(r => {
      const aggregate = Object.keys(r)
        .filter(k => !k.startsWith('$') && !k.startsWith('_'))
        .map(k => (r[k] ?? '').toString().toLowerCase())
        .join(' ')
      return aggregate.includes(keyword)
    })
  })

  // --- Relation metadata ---
  const relations = computed(() => dataStore.getRelations(resolvedResourceName.value))

  const childResources = computed(() => {
    const name = resolvedResourceName.value
    if (!name) return []
    const allResources = Array.isArray(authStore.resources) ? authStore.resources : []
    return allResources.filter(r => r?.parentResource === name)
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

  // Backward-compatible map: { ChildResourceName: [enriched child records] }
  const childRecordsByResource = computed(() => {
    const rec = record.value
    if (!rec) return {}
    const map = {}
    for (const key of rec._Children || []) {
      const childName = key.replace(/^\$/, '')
      map[childName] = rec[key] || []
    }
    return map
  })

  // --- Headers ---
  const headers = computed(() => dataStore.headers[resolvedResourceName.value] || [])

  // --- Data loading ---
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

  // Fetch all related resources (parents, children, linkRefs) from server
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
    return _enrichRecord(name, code, dataStore)
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
    searchTerm.value = ''
    showInactive.value = false
    activeViewName.value = defaultViewName.value
    loading.value = false
    backgroundSyncing.value = false
    loadRequestId.value++
  }

  // Clear enrichment cache on re-login (auth resources change)
  watch(() => authStore.resources, () => clearEnrichmentCache(), { deep: false })

  // Re-read from server when global sync completes and we have no data
  watch(() => authStore.isGlobalSyncing, (syncing, wasSyncing) => {
    if (wasSyncing && !syncing && records.value.length === 0) reload()
  })

  return {
    // Identity
    resourceName: resolvedResourceName,
    code: resolvedCode,

    // Enriched data
    record,
    records,
    items: records,
    filteredRecords,
    filteredItems: filteredRecords,
    headers,
    lastHeaders: headers,

    // Relations
    relations,
    childResources,
    parentResource,
    hasChildren,
    hasParent,
    childRecordsByResource,

    // Loading state
    loading,
    backgroundSyncing,
    searchTerm,
    showInactive,

    // View switching states & actions
    effectiveViews,
    activeViewName,
    activeView,
    setActiveView,

    // Methods
    reload,
    loadRelations,
    getRecordByCode,
    updateLocalRecord,
    notify,
    reset: runReset
  }
}
