<template>
  <q-page padding>
    <div class="q-mb-md">
      <h1 class="text-h5 q-mt-none q-mb-sm">Initiate Purchase Requisition</h1>
      <div class="text-caption text-grey-8">
        Step {{ currentStep }} of 3
      </div>
    </div>

    <q-stepper v-model="currentStep" color="primary" animated flat bordered>
      <!-- Step 1: PR Setup -->
      <q-step :name="1" title="PR Setup" icon="settings" :done="currentStep > 1">
        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 text-h6">Type</div>
          <div v-for="type in types" :key="type.value" class="col-6 col-md-3">
            <q-card
              class="cursor-pointer"
              :class="form.Type === type.value ? 'bg-primary text-white' : ''"
              v-ripple
              @click="form.Type = type.value"
            >
              <q-card-section class="text-center">
                <q-icon :name="type.icon" size="2em" class="q-mb-sm" />
                <div class="text-subtitle2">{{ type.label }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 text-h6">Priority</div>
          <div v-for="priority in priorities" :key="priority.value" class="col-6 col-md-3">
            <q-card
              class="cursor-pointer"
              :class="form.Priority === priority.value ? `bg-${priority.color} text-white` : ''"
              v-ripple
              @click="form.Priority = priority.value"
            >
              <q-card-section class="text-center">
                <div class="text-subtitle2">{{ priority.label }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 text-h6">Warehouse</div>
          <div v-if="loadingWarehouses" class="col-12 flex flex-center q-pa-md">
            <q-spinner color="primary" size="2em" />
          </div>
          <div v-else v-for="wh in warehouses" :key="wh.Code" class="col-6 col-md-4">
            <q-card
              class="cursor-pointer"
              :class="form.WarehouseCode === wh.Code ? 'bg-primary text-white' : ''"
              v-ripple
              @click="form.WarehouseCode = wh.Code"
            >
              <q-card-section>
                <div class="text-subtitle1">{{ wh.Name }}</div>
                <div class="text-caption" :class="form.WarehouseCode === wh.Code ? 'text-white' : 'text-grey-8'">{{ wh.Code }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 col-md-6">
            <q-input
              v-model="form.RequiredDate"
              label="Required Date"
              outlined
              type="date"
              :rules="[val => !!val || 'Required Date is required']"
            />
          </div>
          <div class="col-12 col-md-6" v-if="['PROJECT', 'SALES'].includes(form.Type)">
            <q-input
              v-model="form.TypeReferenceCode"
              label="Reference Code"
              outlined
              :rules="[val => !!val || 'Reference Code is required for Project/Sales']"
            />
          </div>
        </div>

        <q-stepper-navigation>
          <q-btn @click="goToStep2" color="primary" label="Proceed to Items" :disable="!isStep1Valid" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 2: Item Selection -->
      <q-step :name="2" title="Item Selection" icon="shopping_cart" :done="currentStep > 2">
        <div class="row q-col-gutter-md q-mb-md items-center">
          <div class="col-12 col-md-4">
            <q-input v-model="searchQuery" outlined dense placeholder="Search Products/SKUs..." clearable>
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-4">
            <q-btn-toggle
              v-model="sortBy"
              toggle-color="primary"
              :options="[
                {label: 'Sort by Product Stock', value: 'product'},
                {label: 'Sort by SKU Stock', value: 'sku'}
              ]"
            />
          </div>
          <div class="col-12 col-md-4 text-right">
            <q-toggle v-model="allWarehouses" label="Show All Warehouses Stock" left-label />
          </div>
        </div>

        <div v-if="loadingItems" class="flex flex-center q-pa-xl">
          <q-spinner color="primary" size="3em" />
        </div>
        <div v-else>
          <q-list bordered class="rounded-borders">
            <template v-for="productGroup in filteredAndSortedProducts" :key="productGroup.ProductCode">
              <q-item-label header class="bg-grey-2 text-weight-bold text-black text-subtitle1">
                {{ productGroup.ProductName }} ({{ productGroup.ProductCode }})
                <span class="text-caption text-grey-8 q-ml-sm">Total Stock: {{ productGroup.totalStock }}</span>
              </q-item-label>

              <q-item
                v-for="sku in productGroup.skus"
                :key="sku.Code"
                :class="sku.requiredQuantity > 0 ? 'bg-green-1' : ''"
              >
                <q-item-section>
                  <q-item-label>{{ sku.Code }}</q-item-label>
                  <q-item-label caption>{{ formatVariants(sku) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="text-caption q-mb-xs">Stock: {{ getSkuStock(sku.Code) }} {{ sku.UOM || 'units' }}</div>
                </q-item-section>
                <q-item-section side style="min-width: 150px">
                  <q-input
                    v-model.number="sku.requiredQuantity"
                    type="number"
                    dense
                    outlined
                    min="0"
                    label="Req Qty"
                    @update:model-value="val => { if (val < 0) sku.requiredQuantity = 0 }"
                  />
                </q-item-section>
              </q-item>
              <q-separator />
            </template>
          </q-list>
          <div v-if="filteredAndSortedProducts.length === 0" class="text-center q-pa-lg text-grey-8">
            No items found matching your criteria.
          </div>
        </div>

        <q-stepper-navigation class="row items-center justify-between">
          <q-btn flat @click="currentStep = 1" color="primary" label="Back" class="q-ml-sm" />
          <div class="row items-center">
            <div class="q-mr-md text-weight-bold text-primary">{{ selectedSkusCount }} SKUs selected</div>
            <q-btn @click="savePR" color="primary" label="Create Purchase Requisition" :disable="selectedSkusCount === 0 || saving" :loading="saving" />
          </div>
        </q-stepper-navigation>
      </q-step>

      <!-- Step 3 (Hidden, just for layout consistency if needed, we auto-navigate on save) -->
      <q-step :name="3" title="Done" icon="check" />
    </q-stepper>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useStockMovements } from 'src/composables/useStockMovements'
import { callGasApi } from 'src/services/gasApi'
import { format } from 'date-fns'

const $q = useQuasar()
const router = useRouter()
const { loadWarehouses } = useStockMovements()

const currentStep = ref(1)
const loadingWarehouses = ref(false)
const warehouses = ref([])

const types = [
  { label: 'Stock', value: 'STOCK', icon: 'inventory' },
  { label: 'Project', value: 'PROJECT', icon: 'engineering' },
  { label: 'Sales', value: 'SALES', icon: 'point_of_sale' },
  { label: 'Asset', value: 'ASSET', icon: 'category' }
]

const priorities = [
  { label: 'Low', value: 'Low', color: 'info' },
  { label: 'Medium', value: 'Medium', color: 'primary' },
  { label: 'High', value: 'High', color: 'orange' },
  { label: 'Urgent', value: 'Urgent', color: 'negative' }
]

const form = ref({
  Type: 'STOCK',
  Priority: 'Medium',
  WarehouseCode: '',
  RequiredDate: '',
  TypeReferenceCode: ''
})

const isStep1Valid = computed(() => {
  if (!form.value.Type || !form.value.Priority || !form.value.WarehouseCode || !form.value.RequiredDate) return false
  if (['PROJECT', 'SALES'].includes(form.value.Type) && !form.value.TypeReferenceCode) return false
  return true
})

const goToStep2 = () => {
  if (isStep1Valid.value) {
    currentStep.value = 2
    if (products.value.length === 0) {
      loadItemsAndStock()
    }
  }
}

// Step 2 logic
const loadingItems = ref(false)
const products = ref([])
const skus = ref([])
const stockData = ref([])
const searchQuery = ref('')
const sortBy = ref('product') // 'product' or 'sku'
const allWarehouses = ref(false)
const saving = ref(false)

const loadItemsAndStock = async () => {
  loadingItems.value = true
  try {
    const [prodRes, skuRes, stockRes] = await Promise.all([
      callGasApi('getRecords', { resourceName: 'Products', limit: 1000 }),
      callGasApi('getRecords', { resourceName: 'SKUs', limit: 3000 }),
      callGasApi('getRecords', { resourceName: 'WarehouseStorages', limit: 5000 })
    ])

    if (prodRes.success) products.value = prodRes.records.filter(p => p.Status === 'Active')
    if (skuRes.success) skus.value = skuRes.records.filter(s => s.Status === 'Active').map(s => ({...s, requiredQuantity: 0}))
    if (stockRes.success) stockData.value = stockRes.records
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to load catalog data' })
  } finally {
    loadingItems.value = false
  }
}

const getSkuStock = (skuCode) => {
  let relevantStock = stockData.value.filter(s => s.SKU === skuCode)
  if (!allWarehouses.value && form.value.WarehouseCode) {
    relevantStock = relevantStock.filter(s => s.WarehouseCode === form.value.WarehouseCode)
  }
  return relevantStock.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0)
}

const formatVariants = (sku) => {
  const vars = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].filter(Boolean)
  return vars.length > 0 ? vars.join(' | ') : 'No variants'
}

const filteredAndSortedProducts = computed(() => {
  let filteredSkus = skus.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    filteredSkus = filteredSkus.filter(sku => {
      const prod = products.value.find(p => p.Code === sku.ProductCode)
      const prodName = prod ? prod.Name.toLowerCase() : ''
      return sku.Code.toLowerCase().includes(q) ||
             prodName.includes(q) ||
             formatVariants(sku).toLowerCase().includes(q)
    })
  }

  // Group SKUs by Product
  const grouped = {}
  filteredSkus.forEach(sku => {
    if (!grouped[sku.ProductCode]) {
      const prod = products.value.find(p => p.Code === sku.ProductCode)
      grouped[sku.ProductCode] = {
        ProductCode: sku.ProductCode,
        ProductName: prod ? prod.Name : 'Unknown Product',
        skus: [],
        totalStock: 0
      }
    }
    grouped[sku.ProductCode].skus.push(sku)
    grouped[sku.ProductCode].totalStock += getSkuStock(sku.Code)
  })

  let result = Object.values(grouped)

  if (sortBy.value === 'product') {
    result.sort((a, b) => a.totalStock - b.totalStock) // Ascending (lowest stock first)
  } else {
    // Sort products by their lowest SKU stock
    result.forEach(group => {
      group.skus.sort((a, b) => getSkuStock(a.Code) - getSkuStock(b.Code))
      group.minSkuStock = group.skus.length > 0 ? getSkuStock(group.skus[0].Code) : 0
    })
    result.sort((a, b) => a.minSkuStock - b.minSkuStock)
  }

  return result
})

