import { ref } from 'vue'
import { useDataStore } from 'src/stores/data'

export function useProductSkuViewData() {
  const dataStore = useDataStore()
  const skuRows = ref([])
  const skuLoading = ref(false)

  function applySkuRows(productCode, records = []) {
    skuRows.value = records.filter((row) => row.ProductCode === productCode)
  }

  async function syncSkuRowsInBackground(productCode) {
    try {
      const response = await dataStore.syncResource('SKUs', {
        includeInactive: true,
        syncWhenCacheExists: true
      })

      if (response.success && Array.isArray(response.records)) {
        applySkuRows(productCode, response.records)
      }
    } finally {
      skuLoading.value = false
    }
  }

  async function loadSkuRows(productCode) {
    if (!productCode) return
    skuLoading.value = true

    try {
      const response = await dataStore.loadResource('SKUs', { includeInactive: true })
      if (response.success && Array.isArray(response.records)) {
        applySkuRows(productCode, response.records)
        if (response?.meta?.source === 'cache') {
          await syncSkuRowsInBackground(productCode)
          return
        }
      } else {
        skuRows.value = []
      }
    } finally {
      if (skuLoading.value) {
        skuLoading.value = false
      }
    }
  }

  return {
    skuRows,
    skuLoading,
    loadSkuRows
  }
}

