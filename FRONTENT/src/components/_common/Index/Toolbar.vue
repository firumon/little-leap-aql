<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <div v-else class="index-toolbar q-gutter-y-sm">
    <!-- Search Input Control (statically imported, handles self-binding and self-override) -->
    <SearchInput :page="page" />

    <!-- View Switcher Tabs Control (statically imported, handles self-override) -->
    <ViewSwitcher
      v-if="finalProps.views && finalProps.views.length"
      :page="page"
      :views="finalProps.views"
      :active-view-name="finalProps.activeViewName"
      :items="finalProps.items"
      @update:active-view-name="setActiveView"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import SearchInput from 'components/_common/sections/SearchInput.vue'
import ViewSwitcher from 'components/_common/sections/ViewSwitcher.vue'

defineOptions({ name: 'IndexToolbar' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const {
  records: items,
  effectiveViews,
  activeViewName,
  setActiveView
} = inject('resourceRecord')

// Prepare default data/props
const preparedProps = computed(() => ({
  views: effectiveViews.value,
  activeViewName: activeViewName.value,
  items: items.value,
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'Toolbar',
  page: props.page,
  preparedProps
})
</script>
