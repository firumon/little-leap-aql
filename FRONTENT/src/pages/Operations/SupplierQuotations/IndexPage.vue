<template>
  <div class="sq-index">
    <q-card flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6">Supplier Quotations</div>
            <div class="text-caption text-grey-6">{{ totalVisible }} visible · {{ items.length }} total</div>
          </div>
          <q-btn flat round icon="refresh" color="primary" :loading="loading" @click="reload(true)">
            <q-tooltip>Sync from server</q-tooltip>
          </q-btn>
        </div>
        <q-input v-model="searchTerm" dense outlined clearable placeholder="Search quotations" class="q-mt-sm">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </q-card-section>
    </q-card>

    <div v-if="loading && !items.length" class="text-center q-py-xl">
      <q-spinner-dots color="primary" size="36px" />
    </div>

    <template v-else>
      <div v-for="group in groups" :key="group.key">
        <div class="sq-group row items-center q-pa-sm cursor-pointer" :style="{ borderLeftColor: group.color }" @click="toggleGroup(group.key)">
          <q-icon :name="group.icon" :style="{ color: group.color }" size="20px" class="q-mr-sm" />
          <div class="col text-weight-bold" :style="{ color: group.color }">{{ group.label }}</div>
          <q-badge :style="{ background: group.color }" text-color="white">{{ group.records.length }}</q-badge>
          <q-icon :name="isGroupExpanded(group.key) ? 'expand_less' : 'expand_more'" color="grey-6" class="q-ml-sm" />
        </div>

        <div v-if="isGroupExpanded(group.key)" class="sq-records">
          <q-card v-for="row in group.records" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row)">
            <q-card-section class="q-pa-sm">
              <div class="row items-start no-wrap">
                <div class="col">
                  <div class="row items-center q-gutter-xs">
                    <q-chip dense :style="{ background: group.color, color: 'white' }">{{ row.Code }}</q-chip>
                    <q-chip dense outline>{{ row.ResponseType || '-' }}</q-chip>
                    <q-chip dense outline>{{ row.Progress || 'RECEIVED' }}</q-chip>
                  </div>
                  <div class="text-subtitle2 q-mt-xs">
                    {{ supplierName(row.SupplierCode) }} · {{ row.RFQCode || '-' }}
                  </div>
                  <div class="text-caption text-grey-7">
                    {{ row.ProcurementCode || '-' }} · {{ formatDate(row.ResponseDate || row.ResponseRecordedAt) }}
                  </div>
                  <div class="q-mt-xs row q-gutter-xs">
                    <q-chip dense icon="payments">{{ formatCurrency(row.TotalAmount, row.Currency) }}</q-chip>
                    <q-chip dense icon="local_shipping">{{ row.ShippingTerm || 'No term' }}</q-chip>
                    <q-chip dense icon="event_available">Valid {{ formatDate(row.ValidUntilDate) }}</q-chip>
                  </div>
                </div>
                <div class="col-auto text-center text-grey-6 q-pl-sm">
                  <q-icon name="chevron_right" size="24px" :style="{ color: group.color }" />
                  <div class="text-caption">{{ group.actionHint }}</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div v-if="!totalVisible" class="text-center q-py-xl text-grey-6">
        <q-icon name="request_quote" size="48px" color="grey-4" />
        <div class="q-mt-sm">No supplier quotations found</div>
      </div>
    </template>

    <q-page-sticky position="bottom-right" :offset="[16, 22]" style="z-index:30">
      <q-btn v-if="permissions.canWrite" round unelevated icon="add" color="primary" class="sq-fab" @click="navigateToAdd">
        <q-tooltip>Record Supplier Quotation</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </div>
</template>

<script setup>
import { useSupplierQuotationIndex } from 'src/composables/operations/supplierQuotations/useSupplierQuotationIndex'

const {
  permissions,
  items,
  loading,
  searchTerm,
  groups,
  totalVisible,
  reload,
  isGroupExpanded,
  toggleGroup,
  navigateTo,
  navigateToAdd,
  supplierName,
  formatDate,
  formatCurrency
} = useSupplierQuotationIndex()
</script>

<style scoped>
.sq-index { display: grid; gap: 8px; }
.sq-group {
  border-left: 4px solid;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
}
.sq-records {
  display: grid;
  gap: 6px;
  padding: 6px 0 8px 8px;
}
.sq-fab {
  width: 58px;
  height: 58px;
}
</style>
