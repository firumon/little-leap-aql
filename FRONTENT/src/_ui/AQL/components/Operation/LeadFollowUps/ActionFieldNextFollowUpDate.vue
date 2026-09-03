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
        :label="config.label || 'Next Follow Up Date'"
        outlined
        clearable
        hide-bottom-space
      />
    </div>
  </div>
</template>

<script setup>
// The nextFollowUp target's Date, as two linked boxes. The DATE is the one stored answer —
// the day count is derived from it, so the two can never disagree.
import { computed, inject } from 'vue'
import AppDate from 'components/shared/AppDate.vue'
import { addDays, daysFromToday, toDateOnly } from 'src/utils/dateHelpers'

defineOptions({ name: 'LeadFollowUpsActionFieldNextFollowUpDate', inheritAttrs: false })

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

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

// Same address the dialog would have used: source fields sit under `fields`, a target's
// under `targets`.
const path = computed(() =>
  `${props.groupKey ? 'targets' : 'fields'}.${props.field.address || props.header}`)

const dateModel = computed({
  get: () => pageState.getActions(props.actionName, path.value, props.resource) || '',
  set: (value) => pageState.setActions(props.actionName, path.value, value || '', props.resource)
})

const daysModel = computed({
  get: () => {
    const days = daysFromToday(dateModel.value)
    return Number.isFinite(days) ? days : null
  },
  set: (value) => {
    if (value === null || value === '') return (dateModel.value = '')
    dateModel.value = toDateOnly(addDays(new Date(), Math.max(0, Math.round(num(value)))))
  }
})
</script>
