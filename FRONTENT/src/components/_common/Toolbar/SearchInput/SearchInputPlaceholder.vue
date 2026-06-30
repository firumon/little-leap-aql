<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />
  <span v-else>Search code, name, or any field...</span>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SearchInputPlaceholder' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'SearchInputPlaceholder',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
