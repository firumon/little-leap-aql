<template>
  <q-page padding class="aql-page-container">
    <!-- Header + Reload -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <HeaderPanel
          title="Warehouse Transfers"
          subtitle="Stock transfers between warehouses · initiate, approve, complete"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <ResourceReports class="q-mb-md" />

    <!-- Search -->
    <div class="q-mb-md">
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search transfers...">
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Search results -->
    <template v-else-if="searchTerm">
      <div class="text-subtitle1 text-weight-medium q-mb-sm">Search Results</div>
      <div v-if="!searchedTransfers.length" class="text-grey text-center q-pa-xl">No matching transfers found.</div>
      <AqlList
        v-else dense separator
        item-key="Code"
        :highlight="true"
        :highlight-color="(t) => progressHighlightColor(t.Progress)"
        :clickable="true"
        :layout="['label', 'caption', 'caption']"
        :content="[
          (t) => `${warehouseName(t.SourceWarehouseCode)} → ${warehouseName(t.DestinationWarehouseCode) || 'Unassigned'}`,
          (t) => t.Username,
          (t) => t.Date
        ]"
        :items="searchedTransfers"
        @click="onTransferClick"
      />
    </template>

    <template v-else>
      <!-- APPROVED (priority 1) -->
      <template v-if="approvedTransfers.length">
        <SectionDividerLabel label="APPROVED" class="q-mb-xs" />
        <AqlList
          class="q-mb-lg" dense separator
          item-key="Code"
          :highlight="true"
          :highlight-color="() => 'blue-6'"
          :clickable="true"
          :layout="['label', 'caption', 'caption']"
          :content="[
            (t) => warehouseName(t.SourceWarehouseCode),
            (t) => t.Username,
            (t) => warehouseName(t.DestinationWarehouseCode) || ''
          ]"
          :items="approvedTransfers"
          @click="onTransferClick"
        />
      </template>

      <!-- PENDING_APPROVAL (priority 2) -->
      <template v-if="pendingTransfers.length">
        <SectionDividerLabel label="PENDING APPROVAL" class="q-mb-xs" />
        <AqlList
          class="q-mb-lg" dense separator
          item-key="Code"
          :highlight="true"
          :highlight-color="() => 'warning'"
          :clickable="true"
          :layout="['label', 'caption', 'caption']"
          :content="[
            (t) => warehouseName(t.SourceWarehouseCode),
            (t) => t.Username,
            (t) => warehouseName(t.DestinationWarehouseCode) || ''
          ]"
          :items="pendingTransfers"
          @click="onTransferClick"
        />
      </template>

      <!-- DRAFT (priority 3) -->
      <template v-if="draftTransfers.length">
        <SectionDividerLabel label="DRAFTS" class="q-mb-xs" />
        <AqlList
          class="q-mb-lg" dense separator
          item-key="Code"
          :highlight="true"
          :highlight-color="() => 'grey-5'"
          :clickable="true"
          :layout="['caption', 'label']"
          :content="[
            (t) => t.Date,
            (t) => `${draftItemCount(t.Code)} Items · ${draftTotalQty(t.Code)} Qty`
          ]"
          :items="draftTransfers"
          @click="onTransferClick"
        />
      </template>

      <!-- Empty state -->
      <div v-if="!approvedTransfers.length && !pendingTransfers.length && !draftTransfers.length && !historyTransfers.length" class="text-center q-pa-xl">
        <q-icon name="swap_horiz" size="4em" color="grey-5" />
        <div class="text-h6 q-mt-md">No transfers yet</div>
        <div class="text-caption text-grey-7 q-mb-lg">Initiate a new warehouse stock transfer to get started.</div>
      </div>

      <!-- HISTORY -->
      <template v-if="historyTransfers.length">
        <SectionDividerLabel label="HISTORY" class="q-mb-xs" />
        <q-expansion-item v-model="historyExpanded" class="q-mb-md" expand-icon-class="text-grey-6">
          <template #header>
            <q-item-section>
              <span class="text-subtitle1">
                <q-icon name="history" size="sm" class="q-mr-sm" />
                Transfer History
                <q-badge class="q-ml-sm" color="grey" outline :label="String(historyTransfers.length)" />
              </span>
            </q-item-section>
          </template>
          <AqlList
            class="q-pt-sm" dense separator
            item-key="Code"
            :highlight="true"
            :highlight-color="(t) => t.Progress === 'COMPLETED' ? 'positive' : 'negative'"
            :clickable="true"
            :layout="['label', 'caption', 'caption']"
            :content="[
              (t) => warehouseName(t.SourceWarehouseCode),
              (t) => `${t.Username} · ${t.Date}`,
              (t) => warehouseName(t.DestinationWarehouseCode) || ''
            ]"
            :chip="(t) => t.Progress"
            :chip-color="(t) => t.Progress === 'COMPLETED' ? 'positive' : 'negative'"
            :items="historyTransfers"
            @click="onTransferClick"
          />
        </q-expansion-item>
      </template>
    </template>

    <DataAddFAB tooltip="New Transfer" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWarehouseTransfers } from '../../../composables/operation/warehouseTransfers/useWarehouseTransfers.js'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import HeaderPanel from 'components/shared/HeaderPanel.vue'
