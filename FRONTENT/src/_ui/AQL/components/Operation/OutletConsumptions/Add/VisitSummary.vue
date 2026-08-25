<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Heading outside the card, matching every other step (§7.5). -->
    <SectionDividerLabel label="THIS VISIT" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div v-for="(line, i) in summary" :key="line.label" class="items-center"
               :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(i)">
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 6a — read-only recap. Figures only, no controls: a decision stays editable
// only beside the evidence it was made against (§13.6).
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useConsumptionWizard } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddVisitSummary', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard
const { _C } = useCurrency()

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

// Blank rows are dropped rather than padded with em dashes — `Returns: —` states nothing
// while looking like it does (§7.4).
const summary = computed(() => {
  const restockTotal = wizard.restockRows.value.reduce((sum, row) => sum + (Number(row.Quantity) || 0), 0)
  return [
    { label: 'Outlet', value: wizard.outletName.value },
    { label: 'Items sold', value: wizard.soldRows.value.length ? `${wizard.soldRows.value.length} line(s)` : '' },
    { label: 'Returns', value: wizard.returnRows.value.length ? `${wizard.returnRows.value.length} line(s)` : '' },
    { label: 'Invoice', value: wizard.generateInvoice.value && wizard.soldRows.value.length ? _C(wizard.invoiceTotal.value) : '' },
    { label: 'Credit applied', value: wizard.returnDeduction.value > 0 ? `− ${_C(wizard.returnDeduction.value)}` : '' },
    { label: 'Restock', value: restockTotal > 0 ? `${restockTotal} unit(s)` : '' }
  ].filter((line) => String(line.value).trim())
})
</script>
