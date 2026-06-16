<template>
  <q-page padding>
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Restocks"
          subtitle="Stock replenishment · request, approve, deliver"
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

    <ResourceReports class="q-mb-md" />

    <!-- Background loading indicator -->
    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <!-- Initial load spinner -->
    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!items.length" class="text-center q-pa-xl">
      <q-icon name="inventory_2" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No restock requests yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Start by creating a restock request.</div>
      <q-btn v-if="userCanCreate" color="primary" icon="add" label="New Restock Request" @click="navigateToAdd()" />
    </div>

    <!-- Search results -->
    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <AqlList clickable highlight
        item-key="Code" :icon="(row) => getProgressIcon(row.Progress)" :color="(row) => progressMeta(row.Progress).color"
        :items="searchedRestocks" :layout="['label', 'caption', 'caption']"
        :content="[
          (row) => outletLabel(row.OutletCode),
          (row) => [formatDate(row.Date), text(row.RequestedUser)].filter(Boolean).join(' • '),
          (row) => itemProgressSummary(row)
        ]"
        :chip="(row) => progressMeta(row.Progress).label"
        @click="(row) => navigateTo(row.Code)"
        empty-text="No matching restocks found."
      />
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
        <AqlList clickable highlight item-key="Code" icon="edit_note" color="grey-7"
          :items="myDrafts" :layout="['label', 'caption', 'caption']"
          :content="[
            (row) => outletLabel(row.OutletCode),
            (row) => [formatDate(row.Date), text(row.RequestedUser)].filter(Boolean).join(' • '),
            (row) => itemProgressSummary(row)
          ]"
          @click="(row) => navigateTo(row.Code)"
        />
      </div>

      <!-- canApprove: Pending Approval section -->
      <div v-if="userCanApprove && pendingApprovalList.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="hourglass_top" color="orange" size="sm" class="q-mr-xs" />
          Pending Approval ({{ pendingApprovalList.length }})
        </div>
        <AqlList clickable highlight item-key="Code" icon="hourglass_top" color="orange"
          :items="pendingApprovalList" :layout="['label', 'caption', 'caption']"
          :content="[
            (row) => outletLabel(row.OutletCode),
            (row) => [formatDate(row.Date), text(row.RequestedUser)].filter(Boolean).join(' • '),
            (row) => itemProgressSummary(row)
          ]"
          @click="(row) => navigateTo(row.Code)"
        />
      </div>

      <!-- canApprove: Restocks with pending items after approval -->
      <div v-if="userCanApprove && pendingItemRestocks.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="pending_actions" color="secondary" size="sm" class="q-mr-xs" />
          Restocks with Pending Items ({{ pendingItemRestocks.length }})
        </div>
        <AqlList clickable highlight item-key="Code" icon="pending_actions" color="secondary"
          :items="pendingItemRestocks" :layout="['label', 'caption', 'caption']"
          :content="[
            (row) => outletLabel(row.OutletCode),
            (row) => [formatDate(row.Date), text(row.RequestedUser)].filter(Boolean).join(' • '),
            (row) => itemProgressSummary(row)
          ]"
          @click="(row) => navigateTo(row.Code)"
        />
      </div>

      <!-- canCreate: Outlets with planned visits (today & this week) -->
      <div v-if="userCanCreate && todayOutlets.length" class="q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          <q-icon name="store" color="primary" size="sm" class="q-mr-xs" />
          Outlets with Planned Visits ({{ todayOutlets.length }})
        </div>
        <AqlList highlight dense item-key="Code"
          :items="todayOutlets" label="Name"
          @click="(outlet) => navigateToAddOutlet(outlet.Code)"
        />
      </div>

      <!-- History section -->
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
              Restock History
              <q-badge class="q-ml-sm" color="grey" outline :label="String(historyRestocks.length)" />
            </span>
          </q-item-section>
        </template>

        <div class="q-pt-sm">
          <q-btn-dropdown
            color="primary"
            outline
            dense
            no-caps
            class="q-mb-sm full-width"
            :label="currentFilterLabel"
          >
            <q-list dense>
              <q-item v-for="opt in historyFilterOptions" :key="opt.value" clickable v-close-popup @click="historyStatusFilter = opt.value">
                <q-item-section>{{ opt.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
          <div class="row items-center q-gutter-x-sm q-mb-md">
            <AppDate v-model="historyDateFrom" label="From" outlined dense hide-bottom-space class="col" />
            <span class="text-grey-6 text-caption">—</span>
            <AppDate v-model="historyDateTo" label="To" outlined dense hide-bottom-space class="col" />
          </div>

          <div v-if="!filteredHistoryRestocks.length" class="text-grey text-center q-pa-md">
            No restock history found.
          </div>
          <div v-else v-for="group in filteredHistoryByMonth" :key="group.month" class="q-mb-md">
            <div class="row items-center q-mb-sm">
              <q-separator class="col" />
              <span class="text-overline text-weight-bold text-grey-6 q-px-sm">{{ group.label }}</span>
              <q-separator class="col" />
            </div>
            <AqlList clickable highlight
              item-key="Code" :icon="(row) => getProgressIcon(row.Progress)" :color="(row) => progressMeta(row.Progress).color"
              :items="group.items" :layout="['label', 'caption', 'caption']"
              :content="[
                (row) => outletLabel(row.OutletCode),
                (row) => [formatDate(row.Date), text(row.RequestedUser)].filter(Boolean).join(' • '),
                (row) => itemProgressSummary(row)
              ]"
              :chip="(row) => progressMeta(row.Progress).label"
              @click="(row) => navigateTo(row.Code)"
            />
          </div>
        </div>
      </q-expansion-item>

    </template>

    <!-- FAB -->
    <RestockAddFAB />
  </q-page>
</template>


<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useOutletRestocks } from '../../../composables/operations/outlets/useOutletRestocks.js'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import RestockSummaryBar from '../../../components/Operations/Outlets/RestockSummaryBar.vue'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import { RESTOCK_PROGRESS_ORDER, active, text, sortTime, formatDate, progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import AqlList from 'components/shared/AqlList.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import AppDate from '../../../components/shared/AppDate.vue'
import RestockAddFAB from '../../../components/Operations/Outlets/RestockAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletRestocksIndexPage' })

