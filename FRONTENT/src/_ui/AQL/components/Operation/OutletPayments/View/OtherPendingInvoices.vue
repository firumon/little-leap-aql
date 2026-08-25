<template>
  <div v-if="rows.length">
    <SectionDividerLabel :label="finalTitle" />

    <AppList
      :items="rows"
      item-key="code"
      :item-bordered="true"
      :layout="['label', 'caption']"
      :content="content"
      :meta-layout="['chip']"
      :chip="balanceOf"
      :chip-color="chipColor"
      chip-outline
    >
      <!-- The row STARTS WORK rather than opening something to read, so it carries an explicit
           control instead of being clickable end to end — the same `add` button the Index
           queues use, so recording a payment is one gesture wherever an open invoice appears. -->
      <template #btn="{ item }">
        <q-btn
          v-if="canCreate"
          flat round dense
          icon="add"
          color="primary"
          :aria-label="`Record payment for ${item.code}`"
          @click.stop="onPay(item)"
        />
      </template>
    </AppList>
  </div>
</template>

<script setup>
/**
 * OutletPayments › View › OtherPendingInvoices — Section (tier CP: resource + page).
 *
 * What this outlet still owes BESIDES the invoice just credited.
 *
 * It is here because of what happens next in the real world: a collector standing in an outlet
 * that has just paid one invoice is the one person best placed to collect the others, and
 * finding out about them tomorrow is finding out too late. Rendered as an ordinary section
 * rather than a collapsed accordion — context nobody expands is context nobody has — and it
 * hides entirely when the outlet owes nothing else.
 *
 * The DATE is the row's caption rather than the outlet name: every row is the same outlet, so
 * repeating its name would say nothing and crowd out what does vary. No leading icon, for the
 * same reason.
 *
 * Rows are aggregate entries from Layer 2; nothing here recomputes a balance.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { canCreatePayment } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'
import { dueText } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsViewOtherPendingInvoices', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Other Open Invoices' }
})

const { evaluate, money, otherPendingInvoices, payInvoice } = useOutletPaymentViewContext()

const finalTitle = computed(() => evaluate(props.title))

const canCreate = computed(() => canCreatePayment())

const rows = computed(() => otherPendingInvoices.value.map((entry) => ({
  code: entry.code,
  outletCode: entry.outletCode,
  date: entry.date,
  balance: entry.balance,
  isOverdue: entry.isOverdue,
  dueInDays: entry.dueInDays
})))

const content = [
  (row) => row.code,
  (row) => [row.date, dueText(row)].filter(Boolean).join(' · ')
]

const balanceOf = (row) => money(row.balance)
const chipColor = (row) => (row.isOverdue ? 'negative' : 'primary')

const onPay = (row) => payInvoice(row?.code, row?.outletCode)
</script>
