<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="BILLED ITEMS" />

    <q-card flat bordered :class="ui.cardClass">
      <!-- bg-transparent: the card owns the surface, else its corners show a border sliver. -->
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
      variant: label.secondary === sku ? sku : `${label.secondary} · ${sku}`,
      price,
      issuedPrice,
      changed: Math.abs(price - issuedPrice) >= 0.000001
    }
  })
})

const changedCount = computed(() => lines.value.filter((line) => line.changed).length)
const subtotal = computed(() => invoice.value.header.Subtotal)

// A component, not a resolver: a resolver returning null still gets a wrapper element.
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

// Memoised: a fresh literal per render re-runs the control's watchers on every keystroke.
const priceConfig = computed(() => ({
  label: 'Unit price',
  min: 0,
  hideBottomSpace: true,
  inputClass: 'text-right text-weight-bold',
  disable: locked.value
}))
</script>
