<template>
  <div v-if="rows.length" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <AqlList
      :items="rows"
      item-key="code"
      :item-bordered="true"
      :layout="['caption', 'label', 'caption']"
      :content="content"
      :meta-layout="['chip']"
      :chip="balanceOf"
      :chip-color="chipColor"
      chip-outline
      clickable
      @click="onOpen"
    />
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › OtherInvoices — Section (tier CP: resource + page).
 *
 * This outlet's other invoices, most recent first. A collector looking at one overdue invoice
 * needs to know whether it is an isolated slip or the fourth in a row before deciding how
 * hard to chase it, and that judgement is impossible from a single document.
 *
 * A FLAT LIST, not an accordion. The previous version hid both this and the payments beneath
 * two collapsed expansion items inside a shared "Outlet Context" card — which meant the
 * context existed but nobody saw it, and cost two taps to reach the thing that changes the
 * decision. It now renders as an ordinary section and hides entirely when the outlet has no
 * other history.
 *
 * Rows use the same three-line shape the Index lists use, so an invoice reads identically
 * wherever it appears.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewOtherInvoices', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Other Invoices' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, outletInvoices, money, openInvoiceByCode } = useInvoiceViewContext()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const rows = computed(() => outletInvoices.value.map((entry) => ({
  code: entry.code,
  date: entry.date,
  balance: entry.balance,
  total: entry.total,
  progress: entry.progress,
  settled: entry.progress === 'PAID' || entry.progress === 'CANCELLED',
  isOverdue: entry.isOverdue,
  dueInDays: entry.dueInDays
})))

const stateText = (row) => {
  if (row.progress === 'CANCELLED') return 'cancelled'
  if (row.progress === 'PAID') return 'paid'
  if (row.dueInDays === null || row.dueInDays === undefined) return 'no due date'
  if (row.dueInDays < 0) return `due by ${Math.abs(row.dueInDays)} days`
  if (row.dueInDays === 0) return 'due today'
  return `due in ${row.dueInDays} days`
}

const content = [
  (row) => row.code,
  // The DATE is the label here rather than the outlet name: every row is the same outlet, so
  // repeating its name down the list would say nothing and crowd out what does vary.
  (row) => row.date,
  (row) => stateText(row)
]

// A settled invoice has no balance, so the chip shows what it was worth instead — a column
// of zeroes would waste the one figure on the row.
const balanceOf = (row) => money(row.settled ? row.total : row.balance)

const chipColor = (row) => {
  if (row.progress === 'CANCELLED') return 'grey-6'
  if (row.progress === 'PAID') return 'positive'
  return row.isOverdue ? 'negative' : 'primary'
}

const onOpen = (item) => openInvoiceByCode(item?.code)
</script>
