<template>
  <q-btn
    class="aql-form-action-btn"
    glossy
    push
    :color="finalColor"
    :label="finalLabel"
    :icon="finalIcon"
    :disable="isDisabled"
    @click="onClick"
  />
</template>

<script setup>
/**
 * OutletRestocks › Approve › the Reject button.
 *
 * `FormActions` resolves any `actions` entry it does not recognise as
 * `FormAction<Name>` and wires its click to the generic `action(key)` emit, which
 * `PageAction.handleAction('reject')` dispatches to the `reject` handler in
 * `Approve/PageAction.js` (UI_ACTION_SYSTEM.md §3.2). So this component supplies
 * the button and nothing else — it reports intent upward and never dispatches,
 * for the same reason `FormActionCancel` does not navigate: a button that acted on
 * its own would make the handler's `{ valid: false }` veto unable to stop it.
 *
 * There is no framework base for this name, so it is a `.vue` override rather than
 * a `.js` modifier, and it mirrors `FormActionSubmit`'s shape exactly — including
 * disabling (never spinner-loading) while a dispatch is in flight, since the
 * blocking indicator is `AqlContentWrapper`'s overlay (UI_ACTION_SYSTEM.md §5).
 */
import { computed } from 'vue'
import { useRestockApprovalContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApprovalContext'

defineOptions({ name: 'OutletRestocksApproveFormActionReject', inheritAttrs: false })

const props = defineProps({
  label:    { type: [String, Function], default: 'Reject' },
  icon:     { type: [String, Function], default: 'block' },
  color:    { type: [String, Function], default: 'negative' },
  disabled: { type: [Boolean, Function], default: false }
})

const emit = defineEmits(['click'])

const { pageState, evaluate: evalProp } = useRestockApprovalContext()

const submitting = computed(() => !!pageState?.meta?.submitting)

const finalLabel = computed(() => evalProp(props.label))
const finalIcon = computed(() => evalProp(props.icon))
const finalColor = computed(() => evalProp(props.color))
const isDisabled = computed(() => !!evalProp(props.disabled) || submitting.value)

function onClick (evt) {
  if (isDisabled.value) return
  emit('click', evt)
}
</script>
