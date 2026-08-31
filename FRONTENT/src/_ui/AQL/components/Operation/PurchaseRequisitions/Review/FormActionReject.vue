<template>
  <q-btn
    :class="ui.primaryActionBtnClass"
    v-bind="ui.primaryActionBtnProps"
    :color="finalColor"
    :label="finalLabel"
    :icon="finalIcon"
    :disable="isDisabled"
    @click="onClick"
  />
</template>

<script setup>
// Reports intent only. The handler in Review/PageAction.js owns the dispatch, so a
// veto there can still stop it.
import { computed } from 'vue'
import { useRequisitionReviewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewFormActionReject', inheritAttrs: false })

const props = defineProps({
  label: { type: [String, Function], default: 'Reject' },
  icon: { type: [String, Function], default: 'block' },
  color: { type: [String, Function], default: 'negative' },
  disabled: { type: [Boolean, Function], default: false }
})

const emit = defineEmits(['click'])

const { pageState, ui } = useRequisitionReviewContext()

const busy = computed(() => !!pageState?.meta?.submitting || !!pageState?.meta?.stepping)

const evalProp = (value) => (typeof value === 'function' ? value() : value)

const finalLabel = computed(() => evalProp(props.label))
const finalIcon = computed(() => evalProp(props.icon))
const finalColor = computed(() => evalProp(props.color))
const isDisabled = computed(() => !!evalProp(props.disabled) || busy.value)

function onClick (evt) {
  if (isDisabled.value) return
  emit('click', evt)
}
</script>
