<template>
  <div v-if="rows.length > 1" :class="spacingClass">
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
 * OutletPayments › View › InvoiceAllPayments — Section (tier CP: resource + page).
 *
 * Every receipt against the credited invoice, newest first — the reconciliation behind the
 * "Received to date" figure one card above.
 *
 * ── WHY IT HIDES BELOW TWO ROWS ──
 * On a single-payment invoice this list is exactly the receipt already shown at the top of the
 * page, restated one card later. That reads as a duplicate record rather than as
 * reconciliation, so the section renders only once there is genuinely something to reconcile.
 *
 * The receipt being viewed is marked in its caption rather than removed: a reconciliation with
 * one row silently missing is a reconciliation that does not add up.
 *
 * Rows carry no icon — every row is a payment, so a payments glyph down the column says
 * nothing.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewInvoiceAllPayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'All Payments on This Invoice' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, money, record, invoiceAllPayments, openPayment } = useOutletPaymentViewContext()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const text = (value) => (value == null ? '' : String(value).trim())

const currentCode = computed(() => text(record.value?.Code || record.value?.code))

const rows = computed(() => invoiceAllPayments.value.map((payment) => {
  const code = text(payment.Code)
  return {
    code,
    label: text(payment.Date),
    caption: [
      text(payment.Username),
      text(payment.Mode) || 'Cash',
      // The receipt being viewed is MARKED, not removed: a reconciliation with one row
      // silently missing is a reconciliation that does not add up.
      code === currentCode.value ? 'this receipt' : ''
    ].filter(Boolean).join(' • '),
    amount: Number(payment.Amount) || 0
  }
}))

const amountOf = (row) => money(row.amount)

const onOpen = (row) => {
  if (row?.code && row.code !== currentCode.value) openPayment(row.code)
}
</script>
