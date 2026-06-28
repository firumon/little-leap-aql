<template>
  <q-page>
    <ResourceBreadcrumb
      :scope="scope"
      :resource-slug="resourceSlug"
      :resource-title="resourceTitle"
      :code="code"
      :action="action"
      :action-label="actionLabel"
    />
    <router-view :key="routeKey" />
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ResourceBreadcrumb from 'components/_common/Header/ResourceBreadcrumb.vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { humanizeSlug } from 'src/utils/appHelpers'

const route = useRoute()
const { scope, resourceSlug, code, action, config, additionalActions } = useResourceConfig()

const resourceTitle = computed(() => {
  const menus = config.value?.ui?.menus || []
  const currentPath = `/${scope.value}/${resourceSlug.value}`
  const matched = menus.find(m => m.route === currentPath)
  return matched?.pageTitle || menus[0]?.pageTitle || config.value?.name || resourceSlug.value
})

const actionLabel = computed(() => {
  const a = action.value
  if (!a || a === 'index') return ''
  if (a === 'add') return 'Add'
  if (a === 'view') return ''
  if (a === 'edit') return 'Edit'
  if (a === 'resource-page' || a === 'record-page') {
    return humanizeSlug(route.params.pageSlug)
  }
  if (a === 'action') {
    const actionConfig = additionalActions.value.find(
      (ac) => ac.action.toLowerCase() === route.params.action?.toLowerCase()
    )
    return actionConfig?.label || humanizeSlug(route.params.action)
  }
  // Additional actions — find label from config (legacy fallback)
  const actionConfig = additionalActions.value.find(
    (ac) => ac.action.toLowerCase() === a.toLowerCase()
  )
  return actionConfig?.label || a.charAt(0).toUpperCase() + a.slice(1)
})

// Keep router-view stable across query-only changes (e.g. ?view=),
// so switching list views does not remount the whole page.
const routeKey = computed(() => `${route.path}`)
</script>
