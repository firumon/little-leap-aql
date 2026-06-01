<template>
  <q-page padding class="aql-page-container">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Visits"
          subtitle="Sales field planner · plan, visit, track"
          :stats="[]"
          class="brand-header-card"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <!-- Search Input -->
    <div class="q-mb-md">
      <q-input
        v-model="searchTerm"
        dense
        outlined
        clearable
        placeholder="Search outlets..."
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="isGloballyEmpty && !searchTerm" class="text-center q-pa-xl">
      <q-icon name="event_busy" size="4em" color="grey-5" />
      <div class="text-h6 q-mt-md">No visits yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Start by planning your first outlet visit.</div>
      <q-btn v-if="allowed('create')" color="primary" icon="add" label="Plan First Visit" @click="openPlanDialog()" />
    </div>

    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <div v-if="!searchedVisits.length" class="text-grey text-center q-pa-xl">No matching visits found.</div>
      <div v-else>
        <AqlList dense separator item-key="Code" :highlight="true" :highlight-color="getHighlightColor" :clickable="allowed('update')" @click="onVisitClick" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => v.ProgressPlannedComment]" :items="searchedVisits" :chip="getVisitChipLabel" :chip-color="getVisitChipColor">
          <template #content2="{ item: visit }">
            <div v-if="visit.ProgressPlannedComment" class="text-italic text-grey-6">{{ visit.ProgressPlannedComment }}</div>
          </template>
        </AqlList>
      </div>
    </template>

    <template v-else>
      <VisitSummaryBar :stats="summaryStats" class="q-mb-lg" @scroll-to="scrollToSection" />

      <div class="row items-center q-mb-md">
        <q-separator class="col" />
        <span class="text-overline text-weight-bold text-grey-6 q-px-md">PRIORITY</span>
        <q-separator class="col" />
      </div>

      <div id="section-overdue" class="q-mb-xl">
        <div class="row items-center q-mb-md">
          <q-icon name="priority_high" color="negative" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold text-negative">OVERDUE</span>
          <q-badge class="q-ml-sm" color="negative" :label="String(summaryStats.overdue)" />
        </div>
        <div v-if="!overdueVisits.length" class="text-positive text-caption q-pa-sm">
          <q-icon name="check_circle" size="xs" /> No overdue visits — great job!
        </div>
        <div v-else>
          <AqlList dense separator item-key="Code" :highlight="true" :highlight-color="getHighlightColor" :clickable="allowed('update')" @click="onVisitClick" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => v.ProgressPlannedComment]" :items="overdueVisits">
            <template #content2="{ item: visit }">
              <q-item-label caption v-if="visit.ProgressPlannedComment" class="text-italic">{{ visit.ProgressPlannedComment }}</q-item-label>
            </template>
          </AqlList>
        </div>
      </div>

      <div id="section-today" class="q-mb-xl">
        <div class="row items-center q-mb-md">
          <q-icon name="lens" color="primary" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold text-primary">TODAY</span>
          <q-badge class="q-ml-sm" color="primary" :label="String(summaryStats.today)" />
        </div>
        <div v-if="!todayVisits.length" class="text-grey text-caption q-pa-sm">
          Nothing scheduled for today. Check upcoming or plan a visit.
        </div>
        <div v-else>
          <AqlList dense separator item-key="Code" :highlight="true" :highlight-color="getHighlightColor" :clickable="allowed('update')" @click="onVisitClick" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => v.ProgressPlannedComment]" :items="todayVisits">
            <template #content2="{ item: visit }">
              <div v-if="visit.ProgressPlannedComment" class="text-caption text-italic text-grey-6 q-mt-xs">{{ visit.ProgressPlannedComment }}</div>
            </template>
          </AqlList>
        </div>
      </div>

      <div class="row items-center q-mb-md">
        <q-separator class="col" />
        <span class="text-overline text-weight-bold text-grey-6 q-px-md">UPCOMING</span>
        <q-separator class="col" />
      </div>

      <q-expansion-item
        v-model="thisWeekExpanded"
        id="section-thisWeek"
        class="q-mb-md"
        header-class="text-grey-8"
        expand-icon-class="text-grey-6"
      >
        <template #header>
          <q-item-section>
            <span class="text-subtitle1">
              <q-icon name="radio_button_unchecked" size="sm" class="q-mr-sm" />
              This Week
              <q-badge class="q-ml-sm" color="grey" outline :label="String(summaryStats.thisWeek)" />
            </span>
          </q-item-section>
        </template>
        <div v-if="thisWeekVisits.length" class="q-pt-sm">
          <AqlList dense separator item-key="Code" :highlight="true" :highlight-color="getHighlightColor" :clickable="allowed('update')" @click="onVisitClick" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => v.ProgressPlannedComment]" :items="thisWeekVisits">
            <template #content2="{ item: visit }">
              <div v-if="visit.ProgressPlannedComment" class="text-caption text-italic text-grey-6 q-mt-xs">{{ visit.ProgressPlannedComment }}</div>
            </template>
          </AqlList>
        </div>
        <div v-else class="text-grey text-caption q-pa-sm">No visits this week.</div>
      </q-expansion-item>

      <q-expansion-item
        v-model="futureExpanded"
        id="section-future"
        class="q-mb-md"
        header-class="text-grey-8"
        expand-icon-class="text-grey-6"
      >
        <template #header>
          <q-item-section>
            <span class="text-subtitle1">
              <q-icon name="radio_button_unchecked" size="sm" class="q-mr-sm" />
              Upcoming
              <q-badge class="q-ml-sm" color="grey" outline :label="String(summaryStats.future)" />
            </span>
          </q-item-section>
        </template>
        <div v-if="futureVisits.length" class="q-pt-sm">
          <AqlList dense separator item-key="Code" :highlight="true" :highlight-color="getHighlightColor" :clickable="allowed('update')" @click="onVisitClick" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => v.ProgressPlannedComment]" :items="futureVisits">
            <template #content2="{ item: visit }">
              <div v-if="visit.ProgressPlannedComment" class="text-caption text-italic text-grey-6 q-mt-xs">{{ visit.ProgressPlannedComment }}</div>
            </template>
          </AqlList>
        </div>
        <div v-else class="text-grey text-caption q-pa-sm">No upcoming visits.</div>
      </q-expansion-item>

      <div class="row items-center q-mb-md">
        <q-separator class="col" />
        <span class="text-overline text-weight-bold text-grey-6 q-px-md">HISTORY</span>
        <q-separator class="col" />
      </div>

      <q-expansion-item
        v-model="historyExpanded"
        id="section-history"
        class="q-mb-md"
        expand-icon-class="text-grey-6"
      >
        <template #header>
          <q-item-section>
            <span class="text-subtitle1">
              <q-icon name="history" size="sm" class="q-mr-sm" />
              Visit History
              <q-badge class="q-ml-sm" color="grey" outline :label="String(historyVisits.length)" />
            </span>
          </q-item-section>
        </template>

        <div class="q-pt-sm">
          <q-btn-toggle
            v-model="historyStatusFilter"
            toggle-color="primary"
            dense
            spread
            class="q-mb-sm"
            :options="historyFilterOptions"
          />
          <div class="row items-center q-gutter-x-sm q-mb-md">
            <AppDate v-model="historyDateFrom" dense outlined label="From" class="col" hide-bottom-space />
            <span class="text-grey-6 text-caption">—</span>
            <AppDate v-model="historyDateTo" dense outlined label="To" class="col" hide-bottom-space />
          </div>

          <div v-if="!filteredHistoryVisits.length" class="text-grey text-center q-pa-md">
            No visit history found.
          </div>
          <div v-else v-for="group in filteredHistoryByMonth" :key="group.month" class="q-mb-md">
            <div class="row items-center q-mb-sm">
              <q-separator class="col" />
              <span class="text-overline text-weight-bold text-grey-6 q-px-sm">{{ group.label }}</span>
              <q-separator class="col" />
            </div>
            <div>
              <AqlList dense separator item-key="Code" highlight :color="getVisitChipColor" :layout="['label', 'caption', 'caption']" :content="[(v) => outletLabel(v.OutletCode), (v) => getVisitDateLine(v), (v) => getHistoryComment(v)]" :items="group.items" :chip="getVisitChipLabel">
                <template #content2="{ item: visit }">
                  <div v-if="getHistoryComment(visit)" class="text-caption text-italic text-grey-6 q-mt-xs">{{ getHistoryComment(visit) }}</div>
                </template>
              </AqlList>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <div class="row items-center q-mb-md">
        <q-separator class="col" />
        <span class="text-overline text-weight-bold text-grey-6 q-px-md">COVERAGE</span>
        <q-separator class="col" />
      </div>

      <q-expansion-item
        v-model="coverageExpanded"
        id="section-coverage"
        class="q-mb-md"
        expand-icon-class="text-grey-6"
      >
        <template #header>
          <q-item-section>
            <span class="text-subtitle1">
              <q-icon name="store" size="sm" class="q-mr-sm" />
              Outlets without planned visits
              <q-badge class="q-ml-sm" color="grey" outline :label="String(outletsWithoutVisits.length)" />
            </span>
          </q-item-section>
        </template>

        <div class="q-pt-sm">
          <AqlList dense separator item-key="Code" btn-color="primary" @click="openPlanDialog" :label="(outlet) => outlet.Name || outlet.Code" :items="outletsWithoutVisits" :btn="allowed('create') ? 'add' : null">
            <!-- Custom Empty State slot -->
            <template #empty>
              <div class="text-positive text-caption q-pa-sm">
                <q-icon name="check_circle" size="xs" /> All outlets have planned visits.
              </div>
            </template>
          </AqlList>
        </div>
      </q-expansion-item>
    </template>

    <DataAddFAB tooltip="Plan Visit" custom-click @click="openPlanDialog()" />

    <q-dialog v-model="actionSelectionDialog" position="bottom">
      <q-card class="q-pa-md" style="border-radius: 16px 16px 0 0; max-width: 500px; margin: 0 auto; width: 100%;">
        <q-card-section class="q-pb-none row items-center justify-between no-wrap">
          <div class="text-subtitle1 text-weight-bold text-grey-9">{{ selectedVisit ? outletLabel(selectedVisit.OutletCode) : '' }}</div>
          <div><q-btn flat round dense icon="close" v-close-popup /></div>
        </q-card-section>

        <q-card-section class="q-py-md column q-gutter-y-sm">
          <div class="text-caption text-grey-6">Select action:</div>

          <div class="column q-gutter-y-sm q-mb-md">
            <!-- Complete Option -->
            <q-item
              clickable
              v-ripple
              @click="chosenAction = 'complete'"
              :class="{ 'bg-green-1 text-green-9': chosenAction === 'complete' }"
              :style="{
                border: '1px solid',
                borderColor: chosenAction === 'complete' ? '#21ba45' : '#e2e8f0',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }"
              class="q-pa-sm"
            >
              <q-item-section avatar>
                <q-icon name="check_circle" :color="chosenAction === 'complete' ? 'positive' : 'grey-6'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle2">Complete Visit</q-item-label>
                <q-item-label caption :class="{ 'text-green-8': chosenAction === 'complete' }">
                  Mark this planned visit as completed
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- Postpone Option -->
            <q-item
              clickable
              v-ripple
              @click="chosenAction = 'postpone'"
              :class="{ 'bg-orange-1 text-orange-9': chosenAction === 'postpone' }"
              :style="{
                border: '1px solid',
                borderColor: chosenAction === 'postpone' ? '#f2c037' : '#e2e8f0',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }"
              class="q-pa-sm"
            >
              <q-item-section avatar>
                <q-icon name="schedule" :color="chosenAction === 'postpone' ? 'warning' : 'grey-6'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle2">Postpone / Reschedule</q-item-label>
                <q-item-label caption :class="{ 'text-orange-8': chosenAction === 'postpone' }">
                  Reschedule planned visit to another day
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- Cancel Option -->
            <q-item
              clickable
              v-ripple
              @click="chosenAction = 'cancel'"
              :class="{ 'bg-red-1 text-red-9': chosenAction === 'cancel' }"
              :style="{
                border: '1px solid',
                borderColor: chosenAction === 'cancel' ? '#c10015' : '#e2e8f0',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }"
              class="q-pa-sm"
            >
              <q-item-section avatar>
                <q-icon name="cancel" :color="chosenAction === 'cancel' ? 'negative' : 'grey-6'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle2">Cancel Visit</q-item-label>
                <q-item-label caption :class="{ 'text-red-8': chosenAction === 'cancel' }">
                  Cancel this planned visit entirely
                </q-item-label>
              </q-item-section>
            </q-item>
          </div>

          <div v-if="chosenAction === 'complete'" class="column q-gutter-y-sm">
            <q-input v-model="actionForm.comment" label="Comment (optional)" outlined type="textarea" />
          </div>

          <div v-else-if="chosenAction === 'postpone'" class="column q-gutter-y-sm">
            <AppDate v-model="actionForm.date" label="New Date" outlined dense hide-bottom-space />
            <q-input v-model="actionForm.reason" label="Reason (mandatory)" outlined type="textarea" />
          </div>

          <div v-else-if="chosenAction === 'cancel'" class="column q-gutter-y-sm">
            <AppDate v-model="actionForm.nextDate" label="Next Visit Date (optional)" outlined dense clearable hide-bottom-space />
            <q-input v-model="actionForm.reason" label="Reason (mandatory)" outlined type="textarea" />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup />
          <q-btn
            :label="chosenAction === 'complete' ? 'Complete Visit' : chosenAction === 'postpone' ? 'Postpone' : 'Cancel Visit'"
            :color="chosenAction === 'complete' ? 'positive' : chosenAction === 'postpone' ? 'warning' : 'negative'"
            :loading="saving"
            :disable="
              (chosenAction === 'postpone' && (!actionForm.date || !actionForm.reason)) ||
              (chosenAction === 'cancel' && !actionForm.reason)
            "
            @click="handleActionConfirm"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <ActionCommentDialog
      v-model="planDialog"
      title="Plan Visit"
      label="Comment (optional)"
      submit-label="Plan Visit"
      submit-color="primary"
      :saving="saving"
      :disable-submit="!planForm.outletCode || !planForm.date"
      @confirm="handlePlanConfirm"
    >
      <template #fields>
        <q-select
          v-model="planForm.outletCode"
          :options="outletOptions"
          label="Outlet"
          outlined
          :disable="!!planTarget"
          :rules="[val => !!val || 'Outlet is required']"
          hide-bottom-space
        />
        <AppDate v-model="planForm.date" label="Visit Date" outlined :rules="[val => !!val || 'Date is required']" hide-bottom-space />
      </template>
    </ActionCommentDialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { todayISO } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import VisitSummaryBar from '../../../components/Operations/Outlets/VisitSummaryBar.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import AppDate from '../../../components/shared/AppDate.vue'
