<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="assign-supplier-page">
      <q-card-section class="row items-start justify-between q-col-gutter-md">
        <div class="col">
          <div class="text-overline text-primary">Request for Quotation</div>
          <div class="text-h6 text-weight-bold">Assign Supplier</div>
          <div class="text-caption text-grey-6">{{ rfqRecord?.Code || rfqCode }}</div>
        </div>
        <div class="col-auto">
          <q-btn flat round icon="arrow_back" color="primary" @click="nav.goTo('view')">
            <q-tooltip>Back to RFQ</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section v-if="isHeaderLoading">
        <q-spinner color="primary" size="2em" />
      </q-card-section>

      <q-card-section v-else>
        <q-banner v-if="!canAssignSupplier" rounded class="bg-orange-1 text-orange-10 q-mb-md">
          This RFQ is no longer editable. Supplier assignment is only available while the RFQ is in DRAFT.
        </q-banner>

        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-md-4" v-for="field in safeHeaderDisplayFields" :key="field.label">
            <div class="text-caption text-grey-6">{{ field.label }}</div>
            <div class="text-body2">{{ field.value || '-' }}</div>
          </div>
        </div>

        <div class="text-subtitle2 q-mb-xs">Linked PR Items</div>
        <div class="q-gutter-xs q-mb-md">
          <q-chip v-for="itemCode in itemCodes" :key="itemCode" dense square>{{ itemCode }}</q-chip>
          <div v-if="!itemCodes.length" class="text-caption text-grey-6">No PR item codes linked.</div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="text-h6 q-mb-md">Available Suppliers</div>
        <q-banner v-if="availableSuppliers.length === 0 && !isSuppliersLoading" rounded class="bg-grey-2 text-grey-8 q-mb-md">
          No available suppliers to assign.
        </q-banner>

        <q-table
          v-if="availableSuppliers.length > 0"
          v-model:selected="selectedRows"
          :rows="availableSuppliers"
          :columns="supplierColumns"
          row-key="Code"
          selection="multiple"
          :loading="isSuppliersLoading"
          flat
          bordered
          class="q-mb-md"
          :pagination="{ rowsPerPage: 10 }"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="nav.goTo('view')" />
        <q-btn
          label="Save Assignment"
          color="primary"
          :loading="isSaving"
          :disable="!canAssignSupplier || selectedRows.length === 0"
          @click="onSave"
        />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRFQSupplierFlow } from 'src/composables/operations/rfqs/useRFQSupplierFlow'

const nav = useResourceNav()
const { code: rfqCode } = useResourceConfig()

const {
  isHeaderLoading,
  isSuppliersLoading,
  isSaving,
  rfqRecord,
  headerDisplayFields,
  itemCodes,
  availableSuppliers,
  canAssignSupplier,
  loadData,
  saveAssignments
} = useRFQSupplierFlow(rfqCode)

const selectedRows = ref([])
const selectedSupplierCodes = computed(() => selectedRows.value.map((row) => row.Code))
const safeHeaderDisplayFields = computed(() =>
  (headerDisplayFields.value || []).filter((field) => field && field.label)
)

const supplierColumns = [
  { name: 'Name', label: 'Supplier Name', field: 'Name', sortable: true, align: 'left' },
  { name: 'Province', label: 'Province', field: 'Province', sortable: true, align: 'left' },
  { name: 'Country', label: 'Country', field: 'Country', sortable: true, align: 'left' },
  { name: 'ContactPerson', label: 'Contact Person', field: 'ContactPerson', sortable: true, align: 'left' }
]

onMounted(async () => {
  await loadData()
})

async function onSave() {
  await saveAssignments(selectedSupplierCodes.value)
  selectedRows.value = []
}
</script>

<style scoped>
.assign-supplier-page {
  max-width: 960px;
  margin: 0 auto;
}
</style>
