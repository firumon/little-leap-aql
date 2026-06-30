<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <div v-else class="index-toolbar q-gutter-y-sm">
    <!-- Search Input Control (statically imported, handles self-binding and self-override) -->
    <SearchInput page="Index" />

    <!-- View Switcher Tabs Control (statically imported, handles self-override) -->
    <ViewSwitcher
      v-if="finalProps.views && finalProps.views.length"
      :views="finalProps.views"
      :active-view-name="finalProps.activeViewName"
      :items="finalProps.items"
      :resource-config="finalProps.resourceConfig"
      @update:active-view-name="setActiveView"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import SearchInput from 'components/_common/Toolbar/SearchInput.vue'
import ViewSwitcher from 'components/_common/Toolbar/ViewSwitcher.vue'

defineOptions({ name: 'IndexToolbar' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resourceSlug, customUIName, scope, config } = inject('resourceConfig')
const {
  records: items,
  effectiveViews,
  activeViewName,
  setActiveView
} = inject('resourceRecord')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Toolbar',
  page: props.page
})

// Prepare default data/props
const preparedProps = computed(() => ({
  views: effectiveViews.value,
  activeViewName: activeViewName.value,
  items: items.value,
  resourceConfig: config.value
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
