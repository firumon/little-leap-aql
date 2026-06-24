<template>
  <GenericHeaderPanel
    :label="actionConfig?.label || actionName"
    :caption="'Run workflow action on: ' + (record?.Code || '')"
    :icon="actionConfig?.icon || 'check'"
    :reload="false"
    :back="true"
    @click="navigateBack"
  />
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'ActionHeader' })

const nav = useResourceNav()

defineProps({
  actionConfig: Object,
  actionName: String,
  record: Object
})

function navigateBack() {
  nav.goTo('view')
}
</script>
