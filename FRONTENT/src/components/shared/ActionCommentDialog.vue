<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:model-value', $event)" persistent>
    <q-card style="min-width: 320px; max-width: 90vw; border-radius: 12px;">
      <q-card-section class="text-h6 text-weight-bold text-primary q-pb-none">
        {{ title }}
      </q-card-section>

      <q-card-section class="q-gutter-y-md q-pt-md">
        <!-- Optional Slot for extra fields (e.g., Date picker, Outlet Selector) -->
        <slot name="fields" />

        <!-- Comment/Reason text input -->
        <q-input
          v-model="comment"
          type="textarea"
          :label="label"
          outlined
          :rows="commentRows"
          :rules="commentRequired ? [val => !!val || 'This field is required'] : []"
          lazy-rules
          hide-bottom-space
        />
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup @click="handleCancel" />
        <ResourceActionButton
          flat
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
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ResourceActionButton from './ResourceActionButton.vue'

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
