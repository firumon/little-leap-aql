<template>
  <div :class="spacingClass">
    <SectionDividerLabel label="QUANTITY &amp; VALUE" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
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
