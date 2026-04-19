import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'

/**
 * Discovers parent-child relationships from the auth store's resource list.
 * Any resource with `parentResource` pointing to the given resource is a child.
 * Recursive — works for any nesting depth.
 */
export function useResourceRelations(resourceNameRef) {
  const auth = useAuthStore()

  const allResources = computed(() => {
    return Array.isArray(auth.resources) ? auth.resources : []
  })

  /**
   * Direct child resources of the given resource.
   */
  const childResources = computed(() => {
    const name = typeof resourceNameRef === 'function'
      ? resourceNameRef()
      : (resourceNameRef?.value || resourceNameRef)
    if (!name) return []
    return allResources.value.filter((r) => r?.parentResource === name)
  })

  /**
   * The parent resource config (if this resource has a parent).
   */
  const parentResource = computed(() => {
    const name = typeof resourceNameRef === 'function'
      ? resourceNameRef()
      : (resourceNameRef?.value || resourceNameRef)
    if (!name) return null

    const self = allResources.value.find((r) => r?.name === name)
    if (!self?.parentResource) return null

    return allResources.value.find((r) => r?.name === self.parentResource) || null
  })

  const hasChildren = computed(() => childResources.value.length > 0)
  const hasParent = computed(() => !!parentResource.value)

  /**
   * Get child resources for any resource name (utility for recursive use).
   */
  function getChildResources(parentName) {
    if (!parentName) return []
    return allResources.value.filter((r) => r?.parentResource === parentName)
  }

  /**
   * Get resource config by name.
   */
  function getResourceByName(name) {
    if (!name) return null
    return allResources.value.find((r) => r?.name === name) || null
  }

  /**
   * Build the full tree starting from a resource (recursive).
   * Returns: { resource, children: [{ resource, children: [...] }] }
   */
  function buildResourceTree(rootName) {
    const root = getResourceByName(rootName)
    if (!root) return null

    const children = getChildResources(rootName).map((child) => {
      return buildResourceTree(child.name)
    }).filter(Boolean)

    return { resource: root, children }
  }

  return {
    childResources,
    parentResource,
    hasChildren,
    hasParent,
    getChildResources,
    getResourceByName,
    buildResourceTree
  }
}
