<template>
  <component
    :is="resolvedComponent"
    v-slot="{ label, icon, color, submitting, disabled }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @submit="$emit('submit')"
  />
  <q-btn
    v-else
    type="submit"
    :label="finalProps.label"
    :icon="finalProps.icon"
    :color="finalProps.color"
    :loading="finalProps.submitting"
    :disabled="finalProps.disabled"
    unelevated
    @click="$emit('submit')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'ActionSubmit' })

const props = defineProps({
  label: { type: String, default: 'Execute' },
  icon: { type: String, default: 'check' },
  color: { type: String, default: 'primary' },
  submitting: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  page: { type: String, default: 'Action' }
})

defineEmits(['submit'])

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'ActionSubmit',
  page: props.page
})

const preparedProps = computed(() => ({
  label: props.label,
  icon: props.icon,
  color: props.color,
  submitting: props.submitting,
  disabled: props.disabled
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
