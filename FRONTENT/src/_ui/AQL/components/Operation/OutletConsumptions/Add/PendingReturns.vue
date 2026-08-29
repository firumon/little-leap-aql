<template>
  <div v-if="visible && (returnRows.length || pendingReturns.length)" :class="gutterClass">

    <template v-if="returnRows.length">
      <SectionDividerLabel label="RETURNS FOUND TODAY" />

      <q-banner dense rounded class="bg-grey-2 text-body2">
        Each item needs a reason. Credit the outlet for it, send it back to a warehouse, or
        both — the two are independent.
      </q-banner>

      <q-card v-for="entry in returnRows" :key="entry.row.SKU" flat bordered :class="ui.cardClass">
        <q-card-section :class="gutterClass" class="q-mt-sm">
          <div class="row items-center no-wrap" :class="gutterClass">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle2 text-weight-medium">{{ skuLabel(entry.row.SKU).primary }}</div>
              <div class="text-caption text-grey-7">{{ skuLabel(entry.row.SKU).secondary }}</div>
            </div>
            <div class="col-auto">
              <q-chip square color="orange" text-color="white" :label="`Return: ${entry.row.Qty}`" class="q-ma-none" />
            </div>
          </div>

          <component
            :is="SelectField"
            :model-value="entry.row.Reason"
            :record="entry.row"
            :config="{ label: 'Reason', options: REASON_OPTIONS, clearable: false }"
            header="Reason"
            @update:model-value="(v) => setField(entry.index, 'Reason', v)"
          />

          <component
            :is="TextareaField"
            :model-value="entry.row.ReasonComment"
            :record="entry.row"
            :config="{ label: 'Remarks (optional)', hideBottomSpace: true }"
            header="ReasonComment"
            @update:model-value="(v) => setField(entry.index, 'ReasonComment', v)"
          />

          <component
            :is="SelectField"
            :model-value="entry.row.SourceInvoiceCode"
            :record="entry.row"
            :config="{
              label: 'Billed on invoice (optional)',
              options: sourceInvoiceOptions(entry.row.SKU),
              clearable: true
            }"
            header="SourceInvoiceCode"
            @update:model-value="(v) => setSourceInvoice(entry.index, entry.row.SKU, v)"
          />

          <component
            :is="CurrencyField"
            :model-value="entry.row.Price"
            :record="entry.row"
            :config="{ label: 'Credit price', inputClass: 'text-right text-weight-bold' }"
            header="Price"
            @update:model-value="(v) => setField(entry.index, 'Price', num(v))"
          />

          <div class="row items-center no-wrap q-mt-sm q-px-sm ">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">Credit against the invoice</div>
              <div class="text-caption text-grey-8">
                Deducts this item's value from what the outlet is billed.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle
                :model-value="isTrue(entry.row.InvoiceAdjustmentRequired)"
                color="primary"
                :aria-label="`Credit ${skuLabel(entry.row.SKU).primary} against the invoice`"
                @update:model-value="(v) => setFlag(entry.index, 'InvoiceAdjustmentRequired', v)"
              />
            </div>
          </div>

          <div class="row items-center no-wrap q-my-sm q-px-sm ">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">Send back to a warehouse</div>
              <div class="text-caption text-grey-8">
                The stock physically leaves the outlet. Leave off to write it off on site.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle
                :model-value="isTrue(entry.row.WarehouseActionRequired)"
                color="purple"
                :aria-label="`Send ${skuLabel(entry.row.SKU).primary} back to a warehouse`"
                @update:model-value="(v) => setWarehouseAction(entry.index, v)"
              />
            </div>
          </div>

          <!-- Required, and only shown when it can be answered: a target warehouse on a
               return that is not being shipped anywhere is a field with no meaning. -->
          <component
            v-if="isTrue(entry.row.WarehouseActionRequired)"
            :is="SelectField"
            :model-value="entry.row.WarehouseCode"
            :record="entry.row"
            :config="{ label: 'Target warehouse', options: warehouseOptions, clearable: false }"
            header="WarehouseCode"
            @update:model-value="(v) => setField(entry.index, 'WarehouseCode', v)"
          />

          <!-- The ledger effect of the four toggle pairs is genuinely surprising, and two
               of them move no stock at all, so each line states its own. -->
          <q-banner dense rounded :class="outcomeClass(entry.row)">
            {{ outcomeText(entry.row) }}
          </q-banner>
        </q-card-section>
      </q-card>
    </template>

    <template v-if="pendingReturns.length">
      <SectionDividerLabel label="UNSETTLED RETURNS" />
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="text-caption text-grey-8 q-pb-sm">
            This outlet has returns that were meant to be credited and never were. Tick any
            to deduct from this invoice.
          </div>

          <q-list separator>
            <q-item v-for="row in pendingReturns" :key="row.code" tag="label" v-ripple>
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
    </template>
  </div>
