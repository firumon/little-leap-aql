<template>
  <AppList
    :items="rows"
    item-key="outletCode"
    empty-text="No outlet is carrying a balance."
    empty-icon="storefront"
    label="label"
    caption="caption"
    :meta-label="balanceOf"
    :meta-caption="shareOf"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Outlet Pendings" — runtime list view.
 *
 * The receivable book collapsed to ONE ROW PER OUTLET, heaviest debtor first. Every other
 * view on this page lists documents; this one lists counterparties, because the decision it
 * supports is about who to call, not which invoice to open. An outlet owing six small
 * invoices is invisible in a document-sorted list and obvious here.
 *
 * Each row states how many invoices make up the balance and how many of those are overdue —
 * the difference between "one large bill within terms" and "six overdue" is the whole point
 * of the row, and the amount alone cannot express it.
 *
 * Rows are NOT clickable: an outlet is not a record this resource can open, and the grouping
 * key is an outlet code rather than an invoice code. Drilling in means picking one of that
 * outlet's invoices from the Pending view, which is one tap away in the switcher.
 *
 * NO ROW ICON. Every row in this list is an outlet, so a storefront glyph on each one states
 * what the list already is — decoration in the space the figures need.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'

defineOptions({ name: 'OutletConsumptionInvoicesListOutletPendings', inheritAttrs: false })

const { outletPendings, collections, money } = useInvoiceIndexContext()

const rows = computed(() => outletPendings.value.map((entry) => {
  const parts = [`${entry.invoiceCount} invoice${entry.invoiceCount === 1 ? '' : 's'}`]
  if (entry.overdueCount > 0) parts.push(`${entry.overdueCount} overdue`)
  if (entry.oldestDate) parts.push(`since ${entry.oldestDate}`)

  return {
    outletCode: entry.outletCode,
    label: entry.outletName,
    caption: parts.join(' • '),
    balance: entry.balance
  }
}))

const balanceOf = (item) => money(item.balance)

const shareOf = (item) => {
  const total = collections.value.amount
  if (!total || total <= 0) return ''
  return `${Math.round((item.balance / total) * 100)}% of book`
}
</script>

