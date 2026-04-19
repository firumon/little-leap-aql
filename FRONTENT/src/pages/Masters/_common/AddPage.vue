<template>
  <div class="add-page" v-if="sectionsReady">
    <component :is="sections.AddHeader" :config="config" />

    <component
      :is="sections.AddForm"
      :resolved-fields="resolvedFields"
      :parent-form="parentForm"
      :status-options="statusOptions"
      @update:field="(header, val) => { parentForm[header] = val }"
    />

    <component
      :is="sections.AddChildren"
      :child-groups="childGroups"
      :status-options="statusOptions"
      @add-child="addChildRecord"
      @remove-child="removeChildRecord"
      @update-child-field="updateChildField"
    />

    <component
      :is="sections.AddActions"
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
import { onMounted, computed } from 'vue'
import MasterAddHeader from 'components/Masters/_common/MasterAddHeader.vue'
import MasterAddForm from 'components/Masters/_common/MasterAddForm.vue'
import MasterAddChildren from 'components/Masters/_common/MasterAddChildren.vue'
import MasterAddActions from 'components/Masters/_common/MasterAddActions.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, config, resolvedFields, customUIName } = useResourceConfig()

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'masters',
  sectionDefs: {
    AddHeader: MasterAddHeader,
    AddForm: MasterAddForm,
    AddChildren: MasterAddChildren,
    AddActions: MasterAddActions
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
