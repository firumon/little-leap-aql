<template>
  <q-page padding class="delivery-page">
    <!-- Header -->
    <div class="delivery-header q-mb-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="delivery-header__title">
          <div class="text-h6">Outlet Deliveries</div>
        </div>
        <q-btn icon="refresh" flat round dense :loading="loading" @click="reloadIndex(true)" />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Dispatch tracker · schedule, deliver, track</div>
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search outlets..." class="delivery-search">
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
    <div v-else-if="!items.length && !eligibleRestocks.length && !searchTerm" class="text-center q-pa-xl">
      <q-icon name="local_shipping" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No deliveries yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Schedule your first outlet delivery from an approved restock.</div>
      <q-btn v-if="canSchedule" color="primary" icon="add" label="Schedule First Delivery" @click="navigateToAdd()" />
    </div>

    <!-- Search results -->
    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <div v-if="!searchedResults.length" class="text-grey text-center q-pa-xl">No matching deliveries or restocks found.</div>
      <div v-else class="column q-gutter-sm">
        <q-card v-for="result in searchedResults" :key="result._key" flat bordered class="cursor-pointer" @click="result._type === 'delivery' ? navigateTo(result.Code) : navigateToAdd(result.Code)">
          <q-card-section class="q-pa-sm row items-center no-wrap">
            <q-icon :name="result._type === 'delivery' ? 'local_shipping' : 'inventory_2'" color="grey-6" size="sm" class="q-mr-sm" />
            <div class="col">
              <div class="text-caption text-weight-medium">{{ outletName(result.OutletCode) }}</div>
              <div class="text-caption text-grey-7">{{ result.Code }} · {{ itemsSummary(result.ItemsJSON) || restockCardSummary(result) }}</div>
            </div>
            <OutletProgressChip :progress="result.Progress" />
          </q-card-section>
        </q-card>
      </div>
    </template>

    <!-- Main content -->
    <template v-else>
      <!-- Section 1: TO SCHEDULE -->
      <div v-if="canSchedule" class="q-mb-lg">
        <div class="row items-center q-mb-md">
          <q-icon name="inventory_2" color="warning" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold">TO SCHEDULE</span>
          <q-badge class="q-ml-sm" color="warning" :label="String(eligibleRestocks.length)" />
        </div>
        <div v-if="!eligibleRestocks.length" class="text-positive text-caption q-pa-sm">
          <q-icon name="check_circle" size="xs" /> All approved restocks have been scheduled.
        </div>
        <div v-else class="row q-col-gutter-sm">
          <div v-for="restock in eligibleRestocks" :key="restock.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card flat bordered class="cursor-pointer schedule-card" @click="navigateToAdd(restock.Code)">
              <q-card-section class="q-pa-sm">
                <div class="row items-center no-wrap">
                  <div class="col">
                    <div class="text-subtitle2 text-weight-medium ellipsis">{{ outletName(restock.OutletCode) }}</div>
                    <div class="text-caption text-grey-7 q-mt-xs">{{ timeAgo(restock.ProgressApprovedAt || restock.Date) }}</div>
                    <div class="text-caption text-grey-7" v-if="restock.RequestedUser">Requested by {{ restock.RequestedUser }}</div>
                    <div class="text-caption q-mt-xs">{{ restockCardSummary(restock) }}</div>
                  </div>
                  <div class="col-auto q-ml-sm">
                    <OutletProgressChip :progress="restock.Progress" />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Section 2: IN TRANSIT -->
      <div class="q-mb-lg">
        <div class="row items-center q-mb-md">
          <q-icon name="local_shipping" color="primary" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold text-primary">IN TRANSIT</span>
          <q-badge class="q-ml-sm" color="primary" :label="String(inTransit.length)" />
        </div>
        <div v-if="!inTransit.length" class="text-grey text-caption q-pa-sm">
          No deliveries in transit.
        </div>
        <div v-else class="column q-gutter-sm">
          <q-card v-for="row in inTransit" :key="row.Code" flat bordered>
            <q-card-section class="q-pa-sm cursor-pointer" @click="navigateTo(row.Code)">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">Scheduled {{ timeAgo(row.ScheduledAt) }}</div>
                  <div class="text-caption q-mt-xs">{{ itemsSummary(row.ItemsJSON) }}</div>
                </div>
                <div class="column items-end q-gutter-xs">
                  <OutletProgressChip :progress="row.Progress" />
                  <q-btn
                    v-if="canDeliver"
                    flat
                    round
                    icon="check_circle"
                    color="positive"
                    size="sm"
                    @click.stop="openDeliverDialog(row)"
                  >
                    <q-tooltip>Mark as Delivered</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Section 3: HISTORY - Delivered -->
      <q-expansion-item
        v-if="delivered.length"
        v-model="deliveredExpanded"
        header-class="text-subtitle1 text-weight-medium"
        :label="`Delivered (${delivered.length})`"
        class="q-mb-sm"
      >
        <div class="column q-gutter-xs q-pt-sm">
          <q-card v-for="row in deliveredSorted" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm row items-center no-wrap">
              <div class="col">
                <div class="text-caption text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                <div class="text-caption text-grey-7">Delivered {{ timeAgo(row.DeliveredAt) }}</div>
                <div class="text-caption text-grey-7">{{ itemsSummary(row.ItemsJSON) }}</div>
              </div>
              <OutletProgressChip :progress="row.Progress" />
            </q-card-section>
          </q-card>
        </div>
      </q-expansion-item>

      <!-- Section 4: HISTORY - Cancelled -->
      <q-expansion-item
        v-if="cancelled.length"
        v-model="cancelledExpanded"
        header-class="text-subtitle1 text-weight-medium"
        :label="`Cancelled (${cancelled.length})`"
        class="q-mb-sm"
      >
        <div class="column q-gutter-xs q-pt-sm">
          <q-card v-for="row in cancelledSorted" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm row items-center no-wrap">
              <div class="col">
                <div class="text-caption text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                <div class="text-caption text-grey-7">Cancelled {{ timeAgo(row.CancelledAt) }}</div>
                <div class="text-caption text-grey-7">{{ itemsSummary(row.ItemsJSON) }}</div>
              </div>
              <OutletProgressChip :progress="row.Progress" />
            </q-card-section>
          </q-card>
        </div>
      </q-expansion-item>
    </template>

    <!-- Deliver Dialog -->
    <q-dialog v-model="deliverDialog" persistent>
      <q-card style="min-width: 380px; max-width: 90vw;">
        <q-card-section class="text-h6">Mark as Delivered</q-card-section>
        <q-card-section v-if="deliverTarget" class="q-gutter-y-sm">
          <div class="text-subtitle2">{{ outletName(deliverTarget.OutletCode) }}</div>
          <div class="text-caption text-grey-7">{{ deliverTarget.Code }} · Scheduled {{ timeAgo(deliverTarget.ScheduledAt) }}</div>
          <div class="text-caption text-grey-7">{{ itemsSummary(deliverTarget.ItemsJSON) }}</div>
          <q-input v-model="deliverComment" type="textarea" label="Comment (optional)" outlined dense autogrow rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="positive" label="Confirm Delivery" :loading="saving" @click="handleDeliverConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- FAB -->
    <q-page-sticky v-if="canSchedule" position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="primary" @click="navigateToAdd()">
        <q-tooltip anchor="top middle" self="bottom middle">Schedule Delivery</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletDeliveriesIndexPage' })