import ActionCommentDialog from '../../../components/shared/ActionCommentDialog.vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import AqlList from 'components/shared/AqlList.vue'

defineOptions({ name: 'OutletVisitsIndexPage' })

const flow = useOutletVisits()
const { allowed } = useResourceConfig()
const { hasUninitiatedDependencies } = useResourceReload()
const {
  loading, saving, searchTerm,
  summaryStats, overdueVisits, todayVisits, thisWeekVisits, futureVisits,
  searchedVisits, historyVisits, filteredHistoryVisits, filteredHistoryByMonth,
  outletsWithoutVisits,
  visitProgress, outletLabel, visitUrgency, visitDateDisplay, progressMeta,
  reloadIndex, navigateToAdd, outletOptions,
  completeVisit, postponeVisit, cancelVisit, planVisit,
  historyStatusFilter, historyDateFrom, historyDateTo
} = flow

const thisWeekExpanded = ref(false)
const futureExpanded = ref(false)
const historyExpanded = ref(false)
const coverageExpanded = ref(false)
const expansionInitialized = ref(false)

const historyFilterOptions = [
  { label: 'All', value: '' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Postponed', value: 'POSTPONED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]

const isGloballyEmpty = computed(() => summaryStats.value.total === 0 && !historyVisits.value.length)
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

const actionSelectionDialog = ref(false)
const selectedVisit = ref(null)
const chosenAction = ref('complete')
const actionForm = ref({ date: todayISO(), reason: '', nextDate: '', comment: '' })

function getHighlightColor(visit) {
  const urgency = visitUrgency(visit)
  if (urgency === 'overdue') return 'negative'
  if (urgency === 'today') return 'primary'
  return 'grey-5'
}

function getVisitDateLine(visit) {
  const d = visitDateDisplay(visit)
  if (d.relative && d.absolute) return `${d.relative} · ${d.absolute}`
  if (d.absolute) return d.absolute
  return 'No date'
}

function getVisitChipLabel(visit) {
  const p = visitProgress(visit)
  return progressMeta(p).label
}

function getVisitChipColor(visit) {
  const p = visitProgress(visit)
  return progressMeta(p).color
}

function getHistoryComment(visit) {
  const progress = visitProgress(visit)
  if (progress === 'COMPLETED') return visit.ProgressCompletedComment
  if (progress === 'POSTPONED') return visit.ProgressPostponedComment
  if (progress === 'CANCELLED') return visit.ProgressCancelledComment
  return ''
}

function onVisitClick(visit) {
  if (visitProgress(visit) !== 'PLANNED' || !allowed('update')) return
  selectedVisit.value = visit
  actionForm.value = { date: todayISO(), reason: '', nextDate: '', comment: '' }
  chosenAction.value = 'complete'
  actionSelectionDialog.value = true
}

async function handleActionConfirm() {
  if (!selectedVisit.value) return
  saving.value = true
  try {
    if (chosenAction.value === 'complete') {
      const result = await completeVisit(selectedVisit.value, {
        ProgressCompletedComment: actionForm.value.comment
      })
      if (result) {
        actionSelectionDialog.value = false
        await reloadIndex()
      }
    } else if (chosenAction.value === 'postpone') {
      const result = await postponeVisit(selectedVisit.value, {
        Date: actionForm.value.date,
        ProgressPostponedComment: actionForm.value.reason
      })
      if (result) {
        actionSelectionDialog.value = false
        await reloadIndex()
      }
    } else if (chosenAction.value === 'cancel') {
      const result = await cancelVisit(selectedVisit.value, {
        ProgressCancelledComment: actionForm.value.reason,
        Date: actionForm.value.nextDate || undefined
      })
      if (result) {
        actionSelectionDialog.value = false
        await reloadIndex()
      }
    }
  } finally {
    saving.value = false
  }
}

function scrollToSection(key) {
  const el = document.getElementById(`section-${key}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (key === 'thisWeek' && !thisWeekExpanded.value) thisWeekExpanded.value = true
    if (key === 'future' && !futureExpanded.value) futureExpanded.value = true
    if (key === 'history') historyExpanded.value = true
    if (key === 'coverage') coverageExpanded.value = true
  }
}

// Old methods removed - unified action dialog handles all operations

const planDialog = ref(false)
const planTarget = ref(null)
const planForm = ref({ outletCode: null, date: todayISO(), comment: '' })

function openPlanDialog(outlet = null) {
  planTarget.value = outlet
  if (outlet) {
    planForm.value = { outletCode: { label: outlet.Name || outlet.Code, value: outlet.Code }, date: todayISO(), comment: '' }
  } else {
    planForm.value = { outletCode: null, date: todayISO(), comment: '' }
  }
  planDialog.value = true
}

async function handlePlanConfirm(comment) {
  const code = typeof planForm.value.outletCode === 'object' ? planForm.value.outletCode?.value : planForm.value.outletCode
  const result = await planVisit(code, planForm.value.date, comment)
  if (result) {
    planDialog.value = false
    await reloadIndex()
  }
}

watch(summaryStats, (stats) => {
  if (expansionInitialized.value || !stats) return
  if (stats.thisWeek > 0) thisWeekExpanded.value = true
  expansionInitialized.value = true
})

onMounted(async () => {
  await reloadIndex()
})
</script>

