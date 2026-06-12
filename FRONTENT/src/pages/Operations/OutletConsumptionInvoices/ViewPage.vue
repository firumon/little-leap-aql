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
            <div v-for="(item, i) in realtimeLineItems" :key="item.SKU">
              <q-separator v-if="i > 0" class="q-my-xs" />
              <div class="row q-py-sm q-col-gutter-md items-center" :class="{ 'bg-grey-1': i % 2 }">
                <div class="col">
                  <div class="text-body2 text-weight-medium">{{ item.displayLabel }}</div>
                  <div class="text-caption text-grey-6">
                    SKU: {{ item.SKU }}
                    <span v-if="item.TaxCode"> · Tax Code: {{ item.TaxCode }}</span>
                  </div>
                  <div class="text-caption text-grey-7 row items-center q-gutter-x-sm q-mt-xs">
                    <span>Taxable: <span class="text-weight-bold">{{ _C(item.TaxableAmount, true) }}</span></span>
                    <span>·</span>
                    <span>Tax: <span class="text-weight-bold">{{ _C(item.TaxAmount, true) }}</span></span>
                    <span v-if="item.Discount > 0">·</span>
                    <span v-if="item.Discount > 0">Disc: <span class="text-weight-bold text-negative">-{{ _C(item.Discount, true) }}</span></span>
                  </div>
                </div>
                <div class="col-2 text-right text-body2 text-weight-bold">{{ item.Qty }}</div>
                <div class="col-3 text-right text-body2">{{ _C(item.Price, true) }}</div>
                <div class="col-3 text-right text-body2 text-weight-bold text-primary">{{ _C(item.Total, true) }}</div>
              </div>
            </div>
          </q-card-section>
          
          <q-list separator v-else class="q-pa-sm">
            <q-item v-for="item in realtimeLineItems" :key="item.SKU" class="q-py-md">
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ item.displayLabel }}</q-item-label>
                <q-item-label caption>
                  SKU: {{ item.SKU }} · Counted: {{ item.Qty }}
                  <span v-if="item.TaxCode"> · Tax Code: {{ item.TaxCode }}</span>
                </q-item-label>
                <div class="text-caption text-grey-7 row items-center q-gutter-x-sm q-mt-xs">
                  <span>Taxable: <span class="text-weight-bold">{{ _C(item.TaxableAmount, true) }}</span></span>
                  <span>·</span>
                  <span>Tax: <span class="text-weight-bold">{{ _C(item.TaxAmount, true) }}</span></span>
                  <span v-if="item.Discount > 0">·</span>
                  <span v-if="item.Discount > 0">Disc: <span class="text-weight-bold text-negative">-{{ _C(item.Discount, true) }}</span></span>
                  <span>·</span>
                  <span class="text-primary text-weight-bold">Total: {{ _C(item.Total, true) }}</span>
                </div>
              </q-item-section>
              <q-item-section side>
                <q-input
                  v-model.number="editLineItems.find(el => el.SKU === item.SKU).Price"
                  dense
                  outlined
                  type="number"
                  :prefix="defaultCurrency.Symbol"
                  label="Adjusted Price"
                  style="width: 140px"
                />
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
              <div class="col-6 col-sm-2">
                <div class="text-caption text-grey-6">Subtotal</div>
                <div class="text-subtitle1 text-weight-bold text-grey-9 q-mt-xs">{{ _C(realtimeSubtotal || 0, true) }}</div>
              </div>
              <div class="col-6 col-sm-2">
                <div class="text-caption text-grey-6">Total Taxable Amount</div>
                <div class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">{{ _C(realtimeTaxDetailsComputed.totalTaxableAmount || 0, true) }}</div>
              </div>
              <div class="col-12 col-sm-4" v-if="editing">
                <div class="text-caption text-grey-6 q-mb-xs">Discount Options</div>
                <div class="row q-col-gutter-xs">
                  <div class="col-6">
                    <q-select
                      v-model="editForm.discountType"
                      :options="[
                        { label: 'Flat Amount', value: 'FLAT' },
                        { label: 'Percentage (%)', value: 'PERCENT' }
                      ]"
                      emit-value
                      map-options
                      dense
                      outlined
                    />
                  </div>
                  <div class="col-6">
                    <q-input
                      v-model.number="editForm.discountValue"
                      dense
                      outlined
                      type="number"
                      label="Value"
                      :min="0"
                    />
                  </div>
                </div>
              </div>
              <div class="col-6 col-sm-2" v-else>
                <div class="text-caption text-grey-6">Discount</div>
                <div class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">-{{ _C(realtimeHeaderDiscount || 0, true) }}</div>
              </div>
              <div class="col-6 col-sm-2">
                <div class="text-caption text-grey-6">Tax (Computed)</div>
                <div class="text-subtitle1 text-weight-bold text-grey-7 q-mt-xs">+{{ _C(realtimeTax || 0, true) }}</div>
              </div>
              <div class="col-6 col-sm-2">
                <div class="text-caption text-grey-6 text-negative">Returns Deducted</div>
                <div class="text-subtitle1 text-weight-bold text-negative q-mt-xs">-{{ _C(realtimeReturnDeductionTotal || 0, true) }}</div>
              </div>
            </div>
            
            <q-separator v-if="realtimeTaxDetailsComputed.taxDetails && realtimeTaxDetailsComputed.taxDetails.length" class="q-my-sm" />
            <div v-if="realtimeTaxDetailsComputed.taxDetails && realtimeTaxDetailsComputed.taxDetails.length" class="q-py-xs">
              <div class="text-caption text-grey-5 text-weight-bold q-mb-xs">Tax Details Breakdown</div>
              <div v-for="td in realtimeTaxDetailsComputed.taxDetails" :key="td.TaxCode" class="row justify-between text-caption text-grey-7 q-py-xs">
                <span>Tax Code: <span class="text-weight-bold text-grey-8">{{ td.TaxCode }}</span></span>
                <span>Taxable: {{ _C(td.TaxableAmount, true) }} | Tax Amount: {{ _C(td.TaxAmount, true) }}</span>
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
import { useDataStore } from '../../../stores/data.js'
import { useTaxCalculator } from '../../../composables/useTaxCalculator.js'

