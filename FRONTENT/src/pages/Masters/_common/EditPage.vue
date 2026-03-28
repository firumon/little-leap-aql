<template>
  <div class="edit-page">
    <!-- Loading -->
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <!-- Record not found -->
    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <!-- Edit form -->
    <template v-else>
      <q-card flat bordered class="page-card">
        <q-card-section>
          <div class="page-title">
            <q-icon name="edit" size="24px" color="primary" class="q-mr-sm" />
            Edit {{ config?.ui?.pageTitle || config?.name }} — {{ code }}
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-gutter-y-sm">
          <!-- Code (read-only) -->
          <q-input :model-value="code" label="Code" dense outlined disable />

          <!-- Parent fields -->
          <template v-for="field in resolvedFields" :key="field.header">
            <q-select
              v-if="field.type === 'status'"
              :model-value="parentForm[field.header]"
              :options="statusOptions"
              :label="field.label"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="parentForm[field.header] = $event"
            />
            <q-input
              v-else
              :model-value="parentForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              :hint="field.hint"
              dense
              outlined
              @update:model-value="parentForm[field.header] = $event"
            />
          </template>
        </q-card-section>
      </q-card>

      <!-- Child resource tables -->
      <ChildRecordsTable
        v-for="group in childGroups"
        :key="group.resource.name"
        :title="group.resource.ui?.pageTitle || group.resource.name"
        :records="group.records"
        :fields="group.resolvedFields"
        :status-options="statusOptions"
        class="q-mt-sm"
        @add="addChildRecord(group.resource.name)"
        @remove="(idx) => removeChildRecord(group.resource.name, idx)"
        @update-field="(idx, header, val) => updateChildField(group.resource.name, idx, header, val)"
      />

      <!-- Actions -->
      <div class="row q-mt-md q-gutter-sm justify-end">
        <q-btn flat no-caps label="Cancel" icon="arrow_back" @click="navigateBack" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Update"
          icon="check"
          :loading="saving"
          @click="handleSave"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ChildRecordsTable from 'src/components/Masters/ChildRecordsTable.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useCompositeForm } from 'src/composables/useCompositeForm'
import { fetchMasterRecords } from 'src/services/masterRecords'

const router = useRouter()
const { scope, resourceSlug, code, config, resourceName, resolvedFields } = useResourceConfig()
const { items, loading, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)
const {
  parentForm, childGroups, saving, statusOptions,
  initializeForEdit, addChildRecord, removeChildRecord,
  updateChildField, save
} = useCompositeForm(config)

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

function findParentCodeField(childResource, parentResource) {
  const headers = Array.isArray(childResource.headers) ? childResource.headers : []
  if (headers.includes('ParentCode')) return 'ParentCode'
  const parentName = parentResource?.name || ''
  const singularParent = parentName.replace(/s$/, '')
  const candidate = `${singularParent}Code`
  if (headers.includes(candidate)) return candidate
  return 'ParentCode'
}

async function loadAndInitialize() {
  await reload()
  if (!record.value) return

  // Load child records for editing
  const childRecordsByResource = {}
  for (const child of childResources.value) {
    try {
      const resp = await fetchMasterRecords(child.name, { includeInactive: true })
      if (resp.success && resp.records) {
        const parentCodeField = findParentCodeField(child, config.value)
        childRecordsByResource[child.name] = resp.records.filter((r) => r[parentCodeField] === code.value)
      }
    } catch {
      childRecordsByResource[child.name] = []
    }
  }

  initializeForEdit(record.value, childRecordsByResource)
}

watch(() => resourceName.value, (n) => { if (n) loadAndInitialize() }, { immediate: true })

async function handleSave() {
  const response = await save()
  if (response.success) {
    router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
  }
}

function navigateBack() {
  router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
}

function navigateToList() {
  router.push(`/${scope.value}/${resourceSlug.value}`)
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--master-ink);
  display: flex;
  align-items: center;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