import ReloadButton from 'components/shared/ReloadButton.vue'
import ResourceReports from 'components/Reports/ResourceReports.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/shared/AqlList.vue'
import DataAddFAB from 'components/shared/DataAddFAB.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'WarehouseTransfersIndexPage' })

const nav = useResourceNav()
const { hasUninitiatedDependencies } = useResourceReload()
const flow = useWarehouseTransfers()
const { loading, transfers, transferItems, warehouses, reload } = flow

const searchTerm = ref('')
const historyExpanded = ref(false)

const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

function warehouseName(code) {
  if (!code) return ''
  const w = warehouses.items.value.find(w => w.Code === code)
  return w?.Name || code || ''
}

const activeTransfers = computed(() =>
  transfers.items.value.filter(t => (t.Status || 'Active') === 'Active')
)

const searchedTransfers = computed(() => {
  const kw = searchTerm.value.trim().toLowerCase()
  if (!kw) return []
  return activeTransfers.value.filter(t =>
    [t.Code, warehouseName(t.SourceWarehouseCode), warehouseName(t.DestinationWarehouseCode), t.Username, t.Date, t.Progress]
      .join(' ').toLowerCase().includes(kw)
  )
})

const approvedTransfers = computed(() =>
  activeTransfers.value.filter(t => t.Progress === 'APPROVED')
)
const pendingTransfers = computed(() =>
  activeTransfers.value.filter(t => t.Progress === 'PENDING_APPROVAL')
)
const draftTransfers = computed(() =>
  activeTransfers.value.filter(t => t.Progress === 'DRAFT')
)
const historyTransfers = computed(() =>
  activeTransfers.value.filter(t => t.Progress === 'COMPLETED' || t.Progress === 'REJECTED')
)

function activeItemsFor(wtCode) {
  return transferItems.items.value.filter(
    item => item.WarehouseTransferCode === wtCode && (item.Status || 'Active') === 'Active'
  )
}

function draftItemCount(wtCode) {
  return activeItemsFor(wtCode).length
}

function draftTotalQty(wtCode) {
  return activeItemsFor(wtCode).reduce((sum, item) => sum + Number(item.Quantity || 0), 0)
}

function progressChipColor(progress) {
  const map = { DRAFT: 'grey-6', PENDING_APPROVAL: 'orange-7', APPROVED: 'blue-6', COMPLETED: 'positive', REJECTED: 'negative' }
  return map[progress] || 'grey-6'
}

function progressHighlightColor(progress) {
  const map = { DRAFT: 'grey-5', PENDING_APPROVAL: 'warning', APPROVED: 'blue-6', COMPLETED: 'positive', REJECTED: 'negative' }
  return map[progress] || 'grey-5'
}

function onTransferClick(transfer) {
  nav.goTo('view', { code: transfer.Code })
}

onMounted(() => reload())
</script>

