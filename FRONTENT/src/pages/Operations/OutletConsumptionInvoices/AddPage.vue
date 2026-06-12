<template>
  <q-page padding>
    <OutletHeaderPanel
      :title="consumption ? `Generate Invoice — ${outletName(consumption.OutletCode)}` : 'Generate Invoice'"
      subtitle="Review consumption items, set prices, discount & tax"
      class="q-mb-md"
    />

    <div v-if="loading" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>

    <q-banner v-else-if="!consumption" rounded class="bg-grey-2 text-grey-8">Consumption not found.</q-banner>

    <q-banner v-else-if="childInvoice(consumption.Code)" rounded class="bg-orange-2 text-orange-9 q-mb-md">
      An invoice already exists for this consumption.
      <template #action>
        <q-btn flat color="primary" label="View Invoice" @click="navigateToInvoice(childInvoice(consumption.Code).Code)" />
      </template>
    </q-banner>

    <template v-else>
      <div class="text-subtitle1 text-weight-medium q-mb-sm">Price List</div>
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pa-sm">
          <q-select v-model="selectedPriceList" :options="priceListOptions" dense outlined emit-value map-options label="Select Price List" />
        </q-card-section>
      </q-card>

      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle1 text-weight-medium">Items</div>
          <div class="text-caption text-grey-7">Adjust prices as needed</div>
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="(item, i) in editableItems" :key="item.SKU" class="q-pa-sm">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ item.displayLabel }}</q-item-label>
              <q-item-label caption>Qty: {{ item.Qty }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-input v-model.number="item.Price" dense outlined type="number" label="Price" style="width: 130px" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <q-card flat bordered class="q-mb-md">
        <q-card-section class="row q-col-gutter-sm q-pa-sm items-center">
          <div class="col-12 col-sm-6">
            <div class="text-caption text-grey-7 q-mb-xs">Discount Options</div>
            <div class="row q-col-gutter-xs">
              <div class="col-6">
                <q-select
                  v-model="discountType"
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
                  v-model.number="discountValue"
                  dense
                  outlined
                  type="number"
                  label="Value"
                  :min="0"
                />
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="text-caption text-grey-7 q-mb-xs">Tax (Computed)</div>
            <q-input :model-value="tax" readonly dense outlined type="number" label="Tax" />
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="q-mb-md bg-grey-1">
        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-md text-body2">
            <div class="col-3"><span class="text-grey-7">Subtotal</span><div class="text-weight-bold">{{ _C(subtotal, true) }}</div></div>
            <div class="col-3"><span class="text-grey-7">Discount</span><div class="text-weight-bold">-{{ _C(displayDiscount, true) }}</div></div>
            <div class="col-3"><span class="text-grey-7">Tax</span><div class="text-weight-bold">+{{ _C(tax, true) }}</div></div>
            <div class="col-3"><span class="text-grey-7">Returns</span><div class="text-weight-bold text-negative">-{{ _C(returnDeductionTotal, true) }}</div></div>
          </div>
          <q-separator class="q-my-xs" />
          <div class="text-subtitle1 text-weight-bold">Total: {{ _C(total, true) }}</div>
        </q-card-section>
      </q-card>

      <div class="row q-gutter-sm justify-end">
        <q-btn flat label="Cancel" color="primary" @click="cancel" />
        <q-btn unelevated color="primary" icon="receipt" label="Generate Invoice" :loading="saving" @click="saveInvoice" />
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import { useDataStore } from '../../../stores/data.js'
import { useTaxCalculator } from '../../../composables/useTaxCalculator.js'

defineOptions({ name: 'OutletConsumptionInvoicesAddPage' })
const dataStore = useDataStore()
const { calculateLineTax } = useTaxCalculator()
const $q = useQuasar()
const route = useRoute()
const flow = useOutletConsumption()
const { _C } = useCurrency()
const { loading, saving, reload, getConsumption, childItems, childInvoice, outletName, formatDisplayDate, navigateToInvoice, cancel, productDisplayName, saveInvoiceFromConsumption, text, priceLists, resolveDefaultPriceList, resolvePriceListItems, returns, active, getInvoiceTotal } = flow

const discountType = ref('FLAT')
const discountValue = ref(0)

const rawSubtotal = computed(() => editableItems.value.reduce((s, item) => s + (item.Qty * (item.Price || 0)), 0))
const discount = computed(() => {
  const discVal = Number(discountValue.value || 0)
  if (discountType.value === 'PERCENT') {
    return rawSubtotal.value * (discVal / 100)
  }
  return discVal
})
const editableItems = ref([])
const selectedPriceList = ref('')

const consumptionCode = computed(() => text(route.query.consumptionCode || ''))
const consumption = computed(() => consumptionCode.value ? getConsumption(consumptionCode.value) : null)

const priceListOptions = computed(() => priceLists.items.value.map(p => ({ label: `${p.Code} - ${p.Name || ''}`, value: p.Code })))

const taxDetailsComputed = computed(() => {
  const plRecord = priceLists.items.value.find(p => p.Code === selectedPriceList.value && p.Status === 'Active')
  if (!plRecord) {
    return { totalTaxableAmount: 0, totalTaxAmount: 0, taxDetails: '[]', items: [], headerDiscount: 0 }
  }

  const skus = dataStore.getRecords('SKUs') || []
  const sub = rawSubtotal.value
  const disc = Number(discount.value || 0)
  const { roundToDecimals, defaultCurrencyCode } = useCurrency()
  const currencyCode = plRecord.Currency || defaultCurrencyCode.value

  let totalTaxableAmount = 0
  let totalTaxAmount = 0
  const detailsMap = {}

  const itemsWithTax = editableItems.value.map(item => {
    const skuRecord = skus.find(s => s.Code === item.SKU && s.Status === 'Active')
    const taxCode = skuRecord ? skuRecord.TaxCode : ''
    const itemSubtotal = item.Qty * (item.Price || 0)
    const itemDiscount = plRecord.DiscountTaxPolicy === 'PRE_TAX' && sub > 0 ? (itemSubtotal / sub) * disc : 0

    const lineTax = calculateLineTax({
      price: item.Price || 0,
      quantity: item.Qty || 0,
      discount: itemDiscount,
      taxCode: taxCode,
      taxInclusive: plRecord.TaxInclusive === 'TRUE' || plRecord.TaxInclusive === true,
      discountTaxPolicy: plRecord.DiscountTaxPolicy || 'PRE_TAX'
    })

    const roundedTaxable = roundToDecimals(lineTax.taxableAmount, currencyCode)
    const roundedTaxAmount = roundToDecimals(lineTax.taxAmount, currencyCode)
    const roundedDiscount = roundToDecimals(lineTax.discountAmount, currencyCode)
    const roundedTotal = roundToDecimals(lineTax.grossAmount, currencyCode)

    totalTaxableAmount += roundedTaxable
    totalTaxAmount += roundedTaxAmount

    if (taxCode) {
      if (!detailsMap[taxCode]) {
        detailsMap[taxCode] = { TaxCode: taxCode, TaxableAmount: 0, TaxAmount: 0 }
      }
      detailsMap[taxCode].TaxableAmount += roundedTaxable
      detailsMap[taxCode].TaxAmount += roundedTaxAmount
    }

    return {
      SKU: item.SKU,
      Qty: item.Qty,
      Price: item.Price,
      Total: roundedTotal,
      Discount: roundedDiscount,
      TaxableAmount: roundedTaxable,
      TaxAmount: roundedTaxAmount,
      TaxCode: taxCode
    }
  })

  // Round the detailsMap entries
  Object.keys(detailsMap).forEach(key => {
    detailsMap[key].TaxableAmount = roundToDecimals(detailsMap[key].TaxableAmount, currencyCode)
    detailsMap[key].TaxAmount = roundToDecimals(detailsMap[key].TaxAmount, currencyCode)
  })

  const taxDetails = JSON.stringify(Object.values(detailsMap))

  return {
    totalTaxableAmount: roundToDecimals(totalTaxableAmount, currencyCode),
    totalTaxAmount: roundToDecimals(totalTaxAmount, currencyCode),
    taxDetails,
    items: itemsWithTax,
    headerDiscount: plRecord.DiscountTaxPolicy === 'POST_TAX' ? roundToDecimals(disc, currencyCode) : 0
  }
})

const returnDeductionTotal = computed(() => {
  if (!consumption.value) return 0
  const outletCode = text(consumption.value.OutletCode)
  const appliedReturns = returns.items.value.filter(ret =>
    active(ret) &&
    text(ret.OutletCode) === outletCode &&
    text(ret.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(ret.InvoiceAdjustmentDone) !== 'TRUE'
  )

  let totalDeduction = 0
  const pListCode = selectedPriceList.value
  if (pListCode && appliedReturns.length > 0) {
    appliedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = Number(ret.Qty || 0)
      const price = Number(ret.Price || 0)
      if (price > 0) {
        totalDeduction += qty * price
      } else {
        const pricing = resolvePriceListItems(pListCode, [{ SKU: sku, Qty: qty }])
        const resolvedPrice = pricing.items[0]?.Price || 0
        totalDeduction += qty * resolvedPrice
      }
    })
  }
  return totalDeduction
})

