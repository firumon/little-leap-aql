<template>
  <q-btn
    type="submit"
    :label="label"
    :icon="icon"
    :color="color"
    :loading="submitting"
    :disabled="disabled"
    unelevated
    @click="$emit('submit')"
  />
</template>

<script setup>
defineOptions({ name: 'ActionSubmit' })

defineProps({
  label: { type: String, default: 'Execute' },
  icon: { type: String, default: 'check' },
  color: { type: String, default: 'primary' },
  submitting: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

defineEmits(['submit'])
</script>
