<template>
  <div v-if="form.OutletCode && form.SKU" :class="spacingClass">
    <SectionDividerLabel label="BILLED ON" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="!matchingInvoices.length" class="text-body2 text-grey-8">
        No invoice on record bills this item to this outlet. Price it from a price list below.
      </q-card-section>

      <q-card-section v-else>
        <div class="text-caption text-grey-8 q-pb-sm">
          Picking one fills the quantity, price and price list from that bill, and marks the
          credit as required.
        </div>

        <AppList
          :items="matchingInvoices"
          :layout="['label', 'caption', 'caption']"
          :content="['label', 'qtyLabel', 'totalLabel']"
          :meta-layout="[SquarePriceChip]"
          :meta="['priceLabel']"
          item-key="code"
          :gutter="gutter"
          :item-bordered="false"
          clickable
          separator
          :item-class="itemClass"
          :paginate="false"
          align="top"
          @click="(invoice) => toggleInvoice(invoice.code)"
        >
          <!-- The radio SHOWS the selection; the row's own click MAKES it. AppList renders
               this slot in the icon/avatar cell, so the control costs no width of its own
               and the three text lines keep the room they need — Quasar's own
               radio-inside-QItem pattern, through the app's list primitive rather than a
               second hand-rolled one. -->
          <template #avatar="{ item }">
            <q-radio
              dense
              :model-value="selectedInvoiceCode"
              :val="item.code"
              color="primary"
            />
          </template>
        </AppList>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletReturns › FormBilledOn — card 2 of the shared return form (resource tier).
 *
 * The invoice that sold this item to this outlet, offered as a shortcut. Picking one says
 * four things at once — credited, on this bill, this many, at this price — which is why the
 * whole row is the target and the radio only reports the answer.
 *
 * ── WHY `AppList` AND NOT A HAND-ROLLED `q-list` ──
 * This card used to build its own `q-list`/`q-item` because `abstract/List.vue`'s
 * `highlight` is resolved ONCE for the whole list rather than per row, so it cannot mark a
 * single selected row. It does not have to: the RADIO carries the per-row state, through
 * the `avatar` slot, and everything else the row needs — a label, two distinct captions and
 * a meta chip — is already list API. `content` is the mechanism for two DIFFERENT caption
 * lines; a repeated `'caption'` in `layout` alone would resolve the one `caption` prop
 * twice and print the same line twice.
 *
 * `itemClass` is `bg-transparent` because the rows sit INSIDE a card: the list's own row
 * background would paint a second surface over the card's and read as a panel within a
 * panel. The selection is therefore stated by the radio ALONE — `itemClass` is bound once
 * for the whole list, not per row, so it cannot tint the chosen one, and the radio says it
 * plainly anyway.
 *
 * Holds no state (§6). No `<style>` block (§7).
 */
import { computed, defineComponent, h, useAttrs } from 'vue'
import { QChip } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormBilledOn', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const spacingClass = computed(() => `q-gutter-y-${gutter.value}`)

const {
  ui,
  form,
  matchingInvoices,
  selectedInvoiceCode,
  toggleInvoice
} = useReturnFormFields()

const itemClass = 'bg-transparent'

/**
 * The price chip, SQUARE.
 *
 * A `metaLayout` entry may BE a component, which then wraps the resolved value in place of
 * the shared `MetaChip` renderer — the supported way for one list to shape its own meta cell
 * without changing the renderer every other list in the app draws from. A price is a figure,
 * not a status, and the pill shape reads as one; the square corner says "amount".
 */
const SquarePriceChip = defineComponent({
  name: 'BilledOnPriceChip',
  setup (props, { slots }) {
    return () => h(QChip, {
      square: true,
      color: 'primary',
      class: 'text-weight-bold text-white',
      style: 'font-size: 0.75rem'
    }, { default: () => (slots.default ? slots.default() : null) })
  }
})
</script>
