<template>
  <div v-if="pendingReturns.length" :class="gutterClass">
    <SectionDividerLabel label="UNSETTLED RETURNS" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-caption text-grey-8 q-pb-sm">
          This outlet has returns that were meant to be credited and never were. Tick any
          to deduct from this invoice.
        </div>

        <q-list separator>
          <q-item v-for="row in pendingReturns" :key="row.code" v-ripple tag="label">
            <q-item-section side top>
              <q-checkbox
                :model-value="adjustedReturnCodes.includes(row.code)"
                @update:model-value="() => toggleAdjustedReturn(row.code)"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ row.name }}</q-item-label>
              <q-item-label caption>{{ row.variant }}</q-item-label>
              <q-item-label caption>{{ row.reason }} · {{ formatDate(row.date) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ row.qty }}</q-item-label>
              <q-item-label caption>{{ _C(row.value) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <template v-if="returnDeduction > 0">
          <q-separator class="q-my-md" />
          <div class="row justify-between text-subtitle1 text-weight-bold">
            <span>Credit against this invoice</span>
            <span class="text-negative">− {{ _C(returnDeduction) }}</span>
          </div>
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Returns from an earlier visit that never credited an invoice. Ticking one writes the
// credit onto the invoice node. No `<style>` block (ARCHITECTURE RULES §7).
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { NODE, CTRL, getCtrl, setCtrl } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddUnsettledReturns', inheritAttrs: false })

const props = defineProps({ gutter: { type: String, default: 'sm' } })

const { pageState, ui, resource } = useConsumptionAddContext()
const { _C } = useCurrency()
const { getSku } = useSkuResource()

const returns = resource(NODE.RETURNS)

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'

const gutterClass = computed(() => `q-gutter-y-${props.gutter}`)

const consumption = pageState.useNode(NODE.CONSUMPTION)
const invoice = pageState.useNode(NODE.INVOICES)

const outletCode = computed(() => text(consumption.node.value.record.OutletCode))

/** Returns raised at this outlet that were meant to credit an invoice and never did. */
const pendingReturns = computed(() => returns.items.value
  .filter((row) => isActive(row) &&
    text(row.OutletCode) === outletCode.value &&
    text(row.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(row.InvoiceAdjustmentDone) !== 'TRUE' &&
    text(row.Progress) !== 'CANCELLED')
  .map((row) => {
    const info = getSku(text(row.SKU)) || {}
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    return {
      code: text(row.Code),
      name: text(info.productName) || text(row.SKU),
      variant: variants || text(row.SKU),
      qty: num(row.Qty),
      value: num(row.Qty) * num(row.Price),
      reason: text(row.Reason),
      date: text(row.Date)
    }
  }))

const adjustedReturnCodes = computed(() => getCtrl(pageState, CTRL.ADJUSTED_RETURNS, []) || [])

const returnDeduction = computed(() => pendingReturns.value
  .filter((row) => adjustedReturnCodes.value.includes(row.code))
  .reduce((sum, row) => sum + row.value, 0))

// The credit is an invoice COLUMN, so it goes onto the invoice node. Step 3 and the recap
// then read it off the record instead of recalculating it.
function toggleAdjustedReturn (code) {
  const value = text(code)
  const current = adjustedReturnCodes.value
  setCtrl(pageState, CTRL.ADJUSTED_RETURNS,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value])
  if (invoice.exists.value) {
    pageState.setRecord('ReturnDeductionTotal', returnDeduction.value, NODE.INVOICES)
  }
}
</script>
