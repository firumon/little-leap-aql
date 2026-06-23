<template>
  <div class="row q-mt-md q-gutter-sm justify-end">
    <q-btn flat no-caps label="Cancel" icon="arrow_back" @click="$emit('cancel')" />
    <q-btn
      unelevated no-caps
      :color="actionColor"
      :label="actionLabel"
      :icon="actionIcon"
      :loading="submitting"
      :disable="submitDisabled"
      @click="$emit('submit')"
    />
  </div>
</template>

<script setup>
defineProps({
  actionLabel: { type: String, default: 'Submit' },
  actionIcon: { type: String, default: 'check' },
  actionColor: { type: String, default: 'primary' },
  submitting: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])
</script>
