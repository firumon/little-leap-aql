import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createMasterRecord,
  fetchMasterRecords,
  updateMasterRecord
} from 'src/services/masterRecords'

const RESOURCE_NAME = 'Products'

export const useProductsStore = defineStore('products', () => {
  const items = ref([])
  const headers = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const includeInactive = ref(false)

  async function fetchProducts(includeInactiveParam = includeInactive.value) {
    loading.value = true
    try {
      includeInactive.value = includeInactiveParam
      const response = await fetchMasterRecords(RESOURCE_NAME, {
        includeInactive: includeInactiveParam
      })

      if (!response.success) {
        return { success: false, message: response.message || 'Failed to load products' }
      }

      headers.value = response.headers
      items.value = response.records.map((record) => ({
        code: record.Code || '',
        name: record.Name || '',
        sku: record.SKU || '',
        status: (record.Status || '').toString().trim() || 'Active'
      }))

      if (response.stale) {
        return { success: true, data: items.value, stale: true, message: response.message }
      }

      return { success: true, data: items.value }
    } finally {
      loading.value = false
    }
  }

  async function createProduct(payload) {
    saving.value = true
    try {
      const data = await createMasterRecord(RESOURCE_NAME, {
        Name: payload?.name,
        SKU: payload?.sku,
        Status: payload?.status
      })

      if (!data.success) {
        return { success: false, message: data.message || 'Failed to create product' }
      }

      await fetchProducts(includeInactive.value)
      return { success: true, data: data.data }
    } finally {
      saving.value = false
    }
  }

  async function updateProduct(payload) {
    saving.value = true
    try {
      const data = await updateMasterRecord(RESOURCE_NAME, payload?.code, {
        Name: payload?.name,
        SKU: payload?.sku,
        Status: payload?.status
      })

      if (!data.success) {
        return { success: false, message: data.message || 'Failed to update product' }
      }

      await fetchProducts(includeInactive.value)
      return { success: true, data: data.data }
    } finally {
      saving.value = false
    }
  }

  return {
    items,
    headers,
    loading,
    saving,
    includeInactive,
    fetchProducts,
    createProduct,
    updateProduct
  }
})
