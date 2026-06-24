<template>
  <GenericHeaderPanel
    :label="'Create New ' + (config?.name || '')"
    :caption="'Fill out the form below to add a new record'"
    :icon="config?.ui?.icon || 'add_box'"
    :reload="false"
    :back="true"
    @click="navigateBack"
  />
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'AddHeader' })

const nav = useResourceNav()

defineProps({
  config: Object
})

function navigateBack() {
  nav.goTo('list')
}
</script>
