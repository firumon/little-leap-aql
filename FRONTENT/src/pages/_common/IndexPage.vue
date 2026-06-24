<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component
      :is="sections.Header"
      :config="config"
      @reload="reload(true)"
    />

    <!-- 2. ToolBar Section -->
    <component
      :is="sections.ToolBar"
      v-if="sections.ToolBar"
      :config="config"
    />

    <!-- 3. Content Section (with built-in loading/empty wrappers) -->
    <AqlContentWrapper
      :loading="loading"
      :empty="isEmpty"
      :has-data="items.length > 0"
    >
      <component
        :is="sections.Content"
        :config="config"
        :items="items"
      />
    </AqlContentWrapper>

    <!-- 4. Action Section -->
    <component
      :is="sections.Action"
      v-if="sections.Action"
      :config="config"
    />
  </q-page>
  <div v-else class="flex flex-center q-py-xl">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'

defineOptions({ name: 'IndexPage' })

const { scope, resourceSlug, config, resourceName } = useResourceConfig()
const { records: items, loading, reload } = useRecord()

const isEmpty = computed(() => !loading.value && items.value.length === 0)

// Resolve the four top-level sections for the Index page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index',
  sectionDefs: {
    Header: { section: 'Header', default: 'src/components/_common/Header.vue' },
    ToolBar: 'Toolbar',
    Content: 'Content',
    Action: 'Actions'
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
