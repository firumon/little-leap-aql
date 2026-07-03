<template>
  <q-page padding>
<div class="row items-center q-mb-md">
  <div class="text-h6">PO Receiving</div><q-space />
  <q-input v-model="searchTerm" dense outlined placeholder="Search receiving..." class="q-mr-sm" />
  <ReloadButton />
</div>
    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />
    <div v-if="shouldBlockUi" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <q-list v-else-if="groups.length" class="q-gutter-y-sm">
      <q-expansion-item v-for="group in groups" :key="group.key" :label="group.meta.label" :caption="`${group.items.length} records`" :default-opened="isGroupExpanded(group.key)" @update:model-value="toggleGroup(group.key)" header-class="bg-grey-2 text-weight-bold" class="shadow-1 rounded-borders overflow-hidden">
        <q-list separator>
          <q-item v-for="row in group.items" :key="row.Code" clickable @click="navigateTo(row.Code)">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ row.Code }}</q-item-label>
              <q-item-label caption>{{ purchaseOrderLabel(row.PurchaseOrderCode) }} · {{ formatDate(row.InspectionDate) }}</q-item-label>
            </q-item-section>
            <q-item-section side><q-chip dense :color="group.meta.color" text-color="white">{{ group.meta.label }}</q-chip></q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
    <div v-else class="text-center q-pa-xl text-grey">No PO receiving records found.</div>
    <q-page-sticky v-if="permissions.canWrite" position="bottom-right" :offset="[18, 18]"><q-btn fab icon="add" color="primary" @click="navigateToAdd" /></q-page-sticky>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { usePOReceivingIndex } from '../../../composables/operation/poReceivings/usePOReceivingIndex.js'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'PoReceivingsIndexPage' })
const flow = usePOReceivingIndex()
const { hasUninitiatedDependencies } = useResourceReload()
const { permissions, items, groups, loading, searchTerm, isGroupExpanded, toggleGroup, navigateTo, navigateToAdd, purchaseOrderLabel, formatDate } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)
onMounted(() => flow.reload())
</script>

