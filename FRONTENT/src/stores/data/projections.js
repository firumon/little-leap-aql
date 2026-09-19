import { computed, effectScope } from 'vue'

export function createProjections(state, ensureResource) {
  const { rows, headers, _touch } = state

  // Per-resource projection, memoized so repeat reads never re-map the rows. The
  // scope is store-owned so a caller's component scope cannot stop these.
  const _projectionScope = effectScope(true)
  const _projections = new Map()
  const _memos = new Map()

  function remember(key, build) {
    let value = _memos.get(key)
    if (value !== undefined) return value
    value = _projectionScope.run(build)
    _memos.set(key, value)
    return value
  }

  function _projection(resourceName) {
    let entry = _projections.get(resourceName)
    if (entry) return entry
    entry = _projectionScope.run(() => {
      // Rows, records and the Code index in one pass over the Map.
      const projected = computed(() => {
        // The dependency: the Map is raw, so this is what triggers a rebuild.
        _touch(resourceName)
        const map = rows[resourceName]
        const hdrs = headers[resourceName] || []
        const width = hdrs.length
        const rowList = []
        const records = []
        const byCode = new Map()

        if (map) {
          for (const row of map.values()) {
            rowList.push(row)
            // A cached IndexedDB payload can hand back objects, not arrays.
            let record
            if (Array.isArray(row)) {
              record = {}
              for (let i = 0; i < width; i++) record[hdrs[i]] = row[i]
            } else {
              record = { ...row }
            }
            records.push(record)
            if (record.Code) byCode.set(record.Code, record)
          }
        }

        return { rowList, records, byCode }
      })

      return {
        rowList: computed(() => projected.value.rowList),
        records: computed(() => projected.value.records),
        byCode: computed(() => projected.value.byCode),
        // Per-(resource, header) indexes, built on first ask.
        indexes: new Map()
      }
    })
    _projections.set(resourceName, entry)
    return entry
  }

  function _index(resourceName, header) {
    const entry = _projection(resourceName)
    let index = entry.indexes.get(header)
    if (index) return index
    index = _projectionScope.run(() => computed(() => {
      const map = new Map()
      for (const record of entry.records.value) {
        const value = record[header]
        if (value === undefined || value === null || value === '') continue
        const bucket = map.get(value)
        if (bucket) bucket.push(record)
        else map.set(value, [record])
      }
      return map
    }))
    entry.indexes.set(header, index)
    return index
  }

  function getRows(resourceName) {
    if (!resourceName) return []
    ensureResource(resourceName)
    return _projection(resourceName).rowList.value
  }

  function getRecords(resourceName) {
    if (!resourceName) return []
    ensureResource(resourceName)
    return _projection(resourceName).records.value
  }

  /** All records whose `header` equals `value`. O(1) lookup, shared array. */
  function getRecordsBy(resourceName, header, value) {
    if (!resourceName || !header) return []
    if (value === undefined || value === null || value === '') return []
    ensureResource(resourceName)
    if (header === 'Code') {
      const match = _projection(resourceName).byCode.value.get(value)
      return match ? [match] : []
    }
    return _index(resourceName, header).value.get(value) || []
  }

  /** First record whose `header` equals `value`, or null. */
  function getRecordBy(resourceName, header, value) {
    return getRecordsBy(resourceName, header, value)[0] || null
  }

  function getRecord(resourceName, code) {
    if (!resourceName || !code) return null
    ensureResource(resourceName)
    return _projection(resourceName).byCode.value.get(code) || null
  }

  return {
    _projectionScope,
    _projections,
    _projection,
    _index,
    remember,
    getRows,
    getRecords,
    getRecordsBy,
    getRecordBy,
    getRecord
  }
}
