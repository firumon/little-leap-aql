<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <HeaderPanel
          title="Outlet Consumptions"
          subtitle="Stock tracking · count, invoice, track"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <ResourceReports class="q-mb-md" />

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
        <AqlList :items="pendingInvoiceItems" item-key="Code" :layout="['label', 'caption', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => outletName(item.OutletCode),
            item => `${item.Username} · ${formatDisplayDate(item.Date)}`,
            item => `Qty ${consumedTotal(item.Code)}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateTo(row.Code)"
        />
      </div>

      <!-- Invoice Generated -->
      <div v-if="invoiceGeneratedItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="check_circle" :color="generatedMeta.color" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">{{ generatedMeta.label }}</span>
          <q-badge class="q-ml-sm" :color="generatedMeta.color" :label="String(invoiceGeneratedItems.length)" />
        </div>
        <AqlList :items="invoiceGeneratedItems" item-key="Code" :layout="['label', 'caption', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => outletName(item.OutletCode),
            item => `${item.Username} · ${formatDisplayDate(item.Date)}`,
            item => `Qty ${consumedTotal(item.Code)}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateTo(row.Code)"
        />
      </div>

      <!-- Today's Planned Visits -->
      <div v-if="todayPlannedVisits.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="event_available" color="info" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Today's Planned Visits</span>
          <q-badge class="q-ml-sm" color="info" :label="String(todayPlannedVisits.length)" />
        </div>
        <AqlList :items="todayPlannedVisits" item-key="Code" :layout="['label', 'caption']"
          highlight-color="info"
          :content="[
            item => outletName(item.OutletCode),
            item => formatDisplayDate(item.Date)
          ]"
          @click="visit => navigateToAddFromVisit(visit)"
        />
      </div>

      <!-- History (Cancelled) -->
      <div v-if="historyItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="history" color="grey-7" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Cancelled</span>
          <q-badge class="q-ml-sm" color="grey-7" :label="String(historyItems.length)" />
        </div>
        <AqlList :items="historyItems" item-key="Code" :layout="['label', 'caption', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => outletName(item.OutletCode),
            item => `${item.Code} · ${formatDisplayDate(item.Date)}`,
            item => `Qty ${consumedTotal(item.Code)}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateTo(row.Code)"
        />
      </div>

    </template>

    <DataAddFAB tooltip="Record Consumption" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import AqlList from '../../../components/shared/AqlList.vue'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletConsumptionIndexPage' })

const flow = useOutletConsumption()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, items, searchTerm, canCreate, pendingInvoiceItems, invoiceGeneratedItems, historyItems, allPlannedVisits, reload, navigateTo, navigateToAdd, consumedTotal, outletName, formatDisplayDate, getProgressMeta, text, todayISO } = flow

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
