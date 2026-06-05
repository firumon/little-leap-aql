<template>
  <q-page padding>
    <!-- Header panel with action status -->
    <OutletHeaderPanel :subtitle="formatDisplayDate(invoice?.Date) + ' · ' + (invoice?.Code || 'Consumption Invoice')" :title="invoice ? `${outletName(invoice.OutletCode)}` : ''" class="q-mb-md">
      <template #side>
        <div class="row items-center q-gutter-xs">
          <OutletProgressChip :progress="invoice?.Progress" />
        </div>
      </template>
    </OutletHeaderPanel>

    <!-- Interactive toggle for View / Edit mode -->
    <div v-if="canEdit" class="row items-center justify-end q-gutter-sm q-mb-md">
      <span class="text-caption" :class="!editing ? 'text-primary text-weight-bold' : 'text-grey-6'">View</span>
      <q-toggle :model-value="editing" @update:model-value="onEditToggle" color="primary" dense size="sm" />
      <span class="text-caption" :class="editing ? 'text-primary text-weight-bold' : 'text-grey-6'">Edit</span>
    </div>

    <div v-if="loading && !invoice" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>
    <q-banner v-else-if="!invoice" rounded class="bg-grey-2 text-grey-8">
      Invoice not found.
    </q-banner>

    <div v-else class="column q-gutter-y-md">
      <!-- 1. Metadata Details Card -->
      <q-card flat bordered class="rounded-borders shadow-1">
        <q-card-section class="q-pa-md">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-3">
              <div class="row items-center q-gutter-xs text-grey-6">
                <q-icon name="storefront" size="18px" />
                <span class="text-caption">Outlet</span>
              </div>
              <div class="text-subtitle2 text-weight-bold q-mt-xs">{{ outletName(invoice.OutletCode) }}</div>
            </div>
            <div class="col-12 col-sm-3">
              <div class="row items-center q-gutter-xs text-grey-6">
                <q-icon name="event" size="18px" />
                <span class="text-caption">Date</span>
              </div>
              <div class="text-subtitle2 text-weight-bold q-mt-xs">{{ formatDisplayDate(invoice.Date) }}</div>
            </div>
            <div class="col-12 col-sm-3">
              <div class="row items-center q-gutter-xs text-grey-6">
                <q-icon name="person" size="18px" />
                <span class="text-caption">Logged By</span>
              </div>
              <div class="text-subtitle2 text-weight-bold q-mt-xs">{{ invoice.Username }}</div>
            </div>
            <div class="col-12 col-sm-3">
              <div class="row items-center q-gutter-xs text-grey-6">
                <q-icon name="description" size="18px" />
                <span class="text-caption">Consumption Link</span>
              </div>
              <div class="q-mt-xs">
                <q-btn flat dense color="primary" class="text-weight-bold" :label="invoice.OutletConsumptionCode" icon="launch" size="sm" @click="navigateToConsumption(invoice.OutletConsumptionCode)" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 2. Price List Mapping Selector -->
      <div>
        <div class="text-subtitle2 text-weight-bold text-grey-8 q-px-xs q-mb-sm row items-center">
          <q-icon name="sell" class="q-mr-xs" size="18px" />
          Price List Rules
        </div>
        <q-card flat bordered class="rounded-borders shadow-1">
          <q-card-section class="q-pa-md">
            <div v-if="!editing" class="text-subtitle2 text-weight-bold text-primary">{{ plName }}</div>
            <q-select v-else v-model="editForm.priceListCode" :options="priceListOptions" dense outlined emit-value map-options label="Price List Selector" />
          </q-card-section>
        </q-card>
      </div>

      <!-- 3. Line Items Table -->
      <div>
        <div class="text-subtitle2 text-weight-bold text-grey-8 q-px-xs q-mb-sm row items-center">
          <q-icon name="receipt_long" class="q-mr-xs" size="18px" />
          Billed Items
        </div>
        <q-card flat bordered class="rounded-borders shadow-1">
          <q-card-section v-if="!editing" class="q-pa-md">
            <!-- Headers -->
            <div class="row text-caption text-grey-6 text-weight-bold q-mb-sm q-col-gutter-md">
              <div class="col">Product SKU</div>
              <div class="col-2 text-right">Qty</div>
              <div class="col-3 text-right">Unit Price</div>
              <div class="col-3 text-right">Line Total</div>
            </div>
            
            <!-- Rows -->
            <div v-for="(item, i) in editLineItems" :key="item.SKU">
              <q-separator v-if="i > 0" class="q-my-xs" />
              <div class="row q-py-sm q-col-gutter-md items-center" :class="{ 'bg-grey-1': i % 2 }">
                <div class="col">
                  <div class="text-body2 text-weight-medium">{{ item.displayLabel }}</div>
                  <div class="text-caption text-grey-6">{{ item.SKU }}</div>
                </div>
                <div class="col-2 text-right text-body2 text-weight-bold">{{ item.Qty }}</div>
                <div class="col-3 text-right text-body2">{{ _C(item.Price, true) }}</div>
                <div class="col-3 text-right text-body2 text-weight-bold text-primary">{{ _C(item.Qty * item.Price, true) }}</div>
              </div>
            </div>
          </q-card-section>
          
          <q-list separator v-else class="q-pa-sm">
            <q-item v-for="item in editLineItems" :key="item.SKU" class="q-py-md">
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ item.displayLabel }}</q-item-label>
                <q-item-label caption>SKU: {{ item.SKU }} · Counted: {{ item.Qty }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-input v-model.number="item.Price" dense outlined type="number" :prefix="defaultCurrency.Symbol" label="Adjusted Price" style="width: 140px" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- 4. Adjusted Return Items Section (If any exist) -->
      <div v-if="invoiceReturns.length" class="column">
        <div class="text-subtitle2 text-weight-bold text-negative q-px-xs q-mb-sm row items-center">
          <q-icon name="assignment_return" class="q-mr-xs" size="18px" />
          Adjusted Returns
        </div>
        <q-card flat bordered class="rounded-borders shadow-1">
          <q-card-section v-if="!editing" class="q-pa-md">
            <!-- Headers -->
            <div class="row text-caption text-grey-6 text-weight-bold q-mb-sm q-col-gutter-md">
              <div class="col">Product SKU</div>
              <div class="col-2 text-center">Reason</div>
              <div class="col-2 text-right">Qty</div>
              <div class="col-3 text-right">Destination</div>
            </div>
            
            <!-- Rows -->
            <div v-for="(item, i) in invoiceReturns" :key="item.Code">
              <q-separator v-if="i > 0" class="q-my-xs" />
              <div class="row q-py-sm q-col-gutter-md items-center" :class="{ 'bg-grey-1': i % 2 }">
                <div class="col">
                  <div class="text-body2 text-weight-medium text-negative">{{ productDisplayName(item.SKU) }}</div>
                  <div class="text-caption text-grey-6">{{ item.SKU }}</div>
                </div>
                <div class="col-2 text-center">
                  <q-chip dense square outline color="negative" class="text-caption text-weight-bold">
                    {{ item.Reason || 'DAMAGE' }}
                  </q-chip>
                </div>
                <div class="col-2 text-right text-body2 text-weight-bold text-negative">
                  {{ item.Qty }}
                </div>
                <div class="col-3 text-right">
                  <q-badge v-if="item.WarehouseActionRequired === 'TRUE'" color="purple" dense class="q-pa-xs text-weight-bold">
                    Warehouse: {{ item.WarehouseCode }}
                  </q-badge>
                  <q-badge v-else color="grey-6" dense class="q-pa-xs">
                    Left at Outlet
                  </q-badge>
                </div>
              </div>
            </div>
          </q-card-section>
          
          <q-list separator v-else class="q-pa-sm">
            <q-item v-for="item in editReturns" :key="item.Code" class="q-py-md">
              <q-item-section>
                <q-item-label class="text-weight-bold text-negative">{{ item.displayLabel }}</q-item-label>
                <q-item-label caption>SKU: {{ item.SKU }} · Returned: {{ item.Qty }} · Reason: {{ item.Reason }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-input v-model.number="item.Price" dense outlined type="number" :prefix="defaultCurrency.Symbol" label="Credit Price" style="width: 140px" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- 5. Financial Ledger / Summary -->
      <div>
        <div class="text-subtitle2 text-weight-bold text-grey-8 q-px-xs q-mb-sm row items-center">
          <q-icon name="account_balance_wallet" class="q-mr-xs" size="18px" />
          Billing Summary
        </div>
        <q-card flat bordered class="rounded-borders shadow-2">
          <q-card-section class="q-pa-md">
            <div class="row q-col-gutter-md items-center">
              <div class="col-6 col-sm-3">
                <div class="text-caption text-grey-6">Subtotal</div>
                <div class="text-subtitle1 text-weight-bold text-grey-9 q-mt-xs">{{ _C(realtimeSubtotal || 0, true) }}</div>
              </div>
              <div class="col-6 col-sm-3">
                <div class="text-caption text-grey-6">Discount</div>
                <div v-if="!editing" class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">-{{ _C(realtimeDiscount || 0, true) }}</div>
                <q-input v-else v-model.number="editForm.discount" dense outlined type="number" :prefix="defaultCurrency.Symbol" label="Discount" />
              </div>
              <div class="col-6 col-sm-3">
                <div class="text-caption text-grey-6">Tax</div>
                <div v-if="!editing" class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">+{{ _C(realtimeTax || 0, true) }}</div>
                <q-input v-else v-model.number="editForm.tax" dense outlined type="number" :prefix="defaultCurrency.Symbol" label="Tax" />
              </div>
              <div class="col-6 col-sm-3">
                <div class="text-caption text-grey-6 text-negative">Returns Deducted</div>
                <div class="text-subtitle1 text-weight-bold text-negative q-mt-xs">-{{ _C(realtimeReturnDeductionTotal || 0, true) }}</div>
              </div>
            </div>
            
            <q-separator class="q-my-md" />
            
            <div class="row items-center justify-between">
              <span class="text-subtitle1 text-weight-bold text-grey-8">Net Invoice Value</span>
              <span class="text-h5 text-weight-bold text-primary">{{ _C(realtimeTotal, true) }}</span>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Action Navigation Buttons -->
      <div class="row q-gutter-sm justify-end q-mt-md">
        <q-btn v-if="editing" flat label="Cancel" color="grey-8" @click="cancelEdit" />
        <ResourceActionButton
          v-if="editing"
          unelevated
          color="primary"
          icon="save"
          label="Save Changes"
          :loading="saving"
          action="update"
          @click="saveEdit"
        />
        <ResourceActionButton
          v-if="!editing && showPaymentButton"
          unelevated
          color="positive"
          icon="payments"
          label="Make Payment"
          :action="{ outletPayment: 'create', outletConsumptionInvoice: 'update' }"
          :hide-if-unauthorized="false"
          @click="handlePayment"
        />
        <q-btn flat color="primary" icon="arrow_back" label="Back to List" @click="cancel" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import { useResourceNav } from '../../../composables/resources/useResourceNav.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import ResourceActionButton from '../../../components/shared/ResourceActionButton.vue'

defineOptions({ name: 'OutletConsumptionInvoicesViewPage' })

const $q = useQuasar()
const route = useRoute()
const nav = useResourceNav()
const flow = useOutletConsumption()
const { _C, defaultCurrency } = useCurrency()

const {
  loading,
  saving,
  reload,
  getInvoice,
  childInvoiceItems,
  outletName,
  formatDisplayDate,
  navigateToConsumption,
  updateInvoice,
  productDisplayName,
  cancel,
  text,
  priceLists,
  getInvoiceTotal,
  returns,
  resolvePriceListItems
} = flow

const invoice = computed(() => getInvoice(route.params.code))
const editing = ref(false)
const editForm = ref({ priceListCode: '', discount: 0, tax: 0 })
const editLineItems = ref([])
const editReturns = ref([])

const priceListOptions = computed(() => priceLists.items.value.map(p => ({ label: `${p.Code} - ${p.Name || ''}`, value: p.Code })))

const plName = computed(() => {
  if (!invoice.value?.PriceListCode) return 'Not priced'
  const pl = priceLists.items.value.find(p => p.Code === invoice.value.PriceListCode)
  return pl ? `${pl.Code} - ${pl.Name}` : invoice.value.PriceListCode
})

// Real-time calculations adhering to single source of truth reactivity
const realtimeSubtotal = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Subtotal) || 0
  }
  return editLineItems.value.reduce((sum, item) => sum + (parseFloat(item.Qty || 0) * (parseFloat(item.Price) || 0)), 0)
})

