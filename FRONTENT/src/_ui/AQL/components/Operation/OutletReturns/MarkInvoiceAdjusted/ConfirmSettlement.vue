<template>
  <div :class="gutterClass">
    <q-banner v-if="record && !eligible" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <SectionDividerLabel label="Credit To Outlet" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ skuName || '—' }}</div>
            <div class="text-caption text-grey-8">{{ outletName }}</div>
          </div>
          <div class="col-auto text-right no-wrap">
            <div class="text-h6 text-weight-bold">{{ creditText }}</div>
            <div class="text-caption text-grey-8">{{ quantity }} {{ uomCode }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <template v-if="eligible">
      <SectionDividerLabel label="INVOICE MATCH" />

      <q-card v-if="matchedInvoice" flat bordered :class="ui.cardClass">
        <q-item v-ripple clickable @click="openInvoice">
          <q-item-section avatar>
            <q-icon name="check_circle" color="positive" />
          </q-item-section>
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-subtitle1 text-weight-medium">{{ matchedInvoice.Code }}</q-item-label>
            <q-item-label caption>{{ matchedCaption }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-icon name="chevron_right" color="grey-6" /></q-item-section>
        </q-item>
      </q-card>

      <q-banner v-else-if="isCancelledMatch" dense rounded class="bg-red-1 text-body2">
        <template #avatar><q-icon name="dangerous" color="negative" /></template>
        The invoice that carried this return was cancelled ({{ cancelledCodes }}). Nothing
        credits it any more. Please raise a new consumption invoice and attach this return.
      </q-banner>

      <q-banner v-else dense rounded class="bg-orange-1 text-body2">
        <template #avatar><q-icon name="warning" color="warning" /></template>
        No consumption invoice lists this return. Please raise one and attach this return so
        the credit is traceable.
      </q-banner>

      <q-banner dense rounded :class="outcomeClass">
        <template #avatar><q-icon :name="outcomeIcon" :color="outcomeColor" /></template>
        {{ outcomeText }}
      </q-banner>
    </template>
  </div>
</template>

<script setup>
// One settlement channel for all three cases: a live invoice carries this return, only a
// cancelled one did, or none does. The last two still allow a direct attestation, which
// writes no invoice link. No `<style>` block (ARCHITECTURE RULES §7).
import { computed, onMounted, watch, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { buildReturnMarkInvoiceAdjustedInitNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import {
  canMarkInvoiceAdjusted,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted,
  isCancelled,
  returnValueOf,
  matchReturnInvoice,
  INVOICE_MATCH_ACTIVE,
  INVOICE_MATCH_CANCELLED
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

defineOptions({ name: 'OutletReturnsMarkInvoiceAdjustedConfirmSettlement', inheritAttrs: false })

const NODE = 'OutletReturns'
const INVOICE_SLUG = 'outlet-consumption-invoices'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, resourceRecord, resource, ui } = useReturnFormContext()

const outlets = resource('Outlets')
const skus = resource('SKUs')
const products = resource('Products')
const invoices = resource('OutletConsumptionInvoices')

const { getOutlet } = useOutletResource()
const { skuLabelText, skuLabelOf } = useSkuResource()
const { _C } = useCurrency()
const nav = useResourceNav()

const text = (value) => (value == null ? '' : String(value).trim())

const node = pageState.useNode(NODE)
const record = computed(() => resourceRecord?.record?.value || null)
const eligible = computed(() => !!record.value && canMarkInvoiceAdjusted(record.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This return was cancelled — there is no credit to settle.'
  if (!invoiceAdjustmentRequired(row)) return 'This return carries no credit to the outlet, so there is nothing to settle.'
  if (invoiceAdjustmentDone(row)) return 'The credit on this return has already been settled.'
  return 'This return no longer needs an invoice adjustment.'
})

const outletName = computed(() => {
  const code = text(record.value?.OutletCode)
  if (!code) return ''
  return text(getOutlet(code)?.Name) || code
})

const skuName = computed(() => {
  const code = text(record.value?.SKU)
  if (!code) return ''
  return text(skuLabelText(code)) || code
})

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))

// The SKU's own unit of measure, from the one function that names a SKU anywhere.
const uomCode = computed(() => skuLabelOf(text(record.value?.SKU)).uom)
// The one credit figure, from the one function the Index metric and the invoice deduction
// also read — so what the operator attests to matches what the outlet was owed.
const creditText = computed(() => _C(returnValueOf(record.value)))

const match = computed(() => matchReturnInvoice(record.value, invoices.items.value))
const matchedInvoice = computed(() => (match.value.scenario === INVOICE_MATCH_ACTIVE ? match.value.invoice : null))
const isCancelledMatch = computed(() => match.value.scenario === INVOICE_MATCH_CANCELLED)
const cancelledCodes = computed(() => match.value.cancelledInvoices.map((row) => text(row.Code)).join(', '))

const matchedCaption = computed(() => {
  const row = matchedInvoice.value
  if (!row) return ''
  return [text(row.Date), text(row.Username)].filter(Boolean).join(' • ')
})

const outcomeText = computed(() => {
  const row = record.value
  if (!row) return ''
  const stillOwed = warehouseActionRequired(row) && !warehouseActionCompleted(row)
  const closing = stillOwed
    ? 'The return stays open until the warehouse action is confirmed.'
    : 'This closes the return.'
  return matchedInvoice.value
    ? `Confirming links this credit to ${text(matchedInvoice.value.Code)} and marks it settled. ${closing}`
    : `Confirming attests the credit was settled outside the invoice cycle. No invoice is recorded against it. ${closing}`
})

const outcomeColor = computed(() => (matchedInvoice.value ? 'primary' : 'warning'))
const outcomeIcon = computed(() => (matchedInvoice.value ? 'info' : 'gpp_maybe'))
const outcomeClass = computed(() => (matchedInvoice.value ? 'bg-blue-1 text-body2' : 'bg-orange-1 text-body2'))

function openInvoice () {
  const code = text(matchedInvoice.value?.Code)
  if (code) nav.goTo('view', { code, resourceSlug: INVOICE_SLUG })
}

// The link the submit will write is a COLUMN, so it lives on the live node — the sticky bar
// reads it back rather than re-running the match itself.
watch(matchedInvoice, (invoice) => {
  if (pageState.hasNode(NODE)) pageState.setRecord('ConsumptionInvoiceCode', text(invoice?.Code), NODE)
}, { immediate: true })

// The settlement itself is mounted by Layer 2; this card only supplies the invoice link.
// Keyed on the record LANDING, because the page contract's `ready` has already flushed
// whatever the previous page left behind.
watch(record, (row) => {
  const code = text(row?.Code)
  // The contract's `ready` already flushed the previous page, so a plain attach is enough —
  // a second `reset` here would detach the nodes this same pass is about to create.
  if (!code || pageState.hasNode(NODE)) return
  pageState.initResource(NODE, { isPrimaryKey: true, code })
  pageState.applyNodes(buildReturnMarkInvoiceAdjustedInitNodes({ record: row }))
}, { immediate: true })

onMounted(async () => {
  await Promise.all([outlets, skus, products, invoices].map((res) => res.reload()))
})
</script>
