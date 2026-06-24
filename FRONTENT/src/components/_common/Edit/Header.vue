<template>
  <GenericHeaderPanel
    :label="'Edit ' + (config?.name || '')"
    :caption="'Modifying record: ' + (code || '')"
    :icon="config?.ui?.icon || 'edit_note'"
    :reload="false"
    :back="true"
    @click="navigateBack"
  />
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'EditHeader' })

const nav = useResourceNav()

defineProps({
  config: Object,
  code: String
})

function navigateBack() {
  nav.goTo('view')
}
</script>