defineOptions({ name: 'OutletConsumptionInvoicesViewPage' })
const dataStore = useDataStore()
const { calculateLineTax } = useTaxCalculator()

const $q = useQuasar()
const route = useRoute()
const nav = useResourceNav()
const flow = useOutletConsumption()
const { _C, defaultCurrency, roundToInterval, roundToDecimals, defaultCurrencyCode } = useCurrency()

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
const editForm = ref({ priceListCode: '', discountType: 'FLAT', discountValue: 0, tax: 0 })
const editLineItems = ref([])
const editReturns = ref([])

const priceListOptions = computed(() => priceLists.items.value.map(p => ({ label: `${p.Code} - ${p.Name || ''}`, value: p.Code })))

const plName = computed(() => {
  if (!invoice.value?.PriceListCode) return 'Not priced'
  const pl = priceLists.items.value.find(p => p.Code === invoice.value.PriceListCode)
  return pl ? `${pl.Code} - ${pl.Name}` : invoice.value.PriceListCode
})

// Real-time calculations adhering to single source of truth reactivity
const realtimeRawSubtotal = computed(() => {
  return editLineItems.value.reduce((sum, item) => sum + (parseFloat(item.Qty || 0) * (parseFloat(item.Price || 0))), 0)
})

const realtimeDiscount = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Discount) || 0
  }
  const discVal = parseFloat(editForm.value.discountValue) || 0
  if (editForm.value.discountType === 'PERCENT') {
    return realtimeRawSubtotal.value * (discVal / 100)
  }
  return discVal
})

const realtimeTaxDetailsComputed = computed(() => {
  if (!editing.value) {
    return {
      totalTaxableAmount: parseFloat(invoice.value?.TotalTaxableAmount) || 0,
      totalTaxAmount: parseFloat(invoice.value?.TotalTaxAmount) || 0,
      taxDetails: invoice.value?.TaxDetails ? JSON.parse(invoice.value.TaxDetails) : []
    }
  }

  const plCode = editForm.value.priceListCode
  const plRecord = priceLists.items.value.find(p => p.Code === plCode && p.Status === 'Active')
  const skus = dataStore.getRecords('SKUs') || []
  
  const sub = realtimeRawSubtotal.value
  const disc = realtimeDiscount.value
  const currencyCode = plRecord ? plRecord.Currency : defaultCurrencyCode.value

  let totalTaxableAmount = 0
  let totalTaxAmount = 0
  const detailsMap = {}

  editLineItems.value.forEach(item => {
    const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
    const taxCode = skuRecord ? skuRecord.TaxCode : ''
    const itemSubtotal = parseFloat(item.Qty || 0) * (parseFloat(item.Price) || 0)
    const itemDiscount = plRecord && plRecord.DiscountTaxPolicy === 'PRE_TAX' && sub > 0 ? (itemSubtotal / sub) * disc : 0

    const lineTax = calculateLineTax({
      price: parseFloat(item.Price) || 0,
      quantity: parseFloat(item.Qty) || 0,
      discount: itemDiscount,
      taxCode: taxCode,
      taxInclusive: plRecord ? (plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true) : false,
      discountTaxPolicy: plRecord ? (plRecord.DiscountTaxPolicy || 'PRE_TAX') : 'PRE_TAX'
    })

    const roundedTaxable = roundToDecimals(lineTax.taxableAmount, currencyCode)
    const roundedTaxAmount = roundToDecimals(lineTax.taxAmount, currencyCode)

    totalTaxableAmount += roundedTaxable
    totalTaxAmount += roundedTaxAmount

    if (taxCode) {
      if (!detailsMap[taxCode]) {
        detailsMap[taxCode] = { TaxCode: taxCode, TaxableAmount: 0, TaxAmount: 0 }
      }
      detailsMap[taxCode].TaxableAmount += roundedTaxable
      detailsMap[taxCode].TaxAmount += roundedTaxAmount
    }
  })

  // Round the detailsMap entries
  Object.keys(detailsMap).forEach(key => {
    detailsMap[key].TaxableAmount = roundToDecimals(detailsMap[key].TaxableAmount, currencyCode)
    detailsMap[key].TaxAmount = roundToDecimals(detailsMap[key].TaxAmount, currencyCode)
  })

  return {
    totalTaxableAmount: roundToDecimals(totalTaxableAmount, currencyCode),
    totalTaxAmount: roundToDecimals(totalTaxAmount, currencyCode),
    taxDetails: Object.values(detailsMap)
  }
})

