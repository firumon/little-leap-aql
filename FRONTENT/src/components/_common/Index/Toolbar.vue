<template>
  <div class="index-toolbar q-gutter-y-sm" v-if="sectionsReady">
    <!-- Search Input Control (resolved at Index level, self-binding via inject) -->
    <component :is="searchSections.SearchInput" page="Index" />

    <!-- View Switcher Tabs Control -->
    <component
      :is="resolvedViewSwitcher.component"
      v-if="effectiveViews && effectiveViews.length"
      :views="effectiveViews"
      :active-view-name="activeViewName"
      :items="items"
      :resource-config="config"
      :view-switcher-config="resolvedViewSwitcher.config"
      @update:active-view-name="setActiveView"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import SearchInput from 'components/_common/Toolbar/SearchInput.vue'
import ViewSwitcher from 'components/_common/Toolbar/ViewSwitcher.vue'

defineOptions({ name: 'IndexToolbar' })

const { resourceSlug, customUIName, scope, config } = inject('resourceConfig')
const {
  records: items,
  effectiveViews,
  activeViewName,
  setActiveView
} = inject('resourceRecord')

// Resolve ViewSwitcher at Index page level (with script-only override support)
const { sections: toolbarSections, sectionsReady: toolbarReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  page: 'Index',
  sectionDefs: {
    ViewSwitcher: { section: 'ViewSwitcher', default: ViewSwitcher }
  },
  allowScriptOnly: true
})

// Resolve SearchInput at Index level to allow components/[Scope]/[ResourceName]/Index/SearchInput.vue
const { sections: searchSections, sectionsReady: searchReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  page: 'Index',
  sectionDefs: {
    SearchInput: { section: 'SearchInput', default: SearchInput }
  }
})

const sectionsReady = computed(() => toolbarReady.value && searchReady.value)

// Determine if ViewSwitcher component is a template override or script-only config override
const resolvedViewSwitcher = computed(() => {
  const comp = toolbarSections.ViewSwitcher
  if (!comp) return { component: null, config: null }
  const hasTemplate = !!(comp.render || comp.ssrRender || typeof comp === 'function')
  if (hasTemplate) {
    return { component: comp, config: null }
  }
  return { component: ViewSwitcher, config: comp.config || {} }
})
</script>
