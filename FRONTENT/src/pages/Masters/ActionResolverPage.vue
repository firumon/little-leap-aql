<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <q-card v-else-if="notFound" flat bordered class="page-card">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="search_off" size="48px" color="grey-5" />
      <div class="text-subtitle1 text-grey-7 q-mt-md">Page not found</div>
    </q-card-section>
  </q-card>
  <div v-else class="resolver-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, shallowRef, markRaw, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { toPascalCase } from 'src/utils/appHelpers'

const route = useRoute()
const { config } = useResourceConfig()
const resolvedComponent = shallowRef(null)
const notFound = ref(false)

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

function resolveActionName(routeMeta, routeParams) {
  if (routeMeta?.action) return routeMeta.action
  if (routeParams?.action) return routeParams.action
  return 'index'
}

async function resolveComponent(resourceSlug, actionName, customUIName, pageSlug) {
  const entityName = toPascalCase(resourceSlug)

  if (actionName === 'resource-page' || actionName === 'record-page') {
    const customPageName = toPascalCase(pageSlug)
    const customFileName = actionName === 'resource-page'
      ? `${entityName}${customPageName}`
      : `${entityName}Record${customPageName}`

    // Tier 1: Tenant-custom
    if (customUIName) {
      const tenantPath = `./_custom/${customUIName}/${customFileName}.vue`
      if (customTenantModules[tenantPath]) {
        try {
          const module = await customTenantModules[tenantPath]()
          return markRaw(module.default || module)
        } catch {}
      }
    }

    // Tier 2: Entity-custom
    const entityFileName = actionName === 'resource-page'
      ? `${customPageName}Page`
      : `Record${customPageName}Page`
    const entityPath = `./${entityName}/${entityFileName}.vue`
    if (customPageModules[entityPath]) {
      try {
        const module = await customPageModules[entityPath]()
        return markRaw(module.default || module)
      } catch {}
    }

    // No fallback for custom pages
    return null
  }

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
  () => [route.params.resourceSlug, route.meta?.action, route.params.action, config.value?.ui?.customUIName || '', route.params.pageSlug],
  async ([resourceSlug, metaAction, paramAction, customUIName, pageSlug]) => {
    resolvedComponent.value = null
    notFound.value = false
    const slug = resourceSlug
    const action = resolveActionName({ action: metaAction }, { action: paramAction })
    const component = await resolveComponent(slug, action, customUIName, pageSlug)
    if (component) {
      resolvedComponent.value = component
    } else {
      notFound.value = true
    }
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
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
