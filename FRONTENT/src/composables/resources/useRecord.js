import { computed, getCurrentScope } from 'vue'
import { useDataStore } from 'src/stores/data'
import { singularize } from 'src/utils/appHelpers'

function _resolveTargetCode(dataStore, resourceName, targetHeader, value) {
  if (!targetHeader || targetHeader === 'Code') return value
  return dataStore.getRecordBy(resourceName, targetHeader, value)?.Code || null
}

export function useRecord() {
  const dataStore = useDataStore()

  return dataStore.remember('useRecord', () => {
    function relationPlan(resource) {
      return dataStore.remember('relplan:' + resource, () =>
        computed(() => {
          const meta = dataStore.getRelations(resource)
          const parentKeys = []
          const childKeys = []
          const linkKeys = []
          const byKey = new Map()

          for (const p of meta.parents || []) {
            const key = `$${p.singular.toLowerCase()}`
            parentKeys.push(key)
            byKey.set(key, { kind: 'parent', spec: p })
          }

          for (const c of meta.children || []) {
            const key = `$${c.name}`
            childKeys.push(key)
            const entry = { kind: 'child', spec: c }
            byKey.set(key, entry)
            const lowerKey = `$${c.name.toLowerCase()}`
            if (lowerKey !== key) {
              byKey.set(lowerKey, entry)
            }
          }

          for (const rel of Object.values(meta.refs || {})) {
            const key = `$${singularize(rel.resource).toLowerCase()}`
            if (parentKeys.includes(key) || childKeys.includes(key)) continue
            linkKeys.push(key)
            byKey.set(key, { kind: 'link', spec: rel })
          }

          const allParentKeys = [...parentKeys, ...linkKeys]

          return { meta, parentKeys, childKeys, linkKeys, allParentKeys, byKey }
        })
      )
    }

    function rows(resource) {
      if (!resource) return []
      return dataStore.getRecords(resource)
    }

    function relations(resource) {
      if (!resource) return { parents: [], children: [], linkRefs: {}, refs: {} }
      return dataStore.getRelations(resource)
    }

    function enrich(resource, code) {
      if (!resource || !code) return null

      const cache = dataStore.remember('enrich:' + resource, () => {
        const map = new Map()
        map._scope = getCurrentScope()
        return map
      })

      let record = cache.get(code)
      if (record) return record

      const runInScope = (fn) => (cache._scope ? cache._scope.run(fn) : fn())
      const live = runInScope(() => computed(() => dataStore.getRecord(resource, code)))
      const planRef = runInScope(() => relationPlan(resource))

      function getRelation(prop) {
        const plan = planRef.value
        if (!plan) return undefined

        if (prop === '_Parents') return [...plan.allParentKeys]
        if (prop === '_Children') return [...plan.childKeys]
        if (prop === '_relation') return plan.meta

        if (prop === '_Parent') {
          const map = {}
          for (const key of plan.allParentKeys) map[key] = proxy[key]
          return map
        }

        if (prop === '_Child') {
          const map = {}
          for (const key of plan.childKeys) map[key] = proxy[key]
          return map
        }

        if (typeof prop === 'string' && prop.startsWith('$')) {
          const entry = plan.byKey.get(prop)
          if (!entry) return undefined

          if (entry.kind === 'parent') {
            const p = entry.spec
            const parentValue = live.value?.[p.codeField]
            if (!parentValue) return null
            const parentCode = _resolveTargetCode(dataStore, p.resourceName, p.targetHeader, parentValue)
            if (!parentCode) return null
            return enrich(p.resourceName, parentCode)
          }

          if (entry.kind === 'child') {
            const c = entry.spec
            const selfValue = live.value?.[c.targetHeader || 'Code']
            if (!selfValue) return []
            return dataStore.getRecordsBy(c.name, c.codeField, selfValue)
              .map(row => enrich(c.name, row.Code))
          }

          if (entry.kind === 'link') {
            const rel = entry.spec
            const refValue = live.value?.[rel.header]
            if (!refValue) return null
            const refCode = _resolveTargetCode(dataStore, rel.resource, rel.targetHeader, refValue)
            if (!refCode) return null
            return enrich(rel.resource, refCode)
          }
        }

        return undefined
      }

      const target = {}
      const proxy = new Proxy(target, {
        get(t, prop) {
          if (typeof prop !== 'string') return t[prop]
          if (prop.startsWith('$') || prop.startsWith('_')) {
            const rel = getRelation(prop)
            if (rel !== undefined) return rel
          }
          return live.value?.[prop]
        },
        has(t, prop) {
          if (typeof prop !== 'string') return false
          const row = live.value
          if (row && prop in row) return true
          const hdrs = dataStore.headers[resource] || []
          if (hdrs.includes(prop)) return true
          if (prop === '_Parents' || prop === '_Parent' || prop === '_Children' || prop === '_Child' || prop === '_relation') {
            return true
          }
          if (prop.startsWith('$')) {
            const plan = planRef.value
            return plan?.byKey.has(prop) ?? false
          }
          return prop in t
        },
        ownKeys() {
          const row = live.value
          return row ? Object.keys(row) : (dataStore.headers[resource] || [])
        },
        getOwnPropertyDescriptor(t, prop) {
          if (typeof prop !== 'string') return undefined
          const row = live.value
          if (row && prop in row) {
            return { value: row[prop], writable: true, enumerable: true, configurable: true }
          }
          const hdrs = dataStore.headers[resource] || []
          if (hdrs.includes(prop)) {
            return { value: row?.[prop], writable: true, enumerable: true, configurable: true }
          }
          if (prop.startsWith('$') || prop.startsWith('_')) {
            const rel = getRelation(prop)
            if (rel !== undefined) {
              return { value: rel, writable: false, enumerable: false, configurable: true }
            }
          }
          return undefined
        }
      })

      // Circular guard: cache before resolving relations
      cache.set(code, proxy)
      return proxy
    }

    function enriched(resource) {
      if (!resource) return []
      return dataStore.getRecords(resource).map(r => enrich(resource, r.Code))
    }

    function getIndex(resource, header) {
      return dataStore.remember('index:' + resource + ':' + header, () =>
        computed(() => {
          const map = new Map()
          for (const record of dataStore.getRecords(resource)) {
            const val = record[header]
            if (val === undefined || val === null || val === '') continue
            const bucket = map.get(val)
            if (bucket) bucket.push(record)
            else map.set(val, [record])
          }
          return map
        })
      )
    }

    function recordsBy(resource, header, v) {
      if (!resource || !header || v === undefined || v === null || v === '') return []
      const matches = getIndex(resource, header).value.get(v)
      if (!matches || !matches.length) return []
      return matches.map(r => enrich(resource, r.Code))
    }

    function recordBy(resource, header, v) {
      if (!resource || !header || v === undefined || v === null || v === '') return null
      if (header === 'Code') {
        const raw = dataStore.getRecord(resource, v)
        return raw ? enrich(resource, v) : null
      }
      const matches = getIndex(resource, header).value.get(v)
      return matches && matches.length ? enrich(resource, matches[0].Code) : null
    }

    function isLoading(resource) {
      if (!resource) return false
      return !!dataStore.loadingByResource?.[resource]
    }

    return {
      rows,
      enrich,
      enriched,
      recordsBy,
      recordBy,
      relations,
      isLoading,
      remember: (key, build) => dataStore.remember('shared:' + key, build)
    }
  })
}
