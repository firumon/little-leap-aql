<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Approved requisition</div>

        <div v-if="!eligibleRequisitions.length" class="text-center q-py-lg">
          <q-icon name="inbox" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing to source</div>
          <div :class="ui.emptyCaptionClass">No approved requisition is waiting for an RFQ.</div>
        </div>

        <q-list v-else separator>
          <q-item
            v-for="option in eligibleRequisitions"
            :key="option.code"
            clickable
            :active="option.code === selectedRequisitionCode"
            active-class="bg-blue-1"
            @click="selectRequisition(option.code)"
          >
            <q-item-section side top>
              <q-radio
                :model-value="selectedRequisitionCode"
                :val="option.code"
                :style="ui.tapTargetStyle"
                :aria-label="`Select ${option.label}`"
                @update:model-value="selectRequisition"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ option.label }}</q-item-label>
              <q-item-label caption>{{ option.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-card v-if="availableItems.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-medium">Items to quote</div>
          <q-btn flat dense no-caps color="primary" label="Select all" @click="selectAllItems" />
        </div>

        <q-list separator>
          <q-item v-for="item in availableItems" :key="item.code" clickable @click="toggleItem(item.code)">
            <q-item-section side top>
              <q-checkbox
                :model-value="isSelected(item.code)"
                :style="ui.tapTargetStyle"
                :aria-label="`Select ${item.primary}`"
                @update:model-value="toggleItem(item.code)"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ item.primary }}</q-item-label>
              <q-item-label caption>{{ item.secondary }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <span class="text-body2">{{ item.quantity }} {{ item.uom }}</span>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddSelectRequisition', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  eligibleRequisitions,
  selectedRequisitionCode,
  availableItems,
  selectedItemCodes,
  selectRequisition,
  toggleItem,
  selectAllItems,
  currentStep
} = useRFQAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
const selectedSet = computed(() => new Set(selectedItemCodes.value))

function isSelected (code) {
  return selectedSet.value.has(code)
}
</script>
