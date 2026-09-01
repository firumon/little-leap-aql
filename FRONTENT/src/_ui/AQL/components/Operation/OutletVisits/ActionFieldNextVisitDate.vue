<template>
  <div class="row q-col-gutter-sm">
    <div class="col-6">
      <q-input
        v-model.number="daysModel"
        type="number"
        inputmode="numeric"
        min="0"
        label="In days"
        outlined
        clearable
        hide-bottom-space
      />
    </div>
    <div class="col-6">
      <AppDate
        v-model="dateModel"
        :label="config.label || 'Next Visit Date'"
        outlined
        clearable
        hide-bottom-space
      />
    </div>
  </div>
</template>

<script setup>
// The nextVisit target's Date, as two linked boxes. The DATE is the one stored answer —
// the day count is derived from it, so the two can never disagree.
import { computed, inject, watch } from 'vue'
import AppDate from 'components/shared/AppDate.vue'
import { useOutletOperatingRulesResource } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import { visitDateFrom, visitDaysBetween } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'

defineOptions({ name: 'OutletVisitsActionFieldNextVisitDate', inheritAttrs: false })

const props = defineProps({
  actionName: { type: String, default: '' },
  resource:   { type: String, default: '' },
  field:      { type: Object, default: () => ({}) },
  groupKey:   { type: String, default: '' },
  record:     { type: Object, default: () => ({}) },
  config:     { type: Object, default: () => ({}) },
  header:     { type: String, default: '' }
})

const pageState = inject('pageState')
// The cadence is the rules domain's answer, asked for by name. No store read, no scan.
const { visitFrequencyOf } = useOutletOperatingRulesResource()

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const today = () => new Date().toISOString().slice(0, 10)

// Same address the dialog would have used: source fields sit under `fields`, a target's
// under `targets`.
const path = computed(() =>
  `${props.groupKey ? 'targets' : 'fields'}.${props.field.address || props.header}`)

const dateModel = computed({
  get: () => pageState.getActions(props.actionName, path.value, props.resource) || '',
  set: (value) => pageState.setActions(props.actionName, path.value, value || '', props.resource)
})

// The outlet the officer picked on this same action, read straight off the queued entry.
const outletCode = computed(() =>
  String(pageState.getActions(props.actionName, 'fields.OutletCode', props.resource) || '').trim())

const frequencyDays = computed(() => visitFrequencyOf(outletCode.value))

const daysModel = computed({
  get: () => visitDaysBetween(today(), dateModel.value),
  set: (value) => {
    if (value === null || value === '') return (dateModel.value = '')
    dateModel.value = visitDateFrom(today(), Math.max(0, Math.round(num(value))))
  }
})

// Suggest the cadence when the outlet changes. Only ever fills a blank box, so a date the
// officer typed — or deliberately cleared — is never overwritten.
watch(outletCode, () => {
  if (frequencyDays.value > 0) dateModel.value = visitDateFrom(today(), frequencyDays.value)
})
</script>
