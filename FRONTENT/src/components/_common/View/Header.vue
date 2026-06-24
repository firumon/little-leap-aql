<template>
  <GenericHeaderPanel
    :label="config?.name || ''"
    :caption="code || ''"
    :icon="config?.ui?.icon || 'article'"
    :reload="true"
    :back="true"
    :chip="record?.Status || ''"
    :chip-color="statusColor"
    chip-text-color="white"
    @click="navigateBack"
  />
</template>

<script setup>
import { computed } from 'vue'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'ViewHeader' })

const nav = useResourceNav()

const props = defineProps({
  config: Object,
  record: Object,
  code: String
})

function navigateBack() {
  nav.goTo('list')
}

// Map status strings to Quasar color tokens
const statusColor = computed(() => {
  const status = (props.record?.Status || '').toString().toLowerCase().trim()
  if (['approved', 'active', 'completed', 'active'].includes(status)) return 'positive'
  if (['pending', 'draft', 'submitted', 'in progress'].includes(status)) return 'warning'
  if (['rejected', 'cancelled', 'inactive', 'closed'].includes(status)) return 'negative'
  return 'primary'
})
</script>
