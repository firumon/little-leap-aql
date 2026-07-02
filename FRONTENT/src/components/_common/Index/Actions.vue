<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <div v-else class="index-actions">
    <!-- Reports FAB on bottom-left -->
    <Downloads :page="page" />

    <!-- CRUD Actions FAB on bottom-right -->
    <CrudActions :page="page" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Downloads from 'components/_common/sections/Action/Downloads.vue'
import CrudActions from 'components/_common/sections/Action/CrudActions.vue'

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
