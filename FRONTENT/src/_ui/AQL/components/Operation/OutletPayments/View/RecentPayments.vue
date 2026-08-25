<template>
  <div v-if="rows.length">
    <SectionDividerLabel :label="finalTitle" />

    <AppList
      :items="rows"
      item-key="code"
      :item-bordered="true"
      label="label"
      caption="caption"
      :meta-layout="['label']"
      :meta-label="amountOf"
      clickable
      @click="onOpen"
    />
  </div>
</template>

<script setup>
/**
 * OutletPayments › View › RecentPayments — Section (tier CP: resource + page).
 *
 * This outlet's last ten receipts, newest first, excluding the one on screen.
 *
 * It answers the question a single receipt cannot: is this outlet a reliable payer or is this
 * the first money in three months? That judgement changes how hard the next invoice gets
 * chased, and it is invisible from the document itself.
 *
 * Capped at ten deliberately — the section exists to establish a PATTERN, and a full ledger
 * would bury the recent behaviour that carries the signal. Hides itself entirely when this is
 * the outlet's first payment.
 *
 * A cancelled receipt is labelled in its caption rather than dropped: a gap in a payment
 * history reads as a quiet outlet, which is the opposite of what a reversal means.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewRecentPayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Recent Payments' }
})

const { evaluate, money, recentPayments, openPayment } = useOutletPaymentViewContext()

const finalTitle = computed(() => evaluate(props.title))

const rows = computed(() => recentPayments.value.map((payment) => ({
  code: payment.code,
  label: payment.date,
  caption: [
    payment.username,
    payment.mode,
    payment.isCancelled ? 'cancelled' : ''
  ].filter(Boolean).join(' • '),
  amount: payment.amount
})))

const amountOf = (row) => money(row.amount)

const onOpen = (row) => openPayment(row?.code)
</script>
