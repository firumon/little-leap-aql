<template>
  <div :class="spacingClass">
    <SectionDividerLabel label="QUANTITY &amp; VALUE" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- The list is the premise for both figures under it, so it takes the full width
             and the quantity/price pair shares the row below, equally. Both gaps are the
             page's own gutter token (§10.2). -->
        <div class="row" :class="[gutterXClass, gutterYClass]">
          <div class="col-12">
            <FieldSelectAdd
              :model-value="priceListCode"
              :record="form"
              :config="{ label: 'Price List', options: priceListOptions, clearable: false }"
              header="PriceListCode"
              @update:model-value="setPriceList"
            />
          </div>
          <div class="col-6">
            <FieldNumberAdd
              :model-value="form.Qty"
              :record="form"
              :config="{ label: 'Quantity', min: 1 }"
              header="Qty"
              @update:model-value="setQty"
            />
          </div>
          <div class="col-6">
            <FieldCurrencyAdd
              :model-value="form.Price"
              :record="form"
              :config="{ label: 'Unit Price' }"
              header="Price"
              @update:model-value="setPrice"
            />
          </div>
        </div>

        <div class="text-caption text-grey-8 q-pt-sm">{{ priceCaption }}</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletReturns › FormQuantityValue — card 3 of the shared return form (resource tier).
 *
 * What the return is worth: which list it is priced from, how many units, and the unit
 * credit. The price list selector writes NO column — `OutletReturns` declares no
 * `PriceListCode` header, so it is a CONTROL FIELD (§13.5) whose only job is to decide what
 * goes in `Price`. It is shown because an officer pricing a credit needs to see which list
 * the figure came from; it is not stored, because the sheet has nowhere to put it.
 *
 * Holds no state (§6). No `<style>` block (§7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import FieldNumberAdd from 'src/_fields/number/Add.vue'
import FieldCurrencyAdd from 'src/_fields/currency/Add.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormQuantityValue', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const gutterYClass = computed(() => `q-gutter-y-${gutter.value}`)
const spacingClass = computed(() => `q-gutter-y-${gutter.value}`)

const {
  ui,
  form,
  priceListCode,
  priceListOptions,
  priceCaption,
  setPriceList,
  setQty,
  setPrice
} = useReturnFormFields()
</script>
