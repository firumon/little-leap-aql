<template>
  <AdditionalActionsButtons resource="LeadFollowUps" :record="item" :only="ACTION_ORDER">
    <template #default="{ actions, open }">
      <q-btn-group v-if="actions.length" flat>
        <q-btn
          v-for="action in ordered(actions)" :key="action.action"
          flat round
          :icon="action.icon || 'bolt'" :color="action.color || 'primary'" :size="sizeOf(action)"
          @click.stop="open(action)"
        >
          <q-tooltip>{{ action.label || action.action }}</q-tooltip>
        </q-btn>
      </q-btn-group>
    </template>
  </AdditionalActionsButtons>
</template>

<script setup>
// Mounted as a `btn:` prop by the list modifiers, so it takes only `item`.
// A responded follow-up offers no action here: `visibleWhen` empties the list
// and the group disappears on its own.
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'

defineOptions({ name: 'LeadFollowUpsActionButtons' })

defineProps({
  item: { type: Object, required: true }
})

const ACTION_ORDER = ['Complete', 'Postpone', 'Cancel']

function ordered (actions) {
  return actions.slice().sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action))
}

function sizeOf (action) {
  return action.action === 'Complete' ? 'lg' : 'md'
}
</script>
