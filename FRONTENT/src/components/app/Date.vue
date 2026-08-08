<template>
  <!-- App-level date control wrapping the stateless abstract/Date primitive.
       Forwards every attribute + slot through unchanged, and pre-fills today
       (YYYY-MM-DD) when the value starts empty. Whether a later clear re-seeds
       today or stays blank is decided by `required` — see the watcher below. -->
  <AbstractDate
    v-bind="$attrs"
    :model-value="modelValue"
    :required="required"
    :clearable="clearable"
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
  modelValue: { type: String, default: '' },
  // Drives the clear-handling branch below: a mandatory date can never sit
  // empty, so it falls back to today; an optional one is allowed to stay blank.
  // Still forwarded to the primitive so the rendered control is unchanged.
  required: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

function isEmpty (val) {
  return val === undefined || val === null || val === ''
}

function todayIso () {
  return new Date().toISOString().split('T')[0]
}

// The emit is deferred to nextTick. On the immediate run the watcher fires during
// setup, before the inner QInput's <input> exists; emitting synchronously there
// re-enters Quasar's mask handling, which reads `selectionEnd` off a still-null
// input element (TypeError, surfaced as a watcher-callback error). Deferring lets
// the DOM mount first. The condition is re-checked inside the tick so a value that
// arrived in the meantime (hydrated server record, user typing) is never clobbered.
function seedToday () {
  nextTick(() => {
    if (isEmpty(props.modelValue)) emit('update:modelValue', todayIso())
  })
}

// `seeded` separates the setup-time pre-fill from every later emptying of the field.
// Immediate watcher rather than onMounted because the first empty value can arrive
// after mount too (`pageState.initResource(..., { reset: true })` swaps in a fresh
// blank record on Reset) — but only a `required` field re-seeds on those later
// clears. An optional field must be able to end up genuinely blank, which is the
// whole point of the clear button and of backspacing the last character out.
let seeded = false

watch(
  () => props.modelValue,
  (val) => {
    if (!isEmpty(val)) return
    if (seeded && !props.required) return
    seedToday()
  },
  { immediate: true }
)

seeded = true
</script>
