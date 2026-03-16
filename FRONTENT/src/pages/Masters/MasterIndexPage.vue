<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <div v-else class="loading-wrapper">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, shallowRef, markRaw } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const resolvedComponent = shallowRef(null)
const customPageModules = import.meta.glob('./*Page.vue')
const loadMasterEntityPageModule = customPageModules['./MasterEntityPage.vue']
let fallbackComponent = null

async function ensureFallbackComponent() {
  if (fallbackComponent) {
    return fallbackComponent
  }

  if (!loadMasterEntityPageModule) {
    throw new Error('MasterEntityPage module not found')
  }

  const module = await loadMasterEntityPageModule()
  fallbackComponent = markRaw(module.default || module)
  return fallbackComponent
}

/**
 * Convert resource slug to PascalCase component name
 * Examples:
 *   'products' -> 'ProductsPage'
 *   'price-lists' -> 'PriceListsPage'
 *   'customer-groups' -> 'CustomerGroupsPage'
 */
function getCustomPageName(resourceSlug) {
  if (!resourceSlug) return null

  return resourceSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') + 'Page'
}

/**
 * Try to load custom page, fallback to generic page if not found
 * File-based convention: just create CustomPage.vue and it works automatically
 */
async function resolvePageComponent(resourceSlug) {
  if (!resourceSlug) {
    resolvedComponent.value = await ensureFallbackComponent()
    return
  }

  const customPageName = getCustomPageName(resourceSlug)
  const modulePath = `./${customPageName}.vue`
  const loadModule = customPageModules[modulePath]

  if (!loadModule) {
    resolvedComponent.value = await ensureFallbackComponent()
    return
  }

  try {
    const module = await loadModule()
    resolvedComponent.value = markRaw(module.default || module)
  } catch (error) {
    // Custom page doesn't exist, use generic page (silent fallback)
    resolvedComponent.value = await ensureFallbackComponent()
  }
}

// Watch for route changes and resolve appropriate component
watch(
  () => route.params.resourceSlug,
  async (newSlug) => {
    resolvedComponent.value = null
    await resolvePageComponent(newSlug)
  },
  { immediate: true }
)
</script>

<style scoped>
.loading-wrapper {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
