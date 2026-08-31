<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!receiving" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No receiving</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Progress</span>
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
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useReceivingView } from 'src/_ui/AQL/composables/Operation/POReceivings/View/useReceivingView'
import { useReceivingViewContext } from 'src/_ui/AQL/composables/Operation/POReceivings/View/useReceivingViewContext'

defineOptions({ name: 'POReceivingsViewReceivingHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Receiving Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useReceivingViewContext()
const { receiving, pending, goodsReceipt, progressColor, progressIcon, progressLabel } = useReceivingView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(receiving.value?.Progress))
const statusIcon = computed(() => progressIcon(receiving.value?.Progress))
const statusLabel = computed(() => progressLabel(receiving.value?.Progress))

const facts = computed(() => {
  const record = receiving.value
  if (!record) return []
  return [
    { label: 'Purchase Order', value: record.PurchaseOrderCode },
    { label: 'Inspected', value: record.InspectionDate },
    { label: 'Inspected By', value: record.InspectedUserName },
    { label: 'Goods Receipt', value: goodsReceipt.value?.Code || '' },
    { label: 'Remarks', value: record.Remarks },
    { label: 'Procurement', value: record.ProcurementCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
