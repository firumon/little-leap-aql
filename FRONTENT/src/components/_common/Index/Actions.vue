<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <div v-else class="index-actions">
    <!-- Reports Panel (statically imported, handles self-override) -->
    <ResourceReports :page="page" />

    <!-- Add FAB (statically imported, handles self-override) -->
    <AddFAB v-if="permissions.canWrite" :page="page" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import AddFAB from 'components/_common/Action/AddFAB.vue'
import ResourceReports from 'components/_common/Action/ResourceReports.vue'

defineOptions({ name: 'IndexActions' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { permissions } = inject('resourceConfig')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Actions',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
