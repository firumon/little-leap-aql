<template>
  <AppList
    :items="rows"
    item-key="code"
    empty-text="No micro balances to clear."
    empty-icon="cleaning_services"
    label="label"
    caption="caption"
    :meta-label="balanceOf"
    clickable
    @click="onOpen"
  >
    <!-- The quick settle button. `btn` is the list's own action slot, and `@click.stop`
         inside `abstract/List.vue` already stops it opening the row. -->
    <template #btn="{ item }">
      <q-btn
        flat round dense
        icon="price_check"
        color="positive"
        :aria-label="`Settle ${item.code}`"
        @click.stop="onSettle(item)"
      />
    </template>
  </AppList>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Waive-off Invoices" — runtime list view.
 *
 * Invoices whose remaining balance is at or below the currency's own rounding interval —
 * residues too small to be paid off with any combination of coins. Left alone they sit in
 * the collections queue forever, because no payment can ever clear them.
 *
 * ── WHY THE THRESHOLD IS NOT 0.01 ──
 * `isMicroBalance` in Layer 2 compares against `Currencies.RoundingInterval`. On a currency
 * rounding to 0.05 a three-fils residue is unpayable even though it is larger than a cent,
 * so a hardcoded 0.01 would strand exactly the invoices this view exists to clear.
 *
 * The row action settles ONE invoice through the configured `MarkPaid` dialog — the same
 * dialog, the same gate and the same Layer 2 validation the View page's FAB uses. This view
 * gives it a shortcut, not a second implementation.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'

defineOptions({ name: 'OutletConsumptionInvoicesListWaiveOffInvoices', inheritAttrs: false })

const { runtimeViews, money, openInvoice, settleInvoice } = useInvoiceIndexContext()

const rows = computed(() => runtimeViews.value.WaiveOffInvoices.map((entry) => ({
  code: entry.code,
  label: entry.outletName,
  caption: `${entry.code} • ${entry.date}`,
  balance: entry.balance,
  invoice: entry.invoice
})))

const balanceOf = (item) => money(item.balance)

const onOpen = (item) => openInvoice(item?.code)
const onSettle = (item) => settleInvoice(item?.invoice)
</script>

