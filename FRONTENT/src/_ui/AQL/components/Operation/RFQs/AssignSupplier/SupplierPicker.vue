<template>
  <div :class="gutterClass">
    <q-banner v-if="!canAssign && rfq" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This RFQ is closed or cancelled, so no more suppliers can be added.
    </q-banner>

    <q-card v-else flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-medium">Choose suppliers</div>
          <div class="text-caption text-grey-7">{{ selectedSupplierCodes.length }} of {{ availableSuppliers.length }} selected</div>
        </div>

        <div v-if="!availableSuppliers.length" class="text-center q-py-lg">
          <q-icon name="group_off" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No suppliers left</div>
          <div :class="ui.emptyCaptionClass">Every active supplier is already on this RFQ.</div>
        </div>

        <q-list v-else separator>
          <q-item
            v-for="supplier in availableSuppliers"
            :key="supplier.code"
            clickable
            @click="toggleSupplier(supplier.code)"
          >
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
      </q-card-section>
    </q-card>

    <q-card v-if="assignedDetails.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Already assigned</div>
        <div :class="ui.detailGridClass">
          <div
            v-for="row in assignedDetails"
            :key="row.code"
            class="items-center"
            :class="[ui.detailLineClass]"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ row.name }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-badge rounded :color="supplierProgressColor(row.progress)" :label="supplierProgressLabel(row.progress)" />
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQSupplierFlowContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQSupplierFlowContext'

defineOptions({ name: 'RFQsAssignSupplierSupplierPicker', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  rfq,
  canAssign,
  availableSuppliers,
  assignedDetails,
  selectedSupplierCodes,
  toggleSupplier,
  supplierProgressColor,
  supplierProgressLabel
} = useRFQSupplierFlowContext()

const selectedSet = computed(() => new Set(selectedSupplierCodes.value))

function isSelected (code) {
  return selectedSet.value.has(code)
}

function captionOf (supplier) {
  return [supplier.country, supplier.contact].filter(Boolean).join(' • ')
}
</script>
