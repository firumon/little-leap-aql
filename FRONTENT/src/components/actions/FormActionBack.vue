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
 * Base "go back a step" button for multi-step (wizard) form pages — the reverse
 * twin of `FormActionNext.vue`.
 *
 * Reports intent only; the step change is the `back` built-in of
 * `PageAction.handleAction()` (`Math.max(1, currentStep - 1)`, so step 1 is a
 * floor and the bar can render `back` unconditionally). A page's own `back`
 * handler can intercept it — e.g. to confirm before discarding a step's input.
 *
 * Visual subordination to the primary button comes from `color`, never from
 * `flat`: Quasar's `flat` suppresses the shadow `push glossy` renders
 * (AQL_ACTION_SYSTEM.md §5).
 *
 * Overridable per tenant through the 10-tier action lookup as
 * `FormActionBack.(vue|js)` — see Documents/AQL_ACTION_SYSTEM.md.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsFormActionBack', inheritAttrs: false })

const props = defineProps({
  label:      { type: [String, Function], default: 'Back' },
  icon:       { type: [String, Function], default: 'arrow_back' },
  color:      { type: [String, Function], default: 'grey-7' },
  disabled:   { type: [Boolean, Function], default: false },
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
