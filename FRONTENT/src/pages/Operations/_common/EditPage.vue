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
    <template v-else-if="sectionsReady">
      <component :is="sections.EditHeader" :config="config" :code="code" />

      <component
        :is="sections.EditForm"
        :code="code"
        :resolved-fields="resolvedFields"
        :parent-form="parentForm"
        :status-options="statusOptions"
        @update:field="(header, val) => { parentForm[header] = val }"
      />

      <component
        :is="sections.EditChildren"
        :child-groups="childGroups"
        :status-options="statusOptions"
        @add-child="addChildRecord"
        @remove-child="removeChildRecord"
        @update-child-field="updateChildField"
      />

      <component
        :is="sections.EditActions"
        submit-label="Update"
        :saving="saving"
        @cancel="navigateBack"
        @submit="handleSave"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import OperationEditHeader from 'components/Operations/_common/OperationEditHeader.vue'
import OperationEditForm from 'components/Operations/_common/OperationEditForm.vue'
import OperationEditChildren from 'components/Operations/_common/OperationEditChildren.vue'
import OperationEditActions from 'components/Operations/_common/OperationEditActions.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useCompositeForm } from 'src/composables/useCompositeForm'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { useResourceNav } from 'src/composables/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields, customUIName } = useResourceConfig()
const { items, loading, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'operations',
  sectionDefs: {
    EditHeader: OperationEditHeader,
    EditForm: OperationEditForm,
    EditChildren: OperationEditChildren,
    EditActions: OperationEditActions
  }
})

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

  const childRecordsByResource = {}
  for (const child of childResources.value) {
    try {
      const resp = await fetchResourceRecords(child.name, { includeInactive: true })
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
    nav.goTo('view')
  }
}

function navigateBack() {
  nav.goTo('view')
}

function navigateToList() {
  nav.goTo('list')
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
