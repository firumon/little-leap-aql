import { ref, watch, computed, shallowRef, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { toPascalCase } from 'src/utils/appHelpers'

// Vite statically discovers all page Vue files under src/pages
const pageModules = import.meta.glob('../../pages/**/*.vue')

// Build normalized registry (e.g., "pages/Masters/Products/ViewPage.vue")
const registry = {}
Object.keys(pageModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\/pages\//, 'pages/')
  registry[normalizedKey] = pageModules[rawPath]
})

function resolveActionName(routeMeta, routeParams) {
  if (routeMeta?.action === 'action' && routeParams?.action) return routeParams.action
  if (routeMeta?.action) return routeMeta.action
  if (routeParams?.action) return routeParams.action
  return 'index'
}

export function usePageResolver() {
  const route = useRoute()
  const { config } = useResourceConfig()
  const resolvedComponent = shallowRef(null)
  const notFound = ref(false)
  const checkedPaths = ref([])

  // Watch route params and customUIName to trigger resolution reactively
  watch(
    () => [
      route.params.resourceSlug,
      route.meta?.action,
      route.params.action,
      config.value?.ui?.customUIName || '',
      route.params.pageSlug,
      route.params.scope || 'masters'
    ],
    async ([resourceSlug, metaAction, paramAction, customUIName, pageSlug, scope]) => {
      resolvedComponent.value = null
      notFound.value = false
      checkedPaths.value = []

      const slug = resourceSlug
      const action = resolveActionName({ action: metaAction }, { action: paramAction })

      if (!slug) {
        notFound.value = true
        return
      }

      const entityName = toPascalCase(slug)
      const scopeFolder = toPascalCase(scope)
      const actionPageName = toPascalCase(action) + 'Page'

      const candidates = []

      if (action === 'resource-page' || action === 'record-page') {
        const customPageName = toPascalCase(pageSlug)
        const entityFileName = action === 'resource-page'
          ? `${customPageName}Page`
          : `Record${customPageName}Page`

        // Priority 1: Tenant-custom, Resource-specific custom page
        if (customUIName) {
          candidates.push(`pages/_custom/${customUIName}/${scopeFolder}/${entityName}/${entityFileName}.vue`)
        }
        // Priority 2: Entity-custom page
        candidates.push(`pages/${scopeFolder}/${entityName}/${entityFileName}.vue`)
      } else {
        // Standard action priority checklist
        // Priority 1: Tenant-custom, Resource-specific
        if (customUIName) {
          candidates.push(`pages/_custom/${customUIName}/${scopeFolder}/${entityName}/${actionPageName}.vue`)
          // Priority 2: Tenant-custom, Scope-common
          candidates.push(`pages/_custom/${customUIName}/${scopeFolder}/${actionPageName}.vue`)
          // Priority 3: Tenant-custom, Global-common
          candidates.push(`pages/_custom/${customUIName}/${actionPageName}.vue`)
        }
        // Priority 4: Entity-custom
        candidates.push(`pages/${scopeFolder}/${entityName}/${actionPageName}.vue`)
        // Priority 5: Scope-common fallback
        candidates.push(`pages/_common/${scopeFolder}/${actionPageName}.vue`)
        // Priority 6: Global-common fallback
        candidates.push(`pages/_common/${actionPageName}.vue`)
      }

      // Check each candidate path in order
      let matchedPath = null
      for (const path of candidates) {
        const exists = !!registry[path]
        checkedPaths.value.push({ path, found: exists })
        if (exists && !matchedPath) {
          matchedPath = path
        }
      }

      if (matchedPath) {
        try {
          const loadModule = registry[matchedPath]
          const module = await loadModule()
          resolvedComponent.value = markRaw(module.default || module)
          return
        } catch (err) {
          console.error(`Failed to load page module ${matchedPath}:`, err)
        }
      }

      // If no page resolved, fall back to global checklist/fallback page
      const fallbackPath = 'pages/_common/Page.vue'
      const fallbackExists = !!registry[fallbackPath]
      checkedPaths.value.push({ path: fallbackPath, found: fallbackExists })

      if (fallbackExists) {
        try {
          const loadModule = registry[fallbackPath]
          const module = await loadModule()
          resolvedComponent.value = markRaw(module.default || module)
        } catch (err) {
          console.error(`Failed to load fallback page:`, err)
          notFound.value = true
        }
      } else {
        notFound.value = true
      }
    },
    { immediate: true }
  )

  return {
    resolvedComponent,
    notFound,
    checkedPaths,
    routeInfo: computed(() => ({
      scope: route.params.scope || 'masters',
      resourceSlug: route.params.resourceSlug || '',
      action: resolveActionName({ action: route.meta?.action }, { action: route.params.action }),
      customUIName: config.value?.ui?.customUIName || '',
      pageSlug: route.params.pageSlug || ''
    }))
  }
}
