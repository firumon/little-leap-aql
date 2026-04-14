<template>
  <q-page padding>
    <div class="q-mb-md">
      <h1 class="text-h5 q-mt-none q-mb-sm">Initiate Purchase Requisition</h1>
      <div class="text-caption text-grey-8">
        Step {{ currentStep }} of 3
      </div>
    </div>

    <!-- Compact Stepper -->
    <div class="stepper-compact q-mb-md">
      <div class="step-item" :class="currentStep === 1 ? 'active' : ''">
        <div class="step-circle">1</div>
        <div class="step-label">Setup</div>
      </div>
      <div class="step-connector" :class="currentStep > 1 ? 'done' : ''"></div>
      <div class="step-item" :class="currentStep === 2 ? 'active' : ''">
        <div class="step-circle">2</div>
        <div class="step-label">Items</div>
      </div>
      <div class="step-connector" :class="currentStep > 2 ? 'done' : ''"></div>
      <div class="step-item" :class="currentStep === 3 ? 'active' : ''">
        <div class="step-circle">3</div>
        <div class="step-label">Done</div>
      </div>
    </div>

    <!-- Step 1: PR Setup -->
    <div v-if="currentStep === 1">
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">Purchase Requisition Details</div>

          <!-- Type -->
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 text-subtitle2 text-weight-bold">Type <span class="text-negative">*</span></div>
            <div v-for="type in types" :key="type.value" class="col-3">
              <q-card
                class="cursor-pointer"
                :class="form.Type === type.value ? 'bg-primary text-white' : ''"
                v-ripple
                @click="form.Type = type.value"
              >
                <q-card-section class="text-center q-pa-sm">
                  <q-icon :name="type.icon" size="1.5em" class="q-mb-xs" />
                  <div class="text-caption">{{ type.label }}</div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <!-- Priority -->
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 text-subtitle2 text-weight-bold">Priority <span class="text-negative">*</span></div>
            <div v-for="priority in priorities" :key="priority.value" class="col-3">
              <q-card
                class="cursor-pointer"
                :class="form.Priority === priority.value ? `bg-${priority.color} text-white` : ''"
                v-ripple
                @click="form.Priority = priority.value"
              >
                <q-card-section class="text-center q-pa-sm">
                  <div class="text-caption">{{ priority.label }}</div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <!-- Warehouse (Optional) -->
          <div class="q-mb-md">
            <div class="text-subtitle2 text-weight-bold q-mb-sm">Warehouse (Optional)</div>
            <div v-if="loadingWarehouses" class="flex flex-center q-pa-md">
              <q-spinner color="primary" size="2em" />
            </div>
            <div v-else class="row q-col-gutter-sm">
              <div v-for="wh in warehouses" :key="wh.Code" class="col-4">
                <q-card
                  class="cursor-pointer"
                  :class="form.WarehouseCode === wh.Code ? 'bg-primary text-white' : ''"
                  v-ripple
                  @click="form.WarehouseCode = form.WarehouseCode === wh.Code ? '' : wh.Code"
                >
                  <q-card-section class="q-pa-sm text-center relative-position">
                    <div class="text-subtitle2 text-weight-bold">{{ wh.Name }}</div>
                    <div class="text-caption" :class="form.WarehouseCode === wh.Code ? 'text-white' : 'text-grey-8'">{{ wh.Code }}</div>
                    <q-icon
                      v-if="form.WarehouseCode === wh.Code"
                      name="check_circle"
                      color="white"
                      size="sm"
                      class="absolute-top-right q-pa-xs"
                    />
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-md-6">
              <q-input
                v-model="form.RequiredDate"
                label="Required Date (Optional)"
                outlined
                type="date"
                dense
              />
            </div>
            <div class="col-12 col-md-6" v-if="['PROJECT', 'SALES'].includes(form.Type)">
              <q-input
                v-model="form.TypeReferenceCode"
                label="Reference Code"
                outlined
                dense
                :rules="[val => !!val || 'Reference Code is required for Project/Sales']"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="row justify-end q-mt-md">
        <q-btn
          @click="goToStep2"
          color="primary"
          label="Proceed to Items"
          :disable="!isStep1Valid"
          unelevated
        />
      </div>
    </div>

    <!-- Step 2: Item Selection -->
    <div v-if="currentStep === 2">
      <!-- Filter / Search Row (Page level) -->

      <div class="row q-col-gutter-md items-center q-mb-md">
        <div class="col-12 row items-center justify-between no-wrap q-gutter-x-md">
          <q-btn-toggle
            v-model="sortBy"
            unelevated
            toggle-color="primary"
            color="white"
            text-color="primary"
            :options="[
              {label: 'Sort by Product Stock', value: 'product'},
              {label: 'Sort by SKU Stock', value: 'sku'}
            ]"
            class="border-primary"
          />
          <q-toggle
            v-model="allWarehouses"
            label="All Warehouses"
            left-label
            color="primary"
          />
        </div>
        <div class="col-12">
          <q-input v-model="searchQuery" outlined dense placeholder="Search Products/SKUs..." clearable bg-color="white">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </div>

      <!-- Items Card -->
      <q-card class="q-mb-md">
        <q-card-section class="q-pa-none">
          <div v-if="loadingItems" class="flex flex-center q-pa-xl">
            <q-spinner color="primary" size="3em" />
            <div class="q-ml-sm text-grey-8">Syncing catalog data...</div>
          </div>
          <div v-else-if="filteredAndSortedProducts.length === 0" class="text-center q-pa-lg text-grey-8">
            No items found matching your criteria.
          </div>
          <div v-else>
            <q-list bordered class="rounded-borders" separator>
              <template v-for="productGroup in filteredAndSortedProducts" :key="productGroup.ProductCode">

                <q-item-label header class="bg-grey-2 text-weight-bold text-black text-subtitle2 q-py-md q-px-sm flex justify-between items-center no-wrap">
                  <div class="wrap">{{ productGroup.ProductName }} ({{ productGroup.ProductCode }})</div>
                  <div class="text-bold text-grey-8 q-mr-sm float-right">{{ productGroup.totalStock }}</div>
                </q-item-label>

                <q-item
                  v-for="sku in productGroup.skus"
                  :key="sku.Code"
                  :class="sku.requiredQuantity > 0 ? 'bg-green-1' : ''"
                  class="q-pa-sm"
                >
                  <q-item-section>
                    <q-item-label class="text-subtitle2">{{ sku.Code }}</q-item-label>
                    <q-item-label caption>{{ formatVariants(sku) }}</q-item-label>
                    <q-item-label caption>Stock: {{ getSkuStock(sku.Code) }} {{ sku.UOM || 'units' }}</q-item-label>
                  </q-item-section>
                  <q-item-section side style="width: 120px">
                    <q-input
                      v-model.number="sku.requiredQuantity"
                      type="number"
                      dense
                      outlined
                      min="0"
                      bg-color="white"
                      label="Qty"
                      @update:model-value="val => { if (val < 0) sku.requiredQuantity = 0 }"
                    />
                  </q-item-section>
                </q-item>
                <q-separator />
              </template>
            </q-list>
          </div>
        </q-card-section>
      </q-card>

      <!-- Action Row (Page level) -->
      <div class="row items-center justify-between q-mt-lg">
        <q-btn outline @click="currentStep = 1" color="primary" icon="arrow_back" label="Back" />
        <div class="row items-center gap">
          <div class="text-subtitle1 text-weight-bold text-primary q-mr-md">
            {{ selectedSkusCount }} SKUs Selected
          </div>
          <q-btn
            @click="savePR"
            color="primary"
            label="Create PR"
            unelevated
            size="lg"
            :disable="selectedSkusCount === 0 || saving"
            :loading="saving"
          />
        </div>
      </div>
    </div>

    <!-- Step 3: Success -->
    <div v-if="currentStep === 3" class="text-center q-pa-lg">
      <q-icon name="check_circle" size="4em" color="positive" class="q-mb-md" />
      <h2 class="text-h5 q-mt-none">Purchase Requisition Created!</h2>
      <p class="text-body1 text-grey-8">Your purchase requisition has been successfully created.</p>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useStockMovements } from 'src/composables/useStockMovements'
