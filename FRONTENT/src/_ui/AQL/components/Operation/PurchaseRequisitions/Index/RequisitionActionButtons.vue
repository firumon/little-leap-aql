<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-btn v-bind="BTN" icon="visibility" color="grey-7" aria-label="View requisition" @click.stop="goToView">
      <q-tooltip>View Requisition</q-tooltip>
    </q-btn>

    <q-btn
      v-if="canEdit"
      v-bind="BTN"
      icon="edit"
      color="primary"
      aria-label="Edit requisition"
      @click.stop="goToEdit"
    >
      <q-tooltip>Edit Requisition</q-tooltip>
    </q-btn>

    <AdditionalActionsButtons
      v-if="allowedActions.length"
      resource="PurchaseRequisitions" :record="item" :only="allowedActions"
    >
      <template #default="{ actions, open }">
        <q-btn
          v-for="action in ordered(actions)" :key="action.action"
          v-bind="BTN"
          :icon="action.icon || 'bolt'" :color="action.color || 'primary'"
          :aria-label="action.label || action.action"
          @click.stop="open(action)"
        >
          <q-tooltip>{{ action.label || action.action }}</q-tooltip>
        </q-btn>
      </template>
    </AdditionalActionsButtons>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'
import { useProcurementIndexContext } from 'src/_ui/AQL/composables/Operation/useProcurementIndexContext'
import {
  progressOf,
  requisitionEditableProgress,
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

defineOptions({ name: 'PurchaseRequisitionsIndexRequisitionActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav, user } = useProcurementIndexContext()

const BTN = { flat: true, round: true, dense: true, size: 'md' }

// A whitelist of interest, not a permission list. Reject and SendBack need a written
// reason, so both stay on the record page rather than one tap from a scrolling list.
const ACTIONS_BY_PROGRESS = {
  [DRAFT]: [],
  [REVISION_REQUIRED]: [],
  [PENDING_APPROVAL]: ['Approve'],
  [APPROVED]: []
}

const progress = computed(() => progressOf(props.item))
const allowedActions = computed(() => ACTIONS_BY_PROGRESS[progress.value] || [])

function ordered (actions) {
  const order = allowedActions.value
  return actions.slice().sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action))
}

const text = (value) => String(value ?? '').trim()

// State and ownership, both required, matched on the user code and failing closed.
const canEdit = computed(() => {
  if (!requisitionEditableProgress(progress.value)) return false
  const owner = text(props.item?.CreatedBy)
  const me = text(user.value?.id)
  return !!owner && !!me && owner === me
})

function goToEdit () {
  nav.goTo('edit', { code: props.item?.Code })
}

function goToView () {
  nav.goTo('view', { code: props.item?.Code })
}
</script>
