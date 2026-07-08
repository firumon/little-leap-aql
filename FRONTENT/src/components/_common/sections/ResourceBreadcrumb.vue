<template>
  <nav class="breadcrumb-bar" aria-label="Breadcrumb">
    <span class="crumb crumb-link" @click="handleIndexClick">
      <q-icon name="home" size="16px" class="crumb-icon" />
      <span>{{ resolvedResourceTitle }}</span>
    </span>

    <template v-if="resolvedCode">
      <q-icon name="chevron_right" size="16px" class="crumb-sep" />
      <span
        v-if="resolvedAction && resolvedAction !== 'view'"
        class="crumb crumb-link"
        @click="handleViewClick"
      >
        {{ resolvedCode }}
      </span>
      <span v-else class="crumb crumb-current">{{ resolvedCode }}</span>
    </template>

    <template v-if="resolvedActionLabel">
      <q-icon name="chevron_right" size="16px" class="crumb-sep" />
      <span class="crumb crumb-current">{{ resolvedActionLabel }}</span>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { humanizeSlug } from 'src/utils/appHelpers'

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
  return resConfig.code.value || ''
})

const resolvedAction = computed(() => {
  if (props.action !== null && props.action !== undefined) return props.action
  return resConfig.pageName.value || 'index'
})

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

<style scoped>
.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px 10px;
  font-size: 13px;
  flex-wrap: wrap;
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.crumb-link {
  color: var(--q-primary);
  text-decoration: none;
  font-weight: 500;
  border-radius: 6px;
  padding: 2px 6px;
  transition: background 0.15s;
}

.crumb-link:hover {
  background: rgba(15, 43, 74, 0.08);
}

.crumb-current {
  color: var(--master-soft-ink, #51607a);
  font-weight: 600;
}

.crumb-sep {
  color: #94a3b8;
}

.crumb-icon {
  opacity: 0.7;
}
</style>
