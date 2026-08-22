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
/**
 * OutletReturns › FormCommercialCredit — card 4 of the shared return form (resource tier).
 *
 * Track 1: is the outlet owed money. It sits directly under the figures it credits, because
 * it is the same question continued — here is the value, is the outlet owed it — and
 * because picking an invoice two cards above ANSWERS it, which only reads as an answer when
 * the switch is near enough to see move.
 *
 * The toggle is one of the two bare Quasar controls on this form: `InvoiceAdjustmentRequired`
 * is a `'TRUE'`/`'FALSE'` column whose meaning is a commercial consequence, not a value a
 * `_fields` control can offer honestly (§13.0).
 *
 * Holds no state (§6). No `<style>` block (§7).
 */
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
