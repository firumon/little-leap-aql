<template>
  <component
    :is="resolvedComponent"
    v-slot="{ position, offset }"
    v-if="resolvedComponent"
    v-bind="finalProps"
  >
    <slot />
  </component>
  <q-page-sticky
    v-else
    :position="finalProps.position"
    :offset="finalProps.offset"
    style="z-index: 30;"
  >
    <slot />
  </q-page-sticky>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'AdditionalActionsPageSticky' })

const props = defineProps({
  position: { type: String, default: 'bottom-right' },
  offset: { type: Array, default: () => [80, 18] },
  page: { type: String, required: true }
})

const preparedProps = computed(() => ({
  position: props.position,
  offset: props.offset
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'AdditionalActionsPageSticky',
  page: props.page,
  preparedProps
})
</script>
