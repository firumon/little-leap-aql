<template>
  <div class="column q-gutter-md">
    <q-select :model-value="form.OutletCode" :options="outletOptions" label="Outlet" emit-value map-options outlined @update:model-value="$emit('outlet-change', $event)" />

    <div class="row q-col-gutter-sm text-caption text-grey-7">
      <div class="col-6">
        <div class="text-grey-6">Date</div>
        <div class="text-weight-medium text-dark">{{ form.Date }}</div>
      </div>
      <div class="col-6">
        <div class="text-grey-6">User</div>
        <div class="text-weight-medium text-dark">{{ form.Username || '-' }}</div>
      </div>
    </div>

    <q-list bordered separator class="rounded-borders">
      <q-item-label header>Planned Visit</q-item-label>
      <q-item v-if="!plannedVisits.length">
        <q-item-section>
          <q-item-label>No planned visit</q-item-label>
          <q-item-label caption>{{ emptyDiagnosticsMessage }}</q-item-label>
          <q-item-label v-if="progressDistribution" caption>Progress distribution: {{ progressDistribution }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item v-for="visit in plannedVisits" :key="visit.Code" clickable :active="visit.Code === form.OutletVisitCode" @click="$emit('select-visit', visit.Code)">
        <q-item-section>
          <q-item-label>{{ visit.Code }}</q-item-label>
          <q-item-label caption>{{ visit.Date }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-checkbox :model-value="visit.Code === form.OutletVisitCode && checklist.completeVisit" @update:model-value="$emit('update-checklist', { completeVisit: $event })" />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'OutletConsumptionContextStep' })
const props = defineProps({
  form: { type: Object, required: true },
  checklist: { type: Object, required: true },
  outletOptions: { type: Array, default: () => [] },
  plannedVisits: { type: Array, default: () => [] },
  visitDiagnostics: { type: Object, default: () => ({}) }
})
defineEmits(['outlet-change', 'select-visit', 'update-checklist'])

const emptyDiagnosticsMessage = computed(() => {
  const diagnostics = props.visitDiagnostics || {}
  if (!props.form?.OutletCode) return 'Select an outlet to load planned visit options.'
  if (!diagnostics.totalLoaded) return 'No OutletVisits are loaded for the current user/cache. Consumption can still be recorded.'
  if (!diagnostics.matchingOutletCount) return `Loaded ${diagnostics.totalLoaded} OutletVisits, but none match outlet ${props.form.OutletCode}. Consumption can still be recorded.`
  if (!diagnostics.activePlannedCount) return `${diagnostics.matchingOutletCount} visit(s) match this outlet, but none are active with progress PLANNED. Consumption can still be recorded.`
  return 'Consumption can still be recorded.'
})

const progressDistribution = computed(() => {
  const counts = props.visitDiagnostics?.progressCounts || {}
  return Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(', ')
})
</script>
