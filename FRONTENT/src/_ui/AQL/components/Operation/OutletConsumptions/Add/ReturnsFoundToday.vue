<template>
  <div v-if="returnRows.length" :class="gutterClass">
    <SectionDividerLabel label="RETURNS FOUND TODAY" />

    <q-banner dense rounded class="bg-grey-2 text-body2">
      Each item needs a reason. Credit the outlet for it, send it back to a warehouse, or
      both — the two are independent.
    </q-banner>

    <ReturnRoutingCard
      v-for="entry in returnRows"
      :key="entry.row.SKU"
      :row="entry.row"
      :index="entry.index"
      :gutter="gutter"
      :warehouse-options="warehouseOptions"
      :invoice-options="invoiceOptionsFor(entry.row.SKU)"
      :default-price="defaultPriceOf(entry.row.SKU)"
    />
  </div>
</template>

<script setup>
// The surpluses this count produced. Owns the option lists every routing card reads, so
// they are built once for the step. No `<style>` block (ARCHITECTURE RULES §7).
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import ReturnRoutingCard from './ReturnRoutingCard.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { priceOf, priceListForOutlet } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddReturnsFoundToday', inheritAttrs: false })

const props = defineProps({ gutter: { type: String, default: 'sm' } })

const { pageState, hasRegionAccess, resource } = useConsumptionAddContext()
const { _C } = useCurrency()

const warehouses = resource('Warehouses')
const invoices = resource(NODE.INVOICES)
const invoiceItems = resource(NODE.INVOICE_ITEMS)

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'

const gutterClass = computed(() => `q-gutter-y-${props.gutter}`)

const consumption = pageState.useNode(NODE.CONSUMPTION)
const returnsState = pageState.useNode(NODE.RETURNS)

const outletCode = computed(() => text(consumption.node.value.record.OutletCode))

/** The surpluses this visit counted, each with its index on the OutletReturns many-node. */
const returnRows = computed(() => (returnsState.node.value.records || [])
  .map((row, index) => ({ row, index }))
  .filter((entry) => num(entry.row.Qty) > 0))

// `hasRegionAccess`, not a flat equality test: it also honours universe-scoped users.
const warehouseOptions = computed(() => warehouses.items.value
  .filter((row) => isActive(row) && hasRegionAccess(row.AccessRegion))
  .map((row) => ({ value: text(row.Code), label: text(row.Name) || text(row.Code) })))

const priceListCode = computed(() => text(priceListForOutlet(outletCode.value)?.code))

const defaultPriceOf = (sku) => num(priceOf(sku, priceListCode.value))

/** Past invoice lines for this outlet, grouped by SKU. Indexed once, not scanned per row. */
const invoiceLinesBySku = computed(() => {
  const headers = new Map(invoices.items.value
    .filter((row) => text(row.OutletCode) === outletCode.value)
    .map((row) => [text(row.Code), row]))

  return invoiceItems.items.value.reduce((map, item) => {
    const header = headers.get(text(item.OutletConsumptionInvoiceCode))
    const sku = text(item.SKU)
    if (!header || !sku) return map
    const label = `${formatDate(header.Date)} · ${text(header.Username)} · ` +
      `${num(item.Qty)} pcs (@${_C(num(item.Price))}) · Inv ${_C(num(header.Total || header.Subtotal))}`
    const list = map.get(sku) || []
    list.push({ value: text(header.Code), label, price: num(item.Price) })
    map.set(sku, list)
    return map
  }, new Map())
})

const invoiceOptionsFor = (sku) => invoiceLinesBySku.value.get(text(sku)) || []
</script>
