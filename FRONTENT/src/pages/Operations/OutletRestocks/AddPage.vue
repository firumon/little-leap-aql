<template>
  <q-page padding>
    <OutletHeaderPanel title="New Restock Request" subtitle="Request outlet consignment stock" class="q-mb-md" />

    <q-stepper v-model="step" flat bordered header-nav ref="stepperRef" color="primary" class="q-mb-md">
      <!-- Step 1: Outlet -->
      <q-step :name="1" title="Outlet" icon="store" :done="step > 1">
        <div class="text-caption text-grey-7 q-mb-md">Select the outlet to restock</div>
        <div class="row q-col-gutter-sm">
          <div v-for="outlet in outletOptions" :key="outlet.value" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card
              flat bordered
              class="outlet-select-card cursor-pointer clickable-scale"
              :class="{ 'outlet-select-card--active': form.OutletCode === outlet.value }"
              @click="selectOutlet(outlet)"
            >
              <q-card-section class="q-pa-sm">
                <div class="row items-center no-wrap">
                  <q-icon name="store" :color="form.OutletCode === outlet.value ? 'primary' : 'grey-6'" size="xs" class="q-mr-xs" />
                  <div class="text-caption text-weight-medium ellipsis">{{ outletLabel(outlet) }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn flat label="Cancel" @click="cancel" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 2: Products -->
      <q-step :name="2" title="Products" icon="inventory_2" :done="step > 2">
        <div class="text-caption text-grey-7 q-mb-md">Select products and set quantities</div>

        <!-- Product Chips -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Products</div>
          <div class="row q-gutter-xs">
            <q-chip
              v-for="product in productList"
              :key="product.code"
              clickable
              :outline="!selectedProducts.has(product.code)"
              :color="selectedProducts.has(product.code) ? 'primary' : 'grey-8'"
              :text-color="selectedProducts.has(product.code) ? 'white' : 'grey-8'"
              :label="product.label"
              @click="openProductDialog(product)"
            >
              <q-tooltip v-if="addedForProduct(product.code).length">
                {{ addedForProduct(product.code).length }} variant(s) added
              </q-tooltip>
            </q-chip>
          </div>
        </div>

        <!-- Added Items List -->
        <div v-if="addedItems.length" class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Added Items ({{ addedItems.length }})</div>
          <AqlList :items="addedItems"
            :layout="['label', 'caption']"
            :content="[
              item => item.productLabel,
              item => item.variantLabel
            ]"
            :meta="['Quantity']"
            :meta-layout="['chip']"
            item-key="SKU" bordered chip-color="primary" btn="delete" btn-color="negative"
            @click="item => removeAddedItem(item.SKU)"
          />
        </div>

        <q-stepper-navigation class="row">
          <q-btn flat label="Cancel" @click="cancel" size="sm" />
          <q-space />
          <q-btn color="primary" label="Review" @click="step = 3" :disable="!addedItems.length" size="sm" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 3: Review -->
      <q-step :name="3" title="Review" icon="checklist">
        <!-- Products title section -->
        <div class="row items-center q-mb-md">
          <q-icon name="shopping_cart_checkout" color="primary" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1 text-weight-bold text-grey-9">Products</div>
        </div>

        <!-- Product Cards Stack with Gaps between Products -->
        <div class="column q-gutter-y-sm q-mb-md">
          <q-card v-for="(group, gIdx) in groupedByProduct" :key="gIdx" flat bordered class="product-review-card">
            <q-item class="bg-grey-2 q-py-xs q-px-sm">
              <q-item-section avatar style="min-width: auto;" class="q-pr-xs">
                <q-icon name="inventory_2" color="primary" size="xs" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-caption text-weight-bold text-grey-9">{{ group.productLabel }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge color="primary" outline :label="`${group.items.length} variant(s)`" />
              </q-item-section>
            </q-item>
            <q-separator />
            <q-card-section class="q-pa-none">
              <q-list class="q-py-none">
                <q-item v-for="(item, iIdx) in group.items" :key="iIdx" class="q-px-md q-py-sm">
                  <q-item-section>
                    <q-item-label class="text-caption text-weight-medium text-grey-9">{{ item.variantLabel }}</q-item-label>
                    <q-item-label caption class="text-grey-6">SKU: {{ item.SKU }}</q-item-label>
                  </q-item-section>
                  <q-item-section side class="self-center text-center" style="min-width: 60px;">
                    <q-badge color="primary" class="text-bold q-py-xs q-px-sm text-center" style="font-size: 0.85rem;" :label="item.Quantity" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <q-input v-model="submitComment" type="textarea" label="Comment (optional)" outlined class="q-mb-md" />

        <q-stepper-navigation class="flex">
          <q-btn flat label="Cancel" @click="cancel" size="sm" />
          <q-space />
          <q-btn outline color="primary" label="Save Draft" :loading="saving" @click="handleSaveDraft" size="sm" />
          <q-btn color="primary" label="Send For Approval" :loading="saving" class="q-ml-sm" @click="handleSubmit" size="sm" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>

    <!-- Product SKU Dialog -->
    <q-dialog v-model="productDialog" persistent>
      <q-card style="min-width: 380px; max-width: 95vw;">
        <q-card-section class="text-h6">{{ currentProduct?.label || 'Select Variants' }}</q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <div v-for="sku in currentProductSkus" :key="sku.value" class="row items-center q-pa-xs q-mb-xs" style="border-radius: 6px;">
            <div class="col text-caption">{{ sku.variantLabel || sku.label }}</div>
            <q-btn round icon="remove" size="sm" color="primary" push glossy @click="adjustSkuQty(sku.value, -1)" @dblclick="adjustSkuQty(sku.value, -5)" />
            <q-input
              :model-value="skuQuantities[sku.value]"
              type="number"
              dense
              outlined
              min="0"
              style="max-width: 64px"
              class="q-mx-sm"
              input-class="text-center text-bold"
              @update:model-value="val => handleSkuQtyInput(sku.value, val)"
            />
            <q-btn round icon="add" size="sm" color="primary" push glossy @click="adjustSkuQty(sku.value, 1)" @dblclick="adjustSkuQty(sku.value, 5)" />
          </div>
        </q-card-section>
        <q-card-actions align="between">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Done" @click="confirmProductAdd" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOutletRestocks } from '../../../composables/operations/outlets/useOutletRestocks.js'
