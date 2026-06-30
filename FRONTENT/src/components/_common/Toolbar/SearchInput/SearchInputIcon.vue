<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />
  <q-icon v-else name="search" color="grey-6" />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SearchInputIcon' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'SearchInputIcon',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
