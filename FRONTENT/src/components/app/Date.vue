<template>
  <!-- App-level date control wrapping the stateless abstract/Date primitive.
       Forwards every attribute + slot through unchanged, and defaults an empty
       value to today (YYYY-MM-DD) whenever it becomes empty — on mount AND on
       every later clear, so a form Reset re-seeds today instead of a blank field. -->
  <AbstractDate
    v-bind="$attrs"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </AbstractDate>
</template>

<script setup>
import { watch, nextTick } from 'vue'
import AbstractDate from 'components/abstract/Date.vue'

defineOptions({ name: 'AppDate', inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

function todayIso () {
  return new Date().toISOString().split('T')[0]
}

// Immediate watcher rather than onMounted: `pageState.initResource(..., { reset: true })`
// swaps in a fresh blank record on Reset, which clears this field long after mount.
// Watching the value re-seeds today on that clear too, matching the create-form default.
//
// The emit is deferred to nextTick. On the immediate run the watcher fires during setup,
// before the inner QInput's <input> exists; emitting synchronously there re-enters
// Quasar's mask handling, which reads `selectionEnd` off a still-null input element
// (TypeError, surfaced as a watcher-callback error). Deferring lets the DOM mount first.
// The condition is re-checked inside the tick so a value that arrived in the meantime
// (hydrated server record, user typing) is never clobbered by today's date.
watch(
  () => props.modelValue,
  (val) => {
    if (val === undefined || val === null || val === '') {
      nextTick(() => {
        if (props.modelValue === undefined || props.modelValue === null || props.modelValue === '') {
          emit('update:modelValue', todayIso())
        }
      })
    }
  },
  { immediate: true }
)
</script>
