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
        <q-card-section class="row q-col-gutter-md q-pa-sm">
          <div class="col-6">
            <q-input v-model.number="discount" dense outlined type="number" label="Discount" />
          </div>
          <div class="col-6">
            <q-input v-model.number="tax" dense outlined type="number" label="Tax" />
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="q-mb-md bg-grey-1">
        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-md text-body2">
            <div class="col-3"><span class="text-grey-7">Subtotal</span><div class="text-weight-bold">{{ subtotal }}</div></div>
            <div class="col-3"><span class="text-grey-7">Discount</span><div class="text-weight-bold">-{{ discount }}</div></div>
            <div class="col-3"><span class="text-grey-7">Tax</span><div class="text-weight-bold">+{{ tax }}</div></div>
            <div class="col-3"><span class="text-grey-7">Returns</span><div class="text-weight-bold text-negative">-{{ returnDeductionTotal }}</div></div>
          </div>
          <q-separator class="q-my-xs" />
          <div class="text-subtitle1 text-weight-bold">Total: {{ total }}</div>
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
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'

defineOptions({ name: 'OutletConsumptionInvoicesAddPage' })
const $q = useQuasar()
const route = useRoute()
const flow = useOutletConsumption()
const { loading, saving, reload, getConsumption, childItems, childInvoice, outletName, formatDisplayDate, navigateToInvoice, cancel, productDisplayName, saveInvoiceFromConsumption, text, priceLists, resolveDefaultPriceList, resolvePriceListItems, returns, active, getInvoiceTotal } = flow

const discount = ref(0)
const tax = ref(0)
const editableItems = ref([])
const selectedPriceList = ref('')

const consumptionCode = computed(() => text(route.query.consumptionCode || ''))
const consumption = computed(() => consumptionCode.value ? getConsumption(consumptionCode.value) : null)

const priceListOptions = computed(() => priceLists.items.value.map(p => ({ label: `${p.Code} - ${p.Name || ''}`, value: p.Code })))

const subtotal = computed(() => editableItems.value.reduce((s, item) => s + (item.Qty * (item.Price || 0)), 0))
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
      const pricing = resolvePriceListItems(pListCode, [{ SKU: sku, Qty: qty }])
      const price = pricing.items[0]?.Price
      if (price !== null && price > 0) {
        totalDeduction += qty * price
      }
    })
  }
  return totalDeduction
})
const total = computed(() => getInvoiceTotal({ Subtotal: subtotal.value, Discount: discount.value, Tax: tax.value, ReturnDeductionTotal: returnDeductionTotal.value }))

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
    items: editableItems.value.map(item => ({ SKU: item.SKU, Qty: item.Qty, Price: item.Price })),
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
