<template>
  <div v-if="isActive" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-select
          v-if="options.length > 1"
          :model-value="warehouseFilter"
          :options="options"
          label="Source Warehouse"
          outlined
          emit-value
          map-options
          :error="showWarehouseError"
          error-message="Pick the warehouse this run loads from."
          @update:model-value="setWarehouseFilter"
        />

        <div v-else :class="ui.flexWrapTextClass">
          <div class="text-caption text-grey-8">Loading From</div>
          <div class="text-subtitle2 text-weight-medium">{{ soleWarehouseLabel }}</div>
        </div>
      </q-card-section>
    </q-card>

    <AllocationSelectionGrid :step="step" :gutter="attrs.gutter" />
  </div>
</template>

<script setup>
// Step 1 of the delivery wizard: which warehouse, then which allocated lines.
// A single-warehouse tenant gets a badge instead of a select it cannot answer.
import { computed, useAttrs, watch } from 'vue'
import AllocationSelectionGrid from '../AllocationSelectionGrid.vue'
import {
  useDeliverySelection,
  NODE,
  WAREHOUSE_REQUIRED
} from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'

defineOptions({ name: 'OutletDeliveriesAddSelectAllocations', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 1 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, pageState } = useDeliveryFormContext()

const {
  warehouseOptions,
  warehouseFilter,
  setWarehouseFilter,
  selectedCodes
} = useDeliverySelection()

const currentStep = computed(() => pageState?.meta?.currentStep || 1)
const isActive = computed(() => props.step == null || Number(props.step) === currentStep.value)

const options = computed(() => warehouseOptions.value)

const soleWarehouseLabel = computed(() =>
  options.value[0]?.label || 'No warehouse has items waiting')

// The sticky bar vetoes on the same condition; showing it on the field too tells the user
// where to look.
const showWarehouseError = computed(() =>
  options.value.length > 1 && !warehouseFilter.value && selectedCodes.value.length > 0)

// A run loads one van at one warehouse. With one warehouse there is no choice to make, so
// the filter is set rather than asked for. The sticky bar gates step 1 on the same fact
// but cannot see these rows, so it is published as a control for it to read.
watch(options, (list) => {
  pageState?.setControls(WAREHOUSE_REQUIRED, list.length > 1, NODE)
  if (list.length === 1 && warehouseFilter.value !== list[0].value) setWarehouseFilter(list[0].value)
}, { immediate: true })
</script>
