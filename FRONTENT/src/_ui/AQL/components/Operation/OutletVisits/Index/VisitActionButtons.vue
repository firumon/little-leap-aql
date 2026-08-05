<template>
  <!-- Owns NO gating. AdditionalActionsButtons + useAdditionalActions decide which
       actions this record may offer (permissions, `visibleWhen`, `only`) and how a
       click dispatches (navigate vs. the shared dialog). This adapter contributes
       two things and nothing else: the `item` → `record` binding that
       abstract/Renderable.js passes, and the escalation order. -->
  <AdditionalActionsButtons resource="OutletVisits" :record="item" :only="ACTION_ORDER">
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
/**
 * The OutletVisits row action cluster, as a component-valued prop:
 *
 *   btn: VisitActionButtons        // in ListOverdue.js
 *
 * Same buttons ListToday.vue renders through its `#btn` slot — but a `.js` modifier
 * has no slots to give (useContentResolver returns props only), so this reaches the
 * row as a component instead. abstract/Renderable.js binds `item` and nothing else.
 */
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'

defineOptions({ name: 'OutletVisitsVisitActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

// Escalation order, matching ListToday.vue. Doubles as the `only` whitelist: these
// are the three workflow actions a visit row surfaces inline; the rest stay in the
// page-level cluster. WHICH actions are allowed is still the composable's call —
// this only says which ones this list is interested in, and in what order.
const ACTION_ORDER = ['Cancel', 'Postpone', 'Complete']

function ordered (actions) {
  return actions.slice().sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action))
}

// Complete is the primary path out of an overdue visit, so it reads larger.
function sizeOf (action) {
  return action.action === 'Complete' ? 'md' : 'sm'
}
</script>
