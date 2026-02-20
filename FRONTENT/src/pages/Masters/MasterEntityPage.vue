<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-12 col-md">
          <div class="text-h6 text-weight-bold">{{ config?.ui?.pageTitle || config?.name }}</div>
          <div class="text-caption text-grey-7">{{ config?.ui?.pageDescription || '' }}</div>
        </div>

        <div class="col-12 col-md-auto row items-center q-gutter-sm">
          <q-toggle
            v-model="showInactive"
            label="Include Inactive"
            color="primary"
            @update:model-value="reload"
          />
          <q-btn color="primary" icon="add" label="New" @click="openCreateDialog" />
          <q-btn flat icon="refresh" :loading="loading" @click="reload(true)" />
        </div>
      </q-card-section>

      <q-separator />

      <q-table
        :rows="items"
        :columns="tableColumns"
        row-key="Code"
        flat
        :loading="loading"
        :pagination="pagination"
      >
        <template #body-cell-Status="props">
          <q-td :props="props">
            <q-badge :color="props.row.Status === 'Active' ? 'positive' : 'grey-6'" outline>
              {{ props.row.Status }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="text-right">
            <q-btn flat round dense icon="edit" color="primary" @click="openEditDialog(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="showDialog" persistent>
      <q-card style="min-width: 420px; width: 100%; max-width: 560px;">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ isEdit ? `Edit ${config?.ui?.pageTitle || config?.name}` : `Create ${config?.ui?.pageTitle || config?.name}` }}</div>
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

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()

const lastHeaders = ref([])
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
const showInactive = ref(false)
const showDialog = ref(false)
const isEdit = ref(false)
const form = ref({})

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const pagination = {
  rowsPerPage: 10
}

const tableColumns = computed(() => {
  if (!config.value) return []

  const base = [{ name: 'Code', label: 'Code', field: 'Code', align: 'left', sortable: true }]
  const dynamic = resolvedFields.value.map((field) => ({
    name: field.header,
    label: field.label,
    field: field.header,
    align: 'left',
    sortable: true
  }))

  return base.concat(dynamic).concat([
    { name: 'actions', label: '', field: 'actions', align: 'right' }
  ])
})

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

function notify(type, message) {
  $q.notify({ type, message, timeout: 2200 })
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

async function reload(forceSync = false) {
  if (!config.value) return

  loading.value = true
  try {
    const response = await fetchMasterRecords(config.value.name, {
      includeInactive: showInactive.value,
      forceSync
    })

    if (!response.success) {
      notify('negative', response.message || `Failed to load ${config.value.ui?.pageTitle || config.value.name}`)
      return
    }

    lastHeaders.value = Array.isArray(response.headers) ? response.headers : []
    items.value = response.records
    if (response.stale) {
      notify('warning', response.message || 'Showing cached data')
    }
  } finally {
    loading.value = false
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

async function save() {
  if (!config.value || !validateForm()) {
    return
  }

  saving.value = true
  try {
    const record = {}
    resolvedFields.value.forEach((field) => {
      record[field.header] = form.value[field.header]
    })

    const response = isEdit.value
      ? await updateMasterRecord(config.value.name, form.value.Code, record)
      : await createMasterRecord(config.value.name, record)

    if (!response.success) {
      notify('negative', response.message || 'Save failed')
      return
    }

    notify('positive', isEdit.value ? 'Record updated' : 'Record created')
    showDialog.value = false
    await reload()
  } finally {
    saving.value = false
  }
}

async function initializeForRoute() {
  items.value = []
  showDialog.value = false
  isEdit.value = false
  form.value = createEmptyForm()

  if (!config.value) {
    notify('negative', 'Master module is not configured')
    await router.push('/dashboard')
    return
  }

  await reload()
}

watch(() => route.fullPath, async () => {
  await initializeForRoute()
}, { immediate: true })
</script>
