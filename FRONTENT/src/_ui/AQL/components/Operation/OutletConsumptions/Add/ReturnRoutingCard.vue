<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section :class="gutterClass" class="q-mt-sm">
      <div class="row items-center no-wrap" :class="gutterClass">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle2 text-weight-medium">{{ label.primary }}</div>
          <div class="text-caption text-grey-7">{{ label.secondary }}</div>
        </div>
        <div class="col-auto">
          <q-chip square color="orange" text-color="white" :label="`Return: ${row.Qty}`" class="q-ma-none" />
        </div>
      </div>

      <component
        :is="SelectField"
        :model-value="row.Reason"
        :record="row"
        :config="{ label: 'Reason', options: REASON_OPTIONS, clearable: false }"
        header="Reason"
        @update:model-value="(v) => setField('Reason', v)"
      />

      <component
        :is="TextareaField"
        :model-value="row.ReasonComment"
        :record="row"
        :config="{ label: 'Remarks (optional)', hideBottomSpace: true }"
        header="ReasonComment"
        @update:model-value="(v) => setField('ReasonComment', v)"
      />

      <component
        :is="SelectField"
        :model-value="row.SourceInvoiceCode"
        :record="row"
        :config="{ label: 'Billed on invoice (optional)', options: invoiceOptions, clearable: true }"
        header="SourceInvoiceCode"
        @update:model-value="setSourceInvoice"
      />

      <component
        :is="CurrencyField"
        :model-value="row.Price"
        :record="row"
        :config="{ label: 'Credit price', inputClass: 'text-right text-weight-bold' }"
        header="Price"
        @update:model-value="(v) => setField('Price', num(v))"
      />

      <div class="row items-center no-wrap q-mt-sm q-px-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-body2 text-weight-medium">Credit against the invoice</div>
          <div class="text-caption text-grey-8">
            Deducts this item's value from what the outlet is billed.
          </div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="isTrue(row.InvoiceAdjustmentRequired)"
            color="primary"
            :aria-label="`Credit ${label.primary} against the invoice`"
            @update:model-value="(v) => setFlag('InvoiceAdjustmentRequired', v)"
          />
        </div>
      </div>

      <div class="row items-center no-wrap q-my-sm q-px-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-body2 text-weight-medium">Send back to a warehouse</div>
          <div class="text-caption text-grey-8">
            The stock physically leaves the outlet. Leave off to write it off on site.
          </div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="isTrue(row.WarehouseActionRequired)"
            color="purple"
            :aria-label="`Send ${label.primary} back to a warehouse`"
            @update:model-value="setWarehouseAction"
          />
        </div>
      </div>

      <!-- Only shown when it can be answered: a target warehouse on a return that is not
           being shipped anywhere is a field with no meaning. -->
      <component
        v-if="isTrue(row.WarehouseActionRequired)"
        :is="SelectField"
        :model-value="row.WarehouseCode"
        :record="row"
        :config="{ label: 'Target warehouse', options: warehouseOptions, clearable: false }"
        header="WarehouseCode"
        @update:model-value="(v) => setField('WarehouseCode', v)"
      />

      <q-banner dense rounded :class="outcomeClass">
        {{ outcomeText }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup>
// One surplus line, and the routing decision it needs. Writes ONE column per interaction
// onto its own OutletReturns record. No `<style>` block (ARCHITECTURE RULES §7).
import { computed } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  RETURN_REASONS,
  returnQtyChange,
  returnProgressFor
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddReturnRoutingCard', inheritAttrs: false })

const props = defineProps({
  row: { type: Object, required: true },
  index: { type: Number, required: true },
  warehouseOptions: { type: Array, default: () => [] },
  invoiceOptions: { type: Array, default: () => [] },
  defaultPrice: { type: Number, default: 0 },
  gutter: { type: String, default: 'sm' }
})

// Hoisted: an inline literal would re-run the select's resolvers on every render.
const REASON_OPTIONS = RETURN_REASONS.map((reason) => ({
  value: reason,
  label: reason.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}))

const { pageState, ui } = useConsumptionAddContext()
const { getSku } = useSkuResource()

const SelectField = resolveFieldComponent('select', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const isTrue = (value) => text(value).toUpperCase() === 'TRUE'
const flag = (value) => (value === true ? 'TRUE' : 'FALSE')
const capitalise = (value) => String(value).replace(/^\w/, (c) => c.toUpperCase())

const gutterClass = computed(() => `q-gutter-y-${props.gutter}`)

const label = computed(() => {
  const info = getSku(text(props.row.SKU)) || {}
  const variants = (info.variantValues || []).filter(Boolean).join(' / ')
  return { primary: text(info.productName) || text(props.row.SKU), secondary: variants || text(props.row.SKU) }
})

const setField = (key, value) => pageState.setRecords(props.index, key, value, NODE.RETURNS)

// The sheet stores the two flags as strings, never as native booleans.
const setFlag = (key, value) => setField(key, flag(value === true))

// On seeds the only sensible target; off clears it, so a stale code cannot ride along on
// a return that is staying put.
function setWarehouseAction (value) {
  const on = value === true
  const current = text(pageState.getRecords(props.index, 'WarehouseCode', NODE.RETURNS))
  setFlag('WarehouseActionRequired', on)
  setField('WarehouseCode', on ? (current || props.warehouseOptions[0]?.value || '') : '')
}

// Picking an invoice credits the return at what the outlet actually paid; clearing it
// falls back to the outlet's price list, never to a stale invoice rate.
function setSourceInvoice (code) {
  const value = text(code)
  setField('SourceInvoiceCode', value)
  const picked = props.invoiceOptions.find((option) => option.value === value)
  setField('Price', picked ? picked.price : props.defaultPrice)
}

const warehouseName = computed(() => {
  const found = props.warehouseOptions.find((option) => option.value === text(props.row.WarehouseCode))
  return found?.label || 'a warehouse'
})

const meta = computed(() => ({
  InvoiceAdjustmentRequired: isTrue(props.row.InvoiceAdjustmentRequired),
  WarehouseActionRequired: isTrue(props.row.WarehouseActionRequired),
  WarehouseCode: text(props.row.WarehouseCode)
}))

// The plain-language outcome of the toggle pair, from Layer 2's table.
const outcomeText = computed(() => {
  const change = returnQtyChange(1, meta.value)
  const progress = returnProgressFor(meta.value)
  const credited = meta.value.InvoiceAdjustmentRequired ? 'credited on the invoice' : 'not credited'
  // The warehouse's NAME, never its code — a raw `WH001` is opaque to the reader (§7.2).
  const destination = meta.value.WarehouseActionRequired
    ? `shipped to ${warehouseName.value}`
    : 'left at the outlet'
  const ledger = change > 0
    ? 'Outlet stock goes up.'
    : (change < 0 ? 'Outlet stock goes down.' : 'Outlet stock is unchanged.')
  return `${capitalise(destination)}, ${credited}. ${ledger} Marked ${progress.replace(/_/g, ' ').toLowerCase()}.`
})

/** Warning-tinted only when nothing at all happens — the one pair worth querying. */
const outcomeClass = computed(() => {
  const inert = !meta.value.InvoiceAdjustmentRequired && !meta.value.WarehouseActionRequired
  return inert ? 'bg-orange-1 text-body2' : 'bg-grey-2 text-body2'
})
</script>
