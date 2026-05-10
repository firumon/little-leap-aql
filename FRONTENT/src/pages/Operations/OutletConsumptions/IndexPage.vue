<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Outlet Consumptions</div>
      <div class="text-caption text-grey-7">Stock tracking · count, invoice, track</div>
      <q-space />
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search" class="q-mr-sm">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-btn icon="refresh" flat round :loading="loading" @click="reload(true)" />
    </div>

    <q-linear-progress v-if="loading && !isInitialLoad" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="isInitialLoad && loading" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-md">Search Results</div>
      <div v-if="!searchedItems.length" class="text-grey text-center q-pa-xl">No matching consumptions found.</div>
      <div v-else class="column q-gutter-md">
        <q-card v-for="row in searchedItems" :key="row.Code" flat bordered clickable class="cursor-pointer" @click="navigateTo(row.Code)">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-subtitle2">{{ outletName(row.OutletCode) }} · {{ formatDisplayDate(row.Date) }}</div>
              <div class="text-caption text-grey">{{ row.Code }} · Qty {{ consumedTotal(row.Code) }}</div>
            </div>
            <q-space />
            <OutletProgressChip :progress="row.Progress" />
          </q-card-section>
        </q-card>
      </div>
    </template>

    <template v-else>
      <!-- PENDING INVOICE -->
      <div v-if="pendingInvoiceItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-md">
          <q-icon name="receipt" color="warning" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold">PENDING INVOICE</span>
          <q-badge class="q-ml-sm" color="warning" :label="String(pendingInvoiceItems.length)" />
        </div>
        <div class="row q-col-gutter-sm">
          <div v-for="row in pendingInvoiceItems" :key="row.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card flat bordered clickable class="cursor-pointer" @click="navigateTo(row.Code)">
              <q-card-section class="q-pa-sm">
                <div class="text-subtitle2 q-mb-xs">{{ outletName(row.OutletCode) }}</div>
                <div class="text-caption text-grey-7">{{ row.Code }} · {{ formatDisplayDate(row.Date) }}</div>
                <div class="text-caption q-mt-sm">Qty {{ consumedTotal(row.Code) }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- INVOICE GENERATED -->
      <div v-if="invoiceGeneratedItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-md">
          <q-icon name="check_circle" color="positive" size="sm" class="q-mr-sm" />
          <span class="text-h6 text-weight-bold">INVOICE GENERATED</span>
          <q-badge class="q-ml-sm" color="positive" :label="String(invoiceGeneratedItems.length)" />
        </div>
        <div class="row q-col-gutter-sm">
          <div v-for="row in invoiceGeneratedItems" :key="row.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card flat bordered clickable class="cursor-pointer" @click="navigateTo(row.Code)">
              <q-card-section class="q-pa-sm">
                <div class="text-subtitle2 q-mb-xs">{{ outletName(row.OutletCode) }}</div>
                <div class="text-caption text-grey-7">{{ row.Code }} · {{ formatDisplayDate(row.Date) }}</div>
                <div class="text-caption q-mt-sm">Qty {{ consumedTotal(row.Code) }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- HISTORY (CANCELLED) -->
      <q-expansion-item v-if="historyItems.length" class="q-mb-md" header-class="text-grey-8" expand-icon-class="text-grey-6">
        <template #header>
          <q-item-section>
            <span class="text-subtitle1">
              <q-icon name="history" size="sm" class="q-mr-sm" />
              Cancelled
              <q-badge class="q-ml-sm" color="grey" outline :label="String(historyItems.length)" />
            </span>
          </q-item-section>
        </template>
        <div class="row q-col-gutter-sm q-pt-sm q-px-sm">
          <div v-for="row in historyItems" :key="row.Code" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <q-card flat bordered clickable class="cursor-pointer" @click="navigateTo(row.Code)">
              <q-card-section class="q-pa-sm">
                <div class="text-subtitle2 q-mb-xs">{{ outletName(row.OutletCode) }}</div>
                <div class="text-caption text-grey-7">{{ row.Code }} · {{ formatDisplayDate(row.Date) }}</div>
                <div class="text-caption q-mt-sm">Qty {{ consumedTotal(row.Code) }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-expansion-item>

      <!-- Empty State -->
      <div v-if="!pendingInvoiceItems.length && !invoiceGeneratedItems.length && !historyItems.length" class="text-center q-pa-xl">
        <q-icon name="shopping_cart" size="4em" color="grey-5" class="q-mb-sm" />
        <div class="text-h6 q-mt-md">No consumptions recorded</div>
        <div class="text-caption text-grey-7 q-mb-lg">Start by recording an outlet consumption.</div>
        <q-btn v-if="canCreate" color="primary" icon="add" label="Record Consumption" @click="navigateToAdd()" />
      </div>
    </template>

    <q-page-sticky v-if="canCreate" position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="primary" @click="navigateToAdd()">
        <q-tooltip anchor="top middle" self="bottom middle">Record Consumption</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletConsumptionIndexPage' })

const flow = useOutletConsumption()
const {
  loading, searchTerm, canCreate, pendingInvoiceItems, invoiceGeneratedItems, historyItems,
  reload, navigateTo, navigateToAdd, consumedTotal, outletName, formatDisplayDate
} = flow

const isInitialLoad = ref(true)

const searchedItems = computed(() => {
  if (!searchTerm.value) return []
  const term = searchTerm.value.toLowerCase()
  return flow.items.value.filter(row =>
    JSON.stringify(row).toLowerCase().includes(term) ||
    outletName(row.OutletCode).toLowerCase().includes(term)
  )
})

onMounted(async () => {
  await reload()
  isInitialLoad.value = false
})
</script>
