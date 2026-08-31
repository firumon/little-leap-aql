<template>
  <div v-if="!pending && !declined">
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
              (items + {{ money(totals.charges) }} charges)
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
import { useQuotationView } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationView'
import { useQuotationViewContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationViewContext'

defineOptions({ name: 'SupplierQuotationsViewQuotationTotals', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Pricing Summary' }
})

const { evaluate, ui } = useQuotationViewContext()
const { totals, pending, declined, money, chargeLabel } = useQuotationView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
