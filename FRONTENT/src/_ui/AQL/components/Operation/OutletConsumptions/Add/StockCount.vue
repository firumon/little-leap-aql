<template>
  <div v-if="visible" :class="gutterClass">
    <q-input v-model="filter" outlined clearable debounce="150" label="Filter items">
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <!-- Empty storage is a valid audit outcome: a new outlet or sold out. -->
    <q-card v-if="!skus.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing on record here</div>
        <div :class="ui.emptyCaptionClass">
          This outlet holds no recorded stock. You can still log damaged or unlisted items
          below.
        </div>
      </q-card-section>
    </q-card>

    <div v-else-if="!visibleSkus.length" :class="ui.emptyCaptionClass" class="text-center q-py-sm">
      No items match "{{ text(filter) }}"
    </div>

    <StockCountRow
      v-for="sku in visibleSkus"
      :key="sku"
      :sku="sku"
      :count="count"
      :ui="ui"
      :returns-allowed="returnsAllowed"
      :restocks-allowed="restocksAllowed"
    />

    <StockCountExtras v-if="returnsAllowed" :listed="listed" :count="count" :ui="ui" />
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import StockCountRow from './StockCountRow.vue'
import StockCountExtras from './StockCountExtras.vue'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { useConsumptionCountFields } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionCountFields'
import { useConsumptionCountSeed } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionCountSeed'
import { COUNT_FILTER, NODE, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddStockCount', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, allowed } = useConsumptionAddContext()
const { skuLabelOf } = useSkuResource()
const { stockRowsOf } = useOutletStorageResource()

const visible = computed(() => stepVisible(pageState, props.step))

const returnsAllowed = allowed(NODE.RETURNS, 'create')
const restocksAllowed = allowed(NODE.RESTOCKS, 'create')

const count = useConsumptionCountFields(pageState, { returnsAllowed, restocksAllowed })
useConsumptionCountSeed(pageState)

const text = (value) => (value == null ? '' : String(value).trim())

const filter = pageState.useControls(COUNT_FILTER, '')

const items = pageState.useNode(NODE.CONSUMPTION).children(NODE.ITEMS)
const returnsState = pageState.useNode(NODE.RETURNS)

// Shelf stock first, then items found on top of it.
const skus = computed(() => {
  const seen = new Set()
  const push = (sku) => {
    const code = text(sku)
    if (code && !seen.has(code)) seen.add(code)
  }
  stockRowsOf(count.outletCode.value)
    .filter((row) => Number(row.Quantity) > 0)
    .forEach((row) => push(row.SKU))
  ;(items.value || []).forEach((row) => push(row.SKU))
  ;(returnsState.node.value.records || []).forEach((row) => push(row.SKU))
  return [...seen]
})

const visibleSkus = computed(() => {
  const query = text(filter.value).toLowerCase()
  if (!query) return skus.value
  return skus.value.filter((sku) => {
    const label = skuLabelOf(sku)
    const code = text(sku).toLowerCase()
    const primary = text(label?.primary).toLowerCase()
    const secondary = text(label?.secondary).toLowerCase()
    return code.includes(query) || primary.includes(query) || secondary.includes(query)
  })
})

const listed = computed(() => new Set(skus.value))
</script>
