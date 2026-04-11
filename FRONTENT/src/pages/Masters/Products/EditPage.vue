<template>
  <div class="edit-page">
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <template v-else>
      <q-card flat bordered class="page-card">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="text-h6 text-weight-bold">Edit Product - {{ code }}</div>
          <div class="text-caption text-grey-6">Update product and related SKU variants in one save.</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="text-subtitle2 text-weight-medium q-mb-sm">Product Details</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-md-4">
              <q-input :model-value="code" outlined dense label="Code" readonly />
            </div>
            <div class="col-12 col-md-4">
              <q-input v-model="parentForm.Name" outlined dense label="Name *" />
            </div>
            <div class="col-12 col-md-4">
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
                  @remove="confirmRemoveVariantType(index)"
                >
                  {{ variant }}
                </q-chip>
                <span v-if="!variantTypeList.length" class="text-caption text-grey-6">No variant types</span>
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                Removing a variant type will re-map following variant columns and clear trailing values.
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
            <q-btn color="primary" outline no-caps icon="add" label="Add SKU" @click="addSkuRow" />
          </div>

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
              <div class="full-width text-center q-py-lg text-grey-7">No SKU rows available.</div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="row justify-end q-gutter-sm">
          <q-btn flat no-caps label="Cancel" @click="navigateBack" />
          <q-btn color="primary" unelevated no-caps label="Update" :loading="saving" @click="handleSave" />
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useProductVariants, hasDuplicateVariantSet, validateSkuVariants } from 'src/composables/useProductVariants'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useCompositeForm } from 'src/composables/useCompositeForm'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { getResourceMeta, upsertResourceRows, deleteResourceRowByCode } from 'src/utils/db'

const router = useRouter()
const $q = useQuasar()
const { scope, resourceSlug, code, config, resourceName } = useResourceConfig()
const { items, loading: resourceLoading, reload, updateLocalRecord } = useResourceData(resourceName)

const {
  parentForm,
  childGroups,
  saving,
  statusOptions,
  initializeForEdit,
  addChildRecord,
  removeChildRecord,
  updateChildField,
  save
} = useCompositeForm(config)

const initLoading = ref(false)
const newVariantType = ref('')

const record = computed(() => {
  if (!code.value || !Array.isArray(items.value)) return null
  return items.value.find((row) => row.Code === code.value) || null
})

const { variantColumns } = useProductVariants(parentForm)
const skuGroup = computed(() => childGroups.value.find((group) => group.resource?.name === 'SKUs') || null)
const skuRecords = computed(() => skuGroup.value?.records || [])

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

const loading = computed(() => resourceLoading.value || initLoading.value)

function ensureSkuRecordDefaults(recordRow) {
  if (!recordRow || !recordRow.data) return
  if (recordRow.data.Code === undefined || recordRow.data.Code === null) {
    recordRow.data.Code = ''
  }
  if (recordRow.data.ProductCode === undefined || recordRow.data.ProductCode === null) {
    recordRow.data.ProductCode = code.value || ''
  }
  if (!recordRow.data.Status) {
    recordRow.data.Status = 'Active'
  }
  for (let i = 1; i <= 5; i += 1) {
    const key = `Variant${i}`
    if (recordRow.data[key] === undefined || recordRow.data[key] === null) {
      recordRow.data[key] = ''
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

function ensureSkuParentLinkBeforeSave() {
  skuRecords.value.forEach((row) => {
    if (!row || !row.data) return
    if (row._action === 'deactivate') return
    row.data.ProductCode = code.value || row.data.ProductCode || ''
  })
}

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

function applyVariantRemovalToRows(removedIndex) {
  const start = removedIndex + 1
  skuRecords.value.forEach((row) => {
    for (let i = start; i < 5; i += 1) {
      const currentKey = `Variant${i}`
      const nextKey = `Variant${i + 1}`
      row.data[currentKey] = row.data[nextKey] || ''
    }
    row.data.Variant5 = ''
  })
}

function confirmRemoveVariantType(index) {
  const current = [...variantTypeList.value]
  if (!current[index]) return
  const removedLabel = current[index]

  $q.dialog({
    title: 'Remove Variant Type',
    message: `Removing "${removedLabel}" will update existing SKU variant columns. Continue?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    current.splice(index, 1)
    setVariantTypeList(current)
    applyVariantRemovalToRows(index)
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

async function loadAndInitialize(forceSync = false) {
  if (!resourceName.value || !code.value) return
  initLoading.value = true
  try {
    await reload(forceSync)
    if (!record.value) return

    const skuResponse = await fetchResourceRecords('SKUs', {
      includeInactive: true,
      forceSync
    })
    const skuRows = skuResponse.success && Array.isArray(skuResponse.records)
      ? skuResponse.records.filter((row) => row.ProductCode === code.value)
      : []

    initializeForEdit(record.value, { SKUs: skuRows })
    relaxSkuSystemFieldValidation()
    skuRecords.value.forEach((row) => ensureSkuRecordDefaults(row))
  } finally {
    initLoading.value = false
  }
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
  ensureSkuParentLinkBeforeSave()
  if (!validateBeforeSave()) return
  const response = await save()
  if (response.success) {
    // Optimistic: update local items + IDB immediately so View page sees fresh data
    await updateLocalRecord({ ...parentForm.value, Code: code.value })
    await reconcileSkuCacheAfterSave()
    router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
  }
}

async function reconcileSkuCacheAfterSave() {
  const codeChanges = skuRecords.value
    .filter((row) => row?._action === 'update')
    .map((row) => ({
      from: (row._originalCode || '').toString().trim(),
      to: (row.data?.Code || '').toString().trim()
    }))
    .filter((entry) => entry.from && entry.to && entry.from !== entry.to)

  for (const change of codeChanges) {
    await deleteResourceRowByCode('SKUs', change.from)
  }

  const meta = await getResourceMeta('SKUs')
  const headers = Array.isArray(meta?.headers) ? meta.headers : []
  if (!headers.length) return

  const rows = skuRecords.value
    .filter((row) => row && row.data && row.data.Code)
    .map((row) => headers.map((header) => row.data[header] ?? ''))

  if (rows.length) {
    await upsertResourceRows('SKUs', headers, rows)
  }
}

function navigateBack() {
  router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
}

function navigateToList() {
  router.push(`/${scope.value}/${resourceSlug.value}`)
}

watch(
  () => [resourceName.value, code.value],
  async ([name, currentCode]) => {
    if (!name || !currentCode) return
    await loadAndInitialize()
  },
  { immediate: true }
)
</script>

<style scoped>
.edit-page {
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
