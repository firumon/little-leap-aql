<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <div v-else class="resolver-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, shallowRef, markRaw } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const resolvedComponent = shallowRef(null)

/**
 * Two-level auto-discovery:
 *   1. Custom: ./Products/EditPage.vue  (entity-specific override)
 *   2. Fallback: ./_common/EditPage.vue  (generic for all entities)
 */
const customPageModules = import.meta.glob([
  './*/**Page.vue',
  '!./_common/**'
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
  return 'list'
}

async function resolveComponent(resourceSlug, actionName) {
  const entityName = toPascalCase(resourceSlug)
  const actionPageName = toPascalCase(actionName) + 'Page'

  // Step 1: Try custom entity page → ./Products/EditPage.vue
  const customPath = `./${entityName}/${actionPageName}.vue`
  if (customPageModules[customPath]) {
    try {
      const module = await customPageModules[customPath]()
      return markRaw(module.default || module)
    } catch {
      // Custom page failed to load — fall through to fallback
    }
  }

  // Step 2: Try fallback → ./_common/EditPage.vue
  const fallbackPath = `./_common/${actionPageName}.vue`
  if (fallbackModules[fallbackPath]) {
    try {
      const module = await fallbackModules[fallbackPath]()
      return markRaw(module.default || module)
    } catch {
      // Fallback also failed
    }
  }

  // Step 3: No page found — use ActionPage as catch-all for additional actions
  if (actionName !== 'list' && actionName !== 'add' && actionName !== 'view' && actionName !== 'edit') {
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
  () => [route.params.resourceSlug, route.meta?.action, route.params.action, route.fullPath],
  async () => {
    resolvedComponent.value = null
    const slug = route.params.resourceSlug
    const action = resolveActionName(route.meta, route.params)
    const component = await resolveComponent(slug, action)
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
