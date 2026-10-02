<template>
  <div v-if="outletCode" :class="gutterClass">
    <SectionDividerLabel label="AMOUNT COLLECTED" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="CurrencyField"
          v-model.number="amount"
          :config="{ label: 'Amount Collecting', min: 0 }"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

defineOptions({ name: 'OutletPaymentsAddPayingAmount', inheritAttrs: false })

const attrs = useAttrs()
const node = 'OutletPayments'
const { pageState, ui } = useOutletPaymentAddContext()
const gutterClass = computed(() => 'q-gutter-y-' + (attrs.gutter || 'sm'))
const outletCode = pageState.useRecord('OutletCode', node)
const amount = pageState.useRecord('Amount', node)
const CurrencyField = resolveFieldComponent('currency', 'add')
</script>
