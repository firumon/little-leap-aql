<template>
  <div :class="spacingClass">
    <!-- THE EXCEPTION, FIRST. A cancelled receipt still shows an amount, and an amount reads
         as collected money until the reversal is stated beside it. -->
    <q-banner v-if="isPaymentCancelled" dense rounded class="bg-red-1 text-red-10 q-mb-sm">
      <template #avatar>
        <q-icon name="block" color="negative" />
      </template>
      <div class="text-weight-bold">This receipt was cancelled — no money is credited by it.</div>
      <div v-if="record?.ProgressCancelledComment" class="text-caption q-mt-xs">
        &ldquo;{{ record.ProgressCancelledComment }}&rdquo;
      </div>
      <div v-if="record?.ProgressCancelledBy" class="text-caption text-grey-8 q-mt-xs">
        {{ record.ProgressCancelledBy }}<span v-if="record.ProgressCancelledAt"> &bull; {{ record.ProgressCancelledAt }}</span>
      </div>
    </q-banner>

    <SectionDividerLabel label="Payment" />

    <q-card :class="ui.cardClass">
      <!-- THE ONE NUMBER THIS PAGE EXISTS FOR. Centred and oversized on purpose: every other
           figure here is context for it. -->
      <q-card-section class="text-center q-py-md">
        <div class="text-caption text-grey-7 text-uppercase">Amount collected</div>
        <div class="text-h4 text-weight-bolder" :class="isPaymentCancelled ? 'text-grey-6' : 'text-positive'">
          {{ money(amount) }}
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">{{ record?.Code || record?.code }}</div>
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

<!--
      <template v-if="canCancel">
        <q-separator />
        <q-card-section class="row justify-end q-py-sm">
          <q-btn
            flat no-caps
            color="negative"
            icon="block"
            label="Cancel payment receipt"
            :disable="saving"
            @click="openCancelDialog"
          />
        </q-card-section>
      </template>
-->
    </q-card>

    <!-- REASON IS MANDATORY, and the button stays disabled until one is given. A cancellation
         moves an invoice's balance back up; whoever reconciles that figure tomorrow has only
         this sentence to explain it. -->
    <q-dialog v-model="cancelDialogOpen" persistent>
      <q-card style="min-width: 320px; max-width: 480px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">Cancel this receipt?</div>
          <div class="text-caption text-grey-8 q-mt-xs">
            The payment is reversed and the credited invoice's balance is recalculated. Both
            happen together and neither can be undone from here.
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="cancelComment"
            outlined
            autogrow
            type="textarea"
            label="Reason"
            hint="At least 3 characters."
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Keep it" v-close-popup :disable="saving" />
          <q-btn
            unelevated no-caps
            color="negative"
            label="Cancel receipt"
            :loading="saving"
            :disable="reasonTooShort"
            @click="confirmCancel"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
/**
 * OutletPayments › View › PaymentSummary — Section (tier CP: resource + page).
 *
 * The receipt itself: what was taken, from whom, when, how, and by whom — plus the one action
 * this page can still perform on it.
 *
 * ── WHY THE CANCELLATION BANNER LEADS ──
 * It is the only element that CONTRADICTS what the rest of the page implies. A cancelled
 * receipt still carries an amount and still names an invoice, so read top-down without the
 * banner it looks like money that was collected. It renders nothing in every ordinary case, so
 * nothing is displaced when there is no cancellation.
 *
 * The card carries NO title and NO icon of its own — the divider above it is where the section
 * is named, once (UI_MODULE_DEVELOPER_GUIDE.md §10). The detail rows use the canonical
 * `.aql-detail-*` grid rather than a hand-built row/col.
 *
 * Every value is read from the page context, which reads Layer 2. Nothing here sums a payment
 * or decides whether a receipt may be cancelled — `canCancelPayment` owns that, so the button
 * and the request builder cannot disagree about it (ARCHITECTURE RULES §6).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewPaymentSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payment' },
  padding: { type: String, default: 'sm' }
})

const {
  ui, money, record, outletName, isPaymentCancelled, saving,
  canCancel, cancelDialogOpen, cancelComment, openCancelDialog, confirmCancel
} = useOutletPaymentViewContext()

const spacingClass = computed(() => `q-px-${props.padding}`)

const amount = computed(() => Number(record.value?.Amount ?? record.value?.amount) || 0)

const reasonTooShort = computed(() => String(cancelComment.value || '').trim().length < 3)

const details = computed(() => {
  const entry = record.value || {}
  const lines = [
    { key: 'outlet', label: 'Outlet', value: outletName.value },
    { key: 'date', label: 'Date', value: entry.Date || entry.date || '—' },
    { key: 'mode', label: 'Mode', value: entry.Mode || entry.mode || '—' },
    { key: 'user', label: 'Collected by', value: entry.Username || entry.username || '—' }
  ]
  // Omitted rather than shown blank: it is optional, and an empty row on a receipt reads as a
  // value that failed to load.
  const reference = String(entry.Reference || entry.reference || '').trim()
  if (reference) lines.push({ key: 'reference', label: 'Reference', value: reference })
  return lines
})
</script>
