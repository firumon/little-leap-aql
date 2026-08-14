<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <!-- Opening the record needs its own button here, and that is not a workaround:
         `abstract/List.vue` deliberately makes a row NON-clickable once it carries a
         `btn`, so a row with buttons never has an ambiguous tap target. Correct in
         general — but an approver must be able to read the requested items before
         approving, so the way in has to be explicit rather than absent. -->
    <q-btn
      v-bind="BTN"
      icon="visibility"
      color="grey-7"
      @click.stop="goToView"
    >
      <q-tooltip>View Restock</q-tooltip>
    </q-btn>

    <!-- Edit is a CRUD ROUTE, not an AdditionalAction, so it is the one button this
         file dispatches itself. Its two gates are the same ones `ResourceActionEdit.js`
         applies to the page-level FAB — state, then ownership — and for the same
         reasons; see that file. -->
    <q-btn
      v-if="canEdit"
      v-bind="BTN"
      icon="edit"
      color="primary"
      @click.stop="goToEdit"
    >
      <q-tooltip>Edit Restock</q-tooltip>
    </q-btn>

    <!-- Everything else is a workflow action. This component owns NO gating over them:
         AdditionalActionsButtons + useAdditionalActions decide which actions this record
         may offer (permissions, `visibleWhen`, `only`) and how a click dispatches
         (navigate to an action page vs. the shared dialog). -->
    <AdditionalActionsButtons
      v-if="allowedActions.length"
      resource="OutletRestocks" :record="item" :only="allowedActions"
    >
      <template #default="{ actions, open }">
        <!-- Rendered as loose siblings of the two buttons above rather than inside a
             `q-btn-group`: the group draws its own connected-segment chrome, which made
             the workflow buttons read as a different control from View/Edit sitting
             right beside them. One flat row, one visual scale. -->
        <q-btn
          v-for="action in ordered(actions)" :key="action.action"
          v-bind="BTN"
          :icon="action.icon || 'bolt'" :color="action.color || 'primary'"
          @click.stop="open(action)"
        >
          <q-tooltip>{{ action.label || action.action }}</q-tooltip>
        </q-btn>
      </template>
    </AdditionalActionsButtons>
  </div>
</template>

<script setup>
/**
 * The OutletRestocks row action cluster — one definition serving BOTH override paths:
 *
 *   btn: RestockActionButtons                    // ListDrafts.js, a `.js` modifier
 *   <RestockActionButtons :item="item" />        // ListPendingCompletion.vue, a `#btn` slot
 *
 * It was written for the modifier path, which has no slots to give (useContentResolver
 * returns props only) and so needs a component; `abstract/Renderable.js` mounts it with
 * `item` and nothing else. That constraint is what decides the design below: the cluster
 * cannot be told which view it is in, so it derives its action set from the ROW'S OWN
 * PROGRESS instead.
 *
 * Which is the right rule anyway. A restock offers Approve/Reject because it is pending
 * approval, not because the reader happens to be looking at the "Awaiting Approval" pill,
 * and the combined `PendingCompletion` view holds rows in two different states that must
 * offer two different clusters in the same list. One state → one action set, decided once
 * here, is what keeps those consistent.
 */
import { computed } from 'vue'
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'
import { useRestockIndexContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Index/useRestockIndexContext'
import {
  progressOf,
  restockEditableProgress,
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  PARTIALLY_DELIVERED
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

defineOptions({ name: 'OutletRestocksRestockActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav, user } = useRestockIndexContext()

/**
 * One presentation for every button in the cluster, so View, Edit and the workflow
 * actions are literally the same control at the same scale. Sizing used to vary per
 * action (`lg` for the primary one), which made a row read as two different toolbars
 * glued together.
 */
const BTN = { flat: true, round: true, dense: true, size: 'md' }

/**
 * The workflow actions each state surfaces INLINE, in escalation order.
 *
 * This is a whitelist of interest, not a permission list — `useAdditionalActions` still
 * decides which of these the signed-in user may actually see. Everything omitted stays in
 * the page-level FAB cluster on the View page.
 *
 * At most ONE workflow action per state, which keeps every row at two buttons. That is a
 * layout constraint as much as an editorial one — each button competes with the row's own
 * content for a phone's width, and three pushed the outlet name into a four-line wrap and
 * let the age chip collide with the caption. What is deliberately NOT here:
 *
 *   - `Submit` / `Resubmit` are off the draft and revision rows. Sending a request on is
 *     the whole point of opening it: the requester is meant to check the item lines
 *     first, and `Edit` is the button that takes them there — where the submit toggle and
 *     its comment field live (`Edit/EditSubmitOptions.vue`).
 *   - `Reject` and `Revise` are off the approval row. Both are refusals that require the
 *     approver to write a reason, which is a considered act belonging on the record, not
 *     a one-tap decision from a list. `Approve` stays because it navigates to the
 *     allocation page rather than committing anything on the spot.
 *   - `Cancel` is off every row. A destructive action does not belong one mis-tap away
 *     in a scrolling list.
 */
const ACTIONS_BY_PROGRESS = {
  [DRAFT]: [],
  [REVISION_REQUIRED]: [],
  [PENDING_APPROVAL]: ['Approve'],
  [APPROVED]: ['MarkDelivered'],
  [PARTIALLY_DELIVERED]: ['Reallocate', 'MarkDelivered']
}

const progress = computed(() => progressOf(props.item))

const allowedActions = computed(() => ACTIONS_BY_PROGRESS[progress.value] || [])

function ordered (actions) {
  const order = allowedActions.value
  return actions.slice().sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action))
}

const text = (value) => String(value ?? '').trim()

/**
 * Editable state AND ownership, both required.
 *
 * Matched on the user's CODE, not their name: `CreatedBy` is written by GAS as
 * `auth.user.UserID` and `useAuth`'s flat projection exposes that same value as
 * `user.id`. An unidentified session or an unstamped record fails CLOSED — two blanks
 * would otherwise compare equal and hand the button to everyone.
 */
const canEdit = computed(() => {
  if (!restockEditableProgress(progress.value)) return false
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
