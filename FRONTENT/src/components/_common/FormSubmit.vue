<template>
  <q-btn
    type="submit"
    :label="label"
    :loading="saving"
    color="primary"
    unelevated
    icon="save"
    @click="$emit('submit')"
  />
</template>

<script setup>
defineOptions({ name: 'FormSubmit' })

defineProps({
  label: { type: String, default: 'Save' },
  saving: { type: Boolean, default: false }
})

defineEmits(['submit'])
</script>
