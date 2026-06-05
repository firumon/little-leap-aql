<template>
  <div class="q-gutter-md">
    <!-- Planned Visit Quick-Access Cards -->
    <div>
      <div class="text-subtitle2 text-weight-medium q-mb-sm">Planned Visits</div>
      <div v-if="!allPlannedVisits.length" class="text-caption text-grey-7 q-mb-sm">
        No planned visits found. Select an outlet below to record consumption.
      </div>
      <q-card
        v-for="visit in allPlannedVisits"
        :key="visit.Code"
        flat
        bordered
        class="q-mb-sm cursor-pointer"
        :class="{ 'bg-primary text-white': visit.Code === form.OutletVisitCode }"
        @click="onSelectVisit(visit)"
      >
        <q-card-section class="q-pa-sm">
          <div class="row items-center no-wrap">
            <q-avatar color="primary" text-color="white" size="md" class="q-mr-sm">
              <q-icon name="event_note" size="18px" />
            </q-avatar>
            <div class="col">
              <div class="text-subtitle2 text-weight-bold">{{ outletName(visit.OutletCode) }}</div>
              <div class="text-caption" :class="visit.Code === form.OutletVisitCode ? 'text-grey-3' : 'text-grey-7'">
                {{ visit.Date }}
              </div>
            </div>
            <q-icon v-if="visit.Code === form.OutletVisitCode" name="check_circle" size="20px" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Outlet Selector Fallback -->
    <q-separator class="q-my-md" />
    <div>
      <div class="text-subtitle2 text-weight-medium q-mb-sm">All Outlets</div>
      <q-select
        :model-value="form.OutletCode"
        :options="outletFilterRef"
        :label="form.OutletCode ? outletLabel : 'Search or select an outlet...'"
        emit-value
        map-options
        outlined
        use-input
        hide-selected
        fill-input
        input-debounce="0"
        clearable
        @filter="filterOutlets"
        @update:model-value="onOutletSelect"
      >
        <template #no-option>
          <q-item><q-item-section class="text-grey">No matching outlets</q-item-section></q-item>
        </template>
      </q-select>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'OutletConsumptionContextStep' })
const props = defineProps({
  form: { type: Object, required: true },
  checklist: { type: Object, required: true },
  outletOptions: { type: Array, default: () => [] },
  allPlannedVisits: { type: Array, default: () => [] },
  plannedVisits: { type: Array, default: () => [] },
  visitDiagnostics: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['outlet-change', 'select-visit', 'update-checklist'])

const outletFilterRef = ref([])

watch(() => props.outletOptions, (opts) => { outletFilterRef.value = opts }, { immediate: true })

function filterOutlets(val, update) {
  if (val === '') {
    update(() => { outletFilterRef.value = props.outletOptions })
    return
  }
  update(() => {
    const needle = val.toLowerCase()
    outletFilterRef.value = props.outletOptions.filter(v => v.label.toLowerCase().indexOf(needle) > -1)
  })
}

function onOutletSelect(code) {
  if (code) emit('outlet-change', code)
}

function onSelectVisit(visit) {
  emit('outlet-change', visit.OutletCode)
  emit('select-visit', visit.Code)
}

function outletName(code) {
  const opt = props.outletOptions.find(o => o.value === code)
  return opt ? opt.label : code || 'Unknown outlet'
}

const outletLabel = computed(() => {
  const opt = props.outletOptions.find(o => o.value === props.form.OutletCode)
  return opt ? opt.label : props.form.OutletCode
})
</script>
