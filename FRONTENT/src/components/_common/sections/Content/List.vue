<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback to AqlList directly -->
  <AqlList
    v-else
    v-bind="finalProps"
    @click="handleItemClick"
  />
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useDefaultListProps } from 'src/composables/resources/useDefaultListProps'
import AqlList from 'components/shared/AqlList.vue'

defineOptions({ name: 'CommonList', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] },
  resolvedFields: { type: Array, default: () => [] },
  page: { type: String, default: 'Index' }
})

const emit = defineEmits(['navigate-to-view'])
const nav = useResourceNav()
const attrs = useAttrs()

// Generate default props for AqlList based on resolvedFields
const defaultProps = computed(() => useDefaultListProps(props.resolvedFields))

// Combine defaults with props and raw attribute overrides
const preparedProps = computed(() => ({
  ...defaultProps.value,
  items: props.items,
  ...attrs
}))

// Resolve own local override
const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'List',
  page: props.page,
  preparedProps
})

function handleItemClick(item) {
  emit('navigate-to-view', item)
  nav.goTo('view', { code: item.Code || item })
}
</script>
