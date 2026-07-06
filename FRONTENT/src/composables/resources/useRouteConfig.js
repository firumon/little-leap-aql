import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

export function useRouteConfig() {
  const route = useRoute()
  const auth = useAuthStore()

  const scope = computed(() => route.params.scope || 'master')
  const resourceSlug = computed(() => route.params.resourceSlug || '')
  const code = computed(() => route.params.code || '')
  const pageName = computed(() => route.meta?.page || 'index')
  const pageSlug = computed(() => route.params.pageSlug || route.params.action || '')
  const level = computed(() => route.meta?.level || 'resource')

  const query = computed(() => route.query)
  const path = computed(() => route.path)

  const resourceConfig = computed(() => {
    if (!resourceSlug.value) return null
    const resources = Array.isArray(auth.resources) ? auth.resources : []

    // Match by route path (most reliable)
    const currentPath = `/${scope.value}/${resourceSlug.value}`
    const byRoutePath = resources.find((entry) => {
      const menus = Array.isArray(entry?.ui?.menus) ? entry.ui.menus : []
      return menus.some((m) => m.route === currentPath)
    })
    if (byRoutePath) return byRoutePath

    // Fallback: match by resource name derived from slug
    const slugLower = resourceSlug.value.toLowerCase().replace(/-/g, '')
    return resources.find((entry) => {
      const name = (entry?.name || '').toLowerCase()
      return name === slugLower || name === slugLower + 's' || name.replace(/s$/, '') === slugLower.replace(/s$/, '')
    }) || null
  })

  const resourceName = computed(() => resourceConfig.value?.name || '')

  return {
    route,
    scope,
    resourceSlug,
    resourceName,
    code,
    pageName,
    pageSlug,
    level,
    query,
    path,
    resourceConfig
  }
}
