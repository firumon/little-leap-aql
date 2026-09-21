<template>
  <div v-if="visible && rows.length" :class="gutterClass">
    <SectionDividerLabel label="CONSUMED ITEMS" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, i) in summary"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(i)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <AqlList
        :items="rows"
        item-key="sku"
        :label="(row) => row.name"
        :caption="(row) => row.variant"
        :meta-layout="['label']"
        :meta-label="(row) => row.qtyWithUom"
        :item-bordered="false"
        :separator="true"
        item-class="bg-transparent"
        dense
      />
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/shared/AqlList.vue'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { NODE, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddConsumedItems', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui } = useConsumptionAddContext()
const { skuLabelOf } = useSkuResource()

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const consumption = pageState.useNode(NODE.CONSUMPTION)

const visible = computed(() => stepVisible(pageState, props.step))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const consumedRows = computed(() =>
  (consumption.children(NODE.ITEMS).value || []).filter((row) => num(row.Qty) > 0)
)

const totalQty = computed(() =>
  consumedRows.value.reduce((sum, row) => sum + num(row.Qty), 0)
)

const summary = computed(() => [
  { label: 'Items', value: `${consumedRows.value.length}` },
  { label: 'Total qty', value: `${totalQty.value}` }
])

const rows = computed(() =>
  consumedRows.value.map((row) => {
    const sku = text(row.SKU)
    const label = skuLabelOf(sku)
    const qty = num(row.Qty)
    const unit = label.uom || 'Qty'
    return {
      sku,
      name: label.primary,
      variant: label.secondary,
      qty,
      qtyWithUom: `${qty} ${unit}`
    }
  })
)
</script>
