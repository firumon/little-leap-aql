import { ref } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useProductSkuViewData() {
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()
  const skuRows = ref([])
  const skuLoading = ref(false)

  function applySkuRows(productCode, records = []) {
    skuRows.value = records.filter((row) => row.ProductCode === productCode)
  }

  async function loadSkuRows(productCode) {
    if (!productCode) return
    skuLoading.value = true

    try {
      const response = await resourceIoStore.fetchResource('SKUs')
      if (response.success && Array.isArray(response.records)) {
        applySkuRows(productCode, response.records)
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

