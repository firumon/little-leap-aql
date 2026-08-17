<template>
  <AppList
    :items="rows"
    item-key="outletCode"
    empty-text="Every consumption has been invoiced."
    empty-icon="task_alt"
    label="label"
    caption="caption"
  >
    <!-- THE PRIMARY ACTION OF THIS VIEW. Every other list here opens something to read;
         this one starts work. Icon only — the row already names the outlet and the button
         sits in the list's own action slot, so a "Invoice" caption beside it would repeat
         what the column is for. -->
    <template #btn="{ item }">
      <q-btn
        v-if="canCreate"
        flat round dense
        icon="add"
        color="primary"
        :aria-label="`Generate invoice for ${item.label}`"
        @click.stop="onStart(item)"
      />
    </template>
  </AppList>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Invoiceable Outlets" — runtime list view.
 *
 * Outlets carrying consumptions that have been recorded but never billed. This is the only
 * view on the page that looks UPSTREAM: everything else measures money already invoiced,
 * while these rows are revenue that exists physically and is invisible to every financial
 * figure on the page until somebody raises the bill.
 *
 * It reads `OutletConsumptions`, not this resource — which is why it cannot be expressed as
 * a declarative filter (a filter tree evaluates the resource's own rows) and is a runtime
 * evaluator instead. `useInvoiceIndex` decides what counts as uninvoiced by checking the
 * INVOICES side, so a consumption bundled onto a sibling's invoice correctly drops off.
 *
 * NO ROW ICON. A storefront glyph repeated down every row of a list whose every row is an
 * outlet carries no information — it is decoration occupying the space the count could use.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'

defineOptions({ name: 'OutletConsumptionInvoicesListInvoiceableOutlets', inheritAttrs: false })

const { invoiceableOutlets, canCreate, startInvoice } = useInvoiceIndexContext()

const rows = computed(() => invoiceableOutlets.value.map((entry) => ({
  outletCode: entry.outletCode,
  label: entry.outletName,
  caption: `Consumptions: ${entry.consumptionCount}`
})))

const onStart = (item) => startInvoice(item?.outletCode)
</script>
