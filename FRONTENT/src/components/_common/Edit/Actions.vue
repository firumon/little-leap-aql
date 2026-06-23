<template>
  <div class="row q-mt-md q-gutter-sm justify-end">
    <q-btn flat no-caps label="Cancel" icon="arrow_back" @click="$emit('cancel')" />
    <q-btn
      unelevated no-caps color="primary"
      :label="submitLabel" icon="check"
      :loading="saving"
      @click="$emit('submit')"
    />
  </div>
</template>

<script setup>
defineProps({
  submitLabel: { type: String, default: 'Update' },
  saving: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])
</script>