const flow = useOutletDeliveries()
const {
  loading, saving, searchTerm, items, eligibleRestocks,
  reloadIndex, navigateTo, navigateToAdd,
  deliverDelivery, outletName, itemsSummary, restockCardSummary,
  canSchedule, canDeliver, timeAgo
} = flow

const isInitialLoad = ref(true)
const deliveredExpanded = ref(false)
const cancelledExpanded = ref(false)

const inTransit = computed(() => items.value.filter(row => text(row.Progress) === 'SCHEDULED'))
const delivered = computed(() => items.value.filter(row => text(row.Progress) === 'DELIVERED'))
const cancelled = computed(() => items.value.filter(row => text(row.Progress) === 'CANCELLED'))
const deliveredSorted = computed(() => [...delivered.value].sort((a, b) => sortTimeBy(b.DeliveredAt) - sortTimeBy(a.DeliveredAt)))
const cancelledSorted = computed(() => [...cancelled.value].sort((a, b) => sortTimeBy(b.CancelledAt) - sortTimeBy(a.CancelledAt)))
function sortTimeBy(v) { const n = Date.parse(text(v)); return isNaN(n) ? 0 : n }

const searchedResults = computed(() => {
  if (!searchTerm.value) return []
  const term = searchTerm.value.toLowerCase()
  const deliveries = items.value
    .filter(row => text(row.OutletCode).toLowerCase().includes(term) || text(row.Code).toLowerCase().includes(term))
    .map(row => ({ ...row, _key: `del-${row.Code}`, _type: 'delivery' }))
  const restocks = eligibleRestocks.value
    .filter(row => text(row.OutletCode).toLowerCase().includes(term) || text(row.Code).toLowerCase().includes(term))
    .map(row => ({ ...row, _key: `ors-${row.Code}`, _type: 'restock' }))
  return [...deliveries, ...restocks]
})

const deliverDialog = ref(false)
const deliverTarget = ref(null)
const deliverComment = ref('')

function openDeliverDialog(row) {
  deliverTarget.value = row
  deliverComment.value = ''
  deliverDialog.value = true
}

async function handleDeliverConfirm() {
  const result = await deliverDelivery(deliverTarget.value.Code, deliverComment.value)
  if (result) {
    deliverDialog.value = false
    await reloadIndex()
  }
}

onMounted(async () => {
  await reloadIndex()
  isInitialLoad.value = false
})
</script>

<style scoped>
.delivery-page {
  padding-bottom: 80px;
}
.delivery-search {
  max-width: 480px;
}
.delivery-header__title {
  flex: 1;
  min-width: 0;
}
.schedule-card {
  border-left: 3px solid var(--q-warning);
  transition: box-shadow 0.15s ease;
}
.schedule-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
</style>
