<template>
  <q-page padding>
    <!-- Header -->
    <div class="restock-header q-mb-md">
      <div class="row items-center justify-between no-wrap q-mb-xs">
        <div>
          <div class="text-h6">Outlet Restocks</div>
        </div>
        <q-btn icon="refresh" flat round dense :loading="loading" @click="reloadIndex(true)" />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Stock replenishment · request, approve, deliver</div>
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search outlets..." class="restock-search">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </div>

    <!-- Background loading indicator -->
    <q-linear-progress v-if="loading && !isInitialLoad" color="primary" indeterminate class="q-mb-sm" />

    <!-- Initial load spinner -->
    <div v-if="isInitialLoad && loading" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!items.length && !loading" class="text-center q-pa-xl">
      <q-icon name="inventory_2" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No restock requests yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Start by creating a restock request.</div>
      <q-btn v-if="userCanCreate" color="primary" icon="add" label="New Restock Request" @click="navigateToAdd()" />
    </div>

    <!-- Search results -->
    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <div class="row q-col-gutter-sm">
        <div v-for="restock in searchedRestocks" :key="restock.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <div class="cursor-pointer" @click="navigateTo(restock.Code)">
            <RestockCard :restock="restock" :outlet-label="outletLabel(restock.OutletCode)" :item-summary="itemProgressSummary(restock)" />
          </div>
        </div>
      </div>
    </template>

    <!-- Main content: role-based sections -->
    <template v-else>
      <!-- Summary bar: role-based -->
      <RestockSummaryBar :counts="summaryCounts" :permissions="resourcePerms" @filter="onFilterClick" />

      <!-- canCreate: My Drafts -->
      <div v-if="userCanCreate && myDrafts.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="edit_note" color="grey-7" size="sm" class="q-mr-xs" />
          Drafts ({{ myDrafts.length }})
        </div>
        <div class="row q-col-gutter-xs">
          <div v-for="restock in myDrafts" :key="restock.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <div class="cursor-pointer" @click="navigateTo(restock.Code)">
              <RestockCard :restock="restock" :outlet-label="outletLabel(restock.OutletCode)" :item-summary="itemProgressSummary(restock)" />
            </div>
          </div>
        </div>
      </div>

      <!-- canApprove: Pending Approval section -->
      <div v-if="userCanApprove && pendingApprovalList.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="hourglass_top" color="orange" size="sm" class="q-mr-xs" />
          Pending Approval ({{ pendingApprovalList.length }})
        </div>
        <div class="row q-col-gutter-xs">
          <div v-for="restock in pendingApprovalList" :key="restock.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <div class="cursor-pointer" @click="navigateTo(restock.Code)">
              <RestockCard :restock="restock" :outlet-label="outletLabel(restock.OutletCode)" :item-summary="itemProgressSummary(restock)" />
            </div>
          </div>
        </div>
      </div>

      <!-- canApprove: Restocks with pending items after approval -->
      <div v-if="userCanApprove && pendingItemRestocks.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="pending_actions" color="secondary" size="sm" class="q-mr-xs" />
          Restocks with Pending Items ({{ pendingItemRestocks.length }})
        </div>
        <div class="row q-col-gutter-xs">
          <div v-for="restock in pendingItemRestocks" :key="restock.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <div class="cursor-pointer" @click="navigateTo(restock.Code)">
              <RestockCard :restock="restock" :outlet-label="outletLabel(restock.OutletCode)" :item-summary="itemProgressSummary(restock)" />
            </div>
          </div>
        </div>
      </div>

      <!-- canCreate: Outlets with planned visits (today & this week) -->
      <div v-if="userCanCreate && todayOutlets.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="store" color="primary" size="sm" class="q-mr-xs" />
          Outlets with Planned Visits ({{ todayOutlets.length }})
        </div>
        <div class="row q-col-gutter-xs">
          <div v-for="outlet in todayOutlets" :key="outlet.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card flat bordered class="priority-outlet-card cursor-pointer" @click="navigateToAddOutlet(outlet.Code)">
              <q-card-section class="q-pa-sm">
                <div class="row items-center no-wrap">
                  <q-icon name="store" color="primary" size="xs" class="q-mr-xs" />
                  <div class="text-caption text-weight-medium ellipsis">{{ outlet.Name || outlet.Code }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>


    </template>

    <!-- FAB -->
    <q-page-sticky v-if="userCanCreate" position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="primary" @click="navigateToAdd()">
        <q-tooltip anchor="top middle" self="bottom middle">New Restock Request</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useOutletRestocks } from '../../../composables/operations/outlets/useOutletRestocks.js'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import RestockSummaryBar from '../../../components/Operations/Outlets/RestockSummaryBar.vue'
