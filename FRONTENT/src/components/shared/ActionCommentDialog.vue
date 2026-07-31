<template>
  <AqlDialog
    :model-value="modelValue"
    :title="title"
    :icon="submitIcon || 'rate_review'"
    :variant="variant"
    :loading="saving"
    persistent
    max-width="520px"
    @update:model-value="emit('update:model-value', $event)"
    @cancel="handleCancel"
  >
    <!-- Optional Slot for extra fields (e.g., Date picker, Outlet Selector) -->
    <slot name="fields" />

    <!-- Comment/Reason text input -->
    <q-input
      v-model="comment"
      type="textarea"
      :label="label"
      outlined
      class="aql-dialog-field"
      :rows="commentRows"
      :rules="commentRequired ? [val => !!val || 'This field is required'] : []"
      lazy-rules
      hide-bottom-space
    />

    <!-- Confirm stays a ResourceActionButton: it carries the per-action permission
         gate, which the generic footer button has no way to evaluate. -->
    <template #actions>
      <q-btn
        flat
        no-caps
        label="Cancel"
        color="grey-7"
        class="aql-dialog-btn"
        v-close-popup
        @click="handleCancel"
      />
      <ResourceActionButton
        push
        glossy
        no-caps
        class="aql-dialog-btn"
        :color="submitColor"
        :label="submitLabel"
        :icon="submitIcon"
        :loading="saving"
        :disable="isSubmitDisabled"
        :action="action"
        :target-resource="targetResource"
        :hide-if-unauthorized="false"
        @click="handleConfirm"
      />
    </template>
  </AqlDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ResourceActionButton from './ResourceActionButton.vue'
import AqlDialog from './AqlDialog.vue'

defineOptions({ name: 'ActionCommentDialog' })

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: 'Comment (optional)'
  },
  commentRequired: {
    type: Boolean,
    default: false
  },
  commentRows: {
    type: Number,
    default: 5
  },
  saving: {
    type: Boolean,
    default: false
  },
  submitLabel: {
    type: String,
    default: 'Confirm'
  },
  submitColor: {
    type: String,
    default: 'primary'
  },
  submitIcon: {
    type: String,
    default: ''
  },
  // Header/banner tint, forwarded to AqlDialog. Lets a destructive confirmation
  // (cancel, reject) read as negative without any template change at the call site.
  variant: {
    type: String,
    default: 'primary'
  },
  action: {
    type: [String, Array, Object],
    default: null
  },
  targetResource: {
    type: String,
    default: null
  },
  disableSubmit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:model-value', 'confirm', 'cancel'])

const comment = ref('')

// Reset comment on dialog open/close
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    comment.value = ''
  }
})

const isSubmitDisabled = computed(() => {
  if (props.disableSubmit) return true
  if (props.commentRequired && !comment.value.trim()) {
    return true
  }
  return false
})

function handleCancel() {
  emit('cancel')
}

function handleConfirm() {
  if (isSubmitDisabled.value) return
  emit('confirm', comment.value)
}
</script>
