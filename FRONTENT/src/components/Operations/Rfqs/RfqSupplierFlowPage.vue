<template>
  <q-page padding class="q-gutter-md">
    <div class="row items-center q-gutter-sm">
      <q-btn icon="arrow_back" flat round @click="goToList" />
      <div>
        <div class="text-h6">
          {{ isAssignMode ? 'Assign Suppliers for RFQ' : 'Mark RFQ Suppliers as Sent' }}
        </div>
        <div class="text-caption text-grey-6">
          {{ isAssignMode ? 'Attach suppliers to the draft RFQ.' : 'Review assigned suppliers and send them.' }}
        </div>
      </div>
      <q-space />
      <q-chip
        v-if="record"
        :color="progressColor"
        text-color="white"
        icon="local_shipping"
        class="text-weight-bold"
      >
        {{ record.Progress || 'DRAFT' }}
      </q-chip>
    </div>

    <div v-if="loading && !record" class="flex flex-center q-py-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!record" class="text-center q-pa-xl text-grey">
      <q-icon name="search_off" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6">RFQ not found</div>
      <q-btn label="Back to RFQs" flat color="primary" class="q-mt-md" @click="goToList" />
    </div>

    <template v-else>
      <q-banner
        v-if="isAssignMode && !canAssignSupplier"
        rounded
        class="bg-orange-1 text-orange-10"
      >
        This RFQ is no longer in Draft state. Use the sent workflow page instead.
      </q-banner>

      <q-banner
        v-if="!isAssignMode && !canMarkAsSent"
        rounded
        class="bg-orange-1 text-orange-10"
      >
        This RFQ is not in Sent state yet.
      </q-banner>

      <q-card>
        <q-card-section>
          <div class="row q-col-gutter-sm">
            <div
              v-for="field in headerFields"
              :key="field.label"
              class="col-12 col-sm-6 col-md-4"
            >
              <div class="text-caption text-grey-6">{{ field.label }}</div>
              <div class="text-subtitle2">{{ field.value || '-' }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card v-if="itemCodes.length">
        <q-card-section>
          <div class="text-subtitle2 q-mb-xs">PR Items</div>
          <q-chip
            v-for="itemCode in itemCodes"
            :key="itemCode"
            dense
            square
            class="q-mr-xs q-mb-xs"
          >
            {{ itemCode }}
          </q-chip>
        </q-card-section>
      </q-card>

      <div class="row q-col-gutter-md">
        <div class="col-12" :class="isAssignMode ? '' : 'col-lg-6'">
          <q-card class="h-100">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-sm">
                {{ isAssignMode ? 'Available Suppliers' : 'Assigned Suppliers' }}
              </div>
              <q-banner
                v-if="isAssignMode && !availableSuppliers.length"
                rounded
                class="bg-grey-2 text-grey-8"
              >
                No available suppliers to assign.
              </q-banner>
              <q-banner
                v-else-if="!isAssignMode && !assignedSuppliers.length"
                rounded
                class="bg-grey-2 text-grey-8"
              >
                No assigned suppliers found.
              </q-banner>
              <template v-else>
                <q-table
                  v-if="isAssignMode"
                  v-model:selected="selectedAvailableRows"
                  :rows="availableSuppliers"
                  :columns="availableSupplierColumns"
                  row-key="Code"
                  selection="multiple"
                  flat
                  bordered
                  dense
                  :pagination="{ rowsPerPage: 8 }"
                />
                <q-table
                  v-else
                  v-model:selected="selectedAssignedRows"
                  :rows="assignedSuppliers"
                  :columns="assignedSupplierColumns"
                  row-key="Code"
                  selection="multiple"
                  flat
                  bordered
                  dense
                  :pagination="{ rowsPerPage: 8 }"
                />
              </template>
            </q-card-section>
            <q-card-actions align="right" class="q-pt-none">
              <q-btn
                v-if="isAssignMode"
                color="primary"
                icon="group_add"
                label="Assign Supplier"
                :loading="isSaving"
                :disable="!canAssign"
                @click="saveAssignments"
              />
              <q-btn
                v-else
                color="primary"
                icon="send"
                label="Mark Selected As Sent"
                :loading="isSaving"
                :disable="!canMark"
                @click="markSelectedAsSent"
              />
            </q-card-actions>
          </q-card>
        </div>

        <div v-if="!isAssignMode" class="col-12 col-lg-6">
          <q-card class="h-100">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-sm">Available Suppliers</div>
              <q-banner
                v-if="!availableSuppliers.length"
                rounded
                class="bg-grey-2 text-grey-8"
              >
                No available suppliers to show.
              </q-banner>
              <template v-else>
                <q-table
                  v-model:selected="selectedAvailableRows"
                  :rows="availableSuppliers"
                  :columns="availableSupplierColumns"
                  row-key="Code"
                  selection="multiple"
                  flat
                  bordered
                  dense
                  :pagination="{ rowsPerPage: 8 }"
                />
              </template>
            </q-card-section>
            <q-card-actions align="right" class="q-pt-none">
              <q-btn
                color="primary"
                icon="save"
                label="Save Suppliers"
                :loading="isSaving"
                :disable="!canAddAvailable"
                @click="saveAvailableSuppliers"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRFQSupplierFlow } from 'src/composables/operations/rfqs/useRFQSupplierFlow'

