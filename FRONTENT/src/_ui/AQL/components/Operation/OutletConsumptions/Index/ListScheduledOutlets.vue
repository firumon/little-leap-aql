<template>
  <div>
    <!-- One consolidated empty state for the whole view, not one per group: two "nothing
         here" cards stacked read as two failures instead of one clear queue (§7.1). -->
    <q-card v-if="!todays.length && !overdue.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="event_available" :size="ui.emptyIconSize" color="positive" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing scheduled</div>
        <div :class="ui.emptyCaptionClass">
          No visits are planned for today and no outlet is past its audit date.
        </div>
      </q-card-section>
    </q-card>

    <template v-else>
      <!-- A divider per sub-list, and the divider is hidden along with its rows when that
           group is empty — an empty heading is a promise the list does not keep. -->
      <template v-if="todays.length">
        <SectionDividerLabel label="TODAY" />
        <AppList
          :items="todays"
          item-key="visitCode"
          :label="rowLabel"
          :caption="rowCaption"
          clickable
          @click="startAudit"
        />
      </template>

      <template v-if="overdue.length">
        <SectionDividerLabel label="OVERDUE" />
        <AppList
          :items="overdue"
          item-key="visitCode"
          :label="rowLabel"
          :caption="rowCaption"
          :chip="overdueChip"
          :chip-color="overdueChipColor"
          chip-outline
          clickable
          @click="startAudit"
        />
      </template>
    </template>
  </div>
</template>

<script setup>
/**
 * OutletConsumptions › Index › ListScheduledOutlets — per-view override (tier 1).
 *
 * THE DEFAULT VIEW, and a PROJECTION rather than a filter — which is why it is a `.vue`
 * override and not a `Props<Identity>` block.
 *
 * What this queue lists is not an `OutletConsumptions` row at all. It lists the audits
 * still to be DONE: today's planned visits, and every visit whose date has already passed.
 * Those are `OutletVisits` rows, and a sheet list view can only ever narrow this
 * resource's own records — so the sheet filter behind this pill exists to drive the pill's
 * count and to keep a deep link off settled history, and the real projection comes from
 * `useConsumptionIndex`, the ONE Layer 2 aggregate every widget on this page also reads
 * (UI_MODULE_DEVELOPER_GUIDE §7.1).
 *
 * That also means `props.items` is deliberately ignored here. The usual dual read
 * (`props.items` then `attrs.items`) exists for an override that re-sorts the rows the
 * resolver handed it; this one is rendering a different resource entirely.
 *
 * ONE VIEW, TWO GROUPS, NOT TWO PILLS. "What am I doing today" and "what did I miss" are
 * one job to the person doing it — they are going to be in the same van. Splitting them
 * into two pills would make the user check two lists to plan one route, so the view unions
 * them and restores the distinction as a labelled divider (§7.1).
 *
 * Only the OVERDUE group carries an age chip, and it is OUTLINED: a screen of solid
 * colour reads as a wall rather than a scale, and today's rows are not late at all, so a
 * chip on them would be a state with nothing to say.
 *
 * Clicking a row opens the wizard with the outlet AND the visit pre-selected, which is the
 * whole point of the queue — the officer never types either.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionIndexContext'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionRowPresets'

defineOptions({ name: 'OutletConsumptionsIndexListScheduledOutlets', inheritAttrs: false })

const { index, ui, nav } = useConsumptionIndexContext()

const todays = computed(() => index.scheduledVisitRows.value.filter((row) => !row.overdue))
const overdue = computed(() => index.scheduledVisitRows.value.filter((row) => row.overdue))

// The outlet's NAME carries the row. The visit code identifies the row to the database and
// to nobody else, so it is not shown (§7.2).
const rowLabel = (row) => row.outletName
const rowCaption = (row) => row.visit.ProgressPlannedComment

const overdueChip = (row) => (row.daysLate === 1 ? '1 day late' : `${row.daysLate} days late`)

/**
 * The chip's colour tracks the OUTLET's own cadence, not a fixed day count — an outlet
 * visited monthly is not "critical" three days late, and one visited daily is. The band is
 * resolved by the shared aggregate, so this chip and the ageing widget above it can never
 * disagree about which band a row is in (§4.5).
 *
 * Read through the aggregate's `Map` rather than a `.find()`: this runs once per rendered
 * row, and a scan here would make the list O(n×m) (CORE_ARCHITECTURE_RULES §6).
 */
const overdueChipColor = (row) =>
  index.auditByOutlet.value.get(row.outletCode)?.band?.color || 'warning'

/** Straight into the wizard with both context values already answered. */
function startAudit (row) {
  nav.goTo('add', { query: { outletCode: row.outletCode, visitCode: row.visitCode } })
}
</script>
