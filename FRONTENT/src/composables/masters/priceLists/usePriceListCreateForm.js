import { ref, computed, reactive } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useProductSkuResolver } from 'src/composables/masters/products/useProductSkuResolver'

export function usePriceListCreateForm() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()
  const nav = useResourceNav()
  const { skuInfo } = useProductSkuResolver()

  const form = reactive({ Name: '', Description: '', Currency: '', IsDefault: 'FALSE', Status: 'Active' })
  const saving = ref(false)
  const copyFromCode = ref('')
  const prices = reactive({})

  const priceListLookupMode = computed(() => {
    const val = authStore.appConfigMap?.PriceListLookup
    return val === 'ITEMS' ? 'ITEMS' : 'INLINE'
  })

  const productRows = computed(() => dataStore.getRecords('Products'))
  const skuRows = computed(() => dataStore.getRecords('SKUs'))
  const priceListRows = computed(() => dataStore.getRecords('PriceList'))
  const priceListItemsRows = computed(() => dataStore.getRecords('PriceListItems'))

  const copyFromOptions = computed(() => {
    return priceListRows.value
      .filter((row) => (row.Status || 'Active') !== 'Inactive')
      .map((row) => ({
        label: `${row.Code} - ${row.Name || '(Unnamed)'}`,
        value: row.Code
      }))
  })

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

  const groupedSkus = computed(() => {
    const groups = []
    const products = Object.values(productByCode.value)
    products.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))

    for (const product of products) {
      const skus = skusByProductCode.value[product.Code] || []
      if (!skus.length) continue
      const skuEntries = skus.map((sku) => {
        const info = skuInfo(sku.Code) || {}
        const variantLabel = info.variantValues?.filter(Boolean).join(', ') || sku.Code
        return { skuCode: sku.Code, variantLabel, price: prices[sku.Code] ?? '' }
      })
      groups.push({ productCode: product.Code, productName: product.Name || '(Unnamed)', skus: skuEntries })
    }
    return groups
  })

  function updatePrice(skuCode, value) {
    if (value !== '' && value !== null && value !== undefined) {
      const num = parseFloat(value)
      if (isNaN(num)) return
      prices[skuCode] = num
    } else {
      prices[skuCode] = ''
    }
  }

  function resetPrices(nextPrices = {}) {
    Object.keys(prices).forEach((key) => {
      delete prices[key]
    })
    Object.entries(nextPrices).forEach(([skuCode, price]) => {
      const num = parseFloat(price)
      if (!skuCode || isNaN(num)) return
      prices[skuCode] = num
    })
  }

  function parseInlinePrices(value) {
    if (!value) return {}
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  function readSourcePriceMap(priceListCode) {
    if (!priceListCode) return {}

    if (priceListLookupMode.value === 'ITEMS') {
      const map = {}
      priceListItemsRows.value.forEach((row) => {
        if (row.PriceListCode !== priceListCode) return
        if ((row.Status || 'Active') === 'Inactive') return
        if (!row.SKUCode) return
        map[row.SKUCode] = row.Price
      })
      return map
    }

    const source = priceListRows.value.find((row) => row.Code === priceListCode)
    return parseInlinePrices(source?.SKUPrices)
  }

  function copyPricesFromPriceList(priceListCode) {
    copyFromCode.value = priceListCode || ''
    if (!copyFromCode.value) return
    resetPrices(readSourcePriceMap(copyFromCode.value))
  }

  function navigateBack() {
    nav.goTo('index')
  }

  function getPrice(skuCode) {
    return prices[skuCode] ?? ''
  }

  function validateForm() {
    if (!(form.Name || '').trim()) return 'Name is required'
    if (!(form.Currency || '').trim()) return 'Currency is required'
    return null
  }

  async function _saveAsItems() {
    const childRecords = []
    for (const [skuCode, price] of Object.entries(prices)) {
      const num = parseFloat(price)
      if (isNaN(num)) continue
      childRecords.push({
        _action: 'create',
        data: { SKUCode: skuCode, Price: num, Status: 'Active' }
      })
    }

    const payload = {
      action: 'compositeSave',
      scope: 'master',
      resource: 'PriceList',
      data: {
        Name: (form.Name || '').trim(),
        Description: (form.Description || '').trim(),
        Currency: (form.Currency || '').trim(),
        IsDefault: form.IsDefault || 'FALSE',
        Status: form.Status || 'Active'
      }
    }

    if (childRecords.length) {
      payload.children = [{ resource: 'PriceListItems', records: childRecords }]
    }

    return await resourceIoStore.saveComposite(payload)
  }

  async function _saveAsInline() {
    const priceObj = {}
    for (const [skuCode, price] of Object.entries(prices)) {
      const num = parseFloat(price)
      if (!isNaN(num)) priceObj[skuCode] = num
    }

    const record = {
      Name: (form.Name || '').trim(),
      Description: (form.Description || '').trim(),
      Currency: (form.Currency || '').trim(),
      IsDefault: form.IsDefault || 'FALSE',
      Status: form.Status || 'Active',
      SKUPrices: JSON.stringify(priceObj)
    }

    return await resourceIoStore.createResourceRecord('PriceList', record)
  }

  async function handleSave() {
    const error = validateForm()
    if (error) return { success: false, error }

    saving.value = true
    try {
      if (priceListLookupMode.value === 'ITEMS') {
        return await _saveAsItems()
      }
      return await _saveAsInline()
    } finally {
      saving.value = false
    }
  }

  return {
    form,
    saving,
    copyFromCode,
    prices,
    priceListLookupMode,
    copyFromOptions,
    groupedSkus,
    updatePrice,
    copyPricesFromPriceList,
    getPrice,
    handleSave,
    navigateBack
  }
}
