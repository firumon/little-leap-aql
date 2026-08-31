<template>
  <div v-if="!pending && rows.length">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(row, index) in rows"
            :key="row.Code"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">
              {{ row.Code }}
              <span v-if="row.InspectionDate" class="text-caption text-grey-6 block">{{ row.InspectionDate }}</span>
            </span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-badge rounded :color="receivingColor(row.Progress)" :label="receivingLabel(row.Progress)" />
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { progressColor as receivingColor, progressLabel as receivingLabel } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import { usePurchaseOrderView } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderView'
import { usePurchaseOrderViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderViewContext'

defineOptions({ name: 'PurchaseOrdersViewReceivings', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Receiving History' }
})

const { evaluate, ui } = usePurchaseOrderViewContext()
const { receivingRows, pending } = usePurchaseOrderView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => receivingRows.value)

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
