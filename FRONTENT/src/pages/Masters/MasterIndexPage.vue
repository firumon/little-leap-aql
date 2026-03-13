<template>
  <component :is="resolvedComponent" v-if="resolvedComponent" />
  <div v-else class="loading-wrapper">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, shallowRef, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import MasterEntityPage from './MasterEntityPage.vue'

const route = useRoute()
const resolvedComponent = shallowRef(null)

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
    resolvedComponent.value = markRaw(MasterEntityPage)
    return
  }

  const customPageName = getCustomPageName(resourceSlug)

  try {
    // Attempt to dynamically import custom page
    // If file doesn't exist, import will fail silently and we'll use fallback
    const module = await import(`./${customPageName}.vue`)
    resolvedComponent.value = markRaw(module.default || module)
  } catch (error) {
    // Custom page doesn't exist, use generic page (silent fallback)
    resolvedComponent.value = markRaw(MasterEntityPage)
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
