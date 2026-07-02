<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @view="$emit('view')"
  />
  <q-fab-action
    v-else
    :color="finalProps.color"
    :icon="finalProps.icon"
    :label="finalProps.label"
    :label-position="finalProps.labelPosition"
    :external-label="finalProps.externalLabel"
    :label-class="finalProps.labelClass"
    @click="$emit('view')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'CrudActionsFabItemView' })

const props = defineProps({
  permissions: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: String, default: 'primary' },
  icon: { type: String, default: 'visibility' },
  label: { type: String, default: 'View' },
  labelPosition: { type: String, default: 'left' },
  externalLabel: { type: Boolean, default: true },
  labelClass: { type: String, default: 'text-weight-bold bg-white text-grey-9 q-px-sm q-py-xs shadow-1 rounded-borders' }
})

defineEmits(['view'])

const preparedProps = computed(() => ({
  permissions: props.permissions,
  color: props.color,
  icon: props.icon,
  label: props.label,
  labelPosition: props.labelPosition,
  externalLabel: props.externalLabel,
  labelClass: props.labelClass
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'CrudActionsFabItemView',
  page: props.page,
  preparedProps
})
</script>
