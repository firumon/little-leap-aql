<template>
  <q-page padding>
    <OutletHeaderPanel title="Record Outlet Consumption" subtitle="Count stock and submit outlet side effects." class="q-mb-md" />

    <q-stepper v-model="step" flat bordered color="primary" animated header-nav>
      <q-step :name="1" title="Outlet" icon="storefront" :done="!!form.OutletCode">
        <OutletConsumptionContextStep
          :form="form"
          :checklist="checklist"
          :outlet-options="outletOptions"
          :planned-visits="plannedVisits"
          :visit-diagnostics="plannedVisitDiagnostics"
          @outlet-change="onOutletChange"
          @select-visit="selectVisit"
          @update-checklist="updateChecklist"
        />
      </q-step>

      <q-step :name="2" title="Count" icon="inventory_2" :done="soldRows.length > 0">
        <OutletConsumptionStockCountStep
          :rows="stockRows"
          @update-current="updateCurrentQty"
          @increment="incrementCurrent"
          @decrement="decrementCurrent"
          @set-zero="setCurrentToZero"
          @set-system="setCurrentToSystem"
        />
      </q-step>

      <q-step :name="3" title="Summary" icon="fact_check">
        <OutletConsumptionSummaryStep
          :sold-rows="soldRows"
          :restock-rows="restockRows"
          :sku-options="skuOptions"
          :checklist="checklist"
          :has-visit="!!form.OutletVisitCode"
          @update-restock="updateRestockRow"
          @add-restock="addRestockRow"
          @remove-restock="removeRestockRow"
          @update-checklist="updateChecklist"
        />
      </q-step>

      <template #navigation>
        <q-stepper-navigation class="row justify-between">
          <q-btn flat label="Cancel" @click="cancel" />
          <div class="row q-gutter-sm">
            <q-btn v-if="step > 1" flat label="Back" @click="step--" />
            <q-btn v-if="step < 3" color="primary" label="Next" @click="step++" />
            <q-btn v-else color="primary" label="Submit Consumption" :loading="saving" @click="saveConsumption" />
          </div>
        </q-stepper-navigation>
      </template>
    </q-stepper>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletConsumptionContextStep from '../../../components/Operations/Outlets/OutletConsumptionContextStep.vue'
import OutletConsumptionStockCountStep from '../../../components/Operations/Outlets/OutletConsumptionStockCountStep.vue'
import OutletConsumptionSummaryStep from '../../../components/Operations/Outlets/OutletConsumptionSummaryStep.vue'

defineOptions({ name: 'OutletConsumptionAddPage' })
const step = ref(1)
const flow = useOutletConsumption()
const { form, checklist, stockRows, restockRows, soldRows, outletOptions, plannedVisits, plannedVisitDiagnostics, skuOptions, saving, reload, onOutletChange, selectVisit, updateCurrentQty, incrementCurrent, decrementCurrent, setCurrentToZero, setCurrentToSystem, updateRestockRow, addRestockRow, removeRestockRow, saveConsumption, cancel } = flow
function updateChecklist(patch) { Object.assign(checklist.value, patch) }
onMounted(() => reload())
</script>