const selectedSkusCount = computed(() => {
  return skus.value.filter(s => s.requiredQuantity > 0).length
})

const savePR = async () => {
  const itemsToSave = skus.value.filter(s => s.requiredQuantity > 0)
  if (itemsToSave.length === 0) return

  saving.value = true
  try {
    const prDate = format(new Date(), 'yyyy-MM-dd')
    const payload = {
      action: 'compositeSave',
      resource: 'PurchaseRequisitions',
      scope: 'operation',
      data: {
        PRDate: prDate,
        Type: form.value.Type,
        Priority: form.value.Priority,
        RequiredDate: form.value.RequiredDate,
        WarehouseCode: form.value.WarehouseCode,
        TypeReferenceCode: ['PROJECT', 'SALES'].includes(form.value.Type) ? form.value.TypeReferenceCode : '',
        Progress: 'Draft',
        Status: 'Active'
      },
      children: [
        {
          resource: 'PurchaseRequisitionItems',
          records: itemsToSave.map(item => ({
            _action: 'create',
            data: {
              SKU: item.Code,
              UOM: item.UOM || '', // Assuming UOM might be loaded, else fallback
              Quantity: item.requiredQuantity,
              EstimatedRate: 0
            }
          }))
        }
      ]
    }

    const response = await callGasApi('compositeSave', payload, {
      showLoading: true,
      loadingMessage: 'Creating Purchase Requisition...',
      successMessage: 'Purchase Requisition Created'
    })

    if (response.success && response.record) {
      router.push(`/operations/purchase-requisitions/${response.record.Code}/draft`)
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to create PR: ' + error.message })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loadingWarehouses.value = true
  warehouses.value = await loadWarehouses()
  loadingWarehouses.value = false
})
</script>
