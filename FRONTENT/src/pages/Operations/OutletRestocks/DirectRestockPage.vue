<template>
  <q-page padding>
    <HeaderPanel
      title="Direct Restock"
      subtitle="Stock replenishment · Instant delivery and auto-approval"
      class="q-mb-md"
    />

    <!-- Step Progress Indicator -->
    <StepProgressIndicator
      v-model="step"
      :steps="steps"
      clickable
      @click-step="goToStep"
    />

    <DirectRestockSetupStep
      v-if="step === 1"
      :warehouse-options="warehouseOptions"
      :outlet-options="outletOptions"
      :selected-warehouse-code="selectedWarehouseCode"
      :selected-outlet-code="selectedOutletCode"
      @select-warehouse="selectWarehouse"
      @select-outlet="selectOutlet"
    />

    <DirectRestockStockMatchStep
      v-else-if="step === 2"
      :rows="rows"
      :visit-options="visitOptions"
      :selected-visit-code="selectedVisitCode"
      :outlet-name="selectedOutletName"
      @update-qty="updateQuantity"
      @adjust-qty="adjustQuantity"
      @update-visit="val => selectedVisitCode = val"
    />

    <DirectRestockSummaryStep
      v-else-if="step === 3"
      :added-items="addedItems"
      :warehouse-name="selectedWarehouseName"
      :outlet-name="selectedOutletName"
      :submission-mode="submissionMode"
      :submit-comment="submitComment"
      @update-mode="val => submissionMode = val"
      @update-comment="val => submitComment = val"
    />

    <q-card flat class="bg-transparent">
      <q-card-actions align="between">
        <q-btn v-if="step === 1" flat label="Cancel" color="grey-7" @click="cancel" no-caps class="q-px-md"/>
        <q-btn v-else flat label="Back" color="grey-7" icon="arrow_back" @click="step--" no-caps class="q-px-md"/>

        <q-btn v-if="step === 1" color="primary" label="Next" icon-right="arrow_forward"
               :disable="!selectedWarehouseCode || !selectedOutletCode" @click="step = 2" no-caps
               class="q-px-md shadow-1"/>
        <q-btn v-else-if="step === 2" color="primary" label="Review" icon-right="arrow_forward"
               :disable="!addedItems.length" @click="step = 3" no-caps class="q-px-md shadow-1"/>
        <q-btn v-else-if="step === 3" color="primary" label="Submit Restock" icon="check" :loading="saving"
               @click="submitRestock" no-caps class="q-px-md shadow-1"/>
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useDirectRestock } from '../../../composables/operation/outlets/DirectRestock/useDirectRestock.js'
import StepProgressIndicator from '../../../components/shared/StepProgressIndicator.vue'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import DirectRestockSetupStep from '../../../components/operation/Outlets/DirectRestock/DirectRestockSetupStep.vue'
import DirectRestockStockMatchStep from '../../../components/operation/Outlets/DirectRestock/DirectRestockStockMatchStep.vue'
import DirectRestockSummaryStep from '../../../components/operation/Outlets/DirectRestock/DirectRestockSummaryStep.vue'

defineOptions({ name: 'DirectRestockPage' })

const flow = useDirectRestock()

const steps = [
  { name: 1, label: 'Setup', icon: 'settings' },
  { name: 2, label: 'Items', icon: 'inventory_2' },
  { name: 3, label: 'Review', icon: 'fact_check' }
]

const {
  step,
  saving,
  selectedWarehouseCode,
  selectedOutletCode,
  selectedVisitCode,
  rows,
  submissionMode,
  submitComment,
  warehouseOptions,
  outletOptions,
  visitOptions,
  addedItems,
  loadInitialData,
  selectWarehouse,
  selectOutlet,
  updateQuantity,
  adjustQuantity,
  submitRestock,
  cancel
} = flow

// Resolve descriptive names for labels
const selectedWarehouseName = computed(() => {
  const match = warehouseOptions.value.find(w => w.value === selectedWarehouseCode.value)
  return match ? match.label : selectedWarehouseCode.value || 'None Selected'
})

const selectedOutletName = computed(() => {
  const match = outletOptions.value.find(o => o.value === selectedOutletCode.value)
  if (!match) return selectedOutletCode.value || 'None Selected'
  return match.label
})

function goToStep(targetStep) {
  if (targetStep < step.value) {
    step.value = targetStep
  } else if (targetStep === 2 && selectedWarehouseCode.value && selectedOutletCode.value) {
    step.value = 2
  } else if (targetStep === 3 && addedItems.value.length > 0) {
    step.value = 3
  }
}

onMounted(async () => {
  await loadInitialData(true)
})
</script>

<style scoped>
.border-grey {
  border: 1px solid #e2e8f0;
}
.bg-grey-0 {
  background-color: #f8fafc;
}
.primary-light {
  background-color: #e3f2fd;
}
.animate-fade-in {
  animation: fadeIn 0.15s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>

