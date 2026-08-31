<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-medium">Suppliers to invite</div>
          <div class="text-caption text-grey-7">{{ selectedSupplierCodes.length }} selected</div>
        </div>

        <div v-if="!availableSuppliers.length" class="text-center q-py-lg">
          <q-icon name="group_off" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No active suppliers</div>
          <div :class="ui.emptyCaptionClass">Add a supplier before sending an RFQ out.</div>
        </div>

        <q-list v-else separator>
          <q-item v-for="supplier in availableSuppliers" :key="supplier.code" clickable @click="toggleSupplier(supplier.code)">
            <q-item-section side top>
              <q-checkbox
                :model-value="isSelected(supplier.code)"
                :style="ui.tapTargetStyle"
                :aria-label="`Select ${supplier.name}`"
                @update:model-value="toggleSupplier(supplier.code)"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ supplier.name }}</q-item-label>
              <q-item-label caption>{{ captionOf(supplier) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <q-banner dense rounded class="bg-grey-2 q-mt-sm text-caption">
          Suppliers picked here are assigned to the RFQ. Dispatch them from the RFQ page
          when the paperwork actually goes out.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddSupplierSelection', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, availableSuppliers, selectedSupplierCodes, toggleSupplier, currentStep } = useRFQAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
const selectedSet = computed(() => new Set(selectedSupplierCodes.value))

function isSelected (code) {
  return selectedSet.value.has(code)
}

function captionOf (supplier) {
  return [supplier.country, supplier.contact].filter(Boolean).join(' • ')
}
</script>
