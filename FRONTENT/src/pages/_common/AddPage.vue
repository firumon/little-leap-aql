<template>
  <div class="add-page" v-if="sectionsReady">
    <component :is="sections.Header" :config="config" />

    <component
      :is="sections.Form"
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
      submit-label="Create"
      :saving="saving"
      @cancel="navigateBack"
      @submit="handleSave"
    />
  </div>
  <div v-else class="q-py-xl text-center">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, config, resolvedFields, customUIName } = useResourceConfig()

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
      nav.goTo('list')
    }
  }
}

function navigateBack() {
  nav.goTo('list')
}
</script>
