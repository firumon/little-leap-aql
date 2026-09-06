<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Empty storage is a real audit outcome, not an error: a new outlet, or one that
         sold out. -->
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

    <StockCountRow
      v-for="sku in skus"
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
// Step 2 - the physical count. This card owns only the SHEET: which SKUs have a row, and
// in what order. Counting one of them is `StockCountRow`; adding one the shelf does not
// carry is `StockCountExtras`; what a count means is `useConsumptionCountFields`.
import { computed, useAttrs } from 'vue'
import StockCountRow from './StockCountRow.vue'
import StockCountExtras from './StockCountExtras.vue'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { useConsumptionCountFields } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionCountFields'
import { useConsumptionCountSeed } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionCountSeed'
import { NODE, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddStockCount', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, allowed } = useConsumptionAddContext()
const { stockRowsOf } = useOutletStorageResource()

const visible = computed(() => stepVisible(pageState, props.step))

// A surplus found on the shelf is a return, and a mirrored line is a restock. Each side of
// this step is offered only to a role that may write its record.
const returnsAllowed = allowed(NODE.RETURNS, 'create')
const restocksAllowed = allowed(NODE.RESTOCKS, 'create')

const count = useConsumptionCountFields(pageState, { returnsAllowed, restocksAllowed })
useConsumptionCountSeed(pageState)

const text = (value) => (value == null ? '' : String(value).trim())

const items = pageState.useNode(NODE.CONSUMPTION).children(NODE.ITEMS)
const returnsState = pageState.useNode(NODE.RETURNS)

// The shelf FIRST, then anything found on top of it. Dropping the zero lines on the way to
// step 3 therefore cannot empty this list when the officer steps back.
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

const listed = computed(() => new Set(skus.value))
</script>