</template>

<script setup>
// Step 5 - return management, in two sections: the surpluses this count produced, each
// needing its routing decided, and returns from an earlier visit that never credited an
// invoice. Every field of a today's-return binds straight to its OutletReturns record.
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  RETURN_REASONS,
  returnQtyChange,
  returnProgressFor,
  priceOf,
  priceListForOutlet
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { NODE, CTRL, getCtrl, setCtrl, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddPendingReturns', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

// Hoisted: an inline literal would re-run the select's resolvers on every render.
const REASON_OPTIONS = RETURN_REASONS.map((reason) => ({
  value: reason,
  label: reason.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}))

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')
const { _C } = useCurrency()
const { hasRegionAccess } = useAuth()
const { getSku } = useSkuResource()
const warehouses = useRecord('Warehouses')
const returns = useRecord(NODE.RETURNS)
const invoices = useRecord(NODE.INVOICES)
const invoiceItems = useRecord(NODE.INVOICE_ITEMS)

const SelectField = resolveFieldComponent('select', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const isTrue = (value) => text(value).toUpperCase() === 'TRUE'
const flag = (value) => (value === true ? 'TRUE' : 'FALSE')
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'

const consumption = pageState.useNode(NODE.CONSUMPTION)
const returnsState = pageState.useNode(NODE.RETURNS)
const invoice = pageState.useNode(NODE.INVOICES)

const visible = computed(() => stepVisible(pageState, props.step))

const outletCode = computed(() => text(consumption.node.value.record.OutletCode))

/** The surpluses this visit counted, each with its index on the OutletReturns many-node. */
const returnRows = computed(() => (returnsState.node.value.records || [])
  .map((row, index) => ({ row, index }))
  .filter((entry) => num(entry.row.Qty) > 0))

function skuLabel (sku) {
  const info = getSku(text(sku)) || {}
  const variants = (info.variantValues || []).filter(Boolean).join(' / ')
  return { primary: text(info.productName) || text(sku), secondary: variants || text(sku) }
}

// ── Direct binding onto the OutletReturns records ────────────────────────────

const setField = (index, key, value) => pageState.setRecords(index, key, value, NODE.RETURNS)

// The sheet stores the two flags as strings, never as native booleans.
const setFlag = (index, key, value) => setField(index, key, flag(value === true))

// `hasRegionAccess`, not a flat equality test: it also honours universe-scoped users.
const warehouseOptions = computed(() => warehouses.items.value
  .filter((row) => isActive(row) && hasRegionAccess(row.AccessRegion))
  .map((row) => ({ value: text(row.Code), label: text(row.Name) || text(row.Code) })))

/** Indexed once, not scanned per render pass (CORE_ARCHITECTURE_RULES §6). */
const warehouseNameByCode = computed(() =>
  new Map(warehouseOptions.value.map((option) => [option.value, option.label])))

const warehouseName = (code) => warehouseNameByCode.value.get(text(code)) || 'a warehouse'

// On seeds the only sensible target; off clears it, so a stale code cannot ride along on
// a return that is staying put.
function setWarehouseAction (index, value) {
  const on = value === true
  const current = text(pageState.getRecords(index, 'WarehouseCode', NODE.RETURNS))
  setFlag(index, 'WarehouseActionRequired', on)
  setField(index, 'WarehouseCode', on ? (current || warehouseOptions.value[0]?.value || '') : '')
}

// ── The source invoice, and the price it billed ─────────────────────────────

const priceListCode = computed(() => text(priceListForOutlet(outletCode.value)?.code))

const defaultPriceOf = (sku) => num(priceOf(sku, priceListCode.value))

/** Past invoice lines for this outlet, grouped by SKU. Indexed once, not scanned per row. */
const invoiceLinesBySku = computed(() => {
  const headers = new Map(invoices.items.value
    .filter((row) => text(row.OutletCode) === outletCode.value)
    .map((row) => [text(row.Code), row]))

  return invoiceItems.items.value.reduce((map, item) => {
    const header = headers.get(text(item.OutletConsumptionInvoiceCode))
    const sku = text(item.SKU)
    if (!header || !sku) return map
    const label = `${formatDate(header.Date)} · ${text(header.Username)} · ` +
      `${num(item.Qty)} pcs (@${_C(num(item.Price))}) · Inv ${_C(num(header.Total || header.Subtotal))}`
    const list = map.get(sku) || []
    list.push({ value: text(header.Code), label, price: num(item.Price) })
    map.set(sku, list)
    return map
  }, new Map())
})

const sourceInvoiceOptions = (sku) => invoiceLinesBySku.value.get(text(sku)) || []

// Picking an invoice credits the return at what the outlet actually paid; clearing it
// falls back to the outlet's price list, never to a stale invoice rate.
function setSourceInvoice (index, sku, code) {
  const value = text(code)
  setField(index, 'SourceInvoiceCode', value)
  const picked = sourceInvoiceOptions(sku).find((option) => option.value === value)
  setField(index, 'Price', picked ? picked.price : defaultPriceOf(sku))
}

// ── The outcome banner ──────────────────────────────────────────────────────

const metaOf = (row) => ({
  InvoiceAdjustmentRequired: isTrue(row.InvoiceAdjustmentRequired),
  WarehouseActionRequired: isTrue(row.WarehouseActionRequired),
  WarehouseCode: text(row.WarehouseCode)
})

/** The plain-language outcome of the current toggle pair, from Layer 2's table. */
function outcomeText (row) {
  const meta = metaOf(row)
  const change = returnQtyChange(1, meta)
  const progress = returnProgressFor(meta)
  const credited = meta.InvoiceAdjustmentRequired ? 'credited on the invoice' : 'not credited'
  // The warehouse's NAME, never its code — a raw `WH001` is opaque to the reader (§7.2).
  const destination = meta.WarehouseActionRequired
    ? `shipped to ${warehouseName(meta.WarehouseCode)}`
    : 'left at the outlet'
  const ledger = change > 0
    ? 'Outlet stock goes up.'
    : (change < 0 ? 'Outlet stock goes down.' : 'Outlet stock is unchanged.')
  return `${capitalise(destination)}, ${credited}. ${ledger} Marked ${progress.replace(/_/g, ' ').toLowerCase()}.`
}

/** Warning-tinted only when nothing at all happens — the one pair worth querying. */
function outcomeClass (row) {
  const meta = metaOf(row)
  const inert = !meta.InvoiceAdjustmentRequired && !meta.WarehouseActionRequired
  return inert ? 'bg-orange-1 text-body2' : 'bg-grey-2 text-body2'
}

const capitalise = (value) => String(value).replace(/^\w/, (c) => c.toUpperCase())

// ── Unsettled returns from earlier visits ───────────────────────────────────

/** Returns raised at this outlet that were meant to credit an invoice and never did. */
const pendingReturns = computed(() => returns.items.value
  .filter((row) => isActive(row) &&
    text(row.OutletCode) === outletCode.value &&
    text(row.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(row.InvoiceAdjustmentDone) !== 'TRUE' &&
    text(row.Progress) !== 'CANCELLED')
  .map((row) => {
    const label = skuLabel(row.SKU)
    return {
      code: text(row.Code),
      name: label.primary,
      variant: label.secondary,
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
