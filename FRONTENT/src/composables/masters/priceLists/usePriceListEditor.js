import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { parseVariantTypes } from 'src/composables/masters/products/useProductVariants'
import { useApiErrorNotify } from 'src/composables/useApiErrorNotify'

export function usePriceListEditor() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()
  const { notifyApiError } = useApiErrorNotify()

  const expandedCode = ref('')
  const editingHeader = ref(null)
  const dirtyPrices = ref({})
  const saving = ref(false)
  const headerOriginal = ref({})
  const priceOriginal = ref({})

  const priceListLookupMode = computed(() => {
    const val = authStore.appConfigMap?.PriceListLookup
    return val === 'ITEMS' ? 'ITEMS' : 'INLINE'
  })

  const priceListRecords = computed(() => dataStore.getRecords('PriceList'))
  const priceListItemsRows = computed(() => dataStore.getRecords('PriceListItems'))
  const productRows = computed(() => dataStore.getRecords('Products'))
  const skuRows = computed(() => dataStore.getRecords('SKUs'))

  const productByCode = computed(() => {
    const map = {}
    for (const p of productRows.value) {
      if ((p.Status || 'Active') === 'Inactive') continue
      map[p.Code] = p
    }
    return map
  })

  const skusByProductCode = computed(() => {
    const map = {}
    for (const s of skuRows.value) {
      if ((s.Status || 'Active') === 'Inactive') continue
      const pc = s.ProductCode
      if (!map[pc]) map[pc] = []
      map[pc].push(s)
    }
    return map
  })

  const priceMapBySkuCode = computed(() => {
    const code = expandedCode.value
    if (!code) return {}

    if (priceListLookupMode.value === 'ITEMS') {
      const map = {}
      for (const item of priceListItemsRows.value) {
        if (item.PriceListCode !== code) continue
        if ((item.Status || 'Active') === 'Inactive') continue
        const p = parseFloat(item.Price)
        map[item.SKUCode] = isNaN(p) ? '' : p
      }
      return map
    }

    const pl = priceListRecords.value.find((r) => r.Code === code)
    if (!pl || !pl.SKUPrices) return {}
    try {
      const parsed = JSON.parse(pl.SKUPrices)
      const map = {}
      for (const [skuCode, price] of Object.entries(parsed)) {
        const p = parseFloat(price)
        map[skuCode] = isNaN(p) ? '' : p
      }
      return map
    } catch {
      return {}
    }
  })

  const expandedSkus = computed(() => {
    if (!expandedCode.value) return []

    const result = []
    const products = Object.values(productByCode.value)
    products.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))

    for (const product of products) {
      const skus = skusByProductCode.value[product.Code] || []
      const variants = parseVariantTypes(product.VariantTypes || '')

      for (const sku of skus) {
        const variantParts = variants
          .map((v) => (sku[v.key] || '').toString().trim())
          .filter(Boolean)
        const variantLabel = variantParts.length ? variantParts.join(', ') : sku.Code

        result.push({
          productCode: product.Code,
          productName: product.Name || '(Unnamed)',
          skuCode: sku.Code,
          variantLabel,
          price: priceMapBySkuCode.value[sku.Code] ?? ''
        })
      }
    }
    return result
  })

  const groupedSkus = computed(() => {
    const groups = []
    let cur = null
    for (const e of expandedSkus.value) {
      if (!e || !e.productCode || !e.skuCode) continue

      if (!cur || cur.productCode !== e.productCode) {
        cur = { productCode: e.productCode, productName: e.productName, skus: [] }
        groups.push(cur)
      }
      cur.skus.push({ skuCode: e.skuCode, variantLabel: e.variantLabel, price: e.price })
    }
    return groups.filter(Boolean)
  })

  const headerChanged = computed(() => {
    if (!editingHeader.value || !headerOriginal.value) return false
    const fields = ['Name', 'Description', 'Currency', 'IsDefault', 'Status']
    return fields.some((f) => {
      const cur = (editingHeader.value[f] ?? '').toString().trim()
      const orig = (headerOriginal.value[f] ?? '').toString().trim()
      return cur !== orig
    })
  })

  const pricesChanged = computed(() => {
    const keys = new Set([
      ...Object.keys(priceOriginal.value || {}),
      ...Object.keys(dirtyPrices.value || {})
    ])
    for (const skuCode of keys) {
      const cur = dirtyPrices.value[skuCode] ?? ''
      const orig = priceOriginal.value[skuCode] ?? ''
      if (String(cur) !== String(orig)) return true
    }
    return false
  })

  function cloneEditableHeader(row = {}) {
    return {
      Name: row.Name || '',
      Description: row.Description || '',
      Currency: row.Currency || '',
      IsDefault: row.IsDefault || 'FALSE',
      Status: row.Status || 'Active'
    }
  }

  function expandPriceList(code) {
    const pl = priceListRecords.value.find((r) => r.Code === code)
    if (!pl) return

    const editableHeader = cloneEditableHeader(pl)
    headerOriginal.value = { ...editableHeader }
    editingHeader.value = { ...editableHeader }
    expandedCode.value = code
    dirtyPrices.value = { ...priceMapBySkuCode.value }
    priceOriginal.value = { ...priceMapBySkuCode.value }
    saving.value = false
  }

  function collapsePriceList() {
    expandedCode.value = ''
    editingHeader.value = null
    dirtyPrices.value = {}
    headerOriginal.value = {}
    priceOriginal.value = {}
  }

  function isPriceListExpanded(code) {
    return !!code && expandedCode.value === code
  }

  function setPriceListExpanded(code, expanded) {
    if (expanded) expandPriceList(code)
    else if (expandedCode.value === code) collapsePriceList()
  }

  function togglePriceList(code) {
    setPriceListExpanded(code, expandedCode.value !== code)
  }

  function updateHeaderField(header, value) {
    if (!editingHeader.value) return
    editingHeader.value[header] = value
  }

  function updatePriceField(skuCode, value) {
    if (!expandedCode.value) return
    if (value !== '' && value !== null && value !== undefined) {
      const num = parseFloat(value)
      if (isNaN(num)) return
      dirtyPrices.value = { ...dirtyPrices.value, [skuCode]: num }
    } else {
      dirtyPrices.value = { ...dirtyPrices.value, [skuCode]: '' }
    }
  }

  function getPrice(skuCode) {
    return dirtyPrices.value[skuCode] ?? ''
  }

  async function _savePricesViaItems() {
    const code = expandedCode.value

    const existing = {}
    for (const item of priceListItemsRows.value) {
      if (item.PriceListCode !== code || (item.Status || 'Active') === 'Inactive') continue
      existing[item.SKUCode] = item
    }

    const records = []
    for (const [skuCode, price] of Object.entries(dirtyPrices.value)) {
      if (price === '' || price === null || price === undefined) continue
      const ex = existing[skuCode]
      const num = parseFloat(price)
      if (isNaN(num)) continue
      if (ex) {
        const old = parseFloat(ex.Price)
        if (num !== old || isNaN(old)) {
          records.push({ _action: 'update', _originalCode: ex.Code, data: { Price: num } })
        }
      } else {
        records.push({
          _action: 'create',
          data: { PriceListCode: code, SKUCode: skuCode, Price: num, Status: 'Active' }
        })
      }
    }

    if (!records.length) return { success: true }
    const response = await workflowStore.uploadBulkRecords('PriceListItems', records)
    notifyApiError(response, { fallbackMessage: 'Failed to save price list items' })
    return response
  }

  async function _savePricesViaInline() {
    const code = expandedCode.value
    const priceObj = {}
    for (const [skuCode, price] of Object.entries(dirtyPrices.value)) {
      const num = parseFloat(price)
      if (!isNaN(num)) priceObj[skuCode] = num
    }

    const response = await workflowStore.updateResourceRecord('PriceList', code, {
      SKUPrices: JSON.stringify(priceObj)
    })
    notifyApiError(response, { fallbackMessage: 'Failed to save price list prices' })
    return response
  }

  async function saveSection() {
    if (!expandedCode.value) return
    saving.value = true
    try {
      if (headerChanged.value && editingHeader.value) {
        const headerResponse = await workflowStore.updateResourceRecord('PriceList', expandedCode.value, {
          Name: editingHeader.value.Name,
          Description: editingHeader.value.Description,
          Currency: editingHeader.value.Currency,
          IsDefault: editingHeader.value.IsDefault,
          Status: editingHeader.value.Status
        })
        notifyApiError(headerResponse, { fallbackMessage: 'Failed to save price list details' })
        if (!headerResponse?.success) return headerResponse
      }

      if (pricesChanged.value) {
        const priceResponse = priceListLookupMode.value === 'ITEMS'
          ? await _savePricesViaItems()
          : await _savePricesViaInline()
        if (priceResponse && !priceResponse.success) return priceResponse
      }

      if (editingHeader.value) {
        headerOriginal.value = cloneEditableHeader(editingHeader.value)
      }
      priceOriginal.value = { ...dirtyPrices.value }
    } finally {
      saving.value = false
    }
  }

  return {
    expandedCode,
    editingHeader,
    dirtyPrices,
    headerChanged,
    pricesChanged,
    saving,
    priceListLookupMode,
    groupedSkus,
    isPriceListExpanded,
    setPriceListExpanded,
    togglePriceList,
    expandPriceList,
    collapsePriceList,
    updateHeaderField,
    updatePriceField,
    getPrice,
    saveSection
  }
}
