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
      <component :is="sections.Header" :config="config" :code="code" />

      <component
        :is="sections.Form"
        :code="code"
        :resolved-fields="resolvedFields"
        :parent-form="parentForm"
        :status-options="statusOptions"
        :resource-name="config?.name"
        @update:field="(header, val) => { parentForm[header] = val }"
      />

      <component
        :is="sections.Children"
        :child-groups="childGroups"
        :status-options="statusOptions"
        @add-child="addChildRecord"
        @remove-child="removeChildRecord"
        @update-child-field="updateChildField"
      />

      <component
        :is="sections.Actions"
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
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields } = useResourceConfig()
const { records, record, childRecordsByResource, loading, reload, childResources, loadRelations } = useRecord()

const customUIName = computed(() => config.value?.ui?.customUIName || '')

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  sectionDefs: {
    Header: 'Header',
    Form: 'Form',
    Children: 'Children',
    Actions: 'Actions'
  }
})

const {
  parentForm, childGroups, saving, statusOptions,
  initializeForEdit, addChildRecord, removeChildRecord,
  updateChildField, save
} = useCompositeForm(config)

async function loadAndInitialize() {
  await reload()
  if (!record.value) return

  await loadRelations()
  initializeForEdit(record.value, childRecordsByResource.value)
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
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
