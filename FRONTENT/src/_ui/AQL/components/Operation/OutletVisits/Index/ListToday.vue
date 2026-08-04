<template>
  <SectionDividerLabel v-if="overdueVisits.length" label="Overdue Visits" />

  <AppList
    v-if="overdueVisits.length"
    :items="overdueVisits" :layout="['caption', 'label', 'caption']" :content="overdueContent"
    highlight-color="negative"
  >
    <template #btn="{ item }">
      <q-btn-group flat>
        <q-btn
          v-for="actionConfig in actionsFor(item)" :key="actionConfig.action"
          flat round
          :icon="actionConfig.icon || 'bolt'" :color="actionConfig.color || 'primary'" :size="actionSize(actionConfig)"
          @click.stop="triggerAction(actionConfig, item)"
        >
          <q-tooltip>{{ actionConfig.label || actionConfig.action }}</q-tooltip>
        </q-btn>
      </q-btn-group>
    </template>
  </AppList>

  <SectionDividerLabel label="Today Scheduled Visits" />

  <AppList
    :items="todayVisits" :layout="['label', 'caption']" :label="visitLabel" :caption="visitCaption"
    :highlight-color="progressColor"
    empty-text="No visits scheduled for today."
  >
    <template #btn="{ item }">
      <q-icon v-if="progressOf(item) !== 'PLANNED'" name="check_circle" size="28px" :color="progressColor(item)" />

      <q-btn-group v-else flat>
        <q-btn
          v-for="actionConfig in actionsFor(item)" :key="actionConfig.action"
          flat round
          :icon="actionConfig.icon || 'bolt'" :color="actionConfig.color || 'primary'" :size="actionSize(actionConfig)"
          @click.stop="triggerAction(actionConfig, item)"
        >
          <q-tooltip>{{ actionConfig.label || actionConfig.action }}</q-tooltip>
        </q-btn>
      </q-btn-group>
    </template>
  </AppList>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useAdditionalActions } from 'src/composables/resources/useAdditionalActions'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'OutletVisitsListToday', inheritAttrs: false })

// The list content receives the ACTIVE view's records (search term + list-view
// tokens already applied) — never re-read the unfiltered resourceRecord rows.
const props = defineProps({
  items: { type: Array, default: () => [] }
})

const attrs = useAttrs()
const { actionsFor: useAdditionalActionsFor, runAction } = useAdditionalActions('OutletVisits')

// Workflow buttons render in escalation order, mirroring the AdditionalActions cluster.
const ACTION_ORDER = ['Cancel', 'Postpone', 'Complete']
const PROGRESS_COLORS = {
  PLANNED:   'primary',
  COMPLETED: 'positive',
  POSTPONED: 'warning',
  CANCELLED: 'negative'
}

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const todayTimestamp = Date.parse(today)

// Helpers
function isActive (value) {
  if (value == null || value === 'Active') return true
  return String(value).trim() === 'Active'
}

function progressOf (row) {
  return String(row.Progress ?? '').trim().toUpperCase()
}

function isIsoDate (value) {
  return typeof value === 'string' && value.length >= 10 && value.charCodeAt(4) === 45 && value.charCodeAt(7) === 45
}

function visitDate (row) {
  return row.Date || row.ScheduledAt
}

// Categorization
const incomingItems = computed(() => props.items?.length ? props.items : (attrs.items || []))

const overdueVisits = computed(() => {
  const out = []
  for (const row of incomingItems.value) {
    if (!row || !isActive(row.Status) || progressOf(row) !== 'PLANNED') continue
    const date = visitDate(row)
    if (!isIsoDate(date) || date >= today) continue
    // Assigned onto the record itself, never a spread copy: the enriched record's
    // relation getters ($outlet, _Parents, ...) are non-enumerable and a spread
    // would drop them. See AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3.
    row.overdueDays = Math.floor((todayTimestamp - Date.parse(date.slice(0, 10))) / 86400000)
    out.push(row)
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays)
})

const todayVisits = computed(() => incomingItems.value.filter((row) => {
  if (!row || !isActive(row.Status)) return false
  const date = visitDate(row)
  return isIsoDate(date) && date.startsWith(today)
}))

// Card content resolvers
function visitLabel (item) {
  return item.$outlet?.Name || item.OutletName || item.Outlet || item.OutletCode || item.Code
}

function plannedComment (item) {
  return item.ProgressPlannedComment || item.PlannedComment || item.Comment || ''
}

function overdueCaption (item) {
  return `${visitDate(item)} • Due by ${item.overdueDays} ${item.overdueDays === 1 ? 'day' : 'days'}`
}

const overdueContent = [overdueCaption, visitLabel, plannedComment]

// Parts are joined rather than concatenated so a missing NextDate never leaves a
// dangling bullet separator.
function visitCaption (item) {
  const next = item.NextDate ? `Next: ${item.NextDate}` : ''
  switch (progressOf(item)) {
    case 'COMPLETED':
      return joinParts([item.ProgressCompletedComment || item.Comment || '', next])
    case 'POSTPONED':
      return joinParts([next, item.ProgressPlannedComment || ''])
    case 'CANCELLED':
      return item.ProgressCancelledComment || item.Comment || ''
    default:
      return plannedComment(item)
  }
}

function joinParts (parts) {
  return parts.filter((part) => String(part).trim()).join(' • ')
}

function progressColor (item) {
  return PROGRESS_COLORS[progressOf(item)] || 'primary'
}

// Action handlers
//
// Eligibility (permissions + `visibleWhen`) comes entirely from the composable —
// `only` restricts it to the three workflow actions this list surfaces. Only the
// ESCALATION ORDER stays here, because that is a presentation choice specific to
// this list rather than a rule about which actions are allowed.
function actionsFor (record) {
  return useAdditionalActionsFor(record, { only: ACTION_ORDER })
    .slice()
    .sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action))
}

function actionSize (actionConfig) {
  return actionConfig.action === 'Complete' ? 'md' : 'sm'
}

// Dispatch belongs to the composable: navigate vs mutate, and the shared dialog
// mounted once in MainLayout. See AQL_ACTION_SYSTEM.md §7.
function triggerAction (actionConfig, record) {
  runAction(actionConfig, record)
}
</script>
