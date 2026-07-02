<template>
  <component
    :is="resolvedComponent"
    v-slot="{ label, saving, disabled, color, unelevated, icon }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @submit="$emit('submit')"
  />
  <q-btn
    v-else
    type="submit"
    :label="resolvedLabel"
    :loading="finalProps.saving"
    :disable="finalProps.disabled"
    :color="resolvedColor"
    :unelevated="resolvedUnelevated"
    :icon="resolvedIcon"
    @click="$emit('submit')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'FormActionsFormSubmit' })

const props = defineProps({
  label: { type: [String, Function], default: 'Save' },
  saving: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  color: { type: [String, Function], default: 'primary' },
  unelevated: { type: [Boolean, Function], default: true },
  icon: { type: [String, Function], default: 'save' },
  page: { type: String, default: 'Add' }
})

defineEmits(['submit'])

const preparedProps = computed(() => ({
  label: props.label,
  saving: props.saving,
  disabled: props.disabled,
  color: props.color,
  unelevated: props.unelevated,
  icon: props.icon
}))

const { resolvedComponent, finalProps, resourceRecord } = useCommonSection({
  sectionName: 'FormActionsFormSubmit',
  page: props.page,
  preparedProps
})

const resolvedLabel = computed(() => {
  const l = finalProps.value.label
  return typeof l === 'function' ? l(resourceRecord?.value, props) : l
})

const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(resourceRecord?.value, props) : c
})

const resolvedUnelevated = computed(() => {
  const u = finalProps.value.unelevated
  return typeof u === 'function' ? u(resourceRecord?.value, props) : u
})

const resolvedIcon = computed(() => {
  const i = finalProps.value.icon
  return typeof i === 'function' ? i(resourceRecord?.value, props) : i
})
</script>
