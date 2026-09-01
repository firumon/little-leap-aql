<template>
  <div>
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

    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletPayments › View › PaymentSummary — Section (tier CP: resource + page).
 *
 * The receipt itself: what was taken, from whom, when, how, and by whom.
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
 * Every value is read from the page context, which reads Layer 2. Nothing here sums a payment.
 * Cancelling is the `Cancel` additional action's own route, not a control on this card.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewPaymentSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payment' }
})

const {
  ui, money, record, outletName, isPaymentCancelled
} = useOutletPaymentViewContext()

const amount = computed(() => Number(record.value?.Amount ?? record.value?.amount) || 0)

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
