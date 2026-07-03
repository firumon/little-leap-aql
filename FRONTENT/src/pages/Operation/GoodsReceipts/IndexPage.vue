<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><div class="text-h6">Goods Receipts</div><q-space /><q-input v-model="searchTerm" dense outlined placeholder="Search GRNs..." class="q-mr-sm" /><ReloadButton /></div>
    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />
    <div v-if="shouldBlockUi" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <div v-else>
      <q-card class="q-mb-md"><q-card-section><div class="text-subtitle1 q-mb-sm">Active GRNs</div><q-list separator><q-item v-for="row in activeItems" :key="row.Code" clickable @click="navigateTo(row.Code)"><q-item-section><q-item-label class="text-weight-medium">{{ row.Code }}</q-item-label><q-item-label caption>PO {{ row.PurchaseOrderCode }} · Receiving {{ row.POReceivingCode }} · {{ formatDate(row.Date) }}</q-item-label></q-item-section><q-item-section side><q-badge color="positive" label="Active" /></q-item-section></q-item><q-item v-if="!activeItems.length"><q-item-section class="text-grey">No active GRNs.</q-item-section></q-item></q-list></q-card-section></q-card>
      <q-card><q-card-section><div class="text-subtitle1 q-mb-sm">Invalidated GRNs</div><q-list separator><q-item v-for="row in inactiveItems" :key="row.Code" clickable @click="navigateTo(row.Code)"><q-item-section><q-item-label class="text-weight-medium">{{ row.Code }}</q-item-label><q-item-label caption>PO {{ row.PurchaseOrderCode }} · Receiving {{ row.POReceivingCode }}</q-item-label></q-item-section><q-item-section side><q-badge color="grey" label="Inactive" /></q-item-section></q-item><q-item v-if="!inactiveItems.length"><q-item-section class="text-grey">No invalidated GRNs.</q-item-section></q-item></q-list></q-card-section></q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useGoodsReceiptIndex } from '../../../composables/operation/goodsReceipts/useGoodsReceiptIndex.js'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'GoodsReceiptsIndexPage' })
const flow = useGoodsReceiptIndex()
const { hasUninitiatedDependencies } = useResourceReload()
const { items, activeItems, inactiveItems, loading, searchTerm, reload, navigateTo, formatDate } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)
onMounted(() => reload())
</script>

