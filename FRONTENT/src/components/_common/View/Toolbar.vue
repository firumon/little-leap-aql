<template>
  <div class="view-toolbar" v-if="sectionsReady">
    <!-- Action Bar for record status transitions, edits, deletes -->
    <component
      :is="sections.ActionBar"
      :config="config"
      :record="record"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'ViewToolbar' })

const props = defineProps({
  config: Object,
  record: Object
})

// Resolve View page toolbar sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug: props.config?.slug,
  scope: props.config?.scope,
  page: 'View/Toolbar',
  sectionDefs: {
    ActionBar: { section: 'ActionBar', default: 'src/components/_common/ActionBar.vue' }
  }
})
</script>
