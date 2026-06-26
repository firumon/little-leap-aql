<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component :is="sections.Header"/>

    <!-- 2. ToolBar Section (Context actions, ActionBar) -->
    <component :is="sections.ToolBar" v-if="sections.ToolBar"/>

    <!-- 3. Content Section (Details, Child grids, Parent links) -->
    <AqlContentWrapper :loading="loading" :empty="false" requires-record :record-exists="!!record">
      <component :is="sections.Content"/>
    </AqlContentWrapper>

    <!-- 4. Action Section -->
    <component :is="sections.Action" v-if="sections.Action"/>
  </q-page>
  <div v-else class="flex flex-center q-py-xl">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, provide } from 'vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'

defineOptions({ name: 'OperationsViewPage' })

const resourceConfig = useResourceConfig()
const resourceRecord = useRecord()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

const { scope, resourceSlug, code, config, resourceName } = resourceConfig
const { record, loading, reload, loadRelations } = resourceRecord

// Resolve the four top-level sections for the View page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'View',
  sectionDefs: {
    Header: 'Header',
    ToolBar: 'Toolbar',
    Content: 'Content',
    Action: 'Actions'
  }
})

async function loadDataAndRelations() {
  await reload()
  if (record.value) {
    await loadRelations()
  }
}

// Reactively fetch record and relations when resource/code change
watch(
  () => [resourceName.value, code.value],
  async ([newName, newCode]) => {
    if (newName && newCode) {
      await loadDataAndRelations()
    }
  },
  { immediate: true }
)
</script>
