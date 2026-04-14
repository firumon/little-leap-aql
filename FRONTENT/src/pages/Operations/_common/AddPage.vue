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
import OperationAddHeader from 'components/Operations/_common/OperationAddHeader.vue'
import OperationAddForm from 'components/Operations/_common/OperationAddForm.vue'
import OperationAddChildren from 'components/Operations/_common/OperationAddChildren.vue'
import OperationAddActions from 'components/Operations/_common/OperationAddActions.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useCompositeForm } from 'src/composables/useCompositeForm'
import { useResourceNav } from 'src/composables/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, config, resolvedFields } = useResourceConfig()

const customUIName = computed(() => config.value?.ui?.customUIName || '')
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'operations',
  sectionDefs: {
    AddHeader: OperationAddHeader,
    AddForm: OperationAddForm,
    AddChildren: OperationAddChildren,
    AddActions: OperationAddActions
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
