<template>
  <div v-if="outletCode" :class="gutterClass">
    <SectionDividerLabel label="PAYMENT METHOD" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="SelectField"
          v-model="mode"
          :config="{ label: 'Payment mode', options: modes, clearable: false }"
        />
        <component
          :is="TextareaField"
          v-model="reference"
          :config="{ label: 'Reference / memo (optional)' }"
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

defineOptions({ name: 'OutletPaymentsAddModeReference', inheritAttrs: false })

const attrs = useAttrs()
const node = 'OutletPayments'
const { pageState, ui, modes } = useOutletPaymentAddContext()
const gutterClass = computed(() => 'q-gutter-y-' + (attrs.gutter || 'sm'))
const outletCode = pageState.useRecord('OutletCode', node)
const mode = pageState.useRecord('Mode', node)
const reference = pageState.useRecord('Reference', node)
const SelectField = resolveFieldComponent('select', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')
</script>
