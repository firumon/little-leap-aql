<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
  />
  <q-btn
    v-else
    flat
    color="grey-7"
    label="Cancel"
    icon="close"
    @click="$emit('cancel')"
  />
</template>

<script setup>
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'FormCancel' })

const props = defineProps({
  page: { type: String, default: 'Add' }
})

defineEmits(['cancel'])

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'FormCancel',
  page: props.page
})
</script>
