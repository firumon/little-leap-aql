import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

/**
 * Resolves the current resource configuration from route params + auth store.
 * Used by all resource pages (list, view, add, edit, action).
 */
export function useResourceConfig() {
  const route = useRoute()
  const auth = useAuthStore()

  const resourceSlug = computed(() => route.params.resourceSlug || '')
  const scope = computed(() => route.params.scope || 'masters')
  const code = computed(() => route.params.code || '')
  const action = computed(() => route.meta?.action || route.params.action || 'list')
  const level = computed(() => route.meta?.level || 'resource')

  const config = computed(() => {
    const resources = Array.isArray(auth.resources) ? auth.resources : []

    // Match by route path (most reliable)
    const currentPath = `/${scope.value}/${resourceSlug.value}`
    const byRoutePath = resources.find((entry) => {
      const entryPath = entry?.ui?.routePath || ''
      return entryPath === currentPath
    })
    if (byRoutePath) return byRoutePath

    // Fallback: match by resource name derived from slug
    const slugLower = resourceSlug.value.toLowerCase().replace(/-/g, '')
    return resources.find((entry) => {
      const name = (entry?.name || '').toLowerCase()
      return name === slugLower || name === slugLower + 's' || name.replace(/s$/, '') === slugLower.replace(/s$/, '')
    }) || null
  })

  const resourceName = computed(() => config.value?.name || '')
  const resourceHeaders = computed(() => {
    const h = config.value?.headers
    return Array.isArray(h) ? h : []
  })

  const resolvedFields = computed(() => {
    const uiFields = config.value?.ui?.fields
    if (Array.isArray(uiFields) && uiFields.length) {
      return uiFields
    }

    return (resourceHeaders.value || [])
      .filter((header) => !['Code', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(header))
      .map((header) => ({
        header,
        label: header.replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: header === 'Status' ? 'status' : 'text',
        required: false
      }))
  })

  const additionalActions = computed(() => {
    const raw = config.value?.additionalActions
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try { return JSON.parse(raw.trim()) } catch { return [] }
    }
    return []
  })

  const permissions = computed(() => config.value?.permissions || {})

  return {
    route,
    scope,
    resourceSlug,
    code,
    action,
    level,
    config,
    resourceName,
    resourceHeaders,
    resolvedFields,
    additionalActions,
    permissions
  }
}
