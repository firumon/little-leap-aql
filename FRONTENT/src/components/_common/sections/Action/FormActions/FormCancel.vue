<template>
  <component
    :is="resolvedComponent"
    v-slot="{ label, icon, color, flat, page }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
  />
  <q-btn
    v-else
    :flat="resolvedFlat"
    :color="resolvedColor"
    :label="resolvedLabel"
    :icon="resolvedIcon"
    @click="$emit('cancel')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'FormActionsFormCancel' })

const props = defineProps({
  label: { type: [String, Function], default: 'Cancel' },
  icon: { type: [String, Function], default: 'close' },
  color: { type: [String, Function], default: 'grey-7' },
  flat: { type: [Boolean, Function], default: true },
  page: { type: String, default: 'Add' }
})

defineEmits(['cancel'])

const preparedProps = computed(() => ({
  label: props.label,
  icon: props.icon,
  color: props.color,
  flat: props.flat
}))

const { resolvedComponent, finalProps, resourceRecord } = useCommonSection({
  sectionName: 'FormActionsFormCancel',
  page: props.page,
  preparedProps
})

const resolvedFlat = computed(() => {
  const f = finalProps.value.flat
  return typeof f === 'function' ? f(resourceRecord?.value, props) : f
})

const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(resourceRecord?.value, props) : c
})

const resolvedLabel = computed(() => {
  const l = finalProps.value.label
  return typeof l === 'function' ? l(resourceRecord?.value, props) : l
})

const resolvedIcon = computed(() => {
  const i = finalProps.value.icon
  return typeof i === 'function' ? i(resourceRecord?.value, props) : i
})
</script>