const realtimeDiscount = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Discount) || 0
  }
  return parseFloat(editForm.value.discount) || 0
})

const realtimeTax = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Tax) || 0
  }
  return parseFloat(editForm.value.tax) || 0
})

const realtimeReturnDeductionTotal = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.ReturnDeductionTotal) || 0
  }
  return editReturns.value.reduce((sum, item) => sum + (parseFloat(item.Qty || 0) * (parseFloat(item.Price) || 0)), 0)
})

const realtimeTotal = computed(() => {
  return realtimeSubtotal.value - realtimeDiscount.value + realtimeTax.value - realtimeReturnDeductionTotal.value
})

const canEdit = computed(() => {
  const p = text(invoice.value?.Progress)
  return p === 'PENDING_PAYMENT'
})

const showPaymentButton = computed(() => {
  const p = text(invoice.value?.Progress)
  return p !== 'PAID' && p !== 'CANCELLED'
})

const invoiceReturns = computed(() => {
  if (!invoice.value?.OutletReturnCodes) return []
  const codes = invoice.value.OutletReturnCodes.split(',').map(c => c.trim()).filter(Boolean)
  return returns.items.value.filter(r => text(r.OutletCode) === text(invoice.value.OutletCode) && codes.includes(r.Code))
})

function loadLineItems() {
  if (!invoice.value) return
  editForm.value = {
    priceListCode: invoice.value.PriceListCode || '',
    discount: invoice.value.Discount || 0,
    tax: invoice.value.Tax || 0
  }
  editLineItems.value = childInvoiceItems(invoice.value.Code).map(row => ({
    Code: row.Code,
    SKU: row.SKU,
    Qty: row.Qty,
    Price: row.Price || 0,
    displayLabel: productDisplayName(row.SKU)
  }))

  const retList = invoiceReturns.value.map(r => ({ SKU: r.SKU, Qty: r.Qty }))
  const resolved = resolvePriceListItems(editForm.value.priceListCode, retList)
  editReturns.value = invoiceReturns.value.map(r => {
    const resolvedItem = resolved?.items?.find(item => item.SKU === r.SKU)
    const price = resolvedItem ? resolvedItem.Price : 0
    return {
      Code: r.Code,
      SKU: r.SKU,
      Qty: r.Qty,
      Reason: r.Reason || 'DAMAGE',
      Price: price,
      displayLabel: productDisplayName(r.SKU)
    }
  })
}

