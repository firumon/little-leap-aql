<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Heading outside the card, matching every other step (§7.5). -->
    <SectionDividerLabel label="THIS VISIT" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div v-for="(line, i) in summary" :key="line.label" class="items-center"
               :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(i)">
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Offered only when a visit was actually selected: with no planned visit there is
         nothing to complete, and a disabled toggle would still imply there should be. -->
    <q-card v-if="wizard.visitCode.value" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">Mark visit as completed</div>
            <div class="text-caption text-grey-8">Closes the planned visit this consumption was made against.</div>
          </div>
          <div class="col-auto">
            <q-toggle :model-value="wizard.completeVisit.value" color="primary"
                      @update:model-value="(v) => wizard.set(FIELDS.COMPLETE_VISIT, v === true)" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
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

      <!-- TWO linked boxes, because on a phone each is the faster answer depending on what
           the officer is thinking about: a cadence ("come back in a fortnight") or a day
           they know they will be in the area. Typing in either updates the other; the DAYS
           count is the single stored value, so the two can never disagree.
           `type="number"` with `v-model.number` is what raises the numeric keypad — a text
           box here means the officer taps through to the number pad for a two-digit entry. -->
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
  </div>
</template>

<script setup>
/**
 * Step 6 — visit completion and rescheduling.
 *
 * The final read-only summary plus the two decisions that close the loop. A review step is
 * read-only about the things already decided (§13.6) — the counts, the invoice and the
 * restock are restated as figures here, not re-offered as controls, because a decision
 * stays editable only beside the evidence it was made against.
 *
 * Both toggles default ON: an audit made against a planned visit has, by definition,
 * completed it, and an outlet on a recurring cadence needs its next date set. Defaulting
 * either off would make the routine case the one requiring extra taps.
 *
 * The next date comes from the outlet's own `VisitFrequencyDays`, falling back to the
 * backend's configured default — never a literal. Where NEITHER is configured the toggle
 * is disabled rather than hidden, and the caption says why: the question still stands, the
 * answer is just unavailable (§10.5).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import AppDate from 'components/shared/AppDate.vue'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddVisitOptions', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard
const { _C } = useCurrency()

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

/**
 * The days box, as a writable computed over the wizard's single stored value.
 *
 * A local `ref` kept in step with a watcher would be a second source of truth for the same
 * answer (ARCHITECTURE RULES §6); this reads and writes the one control field directly, so
 * the date box beside it moves on the same tick.
 */
const daysModel = computed({
  get: () => wizard.nextVisitDays.value,
  set: (value) => wizard.setNextVisitDays(value)
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

/**
 * Blank rows are dropped rather than padded with em dashes — a summary reads better short,
 * and `Returns: —` states nothing while looking like it does (§7.4).
 */
const summary = computed(() => {
  const restockTotal = wizard.restockRows.value.reduce((sum, row) => sum + (Number(row.Quantity) || 0), 0)
  return [
    { label: 'Outlet', value: wizard.outletName.value },
    { label: 'Items sold', value: wizard.soldRows.value.length ? `${wizard.soldRows.value.length} line(s)` : '' },
    { label: 'Returns', value: wizard.returnRows.value.length ? `${wizard.returnRows.value.length} line(s)` : '' },
    { label: 'Invoice', value: wizard.generateInvoice.value && wizard.soldRows.value.length ? _C(wizard.invoiceTotal.value) : '' },
    { label: 'Credit applied', value: wizard.returnDeduction.value > 0 ? `− ${_C(wizard.returnDeduction.value)}` : '' },
    { label: 'Restock', value: restockTotal > 0 ? `${restockTotal} unit(s)` : '' },
    { label: 'Bundled consumptions', value: wizard.bundledCodes.value.length ? `${wizard.bundledCodes.value.length} earlier consumption(s)` : '' }
  ].filter((line) => String(line.value).trim())
})
</script>
