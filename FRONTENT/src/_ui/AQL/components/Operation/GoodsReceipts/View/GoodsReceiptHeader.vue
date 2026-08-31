<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!goodsReceipt" class="text-center q-py-lg">
        <q-icon name="fact_check" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No goods receipt</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Status</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>

        <q-banner v-if="invalidated" dense rounded class="bg-orange-2 q-mt-sm text-caption">
          This goods receipt was invalidated. Its stock posting has been reversed.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useGoodsReceiptView } from 'src/_ui/AQL/composables/Operation/GoodsReceipts/View/useGoodsReceiptView'
import { useGoodsReceiptViewContext } from 'src/_ui/AQL/composables/Operation/GoodsReceipts/View/useGoodsReceiptViewContext'

defineOptions({ name: 'GoodsReceiptsViewGoodsReceiptHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Goods Receipt Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useGoodsReceiptViewContext()
const { goodsReceipt, pending, totals, invalidated, progressColor, progressIcon, progressLabel } = useGoodsReceiptView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(goodsReceipt.value?.Status))
const statusIcon = computed(() => progressIcon(goodsReceipt.value?.Status))
const statusLabel = computed(() => progressLabel(goodsReceipt.value?.Status))

const facts = computed(() => {
  const record = goodsReceipt.value
  if (!record) return []
  return [
    { label: 'GRN Date', value: record.Date },
    { label: 'Purchase Order', value: record.PurchaseOrderCode },
    { label: 'Receiving', value: record.POReceivingCode },
    { label: 'Posted Quantity', value: totals.value.quantity || '' },
    { label: 'Procurement', value: record.ProcurementCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
