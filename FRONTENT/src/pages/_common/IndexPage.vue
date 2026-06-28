<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component :is="sections.Header"/>

    <!-- 2. ToolBar Section -->
    <component :is="sections.ToolBar" v-if="sections.ToolBar"/>

    <!-- 3. Content Section (with built-in loading/empty wrappers) -->
    <AqlContentWrapper :loading="loading" :empty="isEmpty" :has-data="items.length > 0">
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
import { computed, watch, provide } from 'vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import Header from 'components/_common/Header/Header.vue'
import Toolbar from 'components/_common/Toolbar/Toolbar.vue'
import Actions from 'components/_common/Action/ActionsFallback.vue'

defineOptions({ name: 'IndexPage' })

const resourceConfig = useResourceConfig()
const resourceRecord = useRecord()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

const { scope, resourceSlug, config, resourceName } = resourceConfig
const { records: items, loading, reload } = resourceRecord

const isEmpty = computed(() => !loading.value && items.value.length === 0)

// Resolve the four top-level sections for the Index page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index',
  sectionDefs: {
    Header: { section: 'Header', default: Header },
    ToolBar: { section: 'Toolbar', default: Toolbar },
    Content: 'Content',
    Action: { section: 'Actions', default: Actions }
  }
})

// Reload records reactively when the active resource changes
watch(
  () => resourceName.value,
  async (newName) => {
    if (newName) {
      await reload()
    }
  },
  { immediate: true }
)
</script>
