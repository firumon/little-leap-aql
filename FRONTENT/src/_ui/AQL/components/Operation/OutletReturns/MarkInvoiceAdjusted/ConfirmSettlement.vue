<template>
  <div :class="gutterClass">
    <q-banner v-if="record && !eligible" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <SectionDividerLabel label="CREDIT OWED" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ skuName || '—' }}</div>
            <div class="text-caption text-grey-8">{{ outletName }}</div>
          </div>
          <div class="col-auto text-right">
            <div class="text-h6 text-weight-bold">{{ creditText }}</div>
            <div class="text-caption text-grey-8">{{ quantity }} units</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="eligible" dense rounded class="bg-blue-1 text-body2">
      <template #avatar><q-icon name="info" color="primary" /></template>
      {{ outcomeText }}
    </q-banner>
  </div>
</template>

<script setup>
/**
 * OutletReturns › MarkInvoiceAdjusted › ConfirmSettlement — the action route's content.
 *
 * For a credit settled OUTSIDE the invoice cycle: a cash refund, a manual credit note, an
 * adjustment agreed off-system. The ordinary path is an invoice crediting the return
 * automatically at finalisation (`buildReturnInvoiceAdjustmentLinkedBatch`); this route is
 * the exception, so it collects no input beyond the confirmation itself — there is nothing
 * to decide, only something to attest.
 *
 * ── WHY NO `ConsumptionInvoiceCode` IS WRITTEN ──
 * That column means "the invoice that credited this return". A settlement made outside the
 * invoice system has no such invoice, so the column stays blank and the View card reads
 * "Settled directly" rather than naming a bill that does not exist. The builder enforces
 * this; the card only says so.
 *
 * This card is the HYDRATION POINT (§5.5) — it preloads the master rows its context lines
 * need. It seeds no control fields, because the route collects none.
 *
 * Navigation and submission belong to the sticky bar (§8.3).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  canMarkInvoiceAdjusted,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted,
  isCancelled,
  returnValueOf
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

defineOptions({ name: 'OutletReturnsMarkInvoiceAdjustedConfirmSettlement', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { resourceRecord, resource, ui } = useReturnFormContext()

const outlets = resource('Outlets')
const skus = resource('SKUs')
const products = resource('Products')

const { getOutlet } = useOutletResource()
const { skuLabelText } = useSkuResource()
const { _C } = useCurrency()

const text = (value) => (value == null ? '' : String(value).trim())

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
// The one credit figure, from the one function the Index metric and the invoice deduction
// also read — so what the operator attests to matches what the outlet was owed.
const creditText = computed(() => _C(returnValueOf(record.value)))

const outcomeText = computed(() => {
  const row = record.value
  if (!row) return ''
  const stillOwed = warehouseActionRequired(row) && !warehouseActionCompleted(row)
  return stillOwed
    ? 'Marks the credit settled. The return stays open until the warehouse action is confirmed.'
    : 'Marks the credit settled. This closes the return.'
})

onMounted(async () => {
  await Promise.all([outlets, skus, products].map((res) => res.reload()))
})
</script>
