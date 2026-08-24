<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <AqlList
      :items="rows"
      item-key="key"
      empty-text="No payments recorded yet."
      empty-icon="payments"
      :item-bordered="true"
      label="label"
      caption="caption"
      icon="icon"
      :meta-label="paymentAmount"
    />

    <q-card v-if="showTotals" :class="[ui.cardClass, 'q-mt-sm']">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div class="aql-detail-line">
            <div class="aql-detail-key">Received</div>
            <div class="aql-detail-val text-positive">{{ money(collected) }}</div>
          </div>
          <!-- The middle term. Without it the two figures below simply fail to add up to the
               bill, and the reader is left to guess where the difference went. -->
          <div v-if="settledOff > 0" class="aql-detail-line">
            <div class="aql-detail-key">{{ settledLabel }}</div>
            <div class="aql-detail-val text-negative">{{ money(settledOff) }}</div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Remaining</div>
            <div class="aql-detail-val" :class="balance > 0 ? 'text-negative' : 'text-positive'">
              {{ money(balance) }}
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › InvoicePayments — Section (tier CP: resource + page).
 *
 * Every payment recorded against this invoice, and what they add up to against what is
 * owed. The mode and reference ride in the caption because a collector chasing a bounced
 * cheque needs the cheque number, and it is the only place it exists.
 *
 * The rows come from the page context's aggregate — the same payment set the balance above
 * was computed from — so the list and the "Remaining" figure beneath it cannot disagree
 * (ARCHITECTURE RULES §6).
 *
 * The totals RECONCILE: received + settled + remaining is the payable. The settled line
 * appears only when an audited write-off discharged part of the bill, and it is what stops
 * the other two looking like an arithmetic error on an invoice that was closed short. It is
 * also why the block renders for a settlement with no payments at all — a bad-debt write-off
 * on an untouched invoice has nothing to list but everything to explain.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewInvoicePayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payments' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui, payments, collected, balance, settledOff, settlement, money } = useInvoiceViewContext()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

/** Payment mode → the icon that reads fastest in a list. */
const MODE_ICONS = {
  Cash: 'payments',
  Cheque: 'receipt_long',
  'Bank Transfer': 'account_balance',
  Card: 'credit_card',
  Other: 'more_horiz'
}

const rows = computed(() => payments.value.map((payment) => {
  const mode = String(payment.Mode || 'Other').trim()
  const reference = String(payment.Reference || '').trim()
  return {
    key: payment.Code,
    label: payment.Date,
    caption: reference ? `${mode} • ${reference}` : mode,
    icon: MODE_ICONS[mode] || MODE_ICONS.Other,
    amount: Number(payment.Amount) || 0
  }
}))

const showTotals = computed(() => rows.value.length > 0 || settledOff.value > 0)

// The reason rides in the label rather than a second row: it is one word most of the time,
// and the full audit trail is the Settlement card above.
const settledLabel = computed(() => {
  const reason = settlement.value?.reason
  return reason ? `Settled (${reason})` : 'Settled'
})

/** Right-hand money, as a `metaLabel` closure — `abstract/List.vue` has no `right` slot. */
const paymentAmount = (item) => money(item.amount)
</script>

