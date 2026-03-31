<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <div v-else class="resolver-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, shallowRef, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const route = useRoute()
const { config } = useResourceConfig()
const resolvedComponent = shallowRef(null)

/**
 * Three-tier auto-discovery:
 *   1. Tenant-custom: ./_custom/A2930/Products.vue (index) or ./_custom/A2930/ProductsView.vue
 *   2. Entity-custom: ./Products/IndexPage.vue
 *   3. Default:       ./_common/IndexPage.vue
 */
const customTenantModules = import.meta.glob('./_custom/**/*.vue')
const customPageModules = import.meta.glob([
  './*/**Page.vue',
  '!./_common/**',
  '!./_custom/**'
])
const fallbackModules = import.meta.glob('./_common/**Page.vue')

function toPascalCase(slug) {
  if (!slug) return ''
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function resolveActionName(routeMeta, routeParams) {
  if (routeMeta?.action) return routeMeta.action
  if (routeParams?.action) return routeParams.action
  return 'index'
}

async function resolveComponent(resourceSlug, actionName, customUIName) {
  const entityName = toPascalCase(resourceSlug)
  const actionPageName = toPascalCase(actionName) + 'Page'

  // Step 1: Try tenant-custom page → ./_custom/A2930/Products.vue (index) or ./_custom/A2930/ProductsView.vue
  if (customUIName) {
    const customFileName = actionName === 'index'
      ? `${entityName}`
      : `${entityName}${toPascalCase(actionName)}`
    const tenantPath = `./_custom/${customUIName}/${customFileName}.vue`
    if (customTenantModules[tenantPath]) {
      try {
        const module = await customTenantModules[tenantPath]()
        return markRaw(module.default || module)
      } catch {
        // Tenant-custom page failed — fall through
      }
    }
  }

  // Step 2: Try entity-custom page → ./Products/IndexPage.vue
  const entityPath = `./${entityName}/${actionPageName}.vue`
  if (customPageModules[entityPath]) {
    try {
      const module = await customPageModules[entityPath]()
      return markRaw(module.default || module)
    } catch {
      // Entity-custom page failed — fall through
    }
  }

  // Step 3: Try default → ./_common/IndexPage.vue
  const fallbackPath = `./_common/${actionPageName}.vue`
  if (fallbackModules[fallbackPath]) {
    try {
      const module = await fallbackModules[fallbackPath]()
      return markRaw(module.default || module)
    } catch {
      // Fallback also failed
    }
  }

  // Step 4: No page found — use ActionPage as catch-all for additional actions
  if (actionName !== 'index' && actionName !== 'add' && actionName !== 'view' && actionName !== 'edit') {
    const actionFallbackPath = './_common/ActionPage.vue'
    if (fallbackModules[actionFallbackPath]) {
      try {
        const module = await fallbackModules[actionFallbackPath]()
        return markRaw(module.default || module)
      } catch {
        // Nothing found
      }
    }
  }

  return null
}

watch(
  () => [route.params.resourceSlug, route.meta?.action, route.params.action, route.fullPath, config.value],
  async () => {
    resolvedComponent.value = null
    const slug = route.params.resourceSlug
    const action = resolveActionName(route.meta, route.params)
    const customUIName = config.value?.ui?.customUIName || ''
    const component = await resolveComponent(slug, action, customUIName)
    resolvedComponent.value = component
  },
  { immediate: true }
)
</script>

<style scoped>
.resolver-loading {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
</style>
