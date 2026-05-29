<template>
  <q-page padding class="visit-page">
    <div class="visit-header q-mb-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="visit-header__title">
          <div class="text-h6">Outlet Visits</div>
        </div>
        <ReloadButton />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Sales field planner · plan, visit, track</div>
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search outlets..." class="visit-search">
        <template #prepend><q-icon name="search" /></template>
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
      <q-btn color="primary" icon="add" label="Plan First Visit" @click="openPlanDialog()" />
    </div>

    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <div v-if="!searchedVisits.length" class="text-grey text-center q-pa-xl">No matching visits found.</div>
      <div v-else class="column q-gutter-md">
        <VisitCard
          v-for="visit in searchedVisits" :key="visit.Code" :visit="visit"
          :show-actions="visitProgress(visit) === 'PLANNED'"
          @complete="onComplete" @postpone="onPostpone" @cancel="onCancel"
        />
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
        <div v-else class="column q-gutter-md">
          <VisitCard v-for="visit in overdueVisits" :key="visit.Code" :visit="visit" :show-actions="true"
            @complete="onComplete" @postpone="onPostpone" @cancel="onCancel" />
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
        <div v-else class="column q-gutter-y-xs">
          <VisitCard v-for="visit in todayVisits" :key="visit.Code" :visit="visit" :show-actions="true"
            @complete="onComplete" @postpone="onPostpone" @cancel="onCancel" />
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
        <div v-if="thisWeekVisits.length" class="column q-gutter-y-xs q-pt-sm">
          <VisitCard v-for="visit in thisWeekVisits" :key="visit.Code" :visit="visit" :show-actions="true"
            @complete="onComplete" @postpone="onPostpone" @cancel="onCancel" />
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
        <div v-if="futureVisits.length" class="column q-gutter-y-xs q-pt-sm">
          <VisitCard v-for="visit in futureVisits" :key="visit.Code" :visit="visit" :show-actions="true"
            @complete="onComplete" @postpone="onPostpone" @cancel="onCancel" />
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
            <div class="column q-gutter-y-xs">
              <VisitCard v-for="visit in group.items" :key="visit.Code" :visit="visit" />
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
          <div v-if="!outletsWithoutVisits.length" class="text-positive text-caption q-pa-sm">
            <q-icon name="check_circle" size="xs" /> All outlets have planned visits.
          </div>
          <q-list v-else dense separator>
            <q-item v-for="outlet in outletsWithoutVisits" :key="outlet.Code">
              <q-item-section>
                <span class="text-caption">{{ outlet.Name || outlet.Code }}</span>
                <span class="text-caption text-grey-6">{{ outlet.Code }}</span>
              </q-item-section>
              <q-item-section side>
                <q-btn outline dense color="primary" icon="add" label="Plan Visit" @click="openPlanDialog(outlet)" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-expansion-item>
    </template>

    <div class="visit-page__fab-spacer" />
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="primary" @click="openPlanDialog()" />
    </q-page-sticky>

    <q-dialog v-model="postponeDialog" persistent>
      <q-card style="min-width: 320px; max-width: 90vw;">
        <q-card-section class="text-h6">Postpone Visit</q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <AppDate v-model="postponeForm.date" label="New Date" outlined dense hide-bottom-space />
          <q-input v-model="postponeForm.reason" type="textarea" label="Reason" outlined autogrow rows="2" hide-bottom-space />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat color="primary" label="Postpone" :loading="saving"
            :disable="!postponeForm.date || !postponeForm.reason"
            @click="handlePostponeConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="cancelDialog" persistent>
      <q-card style="min-width: 320px; max-width: 90vw;">
        <q-card-section class="text-h6">Cancel Visit</q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-input v-model="cancelForm.reason" type="textarea" label="Reason" outlined autogrow rows="2" hide-bottom-space />
          <AppDate v-model="cancelForm.nextDate" label="Next Visit Date (optional)" outlined dense clearable hide-bottom-space />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Back" v-close-popup />
          <q-btn flat color="negative" label="Cancel Visit" :loading="saving"
            :disable="!cancelForm.reason"
            @click="handleCancelConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="completeDialog" persistent>
      <q-card style="min-width: 320px; max-width: 90vw;">
        <q-card-section class="text-h6">Complete Visit</q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-input v-model="completeForm.comment" type="textarea" label="Comment (optional)" outlined autogrow rows="2" hide-bottom-space />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat color="positive" label="Complete Visit" :loading="saving" @click="handleCompleteConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="planDialog" persistent>
      <q-card style="min-width: 340px; max-width: 90vw;">
        <q-card-section class="text-h6">Plan Visit</q-card-section>
        <q-card-section class="q-gutter-y-sm">
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
          <q-input v-model="planForm.comment" type="textarea" label="Comment (optional)" outlined hide-bottom-space />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Plan Visit" :loading="saving"
            :disable="!planForm.outletCode || !planForm.date"
            @click="handlePlanConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { todayISO } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import VisitCard from '../../../components/Operations/Outlets/VisitCard.vue'
import VisitSummaryBar from '../../../components/Operations/Outlets/VisitSummaryBar.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import AppDate from '../../../components/shared/AppDate.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletVisitsIndexPage' })

const flow = useOutletVisits()
const { hasUninitiatedDependencies } = useResourceReload()
const {
  loading, saving, searchTerm,
  summaryStats, overdueVisits, todayVisits, thisWeekVisits, futureVisits,
  searchedVisits, historyVisits, filteredHistoryVisits, filteredHistoryByMonth,
  outletsWithoutVisits,
  visitProgress,
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

const postponeDialog = ref(false)
const postponeTarget = ref(null)
const postponeForm = ref({ date: todayISO(), reason: '' })

const cancelDialog = ref(false)
const cancelTarget = ref(null)
const cancelForm = ref({ reason: '', nextDate: '' })

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

const completeDialog = ref(false)
const completeTarget = ref(null)
const completeForm = ref({ comment: '' })

async function onComplete(visit) {
  completeTarget.value = visit
  completeForm.value = { comment: '' }
  completeDialog.value = true
}

async function handleCompleteConfirm() {
  const result = await completeVisit(completeTarget.value, {
    ProgressCompletedComment: completeForm.value.comment
  })
  if (result) {
    completeDialog.value = false
    await reloadIndex()
  }
}

function onPostpone(visit) {
  postponeTarget.value = visit
  postponeForm.value = { date: todayISO(), reason: '' }
  postponeDialog.value = true
}

async function handlePostponeConfirm() {
  const result = await postponeVisit(postponeTarget.value, {
    Date: postponeForm.value.date,
    ProgressPostponedComment: postponeForm.value.reason
  })
  if (result) {
    postponeDialog.value = false
    await reloadIndex()
  }
}

function onCancel(visit) {
  cancelTarget.value = visit
  cancelForm.value = { reason: '', nextDate: '' }
  cancelDialog.value = true
}

async function handleCancelConfirm() {
  const result = await cancelVisit(cancelTarget.value, {
    ProgressCancelledComment: cancelForm.value.reason,
    Date: cancelForm.value.nextDate || undefined
  })
  if (result) {
    cancelDialog.value = false
    await reloadIndex()
  }
}

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

async function handlePlanConfirm() {
  const code = typeof planForm.value.outletCode === 'object' ? planForm.value.outletCode?.value : planForm.value.outletCode
  const result = await planVisit(code, planForm.value.date, planForm.value.comment)
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

<style scoped>
.visit-page {
  padding-bottom: 80px;
}

.visit-page__fab-spacer {
  height: 80px;
}

.visit-header__title {
  flex: 1;
  min-width: 0;
}
</style>
