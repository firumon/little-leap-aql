<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat>
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="35%" class="q-mb-sm" />
        <q-skeleton type="text" width="85%" />
      </q-card-section>

      <q-card-section v-else-if="!recentVisits.length" class="text-caption text-grey-7">
        {{ finalEmptyText }}
      </q-card-section>

      <AppList
        v-else
        :items="recentVisits"
        :content="['Date', rowComment]"
        :chip="rowChip"
        :chip-color="progressColor"
        :icon="progressIcon"
        :color="progressColor"
        @click="openVisit"
      />
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletVisits › RecentVisits — Section (tier 3: resource-level Vue override).
 *
 * The other recent visits to the SAME outlet, newest first, so the page answers
 * "how has this outlet been served lately?" without a second navigation. The visit
 * currently on screen is excluded — it is already the subject of the page.
 *
 * Rows render through `AppList` (the registry list component, ARCHITECTURE RULES §8)
 * inside a flat card, so row geometry, separators and the item transitions all come
 * from `abstract/List.vue` rather than being re-hand-rolled here.
 *
 * The root carries the horizontal section inset so the `SectionDividerLabel` and the
 * card line up with each other and with `AqlContentWrapper`'s `q-px-sm` on framework
 * pages — spacing on the card alone left the divider flush to the viewport edge.
 *
 * Reads `resourceRecord.records` (the resource list the View page's `reload()` has
 * already fetched) rather than issuing its own request: a Section must never fetch.
 * Rows are filtered and sorted, never copied — the enriched records' relation getters
 * are non-enumerable (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3).
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import {
  progressColor,
  progressIcon,
  progressLabel,
  progressComment,
  plannedComment,
  isPlanned,
  respondDelayDays,
  sortByDate
} from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'

defineOptions({ name: 'OutletVisitsRecentVisits', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Recent Visits' },
  limit: { type: [Number, String, Function], default: 4 },
  emptyText: { type: [String, Function], default: 'No other visits recorded for this outlet.' },
  padding: { type: [String], default: 'sm' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const nav = useResourceNav()

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const spacingClass = computed(() => `q-px-${props.padding}`)

const finalTitle = computed(() => evalProp(props.title))
const finalEmptyText = computed(() => evalProp(props.emptyText))

// Coerced loosely: a `limit` arriving from a sheet-authored props block is a string.
const finalLimit = computed(() => {
  const raw = Number(evalProp(props.limit))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 4
})

const visit = computed(() => resourceRecord?.record?.value || null)
const pending = computed(() => !visit.value && resourceRecord?.loading?.value === true)

const recentVisits = computed(() => {
  const current = visit.value
  const outletCode = current?.OutletCode
  if (!outletCode) return []

  const siblings = (resourceRecord?.records?.value || []).filter((row) =>
    row && row.Code !== current.Code && String(row.OutletCode) === String(outletCode)
  )

  // Newest first — "recent" is about the visit date, not the write order.
  return sortByDate(siblings, 'Date', 'desc').slice(0, finalLimit.value)
})

// A settled visit shows its outcome comment; a still-planned one shows its plan.
function rowComment (row) {
  return progressComment(row) || plannedComment(row)
}

/**
 * "Planned" | "Completed same day" | "Completed after 2 days" | "Cancelled 1 day early".
 *
 * Built from the raw signed day count rather than from `delayLabel`: that helper already
 * returns a full phrase ("On time", "2 days late"), so splicing it into an "… after N
 * days" sentence produced "Completed after On time days".
 */
function rowChip (row) {
  const label = progressLabel(row)
  if (isPlanned(row)) return label

  const days = respondDelayDays(row)
  if (days === null) return label
  if (days === 0) return `${label} same day`

  const magnitude = Math.abs(days)
  const noun = magnitude === 1 ? 'day' : 'days'
  return days > 0
    ? `${label} after ${magnitude} ${noun}`
    : `${label} ${magnitude} ${noun} early`
}

function openVisit (row) {
  const code = row?.Code ?? row
  if (code) nav.goTo('view', { code })
}
</script>