import { fetchResourceRecords } from 'src/services/resourceRecords'
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
  if (!form.value.Type || !form.value.Priority) return false
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
    // Use fetchResourceRecords which interacts with the local store and syncs in background if configured
    const [prodRes, skuRes, stockRes] = await Promise.all([
      fetchResourceRecords('Products', { includeInactive: false }),
      fetchResourceRecords('SKUs', { includeInactive: false }),
      fetchResourceRecords('WarehouseStorages', { includeInactive: false })
    ])

    // Handle Products
    if (prodRes?.records) {
      products.value = prodRes.records.filter(p => p.Status === 'Active' || !p.Status)
    }

    // Handle SKUs
    if (skuRes?.records) {
      skus.value = skuRes.records.filter(s => s.Status === 'Active' || !s.Status).map(s => ({...s, requiredQuantity: 0}))
    }

    // Handle Stock Data
    if (stockRes?.records) {
      stockData.value = stockRes.records
    }

    if (products.value.length === 0 || skus.value.length === 0) {
      $q.notify({ type: 'warning', message: 'Some catalog data is empty. Products: ' + products.value.length + ', SKUs: ' + skus.value.length })
    }
  } catch (error) {
    console.error('Error loading catalog:', error)
    $q.notify({ type: 'negative', message: 'Failed to load catalog data: ' + error.message })
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
      resource: 'PurchaseRequisitions',
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
          parentCodeField: 'PurchaseRequisitionCode',
          records: itemsToSave.map(item => ({
            _action: 'create',
            data: {
              SKU: item.Code,
              UOM: item.UOM || '',
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

    if (response.success && response.data?.parentCode) {
      router.push(`/operations/purchase-requisitions/${response.data.parentCode}/draft`)
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

<style scoped>
/* Compact Stepper */
.stepper-compact {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  padding: 12px 20px;
  background: transparent;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0e0e0;
  color: #666;
  font-weight: bold;
  font-size: 14px;
  transition: all 0.3s ease;
}

.step-item.active .step-circle {
  background: var(--q-primary);
  color: white;
}

.step-label {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  color: #666;
  white-space: nowrap;
}

.step-item.active .step-label {
  color: var(--q-primary);
  font-weight: 600;
}

.step-connector {
  width: 40px;
  height: 2px;
  background: #e0e0e0;
  margin: 0 4px;
  transition: background 0.3s ease;
}

.step-connector.done {
  background: var(--q-primary);
}

/* Compact padding for cards */
:deep(.q-card__section) {
  padding: 16px;
}

/* Gap utility */
.gap {
  gap: 12px;
}

.border-primary {
  border: 1px solid var(--q-primary);
}
</style>
