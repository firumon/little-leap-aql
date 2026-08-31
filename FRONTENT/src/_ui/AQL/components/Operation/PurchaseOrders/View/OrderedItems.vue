<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No lines</div>
        <div :class="ui.emptyCaptionClass">This purchase order carries no items.</div>
      </q-card-section>

      <q-card-section v-else>
        <div v-for="(line, index) in rows" :key="line.code" :class="ui.detailRowClass" :style="rowDelay(index)">
          <div class="row items-start no-wrap q-mb-xs">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
              <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
                {{ line.secondary }}
              </div>
              <div class="text-caption text-grey-7">
                {{ line.orderedQuantity }} {{ line.uom }} × {{ money(line.unitPrice) }}
              </div>
              <div class="text-caption text-grey-7">
                Received {{ line.receivedQuantity }} of {{ line.orderedQuantity }}
                <template v-if="line.outstanding"> • {{ line.outstanding }} outstanding</template>
              </div>
            </div>
            <div class="col-auto text-right">
              <div class="text-body2 text-weight-bold">{{ money(line.lineTotal) }}</div>
              <q-badge
                rounded
                outline
                class="q-mt-xs"
                :color="lineProgressColor(line.state)"
                :label="lineProgressLabel(line.state)"
              />
            </div>
          </div>
          <q-separator v-if="index < rows.length - 1" class="q-mb-sm" />
        </div>

        <q-separator class="q-my-sm" />
        <div class="row items-center justify-between text-weight-bold">
          <span>{{ fulfilment.received }} of {{ fulfilment.ordered }} received</span>
          <span>{{ money(totals.subtotal) }}</span>
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

defineOptions({ name: 'PurchaseOrdersViewOrderedItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Ordered Items' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = usePurchaseOrderViewContext()
const { lines, totals, fulfilment, pending, money, lineProgressColor, lineProgressLabel } = usePurchaseOrderView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
