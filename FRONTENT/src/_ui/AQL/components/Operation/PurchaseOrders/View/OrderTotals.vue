<template>
  <div v-if="!pending && purchaseOrder">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Items subtotal</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ money(totals.subtotal) }}
            </span>
          </div>

          <div
            v-for="(charge, index) in totals.breakdown"
            :key="charge.key"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ chargeLabel(charge.key) }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ money(charge.amount) }}
            </span>
          </div>
        </div>

        <q-separator class="q-my-sm" />

        <div class="row items-center justify-between">
          <span class="text-subtitle2 text-weight-bold">
            Total
            <span v-if="totals.charges" class="text-caption text-grey-7 q-ml-xs">
              ({{ money(totals.subtotal) }} + {{ money(totals.charges) }})
            </span>
          </span>
          <span class="text-subtitle1 text-weight-bold">{{ money(totals.total) }}</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { usePurchaseOrderView } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderView'
import { usePurchaseOrderViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderViewContext'

defineOptions({ name: 'PurchaseOrdersViewOrderTotals', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Order Value' }
})

const { evaluate, ui } = usePurchaseOrderViewContext()
const { purchaseOrder, totals, pending, money, chargeLabel } = usePurchaseOrderView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