function getProgressIcon(progress) {
  const map = {
    DRAFT: 'edit_note',
    PENDING_APPROVAL: 'hourglass_top',
    REVISION_REQUIRED: 'feedback',
    APPROVED: 'check_circle',
    PARTIALLY_DELIVERED: 'local_shipping',
    DELIVERED: 'done_all',
    REJECTED: 'cancel'
  }
  return map[text(progress)] || 'inventory_2'
}

const flow = useOutletRestocks()
const visitsFlow = useOutletVisits()
const { hasUninitiatedDependencies } = useResourceReload()
const { todayVisits, thisWeekVisits } = visitsFlow
const { loading, searchTerm, items, reloadIndex, navigateTo, navigateToAdd, itemProgressSummary, resourcePerms, canCreate: userCanCreate, canApprove: userCanApprove } = flow

const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)
const historyExpanded = ref(false)

const historyFilterOptions = [
  { label: 'All', value: '' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Partially Delivered', value: 'PARTIALLY_DELIVERED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Rejected', value: 'REJECTED' }
]

const historyStatusFilter = ref('')
const historyDateFrom = ref('')
const historyDateTo = ref('')

const currentFilterLabel = computed(() => {
  const opt = historyFilterOptions.find(o => o.value === historyStatusFilter.value)
  return opt ? opt.label : 'All'
})

const searchedRestocks = computed(() => {
  if (!searchTerm.value) return []
  const term = searchTerm.value.toLowerCase()
  return items.value.filter(row =>
    text(row.OutletCode).toLowerCase().includes(term) ||
    text(row.Code).toLowerCase().includes(term) ||
    text(row.RequestedUser).toLowerCase().includes(term)
  )
})

const historyRestocks = computed(() =>
  items.value.filter(row => ['APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED'].includes(text(row.Progress)))
    .sort((a, b) => sortTime(b) - sortTime(a)))

const filteredHistoryRestocks = computed(() => {
  let result = historyRestocks.value
  if (historyStatusFilter.value) {
    result = result.filter(row => text(row.Progress) === historyStatusFilter.value)
  }
  if (historyDateFrom.value) {
    result = result.filter(row => row.Date && row.Date >= historyDateFrom.value)
  }
  if (historyDateTo.value) {
    result = result.filter(row => row.Date && row.Date <= historyDateTo.value)
  }
  return result
})

const filteredHistoryByMonth = computed(() => {
  const groups = new Map()
  for (const restock of filteredHistoryRestocks.value) {
    const label = restock.Date ? restock.Date.substring(0, 7) : 'Unknown'
    const key = label
    if (!groups.has(key)) {
      const [year, month] = label.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      groups.set(key, { month: key, label: date.toLocaleString('en-US', { month: 'long', year: 'numeric' }), items: [] })
    }
    groups.get(key).items.push(restock)
  }
  return Array.from(groups.values()).sort((a, b) => b.month.localeCompare(a.month))
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
}

onMounted(() => doReload())
</script>

<style scoped>
.restock-section-body { border-top: none; border-radius: 0 0 8px 8px; }
.priority-outlet-card { transition: box-shadow 0.15s ease; border-left: 3px solid var(--q-primary); }
.priority-outlet-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
</style>
