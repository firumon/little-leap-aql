<template>
  <q-page>
    <ResourceBreadcrumb
      :scope="scope"
      :resource-slug="resourceSlug"
      :resource-title="resourceTitle"
      :code="code"
      :action="pageName"
      :action-label="actionLabel"
    />
    <router-view :key="path" />
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import ResourceBreadcrumb from 'components/_common/sections/ResourceBreadcrumb.vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { humanizeSlug } from 'src/utils/appHelpers'

defineOptions({ name: 'ResourcePageShell' })

const { pageSlug, path } = useRouteConfig()
const { scope, resourceSlug, code, pageName, resourceConfig, additionalActions } = useResourceConfig()

const resourceTitle = computed(() => {
  const menus = resourceConfig.value?.ui?.menus || []
  const currentPath = `/${scope.value}/${resourceSlug.value}`
  const matched = menus.find((m) => m.route === currentPath)
  return matched?.pageTitle || menus[0]?.pageTitle || resourceConfig.value?.name || resourceSlug.value
})

const actionLabel = computed(() => {
  const p = pageName.value
  if (!p || p === 'index') return ''
  if (p === 'add') return 'Add'
  if (p === 'view') return ''
  if (p === 'edit') return 'Edit'
  if (p === 'resource-page' || p === 'record-page') {
    return humanizeSlug(pageSlug.value)
  }
  if (p === 'action') {
    const actionConfig = additionalActions.value.find(
      (ac) => ac.action.toLowerCase() === pageSlug.value?.toLowerCase()
    )
    return actionConfig?.label || humanizeSlug(pageSlug.value)
  }
  // Additional actions — find label from config (legacy fallback)
  const actionConfig = additionalActions.value.find(
    (ac) => ac.action.toLowerCase() === p.toLowerCase()
  )
  return actionConfig?.label || p.charAt(0).toUpperCase() + p.slice(1)
})
</script>