const props = defineProps({
  mode: {
    type: String,
    default: 'assign'
  }
})

const { code: rfqCode } = useResourceConfig()
const flow = useRFQSupplierFlow(rfqCode)
const {
  goToList,
  canAssignSupplier,
  canMarkAsSent,
  canAddAvailableSuppliers,
  isSaving
} = flow

const selectedAvailableRows = ref([])
const selectedAssignedRows = ref([])

const isAssignMode = computed(() => props.mode === 'assign')
const record = computed(() => flow.rfqRecord.value)
const loading = computed(() => flow.isHeaderLoading.value || flow.isSuppliersLoading.value)
const headerFields = computed(() => flow.headerDisplayFields.value || [])
const itemCodes = computed(() => flow.itemCodes.value || [])
const availableSuppliers = computed(() => flow.availableSuppliers.value || [])
const assignedSuppliers = computed(() => flow.assignedSupplierDetails.value || [])
const canAssign = computed(() => canAssignSupplier.value && selectedAvailableRows.value.length > 0)
const canAddAvailable = computed(() => canAddAvailableSuppliers.value && selectedAvailableRows.value.length > 0)
const canMark = computed(() => canMarkAsSent.value && selectedAssignedRows.value.length > 0)
const progressColor = computed(() => {
  const progress = (record.value?.Progress || '').toString().trim().toUpperCase()
  if (progress === 'DRAFT') return 'warning'
  if (progress === 'SENT') return 'primary'
  return 'secondary'
})

const availableSupplierColumns = [
  { name: 'Name', label: 'Supplier Name', field: 'Name', sortable: true, align: 'left' },
  { name: 'Province', label: 'Province', field: 'Province', sortable: true, align: 'left' },
  { name: 'Country', label: 'Country', field: 'Country', sortable: true, align: 'left' },
  { name: 'ContactPerson', label: 'Contact Person', field: 'ContactPerson', sortable: true, align: 'left' }
]

const assignedSupplierColumns = [
  { name: 'SupplierName', label: 'Supplier Name', field: 'SupplierName', sortable: true, align: 'left' },
  { name: 'Province', label: 'Province', field: 'Province', sortable: true, align: 'left' },
  { name: 'Country', label: 'Country', field: 'Country', sortable: true, align: 'left' },
  { name: 'Progress', label: 'Progress', field: 'Progress', sortable: true, align: 'left' }
]

watch(availableSuppliers, (rows) => {
  const availableCodes = new Set(rows.map((row) => row.Code).filter(Boolean))
  selectedAvailableRows.value = selectedAvailableRows.value.filter((row) => availableCodes.has(row.Code))
})

watch(assignedSuppliers, (rows) => {
  const assignedCodes = new Set(rows.map((row) => row.Code).filter(Boolean))
  selectedAssignedRows.value = selectedAssignedRows.value.filter((row) => assignedCodes.has(row.Code))
})

watch(
  () => rfqCode.value,
  async (code) => {
    if (code) {
      await flow.loadData()
    }
  },
  { immediate: true }
)

async function saveAssignments() {
  await flow.saveAssignments(selectedAvailableRows.value.map((row) => row.Code))
  selectedAvailableRows.value = []
}

async function saveAvailableSuppliers() {
  await flow.addAvailableSuppliers(selectedAvailableRows.value.map((row) => row.Code))
  selectedAvailableRows.value = []
}

async function markSelectedAsSent() {
  await flow.markSelectedAsSent(selectedAssignedRows.value.map((row) => row.Code))
  selectedAssignedRows.value = []
}
</script>