const realtimeTax = computed(() => realtimeTaxDetailsComputed.value.totalTaxAmount)

const realtimeReturnDeductionTotal = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.ReturnDeductionTotal) || 0
  }
  return editReturns.value.reduce((sum, item) => sum + (parseFloat(item.Qty || 0) * (parseFloat(item.Price || 0))), 0)
})

const realtimeLineItems = computed(() => {
  if (!editing.value) {
    return editLineItems.value.map(item => {
      const dbRecord = childInvoiceItems(invoice.value?.Code).find(row => row.Code === item.Code)
      return {
        ...item,
        Total: dbRecord?.Total || (item.Qty * item.Price),
        Discount: dbRecord?.Discount || 0,
        TaxableAmount: dbRecord?.TaxableAmount || (item.Qty * item.Price),
        TaxAmount: dbRecord?.TaxAmount || 0,
        TaxCode: dbRecord?.TaxCode || ''
      }
    })
  }

  const plCode = editForm.value.priceListCode
  const plRecord = priceLists.items.value.find(p => p.Code === plCode && p.Status === 'Active')
  const skus = dataStore.getRecords('SKUs') || []
  
  const sub = realtimeRawSubtotal.value
  const disc = realtimeDiscount.value
  const currencyCode = plRecord ? plRecord.Currency : defaultCurrencyCode.value

  return editLineItems.value.map(item => {
    const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
    const taxCode = skuRecord ? skuRecord.TaxCode : ''
    const itemSubtotal = parseFloat(item.Qty || 0) * (parseFloat(item.Price) || 0)
    const itemDiscount = plRecord && plRecord.DiscountTaxPolicy === 'PRE_TAX' && sub > 0 ? (itemSubtotal / sub) * disc : 0

    const lineTax = calculateLineTax({
      price: parseFloat(item.Price) || 0,
      quantity: parseFloat(item.Qty) || 0,
      discount: itemDiscount,
      taxCode: taxCode,
      taxInclusive: plRecord ? (plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true) : false,
      discountTaxPolicy: plRecord ? (plRecord.DiscountTaxPolicy || 'PRE_TAX') : 'PRE_TAX'
    })

    return {
      ...item,
      Total: roundToDecimals(lineTax.grossAmount, currencyCode),
      Discount: roundToDecimals(lineTax.discountAmount, currencyCode),
      TaxableAmount: roundToDecimals(lineTax.taxableAmount, currencyCode),
      TaxAmount: roundToDecimals(lineTax.taxAmount, currencyCode),
      TaxCode: taxCode
    }
  })
})

const realtimeSubtotal = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Subtotal) || 0
  }
  return realtimeLineItems.value.reduce((sum, item) => sum + (parseFloat(item.Total) || 0), 0)
})

const realtimeHeaderDiscount = computed(() => {
  if (!editing.value) {
    return parseFloat(invoice.value?.Discount) || 0
  }
  const plCode = editForm.value.priceListCode
  const plRecord = priceLists.items.value.find(p => p.Code === plCode && p.Status === 'Active')
  const policy = plRecord ? (plRecord.DiscountTaxPolicy || 'PRE_TAX') : 'PRE_TAX'
  const currencyCode = plRecord ? plRecord.Currency : defaultCurrencyCode.value
  return policy === 'PRE_TAX' ? 0 : roundToDecimals(realtimeDiscount.value, currencyCode)
})

const realtimeTotal = computed(() => {
  return getInvoiceTotal({
    Subtotal: realtimeSubtotal.value,
    Discount: realtimeHeaderDiscount.value,
    ReturnDeductionTotal: realtimeReturnDeductionTotal.value
  })
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
    discountType: 'FLAT',
    discountValue: invoice.value.Discount || 0,
    tax: invoice.value.TotalTaxAmount || 0
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
    Discount: realtimeDiscount.value,
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