import AqlList from '../../../components/shared/AqlList.vue'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'OutletRestocksAddPage' })

const $q = useQuasar()
const route = useRoute()
const flow = useOutletRestocks()

const {
  form, rows, outletOptions, skuOptions, saving,
  reloadAdd, saveRestockDraft, addRow, updateRow, removeRow, cancel
} = flow

const step = ref(1)
const submitComment = ref('')

// --- Outlet selection ---
function selectOutlet(outlet) {
  form.value.OutletCode = outlet.value
  step.value = 2
}
function outletLabel(outlet) {
  const parts = (outlet.label || outlet.value).split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : outlet.value
}

// --- Product grouping ---
const productList = computed(() => {
  const seen = new Map()
  skuOptions.value.forEach(sku => {
    const parts = sku.label.split(' · ')
    // sku.label = "SKU_CODE · ProductName · Variant1 / Variant2"
    const productName = parts.length > 1 ? (parts[1] || parts[0]) : parts[0]
    const skuCode = parts[0]
    const variantLabel = parts.length > 2 ? parts.slice(2).join(' · ') : ''
    if (!seen.has(productName)) {
      seen.set(productName, { code: productName, label: productName, skus: [] })
    }
    seen.get(productName).skus.push({
      ...sku,
      productName,
      variantLabel: variantLabel || skuCode,
      skuCode
    })
  })
  return Array.from(seen.values())
})

const selectedProducts = computed(() => {
  const set = new Set()
  rows.value.filter(r => text(r.SKU) && r.Quantity > 0).forEach(row => {
    const sku = skuOptions.value.find(s => s.value === row.SKU)
    if (sku) {
      const parts = sku.label.split(' · ')
      const productName = parts.length > 1 ? (parts[1] || parts[0]) : parts[0]
      set.add(productName)
    }
  })
  return set
})

function addedForProduct(productCode) {
  const product = productList.value.find(p => p.code === productCode)
  if (!product) return []
  return rows.value.filter(r => text(r.SKU) && r.Quantity > 0 && product.skus.some(s => s.value === r.SKU))
}

const addedItems = computed(() => {
  return rows.value
    .filter(r => text(r.SKU) && r.Quantity > 0)
    .map(r => {
      const sku = skuOptions.value.find(s => s.value === r.SKU)
      const parts = (sku?.label || r.SKU).split(' · ')
      const productLabel = parts.length > 1 ? (parts[1] || '') : ''
      const variantLabel = parts.length > 2 ? parts.slice(2).join(' · ') : (parts[0] || r.SKU)
      return { ...r, productLabel, variantLabel }
    })
})

