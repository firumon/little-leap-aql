import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { onRowsUpserted, getResourceRows } from '../utils/db'
import { useAuthStore } from './auth'

export const useDataStore = defineStore('data', () => {
  const headers = {}
  const rows = reactive({})

  function initResource(resourceName, headerArray) {
    if (!headers[resourceName]) {
      headers[resourceName] = headerArray || []
    }
  }

  function setRows(resourceName, newRows) {
    if (!rows[resourceName]) {
      rows[resourceName] = []
    }

    if (!newRows || newRows.length === 0) return

    const map = new Map(rows[resourceName].map(row => [row[0], row]))
    for (const row of newRows) {
      if (row && row.length > 0) {
        map.set(row[0], row)
      }
    }
    rows[resourceName] = Array.from(map.values())
  }

  function replaceRows(resourceName, newRows) {
    rows[resourceName] = newRows || []
  }

  function getRecords(resourceName) {
    const h = headers[resourceName] || []
    const r = rows[resourceName] || []
    return r.map(row => {
      const obj = {}
      h.forEach((key, i) => { obj[key] = row[i] ?? '' })
      return obj
    })
  }

  // Register the DB listener — fires on every upsertResourceRows call
  onRowsUpserted((resource, upsertedRows) => {
    setRows(resource, upsertedRows)
  })

  // Seed store from IDB for all authorized resources
  async function seedFromIDB(resources) {
    for (const res of resources) {
      if (!res?.name) continue
      initResource(res.name, res.headers || [])
      try {
        const idbRows = await getResourceRows(res.name, { includeInactive: true })
        if (idbRows.length) {
          setRows(res.name, idbRows)
        }
      } catch (_) { /* non-critical — store stays empty, sync will fill it */ }
    }
  }

  const authStore = useAuthStore()

  watch(
    () => authStore.resources,
    (resources, prevResources) => {
      if (!resources?.length) return
      if (prevResources?.length) {
        // Re-login — clear stale rows before re-seeding
        Object.keys(rows).forEach(r => replaceRows(r, []))
      }
      seedFromIDB(resources)
    },
    { immediate: true }
  )

  return {
    headers,
    rows,
    initResource,
    setRows,
    replaceRows,
    getRecords
  }
})
