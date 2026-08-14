import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'

// Pure Supplier enrichment function
export const enrichSupplier = (sup) => {
  if (!sup || !sup.Code) return null

  return {
    code: sup.Code,
    supplierCode: sup.Code,
    name: sup.Name || '',
    country: sup.Country || '',
    province: sup.Province || '',
    city: sup.City || '',
    communicationAddress: sup.CommunicationAddress || '',
    contactPerson: sup.ContactPerson || '',
    phone: sup.Phone || '',
    email: sup.Email || '',
    taxRegistrationNumber: sup.TaxRegistrationNumber || '',
    taxRegistrationName: sup.TaxRegistrationName || '',
    accessRegion: sup.AccessRegion || '',
    status: sup.Status || 'Active',
    createdAt: sup.CreatedAt || '',
    updatedAt: sup.UpdatedAt || '',
    createdBy: sup.CreatedBy || '',
    updatedBy: sup.UpdatedBy || '',
    _raw: sup
  }
}

// Composable for Suppliers master resource
export function useSupplierResource() {
  const dataStore = useDataStore()

  const suppliers = computed(() => {
    const raw = dataStore.getRecords('Suppliers') || []
    return raw.map(enrichSupplier).filter(Boolean)
  })

  const activeSuppliers = computed(() => suppliers.value.filter((s) => s.status === 'Active'))

  const supplierMap = computed(() => new Map(suppliers.value.map((s) => [s.code, s])))

  const getSupplier = (code) => {
    if (!code) return null
    return supplierMap.value.get(code) || null
  }

  return {
    suppliers,
    allSuppliers: suppliers,
    activeSuppliers,
    supplierMap,
    getSupplier
  }
}
