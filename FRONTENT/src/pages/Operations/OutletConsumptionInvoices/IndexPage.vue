<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Consumption Invoices</div>
      <q-space />
      <q-input v-model="searchTerm" dense outlined placeholder="Search" class="q-mr-sm" />
      <q-btn icon="refresh" flat round :loading="loading" @click="reload(true)" />
    </div>

    <q-list v-if="invoiceGroups.length" class="q-gutter-y-sm">
      <q-expansion-item
        v-for="group in invoiceGroups"
        :key="group.key"
        :label="group.meta.label"
        :caption="`${group.items.length} records`"
        :model-value="isInvoiceGroupExpanded(group.key)"
        header-class="bg-grey-2 text-weight-bold"
        class="shadow-1 rounded-borders overflow-hidden"
        @update:model-value="toggleInvoiceGroup(group.key, $event)"
      >
        <q-list separator>
          <q-item v-for="row in group.items" :key="row.Code" clickable @click="navigateToInvoice(row.Code)">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ outletName(row.OutletCode) }} · {{ formatDisplayDate(row.Date) }}</q-item-label>
              <q-item-label caption>{{ row.Code }} · {{ row.OutletConsumptionCode }} · {{ row.Username }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="text-right">
                <OutletProgressChip :progress="row.Progress" />
                <div class="text-caption text-grey-7 q-mt-xs">{{ row.Subtotal || 0 }} / {{ row.Discount || 0 }} / {{ row.Tax || 0 }}</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
    <div v-else-if="loading" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>
    <div v-else class="text-center q-pa-xl text-grey">No consumption invoices found.</div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletConsumptionInvoicesIndexPage' })
const flow = useOutletConsumption()
const { loading, searchTerm, invoiceGroups, reload, navigateToInvoice, outletName, formatDisplayDate, isInvoiceGroupExpanded, toggleInvoiceGroup } = flow
onMounted(() => reload())
</script>
