<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @click="$emit('click')"
  />
  <q-fab-action
    v-else
    :color="resolvedColor"
    :icon="resolvedIcon"
    :label="resolvedLabel"
    :label-position="finalProps.labelPosition"
    :external-label="finalProps.externalLabel"
    :label-class="finalProps.labelClass"
    @click="$emit('click')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'AdditionalActionsFabItem' })

const props = defineProps({
  action: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: [String, Function], default: 'secondary' },
  icon: { type: [String, Function], default: 'bolt' },
  label: { type: [String, Function], default: '' },
  labelPosition: { type: String, default: 'left' },
  externalLabel: { type: Boolean, default: true },
  labelClass: { type: String, default: 'text-weight-bold bg-white text-grey-9 q-px-sm q-py-xs shadow-1 rounded-borders' }
})

defineEmits(['click'])

const preparedProps = computed(() => ({
  action: props.action,
  color: typeof props.color === 'function' ? props.color : (props.action.color || props.color),
  icon: typeof props.icon === 'function' ? props.icon : (props.action.icon || props.icon),
  label: typeof props.label === 'function' ? props.label : (props.action.label || props.action.action || props.label),
  labelPosition: props.labelPosition,
  externalLabel: props.externalLabel,
  labelClass: props.labelClass
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'AdditionalActionsFabItem',
  page: props.page,
  preparedProps
})

const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(props.action) : c
})

const resolvedIcon = computed(() => {
  const i = finalProps.value.icon
  return typeof i === 'function' ? i(props.action) : i
})

const resolvedLabel = computed(() => {
  const l = finalProps.value.label
  return typeof l === 'function' ? l(props.action) : l
})
</script>
