<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Select outlet</div>
        <FieldSelectAdd
          v-model="outletCode"
          :record="parent.record.value"
          :config="{ label: 'Outlet', options: outletOptions, clearable: false }"
          header="OutletCode"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 1a - which outlet. The node, its defaults and the deep-linked outlet are seeded by
// the page contract's `ready` (UI_PAGE_STATE.md §14); this card only shows the choice.
import { computed, useAttrs } from 'vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import { useRestockAddContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Add/useRestockAddContext'

defineOptions({ name: 'OutletRestocksOutletSelection', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, outletOptions, ui } = useRestockAddContext()
const parent = pageState.useNode('OutletRestocks')

const visible = computed(() => pageState?.meta.currentStep === 1)

const outletCode = computed({
  get: () => parent.record.value.OutletCode || '',
  set: (value) => pageState.setRecord('OutletCode', value, 'OutletRestocks')
})
</script>
