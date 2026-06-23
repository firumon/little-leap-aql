<template>
  <div class="row q-mt-md q-gutter-sm justify-end">
    <q-btn flat no-caps label="Cancel" icon="arrow_back" @click="$emit('cancel')" />
    <q-btn
      unelevated no-caps
      :color="color"
      :label="label"
      :icon="icon"
      :loading="isLoading"
      :disable="isDisabled"
      @click="$emit('submit')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // ActionPage props
  actionLabel: { type: String, default: undefined },
  actionIcon: { type: String, default: undefined },
  actionColor: { type: String, default: undefined },
  submitting: { type: Boolean, default: undefined },
  submitDisabled: { type: Boolean, default: undefined },

  // AddPage / EditPage props
  submitLabel: { type: String, default: undefined },
  saving: { type: Boolean, default: undefined }
})

defineEmits(['cancel', 'submit'])

const label = computed(() => props.actionLabel ?? props.submitLabel ?? 'Submit')
const icon = computed(() => props.actionIcon ?? 'check')
const color = computed(() => props.actionColor ?? 'primary')
const isLoading = computed(() => props.submitting ?? props.saving ?? false)
const isDisabled = computed(() => props.submitDisabled ?? false)
</script>
