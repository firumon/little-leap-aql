<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-btn v-bind="BTN" icon="visibility" color="grey-7" aria-label="View receiving" @click.stop="goToView">
      <q-tooltip>View Receiving</q-tooltip>
    </q-btn>

    <q-btn v-if="canEdit" v-bind="BTN" icon="edit" color="primary" aria-label="Resume inspection" @click.stop="goToEdit">
      <q-tooltip>Resume Inspection</q-tooltip>
    </q-btn>

    <AdditionalActionsButtons
      v-if="allowedActions.length"
      resource="POReceivings" :record="item" :only="allowedActions"
    >
      <template #default="{ actions, open }">
        <q-btn
          v-for="action in actions" :key="action.action"
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
  isEditable,
  DRAFT,
  CONFIRMED
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

defineOptions({ name: 'POReceivingsIndexReceivingActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav, user } = useProcurementIndexContext()

const BTN = { flat: true, round: true, dense: true, size: 'md' }

// Cancel needs a written reason, so it stays on the record page.
const ACTIONS_BY_PROGRESS = {
  [DRAFT]: [],
  [CONFIRMED]: ['GenerateGRN']
}

const progress = computed(() => progressOf(props.item))
const allowedActions = computed(() => ACTIONS_BY_PROGRESS[progress.value] || [])

const text = (value) => String(value ?? '').trim()

// State and ownership, both required, failing closed on a blank either side.
const canEdit = computed(() => {
  if (!isEditable(props.item)) return false
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
