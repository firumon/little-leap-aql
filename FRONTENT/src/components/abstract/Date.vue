<template>
  <!-- `modelValue || ''` on both controls: a null/undefined value reaching QInput's
       mask handling (or QDate's parser) is what makes it read `selectionEnd` off a
       not-yet-mounted input. Coercing to an empty string keeps both safe regardless
       of what the caller passes. -->
  <q-input
    v-bind="$attrs"
    :model-value="modelValue || ''"
    :clearable="clearable"
    @update:model-value="emitValue"
    mask="####-##-##"
    placeholder="YYYY-MM-DD"
  >
    <template v-slot:append>
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
          <q-date
            :model-value="modelValue || ''"
            @update:model-value="onDateSelect"
            mask="YYYY-MM-DD"
            today-btn
          >
            <!-- Quasar renders `today-btn` inside `.q-date__header`, which `minimal`
                 removes — so the prop alone is inert here. It is kept because it
                 becomes live for any caller that drops `minimal`; the explicit
                 Today button below is what actually delivers one-click today
                 selection in the minimal layout. -->
            <div class="row items-center justify-end q-gutter-sm">
              <q-btn v-close-popup label="Close" color="primary"  />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  // Declared (rather than left to $attrs) so the clear affordance is part of this
  // primitive's contract: QInput's clear button emits `null`, which `emitValue`
  // normalizes back to `''` — see the template comment on why null must not escape.
  clearable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])
const qDateProxy = ref(null)

// Both the clear button and a full backspace hand back `null`/`undefined`.
// Emitting `''` instead keeps the published value a String at all times, so
// callers can treat "cleared" as one shape rather than three.
function emitValue(val) {
  emit('update:modelValue', val ?? '')
}

function onDateSelect(val) {
  emit('update:modelValue', val)
  if (qDateProxy.value) {
    qDateProxy.value.hide()
  }
}

function selectToday() {
  onDateSelect(new Date().toISOString().split('T')[0])
}
</script>
