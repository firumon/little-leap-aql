<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="BILLED ITEMS" />

    <q-card flat bordered :class="ui.cardClass">
      <!-- `item-class="bg-transparent"` and `item-bordered=false` let the card own the
           surface. A row painting its own background inside a card whose corners are rounded
           to a different radius leaves a sliver of border showing in each corner. -->
      <AqlList
        :items="lines"
        item-key="sku"
        :layout="['label', 'caption', 'caption']"
        :content="content"
        :meta-layout="['chip']"
        :chip="(row) => `${row.qty}`"
        chip-color="primary"
        :separator="true"
        :item-bordered="false"
        item-class="bg-transparent"
        gutter="none"
        empty-icon="receipt_long"
        empty-text="No items on this invoice."
      >
        <!-- The unit price box, mounted in the row's ACTION slot.
             A caller slot wins outright in `abstract/Renderable.js` (rule 1), so it renders
             as-is with no `QBtn` wrapper and no click handler bound to it — and AppList turns
             row-clicking off for any list that supplies this slot, so a tap on the input is
             never swallowed by the row. -->
        <template #btn="{ item }">
          <div style="width: 104px">
            <component
              :is="CurrencyField"
              :model-value="item.price"
              :record="item"
              :config="priceConfig"
              header="Price"
              @update:model-value="(value) => setLinePrice(item.sku, value)"
            />
          </div>
        </template>
      </AqlList>

      <template v-if="lines.length">
        <q-separator />
        <q-card-section class="row items-center justify-between q-py-sm">
          <div class="text-caption text-grey-8">
            {{ lines.length }} line{{ lines.length === 1 ? '' : 's' }}
            <span v-if="changedCount"> · {{ changedCount }} re-priced</span>
          </div>
          <div class="text-subtitle2 text-weight-bold">{{ money(subtotal) }}</div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Edit › InvoiceItems — the bill's lines, and their prices.
 *
 * ── THE ROW ──
 *     Nasal Aspirator                    ← the PRODUCT, which is what was sold
 *     Blue / 200 ML · CK3-09             ← the variant, and the code that identifies the row
 *     was د.إ 68.00  [Restore]           ← only on a line whose price was moved
 *                            [2] [75.00] ← quantity chip, then the editable unit price
 *
 * Built on `abstract/List.vue` rather than a hand-rolled `q-list`, so this list inherits the
 * app's row rhythm, empty state and transitions instead of restating them (§7.2). The
 * quantity is the `chip` meta cell and the price control is the `#btn` action slot.
 *
 * The taxable/tax caption is deliberately GONE. It restated, per row, figures the billing
 * summary states once and correctly for the whole invoice — and on a PRE_TAX list a line's
 * taxable amount carries an apportioned share of the header discount, which reads as a
 * discrepancy to anyone comparing it against `qty × price`. The row now says the one thing
 * only it can say: what this price used to be, and how to put it back.
 *
 * ── ONLY THE PRICE MOVES ──
 * There is no quantity box and no remove button. A quantity here is a physical count already
 * recorded against a consumption; changing it on the bill would make the invoice disagree
 * with the audit it was raised from, with nothing recording the decision. Correcting a count
 * belongs on the consumption; adding a line belongs on a new invoice.
 *
 * Editing a price re-runs the WHOLE engine — line tax, discount apportionment and the net
 * payable move together on the same tick — because the override is passed to
 * `calculateConsumptionInvoice` as a price RESOLVER rather than patched onto a total the
 * engine never saw.
 *
 * ── WHAT AN UNTOUCHED LINE COSTS ──
 * Its own STORED price, while the invoice stays on the price list it was issued under. Change
 * the price list on the terms card and untouched lines re-price against the NEW list, because
 * that is the only thing switching a list can mean. Layer 2's `makeStoredPriceResolver` owns
 * both halves of that rule.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, defineComponent, h, useAttrs } from 'vue'
import { QItemLabel, QBtn } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceEditContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

defineOptions({ name: 'OutletConsumptionInvoicesEditInvoiceItems', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const CurrencyField = resolveFieldComponent('currency', 'edit')

const {
  ui, money, skuLabelOf, items, invoice, locked, setLinePrice, resetLinePrice
} = useInvoiceEditContext()

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => Number(value) || 0

/**
 * The rows, joined to the CALCULATED lines so each shows the price actually in force. The
 * calculation is read, never repeated — `invoice.lines` is the same array the summary totals
 * and the payload builder writes.
 */
const lines = computed(() => {
  const calculated = new Map(invoice.value.lines.map((line) => [text(line.SKU), line]))

  return items.value.map((item) => {
    const sku = text(item.SKU)
    const label = skuLabelOf(sku)
    const priced = calculated.get(sku) || {}
    const price = num(priced.Price)
    const issuedPrice = num(item.Price)

    return {
      sku,
      qty: num(item.Qty),
      product: label.primary,
      // The variant and the code together — when a product declares no variants `secondary`
      // is already the code, so this does not repeat it.
      variant: label.secondary === sku ? sku : `${label.secondary} · ${sku}`,
      price,
      issuedPrice,
      changed: Math.abs(price - issuedPrice) >= 0.000001
    }
  })
})

const changedCount = computed(() => lines.value.filter((line) => line.changed).length)
const subtotal = computed(() => invoice.value.header.Subtotal)

/**
 * The third content cell: the original price and the way back to it.
 *
 * A COMPONENT rather than a value resolver, because `Renderable` mounts a component-valued
 * cell outright (rule 3) while a resolver returning `null` still gets wrapped — which left an
 * empty caption element, and its line-height, on every untouched row. As a component the row
 * renders nothing at all until its price is actually moved.
 */
const RepricedNote = defineComponent({
  name: 'InvoiceItemRepricedNote',
  props: { item: { type: Object, required: true } },
  setup: (props) => () => {
    const row = props.item
    if (!row.changed) return null
    return h(QItemLabel, { caption: true, class: 'text-orange-9' }, () => [
      `was ${money(row.issuedPrice)} `,
      h(QBtn, {
        flat: true,
        dense: true,
        noCaps: true,
        size: 'sm',
        color: 'primary',
        label: 'Restore',
        class: 'q-ml-xs q-px-xs',
        disable: locked.value,
        'aria-label': `Restore the original price for ${row.product}`,
        onClick: () => resetLinePrice(row.sku)
      })
    ])
  }
})

const content = [
  (row) => row.product,
  (row) => row.variant,
  RepricedNote
]

// Hoisted into a memo: a fresh object literal per render is a new prop identity every time,
// which re-runs the control's own watchers on every keystroke in a sibling row.
const priceConfig = computed(() => ({
  label: 'Unit price',
  min: 0,
  hideBottomSpace: true,
  inputClass: 'text-right text-weight-bold',
  disable: locked.value
}))
</script>
