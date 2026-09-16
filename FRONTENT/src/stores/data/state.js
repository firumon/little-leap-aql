import { reactive } from 'vue'

export function createState() {
  const headers = reactive({})
  const loadingByResource = reactive({})
  const backgroundSyncingByResource = reactive({})
  const resourceRelations = reactive({})

  // Raw Maps keyed by row Code; reactivity is carried by the version counter, so
  // never read `rows` directly from outside — use the accessors below.
  const rows = {}
  const rowsVersion = reactive({})

  function _touch(resourceName) {
    return rowsVersion[resourceName]
  }

  function _bump(resourceName) {
    rowsVersion[resourceName] = (rowsVersion[resourceName] || 0) + 1
  }

  function ensureResourceState(resourceName) {
    if (!resourceName) return
    if (!headers[resourceName]) {
      headers[resourceName] = []
    }
    if (!rows[resourceName]) {
      rows[resourceName] = new Map()
      rowsVersion[resourceName] = 0
    }
  }

  function initResource(resourceName, headerArray = []) {
    ensureResourceState(resourceName)
    if (Array.isArray(headerArray) && headerArray.length) {
      headers[resourceName] = headerArray
    }
  }

  function setRows(resourceName, newRows) {
    ensureResourceState(resourceName)
    if (!newRows || newRows.length === 0) return

    const map = rows[resourceName]
    for (const row of newRows) {
      if (row && row.length > 0) {
        map.set(row[0], row)
      }
    }
    _bump(resourceName)
  }

  function replaceRows(resourceName, newRows) {
    ensureResourceState(resourceName)
    const map = new Map()
    for (const row of newRows || []) {
      if (row && row.length > 0) map.set(row[0], row)
    }
    rows[resourceName] = map
    _bump(resourceName)
  }

  function getRowCount(resourceName) {
    if (!resourceName) return 0
    ensureResourceState(resourceName)
    _touch(resourceName)
    return rows[resourceName].size
  }

  function hasRows(resourceName) {
    return getRowCount(resourceName) > 0
  }

  return {
    headers,
    loadingByResource,
    backgroundSyncingByResource,
    resourceRelations,
    rows,
    rowsVersion,
    _touch,
    _bump,
    ensureResourceState,
    initResource,
    setRows,
    replaceRows,
    getRowCount,
    hasRows
  }
}
