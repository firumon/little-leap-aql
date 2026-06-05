<template>
  <q-page class="column no-scroll">
    <OutletHeaderPanel title="Record Outlet Consumption" subtitle="Count stock and submit outlet side effects." class="q-pa-md" />

    <!-- Step Progress Indicator -->
    <StepProgressIndicator v-model="step" :steps="steps" />

    <!-- Step Content (scrollable) -->
    <div class="col scroll q-px-md">
      <OutletConsumptionContextStep
        v-if="step === 1"
        :form="form"
        :checklist="checklist"
        :outlet-options="outletOptions"
        :all-planned-visits="allPlannedVisits"
        :planned-visits="plannedVisits"
        :visit-diagnostics="plannedVisitDiagnostics"
        @outlet-change="onOutletChange"
        @select-visit="selectVisit"
        @update-checklist="updateChecklist"
      />
      <OutletConsumptionStockCountStep
        v-if="step === 2"
        :rows="stockRows"
        :sku-options="skuOptions"
        @update-current="updateCurrentQty"
        @increment="incrementCurrent"
        @decrement="decrementCurrent"
        @add-manual-return="addManualReturnSku"
        @remove-manual-return="removeManualReturnRow"
      />
      <OutletConsumptionSummaryStep
        v-if="step === 3"
        :sold-rows="soldRows"
        :restock-rows="restockRows"
        :sku-options="skuOptions"
        :checklist="checklist"
        :has-visit="!!form.OutletVisitCode"
        :return-rows="returnRows"
        :return-metadata="returnMetadata"
        :warehouse-options="warehouseOptions"
        :can-direct-restock="canDirectRestock"
        @update-restock="updateRestockRow"
        @add-restock="onAddRestock"
        @remove-restock="removeRestockRow"
        @update-checklist="updateChecklist"
        @update-return-metadata="updateReturnMetadata"
      />
    </div>

    <!-- Fixed Bottom Navigation -->
    <q-separator />
    <div class="row items-center justify-between q-pa-md bg-white">
<!--      <q-btn flat round icon="close" @click="cancel" />-->
      <div>&nbsp;</div>
      <div class="row q-gutter-sm">
        <q-btn v-if="step > 1" unelevated color="grey-3" text-color="dark" icon="arrow_back" label="Back" @click="step--" />
        <q-btn v-if="step < 3" unelevated color="primary" icon-right="arrow_forward" label="Next" @click="step++" />
        <q-btn v-else unelevated color="primary" icon="check" label="Submit" :loading="saving" @click="saveConsumption" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import StepProgressIndicator from '../../../components/shared/StepProgressIndicator.vue'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import OutletConsumptionContextStep from '../../../components/Operations/Outlets/OutletConsumption/OutletConsumptionContextStep.vue'
import OutletConsumptionStockCountStep from '../../../components/Operations/Outlets/OutletConsumption/OutletConsumptionStockCountStep.vue'
import OutletConsumptionSummaryStep from '../../../components/Operations/Outlets/OutletConsumption/OutletConsumptionSummaryStep.vue'

defineOptions({ name: 'OutletConsumptionAddPage' })

const route = useRoute()

const steps = [
  { name: 1, label: 'Outlet', icon: 'storefront' },
  { name: 2, label: 'Count', icon: 'inventory_2' },
  { name: 3, label: 'Summary', icon: 'fact_check' }
]

const step = ref(1)
const flow = useOutletConsumption()
const {
  form,
  checklist,
  stockRows,
  restockRows,
  soldRows,
  outletOptions,
  allPlannedVisits,
  plannedVisits,
  plannedVisitDiagnostics,
  skuOptions,
  saving,
  reload,
  onOutletChange,
  selectVisit,
  updateCurrentQty,
  incrementCurrent,
  decrementCurrent,
  updateRestockRow,
  addRestockRow,
  removeRestockRow,
  saveConsumption,
  cancel,
  skuName,
  text,
  returnRows,
  returnMetadata,
  warehouseOptions,
  addManualReturnSku,
  updateReturnMetadata,
  removeManualReturnRow,
  canDirectRestock,
  allowed
} = flow

function updateChecklist(patch) {
  Object.assign(checklist.value, patch)
  if (patch.restockSubmissionMode) {
    checklist.value.submitRestock = patch.restockSubmissionMode !== 'DRAFT'
  }
  if (patch.restockWarehouseCode) {
    localStorage.setItem('last_direct_restock_warehouse_code', patch.restockWarehouseCode)
  }
}
function onAddRestock(sku, qty) { restockRows.value.push({ SKU: sku, SkuLabel: skuName(sku), Quantity: qty || 0 }) }

onMounted(async () => {
  await reload()
  form.value.OutletCode = ''
  const queryOutlet = text(route.query.outletCode || '')
  const queryStep = parseInt(route.query.step, 10)
  if (queryOutlet) {
    onOutletChange(queryOutlet)
  }
  if (queryStep >= 1 && queryStep <= 3) {
    step.value = queryStep
  }
})
</script>

