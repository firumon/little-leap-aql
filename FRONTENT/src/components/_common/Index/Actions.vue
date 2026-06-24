<template>
  <div class="index-actions" v-if="sectionsReady">
    <!-- Reports Panel -->
    <component
      :is="sections.ResourceReports"
      v-if="sections.ResourceReports"
    />

    <!-- Add FAB (Floating Action Button) -->
    <component
      :is="sections.AddFAB"
      v-if="permissions.canWrite"
    />
  </div>
</template>

<script setup>
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

defineOptions({ name: 'IndexActions' })

const { resourceSlug, scope, permissions } = useResourceConfig()

// Resolve Index page action sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Action',
  sectionDefs: {
    AddFAB: { section: 'AddFAB', default: 'src/components/_common/AddFAB.vue' },
    ResourceReports: { section: 'ResourceReports', default: 'src/components/_common/ResourceReports.vue' }
  }
})
</script>
