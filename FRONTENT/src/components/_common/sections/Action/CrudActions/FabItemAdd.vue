<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @add="$emit('add')"
  />
  <q-fab-action
    v-else
    :color="finalProps.color"
    :icon="finalProps.icon"
    :label="finalProps.label"
    :label-position="finalProps.labelPosition"
    :external-label="finalProps.externalLabel"
    :label-class="finalProps.labelClass"
    @click="$emit('add')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'CrudActionsFabItemAdd' })

const props = defineProps({
  permissions: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: String, default: 'primary' },
  icon: { type: String, default: 'add' },
  label: { type: String, default: 'Add New' },
  labelPosition: { type: String, default: 'left' },
  externalLabel: { type: Boolean, default: true },
  labelClass: { type: String, default: 'text-weight-bold bg-white text-grey-9 q-px-sm q-py-xs shadow-1 rounded-borders' }
})

defineEmits(['add'])

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
  sectionName: 'CrudActionsFabItemAdd',
  page: props.page,
  preparedProps
})
</script>