// Watch for price list selector changes in Edit Mode to automatically re-price all lines
watch(() => editForm.value.priceListCode, (newPriceListCode) => {
  if (!editing.value) return
  
  const billedRows = editLineItems.value.map(item => ({ SKU: item.SKU, Qty: item.Qty }))
  const resolvedBilled = resolvePriceListItems(newPriceListCode, billedRows)
  editLineItems.value.forEach(item => {
    const resolvedItem = resolvedBilled?.items?.find(r => r.SKU === item.SKU)
    item.Price = resolvedItem ? resolvedItem.Price : 0
  })
  
  const returnRows = editReturns.value.map(item => ({ SKU: item.SKU, Qty: item.Qty }))
  const resolvedReturns = resolvePriceListItems(newPriceListCode, returnRows)
  editReturns.value.forEach(item => {
    const resolvedItem = resolvedReturns?.items?.find(r => r.SKU === item.SKU)
    item.Price = resolvedItem ? resolvedItem.Price : 0
  })
})

function onEditToggle(val) {
  if (val) {
    editing.value = true
    loadLineItems()
  } else {
    cancelEdit()
  }
}

function cancelEdit() {
  editing.value = false
  loadLineItems()
}

async function saveEdit() {
  const result = await updateInvoice(invoice.value.Code, {
    PriceListCode: editForm.value.priceListCode,
    Discount: editForm.value.discount,
    Tax: editForm.value.tax,
    ReturnDeductionTotal: realtimeReturnDeductionTotal.value,
    items: editLineItems.value
  })
  if (result.error) {
    $q.notify({ type: 'negative', message: result.error, position: 'top' })
    return
  }
  $q.notify({ type: 'positive', message: 'Invoice updated.', position: 'top' })
  editing.value = false
}

function handlePayment() {
  if (!invoice.value) return
  nav.goTo('add', {
    scope: 'operations',
    resourceSlug: 'outlet-payments',
    query: {
      outletCode: invoice.value.OutletCode,
      invoiceCode: invoice.value.Code
    }
  })
}

onMounted(async () => {
  await reload()
  loadLineItems()
})
</script>
