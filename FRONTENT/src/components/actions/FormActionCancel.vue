<template>
  <q-btn
    class="aql-form-action-btn"
    glossy
    push
    :flat="finalFlat"
    :unelevated="finalUnelevated"
    :color="finalColor"
    :label="finalLabel"
    :icon="finalIcon"
    :disable="isDisabled"
    @click="onClick"
  />
</template>

<script setup>
/**
 * Base cancel button of the form actions bar.
 *
 * Reports intent upward like Submit and Reset: the navigation itself is the
 * `cancel` built-in of `PageAction.handleAction()` (`nav.goBack()`), so a
 * `cancel` handler returning `false` can veto it. The button must NOT navigate
 * on its own — that would pop two history entries per click.
 *
 * `cancelHandler` is a local escape hatch for standalone use outside PageAction:
 * when supplied it fully replaces the emit, so the container never also navigates.
 *
 * Overridable per tenant through the 10-tier action lookup as
 * `FormActionCancel.(vue|js)` — see Documents/AQL_ACTION_SYSTEM.md.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsFormActionCancel', inheritAttrs: false })

const props = defineProps({
  label:      { type: [String, Function], default: 'Cancel' },
  icon:       { type: [String, Function], default: 'close' },
  color:      { type: [String, Function], default: 'grey-7' },
  disabled:   { type: [Boolean, Function], default: false },
  // Both default false: Quasar's `flat` and `unelevated` each suppress the shadow
  // that `push glossy` renders. Visual subordination to Submit comes from `color`.
  flat:       { type: Boolean, default: false },
  unelevated: { type: Boolean, default: false },
  // Optional caller-supplied navigation override; when provided it fully replaces
  // the default goBack() behaviour. Deliberately NOT named `onCancel` — Vue would
  // treat that as an emit listener and silently bind `pageProps.onCancel`.
  cancelHandler: { type: Function, default: null }
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
const finalFlat       = computed(() => props.flat)
const finalUnelevated = computed(() => props.unelevated)
const isDisabled      = computed(() => !!evalProp(props.disabled) || submitting.value)

function onClick (evt) {
  if (isDisabled.value) return
  // A local handler fully replaces the emit so the container never navigates too.
  if (props.cancelHandler) return props.cancelHandler()
  emit('click', evt)
}
</script>
