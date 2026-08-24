<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="RECEIPT" />

    <q-card flat bordered :class="ui.cardClass">
      <!-- THE ONE NUMBER THIS PAGE EXISTS FOR. Centred and oversized on purpose: everything
           else on the step is an input to it, and a collector confirming a receipt on a phone
           in an outlet needs it legible at arm's length. -->
      <q-card-section class="text-center q-py-md">
        <div class="text-caption text-grey-7 text-uppercase">Amount collected</div>
        <div class="text-h4 text-weight-bolder text-primary">{{ money(amount) }}</div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in details" :key="line.key" class="aql-detail-line">
            <div class="aql-detail-key">{{ line.label }}</div>
            <div class="aql-detail-val">{{ line.value }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="WHAT THIS SETTLES" />

    <q-card flat bordered :class="ui.cardClass">
      <q-list separator>
        <q-item v-for="line in receiptLines" :key="line.code">
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-weight-medium">{{ line.code }}</q-item-label>
            <q-item-label caption>
              {{ line.date }} · {{ money(line.balance) }} owed before this payment
            </q-item-label>
            <q-item-label v-if="line.waived" caption class="text-orange-9">
              {{ money(line.remaining) }} written off
            </q-item-label>
            <q-item-label v-else-if="line.remaining > 0.01" caption>
              {{ money(line.remaining) }} still outstanding after this payment
            </q-item-label>
          </q-item-section>

          <q-item-section side class="text-right">
            <q-item-label class="text-weight-bold">{{ money(line.applied) }}</q-item-label>
            <q-item-label caption :class="line.settled ? 'text-positive' : 'text-grey-8'">
              {{ line.outcome }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <template v-if="waiveResidual && residualBalance > 0">
      <SectionDividerLabel label="WRITE-OFF" />

      <q-banner dense rounded class="bg-orange-1 text-orange-10">
        <template #avatar>
          <q-icon name="price_check" color="orange-9" />
        </template>
        <div class="text-weight-bold">
          {{ money(residualBalance) }} will be written off and the invoices marked fully paid.
        </div>
        <div class="text-caption q-mt-xs">
          &ldquo;{{ waiverComment || waiverAuditComment }}&rdquo;
        </div>
      </q-banner>
    </template>
  </div>
</template>

<script setup>
/**
 * OutletPayments › Add › Step 3 — the receipt as it will be written.
 *
 * ── WHY THIS STEP EXISTS AT ALL ──
 * A collection is irreversible in practice: undoing one means a cancellation receipt and a
 * reverted invoice, both of which stay on the record. So the last thing before committing is a
 * statement of what will happen — not a summary of what was typed, which the user just typed
 * and does not need repeated.
 *
 * The line that earns the step is `outcome`: which invoices this payment CLOSES. It is derived
 * in the page context from the same allocation-versus-balance comparison
 * `buildOutletPaymentCreationRequests` uses to choose between `MarkPaid` and
 * `MarkPartiallyPaid`, so the transition shown and the transition written are one decision.
 *
 * The collector and the date are shown though nobody typed them, because they are stamped onto
 * every row and a receipt that does not say who took the money is not a receipt.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

defineOptions({ name: 'OutletPaymentsAddPaymentReview', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 3 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui, money, amount, mode, reference, outletCode, outletNameOf,
  receiptLines, collectorName, collectionDate,
  waiveResidual, residualBalance, waiverComment, waiverAuditComment,
  step: currentStep
} = useOutletPaymentAddContext()

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

const details = computed(() => {
  const lines = [
    { key: 'outlet', label: 'Outlet', value: outletNameOf(outletCode.value) },
    { key: 'date', label: 'Date', value: collectionDate.value },
    { key: 'mode', label: 'Mode', value: mode.value },
    { key: 'collector', label: 'Collected by', value: collectorName.value }
  ]
  // The reference is omitted rather than shown blank: it is optional, and an empty row on a
  // receipt reads as a value that failed to load.
  if (reference.value) lines.push({ key: 'reference', label: 'Reference', value: reference.value })
  return lines
})
</script>
