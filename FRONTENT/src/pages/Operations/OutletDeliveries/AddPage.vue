<template>
  <q-page padding>
    <HeaderPanel title="Create Outlet Delivery" subtitle="Select allocated restock items" class="q-mb-md" />

    <div class="row q-col-gutter-xs">
      <div class="col-8">
        <q-select v-model="criteria" map-options emit-value outlined :options="criteriaOptions" dense options-dense class="q-mb-xs" label="Display Option" />
      </div>
      <div class="col-4">
        <q-select v-model="selectedWarehouseCode" :options="warehouseOptions" outlined dense label="Warehouse" emit-value map-options options-dense />
      </div>
      <div class="col-12">
        <q-input v-model="searchTerm" dense outlined clearable placeholder="Search outlet, SKU, or restock..." class="q-mb-md">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
    </div>

    <div class="row q-gutter-sm q-mb-md">
      <q-btn flat dense no-caps label="Select All" icon="select_all" @click="selectAllAvailable" />
      <q-btn flat dense no-caps label="Select None" icon="deselect" @click="selectNone" />
      <q-btn flat dense no-caps label="Invert" icon="swap_horiz" @click="invertSelection" />
    </div>

    <div v-if="!groupedSearchResults.length" class="text-center q-pa-xl text-grey-7">
      <q-icon name="inventory_2" size="3em" class="q-mb-sm" />
      <div>No available items match your criteria.</div>
    </div>

    <template v-for="group in groupedSearchResults" :key="group.key">
      <q-card v-if="!isTwoLevel" flat bordered class="q-mb-md">
        <q-card-section class="row items-center q-pa-sm">
          <span class="text-subtitle1 text-weight-medium text-primary">{{ group.label }}</span>
<!--          <q-badge class="q-ml-sm" color="primary" :label="String(group.items.length)" />-->
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="row in group.items" :key="row.ORICode" clickable @click="toggleItem(row.ORICode)">
            <q-item-section avatar>
              <q-checkbox :model-value="selectedItemCodes.includes(row.ORICode)" @update:model-value="toggleItem(row.ORICode)" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-caption text-weight-medium">{{ row.skuLabel }}</q-item-label>
              <q-item-label caption>
                <template v-if="!selectedWarehouseCode">{{ row.warehouseName }} - </template>{{ row.storageName }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="String(row.qty)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <q-card v-else flat bordered class="q-mb-md">
        <q-card-section class="row items-center q-pa-sm">
          <span class="text-subtitle1 text-weight-medium text-primary">{{ group.label }}</span>
<!--          <q-badge class="q-ml-sm" color="primary" :label="String(group.count)" />-->
        </q-card-section>
        <q-separator />
        <div v-for="child in group.children" :key="child.key" class="q-pa-sm">
          <div class="text-subtitle2 q-px-sm q-mb-xs text-weight-medium">{{ child.label }}</div>
          <q-list separator dense>
            <q-item v-for="row in child.items" :key="row.ORICode" clickable @click="toggleItem(row.ORICode)">
              <q-item-section avatar>
                <q-checkbox :model-value="selectedItemCodes.includes(row.ORICode)" @update:model-value="toggleItem(row.ORICode)" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-caption text-weight-medium">{{ row.skuLabel }}</q-item-label>
                <q-item-label caption>
                  <template v-if="!selectedWarehouseCode">{{ row.warehouseName }} - </template>{{ row.storageName }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge color="primary" :label="String(row.qty)" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card>
    </template>

    <div class="row justify-end q-gutter-sm q-mt-md">
      <q-btn flat label="Cancel" @click="cancel" />
      <q-btn color="primary" label="Create Draft" :disable="!selectedItems.length" :loading="saving" @click="createDraft" />
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'

defineOptions({ name: 'OutletDeliveriesAddPage' })

const flow = useOutletDeliveries()
const {
  loading, saving, searchTerm, selectedItemCodes, selectedItems,
  criteria, selectedWarehouseCode, warehouseOptions, groupedSearchResults,
  reloadAdd, toggleItem, selectAllAvailable, clearSelection, selectNone, invertSelection,
  createDraft, cancel
} = flow

const isTwoLevel = computed(() => (flow.CRITERIA_MAP[criteria.value] || flow.CRITERIA_MAP.Outlet).isTwoLevel)

const criteriaOptions = computed(() =>
  Object.keys(flow.CRITERIA_MAP).map(key => ({ label: key, value: key }))
)

onMounted(() => reloadAdd())
</script>
