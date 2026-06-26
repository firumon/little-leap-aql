<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component
      :is="sections.Header"
      :config="config"
      :code="code"
    />

    <!-- 2. ToolBar Section (Usually empty for Edit) -->
    <component
      :is="sections.ToolBar"
      v-if="sections.ToolBar"
      :config="config"
    />

    <!-- 3. Content Section (Prepopulated Form sub-section) -->
    <AqlContentWrapper
      :loading="loading"
      :empty="false"
      requires-record
      :record-exists="!!record"
    >
      <component
        :is="sections.Content"
        :config="config"
        :code="code"
        :resolved-fields="resolvedFields"
        :parent-form="parentForm"
        :child-groups="childGroups"
        :status-options="statusOptions"
        @update:field="(header, val) => { parentForm[header] = val }"
        @add-child="addChildRecord"
        @remove-child="removeChildRecord"
        @update-child-field="updateChildField"
      />
    </AqlContentWrapper>

    <!-- 4. Action Section (Submit/Cancel footer) -->
    <component
      :is="sections.Action"
      v-if="sections.Action"
      submit-label="Update"
      :saving="saving"
      @cancel="navigateBack"
      @submit="handleSave"
    />
  </q-page>
  <div v-else class="flex flex-center q-py-xl">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch } from 'vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'EditPage' })

const nav = useResourceNav()
const { scope, resourceSlug, code, config, resourceName, resolvedFields } = useResourceConfig()
const { record, childRecordsByResource, loading, reload, loadRelations } = useRecord()

// Resolve the four top-level sections for the Edit page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Edit',
  sectionDefs: {
    Header: 'Header',
    ToolBar: 'Toolbar',
    Content: 'Content',
    Action: 'Actions'
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

// Reactively load and prepopulate form when resource/code change
watch(
  () => [resourceName.value, code.value],
  async ([newName, newCode]) => {
    if (newName && newCode) {
      await loadAndInitialize()
    }
  },
  { immediate: true }
)

async function handleSave() {
  const response = await save()
  if (response.success) {
    nav.goTo('view')
  }
}

function navigateBack() {
  nav.goTo('view')
}
</script>
