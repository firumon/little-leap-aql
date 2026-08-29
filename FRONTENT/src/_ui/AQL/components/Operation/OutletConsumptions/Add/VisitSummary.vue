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
// Step 6a - read-only recap, straight off the nodes. Figures only, no controls: a
// decision stays editable only beside the evidence it was made against (§13.6).
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { netPayableOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { NODE, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddVisitSummary', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')
const { _C } = useCurrency()
const { getOutlet } = useOutletResource()

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const consumption = pageState.useNode(NODE.CONSUMPTION)
const returnsState = pageState.useNode(NODE.RETURNS)
const restock = pageState.useNode(NODE.RESTOCKS)
const invoice = pageState.useNode(NODE.INVOICES)

const visible = computed(() => stepVisible(pageState, props.step))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const outletCode = computed(() => text(consumption.node.value.record.OutletCode))
const outletName = computed(() => text(getOutlet(outletCode.value)?.name) || outletCode.value)

const soldRows = computed(() =>
  (consumption.children(NODE.ITEMS).value || []).filter((row) => num(row.Qty) > 0))
const returnRows = computed(() =>
  (returnsState.node.value.records || []).filter((row) => num(row.Qty) > 0))

// Blank rows are dropped rather than padded with em dashes — `Returns: —` states nothing
// while looking like it does (§7.4).
const summary = computed(() => {
  const header = invoice.node.value.record
  const credit = num(header.ReturnDeductionTotal)
  const restockTotal = (restock.children(NODE.RESTOCK_ITEMS).value || [])
    .reduce((sum, row) => sum + num(row.Quantity), 0)

  return [
    { label: 'Outlet', value: outletName.value },
    { label: 'Items sold', value: soldRows.value.length ? `${soldRows.value.length} line(s)` : '' },
    { label: 'Returns', value: returnRows.value.length ? `${returnRows.value.length} line(s)` : '' },
    { label: 'Invoice', value: invoice.exists.value && soldRows.value.length ? _C(netPayableOf(header)) : '' },
    { label: 'Credit applied', value: credit > 0 ? `− ${_C(credit)}` : '' },
    { label: 'Restock', value: restockTotal > 0 ? `${restockTotal} unit(s)` : '' }
  ].filter((line) => String(line.value).trim())
})
</script>
