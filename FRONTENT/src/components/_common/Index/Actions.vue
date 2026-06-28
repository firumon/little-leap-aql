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
import { inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import AddFAB from 'components/_common/Action/AddFAB.vue'
import ResourceReports from 'components/_common/Action/ResourceReports.vue'

defineOptions({ name: 'IndexActions' })

const { resourceSlug, scope, permissions } = inject('resourceConfig')

// Resolve Index page action sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Action',
  sectionDefs: {
    AddFAB: { section: 'AddFAB', default: AddFAB },
    ResourceReports: { section: 'ResourceReports', default: ResourceReports }
  }
})
</script>
