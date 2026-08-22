<template>
  <div :class="spacingClass">
    <SectionDividerLabel label="COMMERCIAL CREDIT" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap" :class="gutterXClass">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium">Invoice Adjustment Required</div>
            <div class="text-caption text-grey-8">
              Credit this return against the outlet's next invoice.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle
              :model-value="invoiceRequired"
              color="primary"
              @update:model-value="setInvoiceRequired"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormCommercialCredit', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const spacingClass = computed(() => `q-gutter-y-${gutter.value}`)

const { ui, invoiceRequired, setInvoiceRequired } = useReturnFormFields()
</script>
