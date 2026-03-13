<template>
  <q-page class="master-page q-pa-sm q-pa-md">
    <q-card flat bordered class="header-card">
      <q-card-section class="q-pa-sm">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="header-title">{{ config?.ui?.pageTitle || config?.name }}</div>
            <div class="header-subtitle">{{ config?.ui?.pageDescription || 'Manage records' }}</div>
          </div>
          <div class="row items-center">
            <q-btn
              v-if="!backgroundSyncing"
              flat
              round
              icon="refresh"
              color="primary"
              :loading="loading"
              :disable="loading || backgroundSyncing"
              @click="reload(true)"
            >
              <q-tooltip>Force Sync from Server</q-tooltip>
            </q-btn>
            <q-icon
              v-if="backgroundSyncing"
              name="sync"
              color="primary"
              class="sync-indicator q-ml-xs"
            >
              <q-tooltip>Background Synchronizing...</q-tooltip>
            </q-icon>
          </div>
        </div>
        <div class="header-stats row q-col-gutter-sm q-mt-sm">
          <div class="col-6">
            <div class="mini-stat">
              <div class="mini-label">Visible</div>
              <div class="mini-value">{{ filteredItems.length }}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="mini-stat">
              <div class="mini-label">Total</div>
              <div class="mini-value">{{ items.length }}</div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="toolbar-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="row q-col-gutter-sm items-center">
          <div class="col-12 col-md">
            <q-input
              v-model="searchTerm"
              outlined
              dense
              clearable
              debounce="180"
              placeholder="Search code, name, or any field"
              class="search-input"
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-auto row items-center q-gutter-sm justify-between">
            <q-toggle
              v-model="showInactive"
              label="Include Inactive"
              color="primary"
              @update:model-value="reload"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="records-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div v-if="loading" class="q-py-lg text-center text-grey-7">
          <q-spinner-dots color="primary" size="32px" />
        </div>
        <div v-else-if="!filteredItems.length" class="empty-state">
          <q-icon name="inventory_2" size="30px" />
          <div>No records found</div>
        </div>
        <div v-else class="card-list q-gutter-sm">
          <q-card
            v-for="row in filteredItems"
            :key="row.Code"
            flat
            class="record-card"
            @click="openDetailDialog(row)"
          >
            <q-card-section class="q-pa-sm">
              <div class="row items-center justify-between q-col-gutter-sm">
                <div class="col">
                  <div class="record-code">{{ row.Code }}</div>
                  <div class="record-name">{{ resolvePrimaryText(row) }}</div>
                  <div class="record-secondary">{{ resolveSecondaryText(row) }}</div>
                </div>
                <q-badge :color="row.Status === 'Active' ? 'positive' : 'grey-6'" class="status-badge">
                  {{ row.Status || 'Unknown' }}
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>
    </q-card>

    <q-page-sticky
      :key="currentResource || route.fullPath"
      position="bottom-right"
      :offset="[16, 22]"
      class="fab-sticky"
    >
      <q-btn
        round
        unelevated
        icon="add"
        color="primary"
        class="fab-btn"
        @click="openCreateDialog"
      />
    </q-page-sticky>

    <q-dialog v-model="showDetailDialog">
      <q-card class="detail-card">
        <q-card-section class="row items-center">
          <div class="text-subtitle1 text-weight-bold">{{ detailRow?.Code || '' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-y-xs">
          <div class="detail-head">{{ resolvePrimaryText(detailRow || {}) }}</div>
          <div
            v-for="field in detailFields"
            :key="field.header"
            class="detail-line"
          >
            <span class="detail-key">{{ field.label }}</span>
            <span class="detail-val">{{ detailRow?.[field.header] || '-' }}</span>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
          <q-btn color="primary" icon="edit" label="Edit" @click="editFromDetail" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showDialog" persistent>
      <q-card class="editor-card">
        <q-card-section class="row items-center">
          <div class="text-h6 text-weight-bold">
            {{ isEdit ? `Edit ${config?.ui?.pageTitle || config?.name}` : `Create ${config?.ui?.pageTitle || config?.name}` }}
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-y-sm">
          <q-input
            v-if="isEdit"
            v-model="form.Code"
            label="Code"
            dense
            outlined
            disable
          />

          <template v-for="field in resolvedFields" :key="field.header">
            <q-select
              v-if="field.type === 'status'"
              v-model="form[field.header]"
              :options="statusOptions"
              :label="field.label"
              dense
              outlined
              emit-value
              map-options
            />
            <q-input
              v-else
              v-model="form[field.header]"
              :label="field.label"
              dense
              outlined
            />
          </template>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" :loading="saving" :label="isEdit ? 'Update' : 'Create'" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { createMasterRecord, fetchMasterRecords, updateMasterRecord } from 'src/services/masterRecords'
import { useAuthStore } from 'src/stores/auth'
import { useProductsStore } from 'src/stores/products'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()
const productsStore = useProductsStore()

const lastHeaders = ref([])
const searchTerm = ref('')
const currentResource = ref(null)
const config = computed(() => {
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  const byMeta = route.meta?.requiredResource
    ? resources.find((entry) => entry?.name === route.meta.requiredResource)
    : null

  if (byMeta) return byMeta

  return resources.find((entry) => entry?.ui?.routePath === route.path) || null
})

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const backgroundSyncing = ref(false)
const showInactive = ref(false)
const showDialog = ref(false)
const showDetailDialog = ref(false)
const isEdit = ref(false)
const form = ref({})
const detailRow = ref(null)
const loadRequestId = ref(0)
const activeResourceName = ref('')

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const resolvedFields = computed(() => {
  const uiFields = config.value?.ui?.fields
  if (Array.isArray(uiFields) && uiFields.length) {
    return uiFields
  }

  return (lastHeaders.value || [])
    .filter((header) => !['Code', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(header))
    .map((header) => ({
      header,
      label: header.replace(/([a-z])([A-Z])/g, '$1 $2'),
      type: header === 'Status' ? 'status' : 'text',
      required: false
    }))
})

const detailFields = computed(() => {
  return resolvedFields.value.filter((entry) => entry.header !== 'Code')
})

const filteredItems = computed(() => {
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return items.value

  return items.value.filter((row) => {
    const aggregate = Object.values(row || {}).map((value) => (value ?? '').toString().toLowerCase()).join(' ')
    return aggregate.includes(keyword)
  })
})

function notify(type, message) {
  $q.notify({ type, message, timeout: 2200 })
}

function resolvePrimaryText(row) {
  if (!row || typeof row !== 'object') return '-'
  if (row.Name) return row.Name
  const firstFilled = resolvedFields.value.find((field) => {
    const value = row[field.header]
    return value !== undefined && value !== null && value.toString().trim() !== '' && field.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
}

function resolveSecondaryText(row) {
  if (!row || typeof row !== 'object') return ''
  const field = resolvedFields.value.find((entry) => {
    if (entry.header === 'Status') return false
    if (row.Name && entry.header === 'Name') return false
    const value = row[entry.header]
    return value !== undefined && value !== null && value.toString().trim() !== ''
  })
  if (!field) return ''
  return row[field.header]
}

function applyRecordsResponse(response) {
  lastHeaders.value = Array.isArray(response.headers) ? response.headers : []
  items.value = Array.isArray(response.records) ? response.records : []
  if (config.value?.name === 'Products') {
    productsStore.hydrateFromMasterRecords(response.records, response.headers, showInactive.value)
  }
}

async function runBackgroundSync(resourceName, requestId) {
  if (!resourceName || backgroundSyncing.value) return

  backgroundSyncing.value = true
  try {
    const response = await fetchMasterRecords(resourceName, {
      includeInactive: showInactive.value,
      syncWhenCacheExists: true
    })

    if (requestId !== loadRequestId.value || activeResourceName.value !== resourceName) {
      return
    }

    if (!response.success) {
      return
    }

    applyRecordsResponse(response)
  } finally {
    backgroundSyncing.value = false
  }
}

function generateTempCode() {
  return `TEMP-${Date.now()}`
}

function optimisticallyAddRecord(newRecord) {
  items.value = [newRecord, ...items.value]
}

function optimisticallyUpdateRecord(code, updatedRecord) {
  const index = items.value.findIndex(item => item.Code === code)
  if (index !== -1) {
    items.value[index] = { ...items.value[index], ...updatedRecord }
  }
}

function revertOptimisticCreate(tempCode) {
  items.value = items.value.filter(item => item.Code !== tempCode)
}

function revertOptimisticUpdate(code, originalRecord) {
  const index = items.value.findIndex(item => item.Code === code)
  if (index !== -1) {
    items.value[index] = { ...originalRecord }
  }
}

function createEmptyForm() {
  const result = { Code: '' }
  if (!config.value) return result

  resolvedFields.value.forEach((field) => {
    if (field.type === 'status') {
      result[field.header] = 'Active'
    } else {
      result[field.header] = ''
    }
  })
  return result
}

function validateForm() {
  if (!config.value) return false

  for (const field of resolvedFields.value) {
    if (!field.required) continue
    const value = (form.value[field.header] || '').toString().trim()
    if (!value) {
      notify('negative', `${field.label} is required`)
      return false
    }
  }

  return true
}

async function reload(forceSync = false, requestId = loadRequestId.value, resourceName = activeResourceName.value) {
  if (!resourceName) return

  // Only show main spinner if we have NO items and it's not a background sync
  if (!items.value.length) {
    loading.value = true
  }
  try {
    const response = await fetchMasterRecords(resourceName, {
      includeInactive: showInactive.value,
      forceSync
    })

    if (requestId !== loadRequestId.value || activeResourceName.value !== resourceName) {
      return
    }

    if (response.success || (response.records && response.records.length > 0)) {
      applyRecordsResponse(response)
    }

    // If we loaded from cache, trigger a background sync automatically
    if (!forceSync && response?.meta?.source === 'cache') {
      runBackgroundSync(resourceName, requestId)
    }
  } finally {
    if (requestId === loadRequestId.value) {
      loading.value = false
    }
  }
}

function openCreateDialog() {
  isEdit.value = false
  form.value = createEmptyForm()
  showDialog.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  form.value = { ...createEmptyForm(), ...row }
  showDialog.value = true
}

function openDetailDialog(row) {
  detailRow.value = { ...row }
  showDetailDialog.value = true
}

function editFromDetail() {
  if (!detailRow.value) return
  showDetailDialog.value = false
  openEditDialog(detailRow.value)
}

async function save() {
  if (!config.value || !validateForm()) {
    return
  }

  const originalForm = { ...form.value }
  const isUpdating = isEdit.value
  const targetCode = isUpdating ? form.value.Code : generateTempCode()

  const optimisticRecord = {
    Code: targetCode,
    Status: 'Active',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
    ...form.value
  }

  if (isUpdating) {
    optimisticallyUpdateRecord(targetCode, optimisticRecord)
  } else {
    optimisticallyAddRecord(optimisticRecord)
  }

  showDialog.value = false
  saving.value = false
  notify('primary', isUpdating ? 'Updating record in background...' : 'Creating record in background...')

  const apiPromise = isUpdating
    ? updateMasterRecord(config.value.name, targetCode, form.value)
    : createMasterRecord(config.value.name, form.value)

  apiPromise.then(response => {
    if (response.success) {
      runBackgroundSync(config.value?.name || '', loadRequestId.value)
    } else {
      if (isUpdating) {
        revertOptimisticUpdate(targetCode, originalForm)
      } else {
        revertOptimisticCreate(targetCode)
      }
      notify('negative', `Failed to save: ${response.message || 'Server error'}`)
    }
  }).catch(err => {
    if (isUpdating) {
      revertOptimisticUpdate(targetCode, originalForm)
    } else {
      revertOptimisticCreate(targetCode)
    }
    notify('negative', `Network error: ${err.message}`)
  })
}

async function initializeForRoute() {
  const newResource = config.value?.name
  const requestId = loadRequestId.value + 1
  loadRequestId.value = requestId
  
  showDialog.value = false
  showDetailDialog.value = false
  isEdit.value = false
  detailRow.value = null
  form.value = createEmptyForm()

  if (!config.value) {
    items.value = []
    currentResource.value = null
    activeResourceName.value = ''
    notify('negative', 'Master module is not configured')
    await router.push('/dashboard')
    return
  }

  activeResourceName.value = newResource || ''

  // If we are switching to a DIFFERENT resource, clear the list
  if (currentResource.value !== newResource) {
    items.value = []
    currentResource.value = newResource
  }

  await reload(false, requestId, newResource)
}

watch(() => route.fullPath, async () => {
  await initializeForRoute()
}, { immediate: true })
</script>

<style scoped>
.master-page {
  --master-font: 'Sora', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --master-bg-1: #f8fafc;
  --master-bg-2: #eef2f7;
  --master-ink: #0f172a;
  --master-soft-ink: #51607a;
  --master-primary: #0f766e;
  --master-primary-700: #0b5d56;
  --master-surface: #ffffff;
  --master-border: #dbe3ed;

  font-family: var(--master-font);
  color: var(--master-ink);
  background:
    radial-gradient(1000px 520px at 12% -10%, #dfe8f6 0%, transparent 58%),
    radial-gradient(900px 420px at 100% -5%, #d9ece7 0%, transparent 52%),
    linear-gradient(160deg, var(--master-bg-1) 0%, var(--master-bg-2) 100%);
  min-height: 100%;
}

.header-card,
.toolbar-card,
.records-card {
  animation: rise-in 280ms ease-out both;
}

.header-card,
.toolbar-card,
.records-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
}

.header-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 700;
}

.header-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.mini-stat {
  border: 1px solid #e6edf5;
  border-radius: 10px;
  padding: 6px 10px;
  background: #fff;
}

.mini-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mini-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.search-input :deep(.q-field__control) {
  border-radius: 12px;
  background: #fff;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
}

.record-card {
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid #d9e4f0;
  background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 6px 16px rgba(23, 37, 61, 0.08);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.record-card:active {
  transform: scale(0.995);
}

.record-card:hover {
  box-shadow: 0 10px 24px rgba(23, 37, 61, 0.12);
}

.record-code {
  font-size: 12px;
  color: var(--master-soft-ink);
  letter-spacing: 0.03em;
}

.record-name {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--master-ink);
}

.record-secondary {
  margin-top: 3px;
  font-size: 12px;
  color: #64748b;
}

.status-badge {
  border-radius: 8px;
  font-weight: 600;
  padding: 2px 9px;
}

.empty-state {
  text-align: center;
  color: #667085;
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 20px 10px;
}

.fab-btn {
  width: 58px;
  height: 58px;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary), var(--master-primary-700));
}

.fab-sticky {
  z-index: 30;
}

.editor-card {
  min-width: 300px;
  width: 100%;
  max-width: 560px;
  border-radius: 16px;
}

.detail-card {
  min-width: 300px;
  width: 100%;
  max-width: 560px;
  border-radius: 16px;
}

.detail-head {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #0f172a;
}

.detail-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 2px;
  border-bottom: 1px dashed #e2e8f0;
}

.detail-key {
  color: #64748b;
  font-size: 12px;
}

.detail-val {
  color: #1f2937;
  font-size: 12px;
  text-align: right;
}

.sync-indicator {
  animation: pulse-sync 2s infinite linear;
  opacity: 0.8;
}

@keyframes pulse-sync {
  0% { transform: rotate(0deg); opacity: 0.5; }
  50% { opacity: 1; }
  100% { transform: rotate(360deg); opacity: 0.5; }
}

@media (min-width: 600px) {
  .card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@keyframes rise-in {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
