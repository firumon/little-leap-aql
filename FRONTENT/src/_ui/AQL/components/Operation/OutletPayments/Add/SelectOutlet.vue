<template>
  <div :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="SelectField"
          v-model="outletCode"
          :config="{ label: 'Outlet', options: outletOptions, clearable: false }"
          @update:model-value="onDropdownSelect"
        />
        <template v-if="suggestedOutlets.length">
          <div class="text-caption text-grey-7 q-mt-sm q-mb-xs">Outlets with open balance</div>
          <div class="row q-gutter-xs">
            <q-chip
              v-for="s in suggestedOutlets"
              :key="s.outletCode"
              clickable
              :outline="s.outletCode !== outletCode"
              color="primary"
              :text-color="s.outletCode === outletCode ? 'white' : undefined"
              :label="`${s.outletName} (${s.total})`"
              @click="setOutletCode(s)"
            />
          </div>
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

defineOptions({ name: 'OutletPaymentsAddSelectOutlet', inheritAttrs: false })

const props = defineProps({
  suggestLimit: { type: Number, default: 10 }
})

const attrs = useAttrs()
const node = 'OutletPayments'
const { pageState, ui, outletOptions, getSuggestedOutlets } = useOutletPaymentAddContext()
const gutterClass = computed(() => 'q-gutter-y-' + (attrs.gutter || 'sm'))
const outletCode = pageState.useRecord('OutletCode', node)
const allSuggestedOutlets = computed(() => getSuggestedOutlets())
const suggestedOutlets = computed(() => allSuggestedOutlets.value.slice(0, props.suggestLimit))
const SelectField = resolveFieldComponent('select', 'add')

function setOutletCode (s) {
  outletCode.value = s.outletCode
  pageState.setRecord('Amount', s.total, node)
}

function onDropdownSelect (selectedCode) {
  const found = allSuggestedOutlets.value.find((o) => o.outletCode === selectedCode)
  pageState.setRecord('Amount', found ? found.total : 0, node)
}
</script>
