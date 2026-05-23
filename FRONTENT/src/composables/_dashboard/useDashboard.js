import { computed, onMounted } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useCurrency } from 'src/composables/useCurrency'

export function useDashboard() {
  const dataStore = useDataStore()
  const resourceIo = useResourceIoStore()
  const { allowed } = useResourceConfig()
  const { _C } = useCurrency()

  // 1. Vite Glob Discovery: Scan all widget config files eagerly
  const widgetModules = import.meta.glob('src/dashboard/**/*.js', { eager: true })

  // 2. Discover and filter widgets by permission gating
  const activeWidgets = computed(() => {
    const allWidgets = Object.keys(widgetModules).map((key) => {
      const mod = widgetModules[key]
      return mod.default || mod
    }).filter((w) => w && w.metadata)

    // Permission gating using allowed helper (AND fail-safe)
    const allowedWidgets = allWidgets.filter((w) => {
      const perm = w.metadata.permission
      if (!perm) return true
      return allowed(perm)
    })

    // Scope sorting priority hierarchy: operations (3) > accounts (2) > masters (1)
    const getScopePriority = (scope) => {
      const cleanScope = String(scope || '').toLowerCase().trim()
      if (cleanScope === 'operations') return 3
      if (cleanScope === 'accounts') return 2
      if (cleanScope === 'masters') return 1
      return 0
    }

    return allowedWidgets.sort((a, b) => {
      const priorityA = getScopePriority(a.metadata.scope)
      const priorityB = getScopePriority(b.metadata.scope)

      if (priorityB !== priorityA) {
        return priorityB - priorityA // Higher scope priority first
      }

      // Secondary sorting: weight descending
      const weightA = Number(a.metadata.config?.weight || 0)
      const weightB = Number(b.metadata.config?.weight || 0)
      if (weightB !== weightA) {
        return weightB - weightA
      }

      // Tertiary sorting: alphabetical title
      const titleA = String(a.metadata.config?.title || '')
      const titleB = String(b.metadata.config?.title || '')
      return titleA.localeCompare(titleB)
    })
  })

  // 3. Extract unique resource dependencies
  const requiredResources = computed(() => {
    const resSet = new Set()
    activeWidgets.value.forEach((w) => {
      const ds = w.metadata.dataSource
      if (ds) {
        if (ds.resource) resSet.add(ds.resource)
        if (Array.isArray(ds.resources)) {
          ds.resources.forEach((r) => resSet.add(r))
        }
      }
    })
    return Array.from(resSet)
  })

  // 4. Batch asynchronous loading sequence on mount
  onMounted(async () => {
    const resourcesToFetch = requiredResources.value.filter((res) => {
      const rows = dataStore.rows[res] || []
      // Fetch if empty in Pinia, and not already loading/syncing
      return rows.length === 0 && !dataStore.loadingByResource[res] && !dataStore.backgroundSyncingByResource[res]
    })

    if (resourcesToFetch.length > 0) {
      try {
        await resourceIo.fetchResources(resourcesToFetch, { showLoading: false })
      } catch (err) {
        console.error('Failed to load dashboard dependencies:', err)
      }
    }
  })

  // 5. Expose dynamic, reactive loading state
  const loading = computed(() => {
    return requiredResources.value.some((res) => {
      return dataStore.loadingByResource[res] === true || dataStore.backgroundSyncingByResource[res] === true
    })
  })

  // 6. Filtering Helper
  function evaluateFilters(records, filters) {
    if (!Array.isArray(filters) || !filters.length) return records

    return records.filter((rec) => {
      return filters.every((f) => {
        const { field, op, value } = f
        if (!field) return true

        const cell = rec[field]
        const cleanCell = cell !== undefined && cell !== null ? String(cell) : ''

        switch (op) {
          case 'eq':
            return cleanCell.toLowerCase() === String(value ?? '').toLowerCase()
          case 'ne':
            return cleanCell.toLowerCase() !== String(value ?? '').toLowerCase()
          case 'gt':
            return Number(cell || 0) > Number(value || 0)
          case 'lt':
            return Number(cell || 0) < Number(value || 0)
          case 'in': {
            const arr = Array.isArray(value)
              ? value
              : String(value || '').split(',').map((s) => s.trim())
            return arr.map(String).map((s) => s.toLowerCase()).includes(cleanCell.toLowerCase())
          }
          case 'contains':
            return cleanCell.toLowerCase().includes(String(value ?? '').toLowerCase())
          default:
            return true
        }
      })
    })
  }

  // 7. Aggregation Helper
  function evaluateAggregate(records, aggregate) {
    if (!aggregate) return records.length

    if (aggregate === 'count' || aggregate.type === 'count') {
      return records.length
    }

    const { type, field } = aggregate
    if (!field) return records.length

    const values = records.map((r) => Number(r[field] || 0)).filter((v) => !isNaN(v))

    if (type === 'sum') {
      return values.reduce((sum, v) => sum + v, 0)
    }

    if (type === 'avg') {
      if (!values.length) return 0
      return values.reduce((sum, v) => sum + v, 0) / values.length
    }

    return records.length
  }

  // 8. Central Process Data Core (Memoized & Reactively Bound)
  function processWidgetData(widget) {
    const { dataSource } = widget.metadata
    if (!dataSource) return null

    const context = { _C }

    // Multi-resource Mode
    if (Array.isArray(dataSource.resources)) {
      const dataList = dataSource.resources.map((res) => {
        return dataStore.getRecords(res) || []
      })

      if (typeof dataSource.evaluate === 'function') {
        return dataSource.evaluate(dataList, context)
      }
      return dataList
    }

    // Single-resource Mode
    const primaryRes = dataSource.resource
    if (!primaryRes) return null

    const rawRecords = dataStore.getRecords(primaryRes) || []
    const dsPipeline = dataSource.pipeline || {}

    // Apply filters
    const filtered = evaluateFilters(rawRecords, dsPipeline.filters)

    // Apply custom evaluation if provided, else apply declarative aggregates
    if (typeof dataSource.evaluate === 'function') {
      return dataSource.evaluate(filtered, context)
    }

    return evaluateAggregate(filtered, dsPipeline.aggregate)
  }

  // 9. Reactively Memoize calculations per widget
  const widgetValues = computed(() => {
    const values = {}
    activeWidgets.value.forEach((widget) => {
      const { id, dataSource } = widget.metadata
      const resourcesList = dataSource.resources || (dataSource.resource ? [dataSource.resource] : [])
      
      // Explicitly access Pinia reactivity layers to trigger Vue computed tracking
      resourcesList.forEach((res) => {
        const _ = dataStore.rows[res]
      })

      try {
        values[id] = processWidgetData(widget)
      } catch (err) {
        console.error(`Calculation failed for widget ID: ${id}`, err)
        values[id] = null
      }
    })
    return values
  })

  return {
    activeWidgets,
    widgetValues,
    loading
  }
}
