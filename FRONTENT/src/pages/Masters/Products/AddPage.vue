<template>
  <div class="add-page">
    <q-card flat bordered class="page-card">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-h6 text-weight-bold">Create Product</div>
        <div class="text-caption text-grey-6">Define variant dimensions, then add SKU rows.</div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">Product Details</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input
              v-model="parentForm.Name"
              outlined
              dense
              label="Name *"
              placeholder="e.g. Baby Bottle"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="parentForm.Status"
              outlined
              dense
              emit-value
              map-options
              :options="statusOptions"
              label="Status"
            />
          </div>
          <div class="col-12">
            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <q-input
                  v-model="newVariantType"
                  outlined
                  dense
                  label="Variant Type"
                  placeholder="e.g. Color"
                  @keyup.enter.prevent="addVariantType"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  color="primary"
                  unelevated
                  no-caps
                  label="Add Variant"
                  :disable="!newVariantType.trim() || variantTypeList.length >= 5"
                  @click="addVariantType"
                />
              </div>
            </div>
            <div class="q-mt-sm">
              <q-chip
                v-for="(variant, index) in variantTypeList"
                :key="`${variant}-${index}`"
                removable
                dense
                square
                color="teal-1"
                text-color="teal-10"
                class="q-mr-xs q-mb-xs"
                @remove="removeVariantType(index)"
              >
                {{ variant }}
              </q-chip>
              <span v-if="!variantTypeList.length" class="text-caption text-grey-6">No variant types added yet</span>
            </div>
            <div class="text-caption text-grey-6 q-mt-xs">
              Maximum 5 variant types. Order maps to SKU columns: Variant1 to Variant5.
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2 text-weight-medium">SKU Variants</div>
          <q-space />
          <q-btn
            color="primary"
            outline
            no-caps
            icon="add"
            label="Add SKU"
            @click="addSkuRow"
          />
        </div>

        <q-banner v-if="!variantColumns.length" rounded class="bg-blue-1 text-blue-10 q-mb-sm">
          You can save without variant types, but SKU duplicate validation will be skipped.
        </q-banner>

        <q-banner v-if="duplicateIssue" rounded class="bg-orange-1 text-orange-10 q-mb-sm">
          Duplicate variant set found in rows {{ duplicateIssue.row1 }} and {{ duplicateIssue.row2 }}.
        </q-banner>

        <q-table
          :rows="skuRecords"
          :columns="skuColumns"
          row-key="_key"
          flat
          bordered
          :rows-per-page-options="[0]"
          hide-pagination
        >
          <template #body="props">
            <q-tr :props="props" :class="{ 'row-inactive': isRowInactive(props.row) }">
              <q-td v-for="column in props.cols" :key="column.name" :props="props">
                <template v-if="column.name === 'actions'">
                  <q-btn
                    v-if="isRowInactive(props.row)"
                    flat
                    round
                    dense
                    color="positive"
                    icon="undo"
                    @click="restoreSkuRow(props.rowIndex)"
                  >
                    <q-tooltip>Restore</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-else
                    flat
                    round
                    dense
                    color="negative"
                    icon="delete"
                    @click="removeSkuRow(props.rowIndex)"
                  >
                    <q-tooltip>Delete</q-tooltip>
                  </q-btn>
                </template>
                <template v-else-if="column.name === 'Status'">
                  <q-badge :color="isRowInactive(props.row) ? 'grey-6' : 'positive'" outline>
                    {{ props.row.data.Status || 'Active' }}
                  </q-badge>
                </template>
                <template v-else>
                  <q-input
                    :model-value="props.row.data[column.field]"
                    outlined
                    dense
                    :disable="isRowInactive(props.row)"
                    @update:model-value="updateSkuField(props.rowIndex, column.field, $event)"
                  />
                </template>
              </q-td>
            </q-tr>
          </template>
          <template #no-data>
            <div class="full-width text-center q-py-lg text-grey-7">
              No SKU rows yet. Click "Add SKU" to create one.
            </div>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="row justify-end q-gutter-sm">
        <q-btn flat no-caps label="Cancel" @click="navigateBack" />
        <q-btn color="primary" unelevated no-caps label="Create" :loading="saving" @click="handleSave" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useProductVariants, hasDuplicateVariantSet, validateSkuVariants } from 'src/composables/useProductVariants'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useCompositeForm } from 'src/composables/useCompositeForm'
import { useResourceNav } from 'src/composables/useResourceNav'

const nav = useResourceNav()
const $q = useQuasar()
const { config } = useResourceConfig()

const {
  parentForm,
  childGroups,
  saving,
  statusOptions,
  initializeForCreate,
  addChildRecord,
  removeChildRecord,
  updateChildField,
  save
} = useCompositeForm(config)

const newVariantType = ref('')
const { variantColumns } = useProductVariants(parentForm)

const skuGroup = computed(() => childGroups.value.find((group) => group.resource?.name === 'SKUs') || null)
const skuRecords = computed(() => (skuGroup.value?.records || []))

const variantTypeList = computed(() => {
  const raw = (parentForm.value?.VariantTypes || '').toString().trim()
  if (!raw) return []
  return raw.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5)
})

const activeSkuRecords = computed(() => {
  return skuRecords.value.filter((row) => row._action !== 'deactivate' && (row.data?.Status || 'Active') !== 'Inactive')
})