const groupedByProduct = computed(() => {
  const groups = new Map()
  addedItems.value.forEach(item => {
    const key = item.productLabel
    if (!groups.has(key)) groups.set(key, { productLabel: key, items: [] })
    groups.get(key).items.push(item)
  })
  return Array.from(groups.values())
})

function removeAddedItem(sku) {
  const actualIdx = rows.value.findIndex(r => text(r.SKU) === text(sku))
  if (actualIdx >= 0) removeRow(actualIdx)
}

function adjustSkuQty(skuValue, delta) {
  const current = Number(skuQuantities[skuValue]) || 0
  const next = Math.max(0, current + delta)
  skuQuantities[skuValue] = next
}

function handleSkuQtyInput(skuValue, val) {
  const num = Number(val)
  skuQuantities[skuValue] = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0
}

// --- Product Dialog ---
const productDialog = ref(false)
const currentProduct = ref(null)
const skuQuantities = reactive({})

const currentProductSkus = computed(() => currentProduct.value?.skus || [])

function openProductDialog(product) {
  currentProduct.value = product
  // Pre-fill quantities from existing rows
  const qtyMap = {}
  product.skus.forEach(sku => {
    const existing = rows.value.find(r => text(r.SKU) === text(sku.value))
    qtyMap[sku.value] = existing ? (existing.Quantity || 0) : 0
  })
  Object.keys(skuQuantities).forEach(k => delete skuQuantities[k])
  Object.assign(skuQuantities, qtyMap)
  productDialog.value = true
}

function confirmProductAdd() {
  if (!currentProduct.value) return
  currentProduct.value.skus.forEach(sku => {
    const qty = Number(skuQuantities[sku.value]) || 0
    const existingIdx = rows.value.findIndex(r => text(r.SKU) === text(sku.value))
    if (qty > 0) {
      if (existingIdx >= 0) {
        updateRow(existingIdx, { SKU: sku.value, Quantity: qty })
      } else {
        // Remove empty placeholder rows first
        const emptyIdx = rows.value.findIndex(r => !text(r.SKU))
        if (emptyIdx >= 0) {
          updateRow(emptyIdx, { SKU: sku.value, Quantity: qty })
        } else {
          addRow()
          updateRow(rows.value.length - 1, { SKU: sku.value, Quantity: qty })
        }
      }
    } else if (existingIdx >= 0) {
      removeRow(existingIdx)
    }
  })
  productDialog.value = false
}

// --- Computed ---
const outletName = computed(() => {
  const outlet = outletOptions.value.find(o => o.value === form.value.OutletCode)
  return outlet ? outletLabel(outlet) : (form.value.OutletCode || '—')
})

// --- Actions ---
function cleanRows() {
  // Remove empty rows (no SKU or qty <= 0)
  const toRemove = []
  rows.value.forEach((r, i) => {
    if (!text(r.SKU) || (r.Quantity || 0) <= 0) toRemove.push(i)
  })
  // Remove from highest index to lowest
  toRemove.reverse().forEach(i => removeRow(i))
}

async function handleSaveDraft() {
  cleanRows()
  if (!rows.value.filter(r => text(r.SKU)).length) {
    $q.notify({ type: 'warning', message: 'Add at least one product.', position: 'top' })
    return
  }
  const result = await saveRestockDraft(false)
  if (result) $q.notify({ type: 'positive', message: 'Draft saved.', position: 'top' })
}

async function handleSubmit() {
  cleanRows()
  if (!rows.value.filter(r => text(r.SKU)).length) {
    $q.notify({ type: 'warning', message: 'Add at least one product.', position: 'top' })
    return
  }
  const result = await saveRestockDraft(true, submitComment.value)
  if (result) submitComment.value = ''
}

onMounted(async () => {
  await reloadAdd()
  if (route.query.outletCode) {
    const match = outletOptions.value.find(o => o.value === route.query.outletCode)
    if (match) {
      selectOutlet(match)
    }
  }
})
</script>

<style scoped>
.outlet-select-card {
  border: 1.5px solid transparent;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.outlet-select-card:hover { background: #f5f5f5; }
.outlet-select-card--active {
  border-color: var(--q-primary);
  background: var(--q-primary-light, #e3f2fd);
}
</style>
