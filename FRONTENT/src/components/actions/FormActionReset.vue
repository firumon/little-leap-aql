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
 * Base reset button of the form actions bar.
 *
 * Overridable per tenant through the 10-tier action lookup as
 * `FormActionReset.(vue|js)` — see Documents/AQL_ACTION_SYSTEM.md.
 *
 * Reset semantics live in the owning container (`PageAction.vue` → `onReset`):
 * silent discard of unsaved input, re-seeding configured defaults on `add`,
 * re-hydrating the pristine server record on `edit`/`action`. This component only
 * reports the intent.
 *
 * Loading UX contract (AQL_ACTION_SYSTEM.md §5): disabled while submitting, never
 * spinner-loaded.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsFormActionReset', inheritAttrs: false })

const props = defineProps({
  label:      { type: [String, Function], default: 'Reset' },
  icon:       { type: [String, Function], default: 'restart_alt' },
  color:      { type: [String, Function], default: 'grey-7' },
  disabled:   { type: [Boolean, Function], default: false },
  // Both default false: Quasar's `flat` and `unelevated` each suppress the shadow
  // that `push glossy` renders. Visual subordination to Submit comes from `color`
  // (grey-7 vs primary), not from flatness.
  flat:       { type: Boolean, default: false },
  unelevated: { type: Boolean, default: false }
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
  emit('click', evt)
}
</script>
