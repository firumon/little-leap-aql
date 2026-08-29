<template>
  <!-- Offered only when a visit was actually selected: with no planned visit there is
       nothing to complete, and a disabled toggle would still imply there should be. -->
  <q-card v-if="visible && visitCode" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Mark visit as completed</div>
          <div class="text-caption text-grey-8">Closes the planned visit this consumption was made against.</div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="completeVisit"
            color="primary"
            :disable="!canComplete"
            @update:model-value="(v) => { completeVisit = v === true }"
          />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-if="completeVisit" class="q-pt-none">
      <q-input
        v-model="completeComment"
        type="textarea"
        label="Completion comment"
        outlined
        hide-bottom-space
        rows="3"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
// Step 6b - close the planned visit. Its own content because it needs its own
// permission: the contract gates it on `OutletVisits:complete`, not on scheduling.
import { computed, inject, watch } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { nextVisitPlan } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useNextVisitPlan'
import {
  NODE,
  CTRL,
  VISIT_COMPLETE_COMMENT,
  VISIT_COMPLETE_COMMENT_FIELD,
  NEXT_VISIT_TARGET,
  getCtrl,
  setCtrl,
  stepVisible
} from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddCompleteVisit', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const ACTION = 'Complete'

// An empty target. GAS gates `nextVisit` on a non-empty Date, so a blank one is skipped.
const EMPTY_NEXT_VISIT = { Date: '', ProgressPlannedComment: '' }

const ui = useAQLConfig()
const pageState = inject('pageState')
const operatingRules = useRecord('OutletOperatingRules')

const consumption = pageState.useNode(NODE.CONSUMPTION)

const visible = computed(() => stepVisible(pageState, props.step))

const visitCode = computed(() => String(consumption.node.value.record.OutletVisitCode || '').trim())

const canComplete = computed(() =>
  !!visitCode.value && useResourceConfig(NODE.VISITS).allowed('complete') === true)

// ScheduleNextVisit owns the plan; this reads only WHETHER there is one, so the queued
// action never carries a next visit the officer has switched off.
// The plan is derived, never carried: reading it back off the entry meant a blanked target
// re-seeded the action config's own $date:30. This card owns the action, so it also owns
// what rides on it.
const plan = computed(() => nextVisitPlan(pageState, operatingRules.items.value))

const plannedNextVisit = computed(() => (plan.value.willSchedule
  ? { Date: plan.value.date, ProgressPlannedComment: plan.value.comment }
  : EMPTY_NEXT_VISIT))

// A page control, not the node: the answer must survive the queued action being pulled
// and re-queued as the outlet or the visit changes.
const completeVisit = computed({
  get: () => canComplete.value && getCtrl(pageState, CTRL.COMPLETE_VISIT, true) === true,
  set: (value) => setCtrl(pageState, CTRL.COMPLETE_VISIT, value === true)
})

// The action's own field, edited in place — no local mirror to fall out of step. Bound to
// the DERIVED header, which is the only address the queued entry actually carries.
const completeComment = pageState.useActions(
  ACTION, `fields.${VISIT_COMPLETE_COMMENT_FIELD}`, NODE.VISITS)

// The queued action IS the answer, so it is kept in step with the toggle rather than
// assembled at submit time. A comment already typed survives a re-queue.
watch([completeVisit, visitCode, plannedNextVisit], ([on]) => {
  if (!on) return pageState.excludeAdditionalAction(ACTION, { resource: NODE.VISITS })
  // includeAdditionalAction REPLACES the entry by re-seeding it from the action config, so
  // anything already answered has to be handed back in. Targets go in FLAT — the seeder
  // reads a target value at `<targetKey>.<Column>`, so a nested `targets` bag would be
  // ignored and the config's own `$date:30` default would win over the planned date.
  const existing = pageState.getActions(ACTION, null, NODE.VISITS) || {}
  const typed = String(existing.fields?.[VISIT_COMPLETE_COMMENT_FIELD] || '').trim()
  pageState.includeAdditionalAction(ACTION, {
    [VISIT_COMPLETE_COMMENT_FIELD]: typed || VISIT_COMPLETE_COMMENT,
    // ALWAYS supplied, and blank unless the scheduling card is switched on. Left out, the
    // seeder falls back to the action config's own `$date:30` and queues a next visit
    // nobody asked for; carried blindly, a stale one outlives the card being switched off.
    [NEXT_VISIT_TARGET]: plannedNextVisit.value
  }, { resource: NODE.VISITS, code: visitCode.value })
}, { immediate: true })
</script>
