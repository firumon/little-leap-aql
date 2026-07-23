<template>
  <Breadcrumb
    :resource-title="resolvedResourceTitle"
    :code="resolvedCode"
    :action-label="resolvedActionLabel"
    :is-action-view="isActionView"
    @click-root="handleIndexClick"
    @click-code="handleViewClick"
  />
</template>

<script setup>
import { computed } from 'vue'
import Breadcrumb from 'components/abstract/Breadcrumb.vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { humanizeSlug } from 'src/utils/appHelpers'

defineOptions({ name: 'AppBreadcrumb' })

const props = defineProps({
  scope: { type: String, default: null },
  resourceSlug: { type: String, default: null },
  resourceTitle: { type: String, default: null },
  code: { type: String, default: null },
  action: { type: String, default: null },
  actionLabel: { type: String, default: null }
})

const routeConfig = useRouteConfig()
const resConfig = useResourceConfig()
const nav = useResourceNav()

const resolvedScope = computed(() => {
  if (props.scope !== null && props.scope !== undefined) return props.scope
  return resConfig.scope.value || 'master'
})

const resolvedResourceSlug = computed(() => {
  if (props.resourceSlug !== null && props.resourceSlug !== undefined) return props.resourceSlug
  return resConfig.resourceSlug.value || ''
})

const resolvedResourceTitle = computed(() => {
  if (props.resourceTitle !== null && props.resourceTitle !== undefined) return props.resourceTitle
  const config = resConfig.config.value
  const menus = config?.ui?.menus || []
  const currentPath = `/${resolvedScope.value}/${resolvedResourceSlug.value}`
  const matched = menus.find((m) => m.route === currentPath)
  return matched?.pageTitle || menus[0]?.pageTitle || config?.name || resolvedResourceSlug.value
})

const resolvedCode = computed(() => {
  if (props.code !== null && props.code !== undefined) return props.code
  return routeConfig.code.value || ''
})

const resolvedAction = computed(() => {
  if (props.action !== null && props.action !== undefined) return props.action
  return routeConfig.pageName.value || 'index'
})

const isActionView = computed(() => !!resolvedAction.value && resolvedAction.value !== 'view')

const resolvedActionLabel = computed(() => {
  if (props.actionLabel !== null && props.actionLabel !== undefined) return props.actionLabel
  const p = resolvedAction.value
  if (!p || p === 'index') return ''
  if (p === 'add') return 'Add'
  if (p === 'view') return ''
  if (p === 'edit') return 'Edit'
  if (p === 'resource-page' || p === 'record-page') {
    return humanizeSlug(routeConfig.pageSlug.value)
  }
  if (p === 'action') {
    const actionConfig = resConfig.additionalActions.value.find(
      (ac) => ac.action.toLowerCase() === routeConfig.pageSlug.value?.toLowerCase()
    )
    return actionConfig?.label || humanizeSlug(routeConfig.pageSlug.value)
  }
  const actionConfig = resConfig.additionalActions.value.find(
    (ac) => ac.action.toLowerCase() === p.toLowerCase()
  )
  return actionConfig?.label || p.charAt(0).toUpperCase() + p.slice(1)
})

const handleIndexClick = () => {
  nav.goTo('index', {
    scope: resolvedScope.value,
    resourceSlug: resolvedResourceSlug.value
  })
}

const handleViewClick = () => {
  nav.goTo('view', {
    scope: resolvedScope.value,
    resourceSlug: resolvedResourceSlug.value,
    code: resolvedCode.value
  })
}
</script>
