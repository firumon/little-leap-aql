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
        <div :class="ui.emptyTitleClass">No items</div>
        <div :class="ui.emptyCaptionClass">This goods receipt posted nothing to stock.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in rows"
            :key="line.code"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">
              {{ line.primary }}
              <span v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6 block">
                {{ line.secondary }}
              </span>
            </span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.quantity }} {{ line.uom }}
            </span>
          </div>
        </div>

        <q-separator class="q-my-sm" />
        <div class="row items-center justify-between text-weight-bold">
          <span>{{ totals.lines }} lines</span>
          <span>{{ totals.quantity }} units</span>
        </div>

        <q-banner v-if="movements.length" dense rounded class="bg-grey-2 q-mt-sm text-caption">
          {{ movements.length }} stock movements were written against this receipt.
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

defineOptions({ name: 'GoodsReceiptsViewReceiptItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Received Items' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useGoodsReceiptViewContext()
const { lines, totals, movements, pending } = useGoodsReceiptView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