const subtotal = computed(() => {
  const items = taxDetailsComputed.value.items || []
  return items.reduce((s, item) => s + Number(item.Total || 0), 0)
})
const displayDiscount = computed(() => taxDetailsComputed.value.headerDiscount)
const tax = computed(() => taxDetailsComputed.value.totalTaxAmount)
const total = computed(() => getInvoiceTotal({ Subtotal: subtotal.value, Discount: displayDiscount.value, ReturnDeductionTotal: returnDeductionTotal.value }))

function loadItems(priceListCode) {
  if (!consumption.value) return
  const items = childItems(consumptionCode.value)
  if (priceListCode) {
    const pricing = resolvePriceListItems(priceListCode, items.map(row => ({ SKU: row.SKU, Qty: row.Qty })))
    editableItems.value = items.map(row => {
      const priced = pricing.items.find(p => text(p.SKU) === text(row.SKU))
      return {
        SKU: row.SKU,
        Qty: row.Qty,
        Price: priced ? priced.Price : 0,
        displayLabel: productDisplayName(row.SKU)
      }
    })
  } else {
    editableItems.value = items.map(row => ({
      SKU: row.SKU,
      Qty: row.Qty,
      Price: 0,
      displayLabel: productDisplayName(row.SKU)
    }))
  }
}

watch(selectedPriceList, (val) => {
  if (val !== undefined) loadItems(val)
})

async function saveInvoice() {
  if (!consumption.value) return
  if (!editableItems.value.length) {
    $q.notify({ type: 'warning', message: 'No items to invoice.', position: 'top' })
    return
  }
  if (editableItems.value.some(item => !item.Price || item.Price < 0)) {
    $q.notify({ type: 'warning', message: 'All items must have a valid price.', position: 'top' })
    return
  }
  const result = await saveInvoiceFromConsumption({
    consumptionCode: consumptionCode.value,
    consumptionRecord: consumption.value,
    items: taxDetailsComputed.value.items,
    discount: discount.value,
    tax: tax.value,
    priceListCode: selectedPriceList.value
  })
  if (result.error) {
    $q.notify({ type: 'negative', message: result.error, position: 'top' })
    return
  }
  $q.notify({ type: 'positive', message: 'Invoice generated.', position: 'top' })
  navigateToInvoice(result.invoiceCode)
}

onMounted(async () => {
  await reload()
  if (consumption.value) {
    selectedPriceList.value = resolveDefaultPriceList(consumption.value.OutletCode)
  }
})
</script>
