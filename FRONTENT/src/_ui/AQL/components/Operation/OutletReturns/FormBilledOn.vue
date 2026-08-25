<template>
  <div v-if="form.OutletCode && form.SKU">
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
          <!-- No handler: the row click owns the toggle, a second one would undo it. -->
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
import { computed, defineComponent, h, useAttrs } from 'vue'
import { QChip } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormBilledOn', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')

const {
  ui,
  form,
  matchingInvoices,
  selectedInvoiceCode,
  toggleInvoice
} = useReturnFormFields()

const itemClass = 'bg-transparent'

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
