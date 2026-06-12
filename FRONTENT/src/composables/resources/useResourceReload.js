import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceStatusStore } from 'src/stores/resourceStatus'
import { useDataStore } from 'src/stores/data'
import { useResourceConfig } from './useResourceConfig.js'
import { useResourceRelations } from './useResourceRelations.js'

function normalizeName(value) {
  return (value || '').toString().trim()
}

function headerName(field) {
  if (typeof field === 'string') return field
  return field?.header || field?.name || ''
}

function codeHeaderCandidates(header) {
  const name = normalizeName(header)
  if (!name || name === 'Code' || !name.endsWith('Code')) return []

  const stem = name.slice(0, -4)
  return [
    stem,
    `${stem}s`,
    stem.endsWith('y') ? `${stem.slice(0, -1)}ies` : ''
  ].filter(Boolean)
}

export function useResourceReload() {
  const auth = useAuthStore()
  const resourceIo = useResourceIoStore()
  const resourceStatus = useResourceStatusStore()
  const dataStore = useDataStore()
  const { resourceName, resourceHeaders, resolvedFields } = useResourceConfig()
  const { parentResource, childResources } = useResourceRelations(resourceName)

  const authorizedResources = computed(() => Array.isArray(auth.resources) ? auth.resources : [])

  const resourceByLowerName = computed(() => {
    const map = new Map()
    authorizedResources.value.forEach((resource) => {
      const name = normalizeName(resource?.name)
      if (name) map.set(name.toLowerCase(), name)
    })
    return map
  })

  function resolveResourceName(name) {
    return resourceByLowerName.value.get(normalizeName(name).toLowerCase()) || ''
  }

  function resolveCodeHeaderResource(header) {
    for (const candidate of codeHeaderCandidates(header)) {
      const matched = resolveResourceName(candidate)
      if (matched) return matched
    }
    return ''
  }

  const dependencyResourceNames = computed(() => {
    const names = new Set()
    const currentResource = normalizeName(resourceName.value)
    if (currentResource) names.add(currentResource)

    const parentName = normalizeName(parentResource.value?.name)
    if (parentName) names.add(parentName)

    childResources.value.forEach((child) => {
      const childName = normalizeName(child?.name)
      if (childName) names.add(childName)
    })

    const fields = [
      ...(Array.isArray(resourceHeaders.value) ? resourceHeaders.value : []),
      ...(Array.isArray(resolvedFields.value) ? resolvedFields.value.map(headerName) : [])
    ]

    fields.forEach((field) => {
      const matchedName = resolveCodeHeaderResource(field)
      if (matchedName) names.add(matchedName)
    })

    return Array.from(names)
  })

  const isAnyDependencySyncing = computed(() => {
    return dependencyResourceNames.value.some((name) => {
      return resourceStatus.isSyncing(name) ||
        dataStore.loadingByResource[name] === true ||
        dataStore.backgroundSyncingByResource[name] === true
    })
  })

  const hasUninitiatedDependencies = computed(() => {
    return dependencyResourceNames.value.some((name) => {
      return resourceStatus.byResource[name]?.initiated !== true
    })
  })

  async function reloadDependencies(options = {}) {
    const resources = dependencyResourceNames.value
    if (!resources.length) return { success: true, data: {}, error: null }
    return resourceIo.syncResources(resources, {
      showLoading: options.showLoading === true,
      showError: options.showError !== false,
      forceSync: true
    })
  }

  return {
    dependencyResourceNames,
    isAnyDependencySyncing,
    hasUninitiatedDependencies,
    reloadDependencies
  }
}
