<template>
  <div class="pr-review-page">
    <div v-if="loading" class="page-fullload column items-center justify-center">
      <q-spinner-dots color="primary" size="40px" />
      <div class="text-caption text-grey-5 q-mt-sm">Loading requisition…</div>
    </div>

    <div v-else-if="!prForm.Code" class="page-fullload column items-center justify-center">
      <q-icon name="search_off" size="48px" color="grey-4" />
      <div class="text-subtitle2 text-grey-5 q-mt-sm">Requisition not found</div>
      <q-btn flat color="primary" label="Back to list" icon="arrow_back" class="q-mt-md" @click="nav.goTo('list')" />
    </div>

    <template v-else>
      <PurchaseRequisitionReviewHero
        :nav="nav"
        :pr-form="prForm"
        :items-length="items.length"
        :total-qty="totalQty"
        :grand-total="grandTotal"
        :types="types"
        :priorities="priorities"
        :selected-warehouse="selectedWarehouse"
        :header-expanded="headerExpanded"
        :loading-warehouses="loadingWarehouses"
        :warehouses="warehouses"
        :is-revision="isRevision"
        :response-comment="responseComment"
        :format-date="formatDate"
        :format-currency="formatCurrency"
        :status-chip-style="statusChipStyle"
        :status-dot-color="statusDotColor"
        :type-icon="typeIcon"
        :priority-hex-color="priorityHexColor"
        :is-overdue="isOverdue"
        @update:header-expanded="headerExpanded = $event"
        @update:response-comment="responseComment = $event"
      />

      <PurchaseRequisitionReviewItemsCard
        :items="items"
        :filtered-items="filteredItems"
        :item-search="itemSearch"
        :sku-info-by-code="skuInfoByCode"
        :focused-field="focusedField"
        :format-currency="formatCurrency"
        @open-add-item="openAddItemDialog"
        @update:item-search="itemSearch = $event"
        @update:focused-field="focusedField = $event"
        @remove-item="removeItem"
      />

      <div style="height:168px" />
    </template>

    <PurchaseRequisitionReviewActionBar
      :loading="loading"
      :has-code="!!prForm.Code"
      :grand-total="grandTotal"
      :saving="saving"
      :submitting="submitting"
      :items-count="items.length"
      :format-currency="formatCurrency"
      @save-draft="emit('save-draft', buildPayload('Draft'))"
      @submit="emit('submit', buildPayload('New'))"
    />

    <PurchaseRequisitionAddItemDialog
      v-model="addDialog"
      :new-item="newItem"
      :sku-options="skuOptions"
      :format-currency="formatCurrency"
      @filter-skus="filterSkus"
      @confirm-add-item="confirmAddItem"
    />
  </div>
</template>

<script setup>
import PurchaseRequisitionAddItemDialog from 'src/components/Operations/PurchaseRequisitions/PurchaseRequisitionAddItemDialog.vue'
import PurchaseRequisitionReviewActionBar from 'src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewActionBar.vue'
import PurchaseRequisitionReviewHero from 'src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewHero.vue'
import PurchaseRequisitionReviewItemsCard from 'src/components/Operations/PurchaseRequisitions/PurchaseRequisitionReviewItemsCard.vue'
import { usePurchaseRequisitionReviewFlow } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionReviewFlow'

const emit = defineEmits(['save-draft', 'submit'])

const {
  nav,
  loading,
  saving,
  submitting,
  prForm,
  items,
  responseComment,
  warehouses,
  loadingWarehouses,
  skuInfoByCode,
  skuOptions,
  itemSearch,
  addDialog,
  newItem,
  headerExpanded,
  focusedField,
  types,
  priorities,
  isRevision,
  filteredItems,
  totalQty,
  grandTotal,
  selectedWarehouse,
  statusChipStyle,
  statusDotColor,
  typeIcon,
  priorityHexColor,
  formatDate,
  formatCurrency,
  isOverdue,
  openAddItemDialog,
  filterSkus,
  confirmAddItem,
  removeItem,
  buildPayload
} = usePurchaseRequisitionReviewFlow()

defineExpose({ buildPayload, prForm, items })
</script>

<style lang="scss" scoped>
.pr-review-page {
  min-height: 100%;
  padding-bottom: 168px;
}

.page-fullload {
  min-height: 300px;
}
</style>
