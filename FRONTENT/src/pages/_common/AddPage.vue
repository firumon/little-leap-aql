<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component
      :is="sections.Header"
      :config="config"
    />

    <!-- 2. ToolBar Section (Usually empty for Add) -->
    <component
      :is="sections.ToolBar"
      v-if="sections.ToolBar"
      :config="config"
    />

    <!-- 3. Content Section (Contains the Form sub-section) -->
    <AqlContentWrapper
      :loading="false"
      :empty="false"
    >
      <component
        :is="sections.Content"
        :config="config"
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
      submit-label="Create"
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
import { onMounted, provide } from 'vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'AddPage' })

const nav = useResourceNav()
const resourceConfig = useResourceConfig()
const resourceRecord = useRecord()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

const { scope, resourceSlug, config, resolvedFields } = resourceConfig

// Resolve the four top-level sections for the Add page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Add',
  sectionDefs: {
    Header: 'Header',
    ToolBar: 'Toolbar',
    Content: 'Content',
    Action: 'Actions'
  }
})

const {
  parentForm, childGroups, saving, statusOptions,
  initializeForCreate, addChildRecord, removeChildRecord,
  updateChildField, save
} = useCompositeForm(config)

onMounted(() => {
  initializeForCreate()
})

async function handleSave() {
  const response = await save()
  if (response.success) {
    const newCode = response.data?.code || response.data?.parentCode
    if (newCode) {
      nav.goTo('view', { code: newCode })
    } else {
      nav.goTo('index')
    }
  }
}

function navigateBack() {
  nav.goTo('index')
}
</script>
