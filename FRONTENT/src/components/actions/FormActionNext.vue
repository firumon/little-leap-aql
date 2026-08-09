<template>
  <q-btn
    class="aql-form-action-btn"
    glossy
    push
    :unelevated="finalUnelevated"
    :flat="finalFlat"
    :color="finalColor"
    :label="finalLabel"
    :icon-right="finalIcon"
    :disable="isDisabled"
    @click="onClick"
  />
</template>

<script setup>
/**
 * Base "advance a step" button for multi-step (wizard) form pages.
 *
 * Like every other button in the bar it reports intent only — the step change
 * itself is the `next` built-in of `PageAction.handleAction()`
 * (`pageState.meta.currentStep + 1`), so a page's own `next` handler can validate
 * first and veto with `{ valid: false, message }`. A button that moved the step on
 * its own would have already advanced by the time that veto resolved.
 *
 * With no `next` handler supplied the built-in default runs, so a wizard page can
 * list `actions: ['back', 'next']` and work with no modifier at all.
 *
 * Overridable per tenant through the 10-tier action lookup as
 * `FormActionNext.(vue|js)` — see Documents/AQL_ACTION_SYSTEM.md.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsFormActionNext', inheritAttrs: false })

const props = defineProps({
  label:      { type: [String, Function], default: 'Continue' },
  icon:       { type: [String, Function], default: 'arrow_forward' },
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

const submitting = computed(() => !!pageState?.meta?.submitting)

const finalLabel      = computed(() => evalProp(props.label))
const finalIcon       = computed(() => evalProp(props.icon))
const finalColor      = computed(() => evalProp(props.color))
const finalUnelevated = computed(() => props.unelevated)
const finalFlat       = computed(() => props.flat)
const isDisabled      = computed(() => !!evalProp(props.disabled) || submitting.value)

function onClick (evt) {
  if (isDisabled.value) return
  emit('click', evt)
}
</script>
