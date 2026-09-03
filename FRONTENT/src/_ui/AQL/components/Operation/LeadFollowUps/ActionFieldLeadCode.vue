<template>
  <q-select
    v-model="model"
    :options="options"
    :label="config.label || 'Lead'"
    outlined
    emit-value
    map-options
    use-input
    input-debounce="200"
    hide-bottom-space
    @filter="onFilter"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey-6">No open lead left</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
// The action config sources every lead. A settled lead needs no follow-up, so only
// Draft and Processing ones are offered here.
import { computed, inject, ref, watch } from 'vue'
import { useLeadResource } from 'src/_resource/Master/Leads/composables/useLeadResource'

defineOptions({ name: 'LeadFollowUpsActionFieldLeadCode', inheritAttrs: false })

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
const { openLeads } = useLeadResource()

const path = computed(() =>
  `${props.groupKey ? 'targets' : 'fields'}.${props.field.address || props.header}`)

const model = computed({
  get: () => pageState.getActions(props.actionName, path.value, props.resource) || null,
  set: (value) => pageState.setActions(props.actionName, path.value, value || '', props.resource)
})

const allOptions = computed(() =>
  openLeads.value.map((lead) => ({ label: lead.displayName, value: lead.code })))

const options = ref(allOptions.value)

watch(allOptions, (next) => { options.value = next })

function onFilter (needle, update) {
  update(() => {
    const term = String(needle || '').trim().toLowerCase()
    options.value = term
      ? allOptions.value.filter((option) => option.label.toLowerCase().includes(term))
      : allOptions.value
  })
}
</script>