import RestockCard from '../../../components/Operations/Outlets/RestockCard.vue'
import { RESTOCK_PROGRESS_ORDER, active, text } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'OutletRestocksIndexPage' })

const flow = useOutletRestocks()
const visitsFlow = useOutletVisits()
const { todayVisits, thisWeekVisits } = visitsFlow
const { loading, searchTerm, items, reloadIndex, navigateTo, navigateToAdd, itemProgressSummary, resourcePerms, canCreate: userCanCreate, canApprove: userCanApprove } = flow

const isInitialLoad = ref(true)

const searchedRestocks = computed(() => {
  if (!searchTerm.value) return []
  const term = searchTerm.value.toLowerCase()
  return items.value.filter(row =>
    text(row.OutletCode).toLowerCase().includes(term) ||
    text(row.Code).toLowerCase().includes(term) ||
    text(row.RequestedUser).toLowerCase().includes(term)
  )
})

const pendingApprovalList = computed(() =>
  items.value.filter(row => text(row.Progress) === 'PENDING_APPROVAL'))

const pendingItemRestocks = computed(() => {
  const restockCodes = new Set(flow.restockItems.items.value
    .filter(active)
    .filter(row => text(row.Progress) === 'PENDING')
    .map(row => text(row.OutletRestockCode))
    .filter(Boolean))
  return items.value.filter(row =>
    text(row.Progress) === 'APPROVED' &&
    restockCodes.has(text(row.Code)))
})

const myDrafts = computed(() =>
  items.value.filter(row => ['DRAFT', 'REVISION_REQUIRED'].includes(text(row.Progress))))

const todayOutlets = computed(() => {
  const plannedCodes = new Set()
  for (const visit of todayVisits.value) {
    if (visit.OutletCode) plannedCodes.add(visit.OutletCode)
  }
  for (const visit of thisWeekVisits.value) {
    if (visit.OutletCode) plannedCodes.add(visit.OutletCode)
  }
  const outletMap = new Map()
  ;(flow.outletOptions?.value || []).forEach(o => {
    if (o.value && plannedCodes.has(o.value)) {
      outletMap.set(o.value, { Code: o.value, Name: (o.label || '').split(' · ')[1] || o.value })
    }
  })
  return Array.from(outletMap.values())
})

const summaryCounts = computed(() => {
  const counts = {}
  RESTOCK_PROGRESS_ORDER.forEach(key => {
    counts[key] = items.value.filter(row =>
      (RESTOCK_PROGRESS_ORDER.includes(row.Progress) ? row.Progress : 'OTHER') === key
    ).length
  })
  return counts
})

const expandState = reactive({})

function onFilterClick(key) {
  expandState[key] = true
}

function outletLabel(code) {
  const outlet = (flow.outletOptions?.value || []).find(o => o.value === code)
  if (!outlet) return code
  const parts = outlet.label.split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : outlet.label
}

function navigateToAddOutlet(outletCode) {
  navigateToAdd(outletCode)
}

async function doReload() {
  await Promise.all([
    reloadIndex(true),
    visitsFlow.reloadIndex(true)
  ])
  isInitialLoad.value = false
}

onMounted(() => doReload())
</script>

<style scoped>
.restock-search { max-width: 480px; }
.restock-section-body { border-top: none; border-radius: 0 0 8px 8px; }
.priority-outlet-card { transition: box-shadow 0.15s ease; border-left: 3px solid var(--q-primary); }
.priority-outlet-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
</style>
