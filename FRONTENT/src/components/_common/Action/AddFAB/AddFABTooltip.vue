<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />
  <q-tooltip v-else anchor="top middle" self="bottom middle" :offset="[0, 8]">
    Add New
  </q-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'AddFABTooltip' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'AddFABTooltip',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
