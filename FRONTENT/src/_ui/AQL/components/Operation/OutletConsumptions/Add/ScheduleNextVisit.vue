<template>
  <q-card v-if="visible" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Schedule the next visit</div>
          <div class="text-caption text-grey-8">
            <template v-if="wizard.frequencyDays.value">
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
            :model-value="wizard.scheduleNextVisit.value && !!wizard.nextVisitDays.value"
            color="primary"
            :disable="!wizard.nextVisitDays.value"
            @update:model-value="(v) => wizard.set(FIELDS.SCHEDULE_NEXT, v === true)"
          />
        </div>
      </div>
    </q-card-section>

    <!-- TWO linked boxes: a cadence ("come back in a fortnight") or a day the officer
         knows. Typing in either updates the other; the DAYS count is the one stored
         value, so the two can never disagree. `type="number"` raises the numeric keypad. -->
    <q-card-section class="q-pt-none">
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
          />
        </div>
        <div class="col-7">
          <AppDate
            :model-value="wizard.nextVisitDate.value"
            label="Next visit date"
            outlined
            hide-bottom-space
            @update:model-value="wizard.setNextVisitDate"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
// Step 6c — plan the next visit. Its own content because it needs its own permission:
// the contract gates it on `OutletVisits:create`, not on closing the current visit.
import { computed } from 'vue'
import AppDate from 'components/shared/AppDate.vue'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddScheduleNextVisit', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

// Writable computed over the wizard's one stored value — a local ref plus a watcher
// would be a second source of truth (§6).
const daysModel = computed({
  get: () => wizard.nextVisitDays.value,
  set: (value) => wizard.setNextVisitDays(value)
})

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))
</script>