const duplicateIssue = computed(() => {
  return hasDuplicateVariantSet(activeSkuRecords.value, variantColumns.value)
})

const skuColumns = computed(() => {
  return [
    {
      name: 'Code',
      label: 'SKU Code',
      field: 'Code',
      align: 'left'
    },
    ...variantColumns.value.map((variant) => ({
      name: variant.key,
      label: variant.label,
      field: variant.key,
      align: 'left'
    })),
    {
      name: 'Status',
      label: 'Status',
      field: 'Status',
      align: 'left'
    },
    {
      name: 'actions',
      label: '',
      field: 'actions',
      align: 'right'
    }
  ]
})

function setVariantTypeList(nextList) {
  const normalized = nextList
    .map((entry) => (entry || '').toString().trim())
    .filter(Boolean)
    .slice(0, 5)

  parentForm.value.VariantTypes = normalized.join(',')
}

function addVariantType() {
  const next = newVariantType.value.trim()
  if (!next) return
  if (variantTypeList.value.length >= 5) {
    $q.notify({ type: 'warning', message: 'Maximum 5 variant types allowed.', timeout: 2200 })
    return
  }
  const exists = variantTypeList.value.some((item) => item.toLowerCase() === next.toLowerCase())
  if (exists) {
    $q.notify({ type: 'warning', message: 'Variant type already exists.', timeout: 2200 })
    return
  }
  setVariantTypeList([...variantTypeList.value, next])
  newVariantType.value = ''
}

function removeVariantType(index) {
  const next = [...variantTypeList.value]
  next.splice(index, 1)
  setVariantTypeList(next)
}

function ensureSkuRecordDefaults(record) {
  if (!record || !record.data) return
  if (record.data.Code === undefined || record.data.Code === null) {
    record.data.Code = ''
  }
  if (record.data.ProductCode === undefined || record.data.ProductCode === null) {
    record.data.ProductCode = ''
  }
  if (!record.data.Status) {
    record.data.Status = 'Active'
  }
  for (let i = 1; i <= 5; i += 1) {
    const key = `Variant${i}`
    if (record.data[key] === undefined || record.data[key] === null) {
      record.data[key] = ''
    }
  }
}

function relaxSkuSystemFieldValidation() {
  if (!skuGroup.value || !Array.isArray(skuGroup.value.resolvedFields)) return
  skuGroup.value.resolvedFields = skuGroup.value.resolvedFields.map((field) => {
    if (field.header === 'ProductCode' || field.header === 'ParentCode') {
      return { ...field, required: false }
    }
    return field
  })
}

function addSkuRow() {
  addChildRecord('SKUs')
  const lastRow = skuRecords.value[skuRecords.value.length - 1]
  ensureSkuRecordDefaults(lastRow)
}

function removeSkuRow(index) {
  removeChildRecord('SKUs', index)
}

function restoreSkuRow(index) {
  const row = skuRecords.value[index]
  if (!row) return
  row._action = row.data?.Code ? 'update' : 'create'
  row.data.Status = 'Active'
}

function updateSkuField(index, field, value) {
  updateChildField('SKUs', index, field, value)
}

function isRowInactive(row) {
  return row?._action === 'deactivate' || (row?.data?.Status || 'Active') === 'Inactive'
}

function validateBeforeSave() {
  const productName = (parentForm.value?.Name || '').toString().trim()
  if (!productName) {
    $q.notify({ type: 'negative', message: 'Product Name is required.', timeout: 2200 })
    return false
  }

  for (let i = 0; i < activeSkuRecords.value.length; i += 1) {
    const row = activeSkuRecords.value[i]
    const error = validateSkuVariants(row, variantColumns.value)
    if (error) {
      $q.notify({ type: 'negative', message: `SKU row ${i + 1}: ${error}`, timeout: 2500 })
      return false
    }
  }

  const duplicate = hasDuplicateVariantSet(activeSkuRecords.value, variantColumns.value)
  if (duplicate) {
    $q.notify({
      type: 'negative',
      message: `Duplicate variant set found in rows ${duplicate.row1} and ${duplicate.row2}.`,
      timeout: 2600
    })
    return false
  }

  return true
}

async function handleSave() {
  relaxSkuSystemFieldValidation()
  if (!validateBeforeSave()) return
  const response = await save()
  if (response.success) {
    const newCode = response.data?.code || response.data?.parentCode
    if (newCode) {
      nav.goTo('view', { code: newCode })
    } else {
      nav.goTo('list')
    }
  }
}

function navigateBack() {
  nav.goTo('list')
}

onMounted(() => {
  initializeForCreate()
  parentForm.value.Status = parentForm.value.Status || 'Active'
  parentForm.value.VariantTypes = parentForm.value.VariantTypes || ''
  relaxSkuSystemFieldValidation()
})

watch(
  () => skuRecords.value.length,
  () => {
    relaxSkuSystemFieldValidation()
    skuRecords.value.forEach((row) => ensureSkuRecordDefaults(row))
  },
  { immediate: true }
)
</script>

<style scoped>
.add-page {
  display: grid;
  gap: 8px;
}

.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
}

.row-inactive {
  opacity: 0.6;
}
</style>
