<template>
  <q-page class="column no-scroll">
    <OutletHeaderPanel title="Record Outlet Consumption" subtitle="Count stock and submit outlet side effects." class="q-pa-md" />

    <!-- Step Progress Indicator -->
    <div class="row items-center justify-around q-px-lg q-pb-md q-mt-md">
      <div v-for="s in steps" :key="s.name" class="column items-center" style="min-width: 72px">
        <q-avatar
          :size="step >= s.name ? '36px' : '32px'"
          :color="step >= s.name ? 'primary' : 'grey-4'"
          :text-color="step >= s.name ? 'white' : 'grey-7'"
          :class="step === s.name ? 'shadow-3' : ''"
        >
          <q-icon :name="step > s.name ? 'check' : s.icon" size="18px" />
        </q-avatar>
        <div class="text-caption q-mt-xs" :class="step >= s.name ? 'text-weight-bold text-primary' : 'text-grey-7'">{{ s.label }}</div>
      </div>
    </div>

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
        @update-current="updateCurrentQty"
        @increment="incrementCurrent"
        @decrement="decrementCurrent"
      />
      <OutletConsumptionSummaryStep
        v-if="step === 3"
        :sold-rows="soldRows"
        :restock-rows="restockRows"
        :sku-options="skuOptions"
        :checklist="checklist"
        :has-visit="!!form.OutletVisitCode"
        @update-restock="updateRestockRow"
        @add-restock="onAddRestock"
        @remove-restock="removeRestockRow"
        @update-checklist="updateChecklist"
      />
    </div>

    <!-- Fixed Bottom Navigation -->
    <div class="row items-center justify-between q-pa-md bg-white border-top">
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
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletConsumptionContextStep from '../../../components/Operations/Outlets/OutletConsumptionContextStep.vue'
import OutletConsumptionStockCountStep from '../../../components/Operations/Outlets/OutletConsumptionStockCountStep.vue'
import OutletConsumptionSummaryStep from '../../../components/Operations/Outlets/OutletConsumptionSummaryStep.vue'

defineOptions({ name: 'OutletConsumptionAddPage' })

const route = useRoute()

const steps = [
  { name: 1, label: 'Outlet', icon: 'storefront' },
  { name: 2, label: 'Count', icon: 'inventory_2' },
  { name: 3, label: 'Summary', icon: 'fact_check' }
]

const step = ref(1)
const flow = useOutletConsumption()
const { form, checklist, stockRows, restockRows, soldRows, outletOptions, allPlannedVisits, plannedVisits, plannedVisitDiagnostics, skuOptions, saving, reload, onOutletChange, selectVisit, updateCurrentQty, incrementCurrent, decrementCurrent, updateRestockRow, addRestockRow, removeRestockRow, saveConsumption, cancel, skuName, text } = flow

function updateChecklist(patch) { Object.assign(checklist.value, patch) }
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

<style scoped>
.border-top {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
