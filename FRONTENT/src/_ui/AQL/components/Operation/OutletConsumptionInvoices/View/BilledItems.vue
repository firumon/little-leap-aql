<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <AqlList
      :items="rows"
      item-key="key"
      empty-text="No items on this invoice."
      :item-bordered="true"
      :layout="['label', 'caption', 'caption']"
      :content="content"
      :meta-label="lineTotal"
    />
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › BilledItems — Section (tier CP: resource + page).
 *
 * What was billed, one row per line item:
 *
 *     Fruit Feeder                       ← the PRODUCT, which is what was sold
 *     Red / 500ml · CK3-09               ← the variant, and the code that identifies the row
 *     2 × 68.00 · Taxable 136.00 · Tax 6.80
 *                              136.00    ← the line total
 *
 * ── THE PRODUCT NAME LEADS, THE CODE FOLLOWS ──
 * `CK3-09` identifies a row to the system and means nothing to whoever is reading the bill,
 * so the code never stands alone as a line's name. The naming rule itself comes from
 * `useSkuResource().skuLabelOf` — the SKUs domain owns "what do we call this SKU", and every
 * screen that asks gets the same answer (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
 *
 * The rows are the STORED `OutletConsumptionInvoiceItems`, not a recalculation. An invoice is
 * a historical document: re-pricing it against today's price list would show a customer
 * different numbers from the ones on the bill they were sent.
 *
 * A table would scroll horizontally on a phone, which ARCHITECTURE RULES §7 rules out, so the
 * money sits in the row's meta column instead of a fourth cell.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewBilledItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Billed Items' }
})

const { evaluate, items, money, skuLabelOf } = useInvoiceViewContext()

const finalTitle = computed(() => evaluate(props.title))

const num = (value) => Number(value) || 0

const rows = computed(() => items.value.map((item) => {
  const sku = String(item.SKU || '').trim()
  const label = skuLabelOf(sku)
  const qty = num(item.Qty)
  const discount = num(item.Discount)

  // Assembled from whichever parts are non-zero — a caption reading
  // "Taxable: 0 | Tax: 0 | Disc: -0" on an untaxed line is noise, not detail.
  const parts = [`${qty} × ${money(num(item.Price))}`]
  // if (num(item.TaxableAmount)) parts.push(`Taxable ${money(item.TaxableAmount)}`)
  // if (num(item.TaxAmount)) parts.push(`Tax ${money(item.TaxAmount)}`)
  // if (discount) parts.push(`Disc −${money(discount)}`)

  return {
    key: item.Code || `${sku}-${qty}`,
    product: label.primary,
    // The variant and the code together: the variant is what distinguishes this line to a
    // reader, the code is what they quote back when querying it. When a product declares no
    // variants `secondary` is already the code, so this does not repeat it.
    variant: label.secondary === sku ? sku : `${label.secondary} · ${sku}`,
    detail: parts.join('  •  '),
    total: num(item.Total),
    tax: num(item.TaxAmount)
  }
}))

// Positional pairs with `layout` above: `abstract/List.vue` maps only one `caption` prop, so
// a row needing two caption lines supplies them through `content` instead.
const content = [
  (row) => row.product,
  (row) => row.variant,
  (row) => row.detail
]

const lineTotal = (item) => money(item.total)
const lineTax = (item) => (item.tax > 0 ? `incl. tax ${money(item.tax)}` : '')
</script>
