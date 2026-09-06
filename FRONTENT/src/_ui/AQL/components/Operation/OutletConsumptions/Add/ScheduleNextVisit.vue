<template>
  <q-card v-if="visible" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Schedule the next visit</div>
          <div class="text-caption text-grey-8">
            <template v-if="scheduleNextVisit && !nextVisitDate">
              Set a day count above 0 to plan a date. Nothing is scheduled at 0.
            </template>
            <template v-else-if="onCompletion">
              Planned as part of closing this visit.
            </template>
            <template v-else-if="frequencyDays">
              Suggested from this outlet's cadence — adjust either box below.
            </template>
            <template v-else>
              No visit frequency is configured for this outlet, so no date is suggested.
              Set one below to schedule anyway.
            </template>
          </div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="scheduleNextVisit"
            color="primary"
            :disable="!canSchedule"
            @update:model-value="(v) => { scheduleNextVisit = v === true }"
          />
        </div>
      </div>
    </q-card-section>

    <!-- TWO linked boxes: a cadence ("come back in a fortnight") or a day the officer
         knows. Typing in either updates the other; the DAYS count is the one stored
         value, so the two can never disagree. `type="number"` raises the numeric keypad. -->
    <q-card-section class="q-pt-none q-gutter-y-sm">
      <div class="row q-col-gutter-sm">
        <div class="col-5">
          <q-input
            v-model.number="daysModel"
            type="number"
            inputmode="numeric"
            min="0"
            label="In days"
            outlined
            hide-bottom-space
            :disable="!scheduleNextVisit"
          />
        </div>
        <div class="col-7">
          <AppDate
            :model-value="nextVisitDate"
            label="Next visit date"
            outlined
            hide-bottom-space
            :disable="!scheduleNextVisit"
            @update:model-value="setNextVisitDate"
          />
        </div>
      </div>

      <q-input
        v-model="commentModel"
        type="textarea"
        label="Planned comment"
        outlined
        hide-bottom-space
        :disable="!scheduleNextVisit"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
// Step 6c - plan the next visit. Its own content because it needs its own permission:
// the contract gates it on `OutletVisits:create`, not on closing the current visit.
import { computed, watch } from 'vue'
import AppDate from 'components/shared/AppDate.vue'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { buildNextVisitNode } from 'src/_resource/Operation/OutletVisits/composables/useVisitPayload'
import { visitDaysBetween } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'
import { nextVisitPlan } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'
import { NODE, ROLE, CTRL, getCtrl, setCtrl, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddScheduleNextVisit', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const { pageState, ui, user, resource, allowed } = useConsumptionAddContext()
const operatingRules = resource('OutletOperatingRules')

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const consumption = pageState.useNode(NODE.CONSUMPTION)

const visible = computed(() => stepVisible(pageState, props.step))

const plan = computed(() => nextVisitPlan(pageState, operatingRules.items.value))

const outletCode = computed(() => plan.value.outletCode)
const frequencyDays = computed(() => plan.value.frequency)
const baseDate = computed(() => plan.value.base)
const nextVisitDays = computed(() => plan.value.days)
const nextVisitDate = computed(() => plan.value.date)
const nextVisitComment = computed(() => plan.value.comment)

// Closing a visit plans its successor through the Complete action's own `nextVisit`
// target, so the card says which of the two routes this plan will take.
const onCompletion = computed(() =>
  !!text(consumption.node.value.record.OutletVisitCode) &&
  getCtrl(pageState, CTRL.COMPLETE_VISIT, true) === true &&
  allowed(NODE.VISITS, 'complete'))

const canSchedule = computed(() =>
  !!outletCode.value && allowed(NODE.VISITS, 'create'))

// The INTENT, and only the intent. Kept apart from whether the answers currently resolve
// to a date: folding the two together let a day count of 0 empty the date, switch the card
// off, and disable the very box needed to undo it.
const scheduleNextVisit = computed({
  get: () => canSchedule.value && getCtrl(pageState, CTRL.SCHEDULE_NEXT, true) === true,
  set: (value) => setCtrl(pageState, CTRL.SCHEDULE_NEXT, value === true)
})

/** Intent AND a usable date — what actually produces a write. */
const willSchedule = computed(() => scheduleNextVisit.value && !!nextVisitDate.value)

/** A date in → the day count follows, as whole calendar days from the audit's own date. */
function setNextVisitDate (value) {
  const days = visitDaysBetween(baseDate.value, value)
  if (days !== null) setCtrl(pageState, CTRL.NEXT_VISIT_DAYS, days)
}

// Writable computeds over the stored values — a local ref plus a watcher would be a
// second source of truth (§6).
const daysModel = computed({
  get: () => nextVisitDays.value,
  set: (value) => setCtrl(pageState, CTRL.NEXT_VISIT_DAYS, Math.max(0, Math.round(num(value))))
})

const commentModel = computed({
  get: () => nextVisitComment.value,
  set: (value) => setCtrl(pageState, CTRL.NEXT_VISIT_COMMENT, text(value))
})

// The plan is kept in step with the answers rather than assembled at submit time, and it
// travels by exactly ONE of the two routes. Closing a visit carries it on the Complete
// action's own `nextVisit` target; otherwise it is a standalone create node. Writing both
// would schedule the same visit twice.
watch(
  [willSchedule, onCompletion, outletCode, nextVisitDate, nextVisitComment],
  ([on, viaCompletion, outlet, date, comment]) => {
    // Closing a visit carries the plan on the Complete action's own target, and that
    // action has ONE owner (CompleteVisit) — writing it here would queue a completion.
    if (!on || viaCompletion) return pageState.removeNode(NODE.VISITS, ROLE.NEXT)

    // The visit's own domain builder decides its columns and its stamps — a card must
    // never hand-write another resource's schema (UI_PAGE_STATE §19.11).
    const planner = text(user.value?.name)
    const node = buildNextVisitNode(
      { OutletCode: outlet, Date: baseDate.value, Username: planner },
      nextVisitDays.value,
      planner,
      { OutletCode: outlet, Date: date, ProgressPlannedComment: comment, Username: planner }
    )
    if (!node) return pageState.removeNode(NODE.VISITS, ROLE.NEXT)
    pageState.applyNodes([node])
  },
  { immediate: true }
)
</script>
