<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Consumptions"
          subtitle="Stock tracking · count, invoice, track"
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
        placeholder="Search consumptions..."
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

    <div v-else-if="!items.length && !pendingInvoiceItems.length && !invoiceGeneratedItems.length && !historyItems.length" class="text-center q-pa-xl">
      <q-icon name="shopping_cart" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No consumptions yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Start by recording an outlet consumption.</div>
      <q-btn v-if="canCreate" color="primary" icon="add" label="Record Consumption" @click="navigateToAdd()" />
    </div>

    <template v-else>

      <!-- Pending Invoice Generation (Highest Priority) -->
      <div v-if="pendingInvoiceItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="receipt" :color="pendingMeta.color" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">{{ pendingMeta.label }}</span>
          <q-badge class="q-ml-sm" :color="pendingMeta.color" :label="String(pendingInvoiceItems.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in pendingInvoiceItems" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Username }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">Qty {{ consumedTotal(row.Code) }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Invoice Generated -->
      <div v-if="invoiceGeneratedItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="check_circle" :color="generatedMeta.color" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">{{ generatedMeta.label }}</span>
          <q-badge class="q-ml-sm" :color="generatedMeta.color" :label="String(invoiceGeneratedItems.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in invoiceGeneratedItems" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Username }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">Qty {{ consumedTotal(row.Code) }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Today's Planned Visits -->
      <div v-if="todayPlannedVisits.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="event_available" color="info" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Today's Planned Visits</span>
          <q-badge class="q-ml-sm" color="info" :label="String(todayPlannedVisits.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="visit in todayPlannedVisits" :key="visit.Code" flat bordered class="cursor-pointer" @click="navigateToAddFromVisit(visit)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(visit.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ formatDisplayDate(visit.Date) }}</div>
                </div>
                <q-icon name="arrow_forward" color="primary" size="sm" />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- History (Cancelled) -->
      <div v-if="historyItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="history" color="grey-7" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Cancelled</span>
          <q-badge class="q-ml-sm" color="grey-7" :label="String(historyItems.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in historyItems" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Code }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">Qty {{ consumedTotal(row.Code) }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

    </template>

    <DataAddFAB tooltip="Record Consumption" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletConsumptionIndexPage' })

const flow = useOutletConsumption()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, items, searchTerm, canCreate, pendingInvoiceItems, invoiceGeneratedItems, historyItems, allPlannedVisits, reload, navigateTo, navigateToAdd, consumedTotal, outletName, formatDisplayDate, text, todayISO } = flow

const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

const pendingMeta = { label: 'Pending Invoice Generation', color: 'warning' }
const generatedMeta = { label: 'Invoice Generated', color: 'positive' }

const todayPlannedVisits = computed(() => {
  const today = todayISO()
  return allPlannedVisits.value.filter(v => text(v.Date) === today)
})

function navigateToAddFromVisit(visit) {
  navigateToAdd(visit.OutletCode, 2)
}

onMounted(async () => {
  await reload()
})
</script>
