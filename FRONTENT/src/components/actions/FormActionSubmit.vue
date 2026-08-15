<template>
  <q-btn
    class="aql-form-action-btn"
    glossy
    push
    :unelevated="finalUnelevated"
    :flat="finalFlat"
    :color="finalColor"
    :label="finalLabel"
    :icon="finalIcon"
    :disable="isDisabled"
    @click="onClick"
  />
</template>

<script setup>
/**
 * Base submit button of the form actions bar.
 *
 * Overridable per tenant through the 10-tier action lookup as
 * `FormActionSubmit.(vue|js)` — see Documents/AQL_ACTION_SYSTEM.md.
 *
 * Loading UX contract (AQL_ACTION_SYSTEM.md §5): while a submission is in flight
 * the button is *disabled*, never spinner-loaded. The blocking feedback is the
 * `q-inner-loading` overlay rendered by `AqlContentWrapper` over the page body.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsFormActionSubmit', inheritAttrs: false })

const props = defineProps({
  label:      { type: [String, Function], default: 'Save' },
  icon:       { type: [String, Function], default: 'check' },
  color:      { type: [String, Function], default: 'primary' },
  disabled:   { type: [Boolean, Function], default: false },
  // Both default false: Quasar's `flat` and `unelevated` each suppress the shadow
  // that `push glossy` renders, so either one would make the styling inert.
  unelevated: { type: Boolean, default: false },
  flat:       { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState      = inject('pageState', null)

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

// Single source of truth for the "bar is not clickable right now" state.
// `submitting` is flipped by usePageState.run() around every dispatch;
// `stepping` by PageAction's next/back built-ins for the step settle window, so
// a step swap can't be double-clicked mid-transition.
const busy = computed(() => !!pageState?.meta?.submitting || !!pageState?.meta?.stepping)

const finalLabel      = computed(() => evalProp(props.label))
const finalIcon       = computed(() => evalProp(props.icon))
const finalColor      = computed(() => evalProp(props.color))
const finalUnelevated = computed(() => props.unelevated)
const finalFlat       = computed(() => props.flat)
const isDisabled      = computed(() => !!evalProp(props.disabled) || busy.value)

function onClick (evt) {
  if (isDisabled.value) return
  emit('click', evt)
}
</script>
