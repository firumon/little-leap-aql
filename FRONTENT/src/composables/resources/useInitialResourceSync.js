import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'

function normalizeResourceField(value) {
  return (value || '').toString().trim()
}

function isInitialSyncResource(resource = {}) {
  const scope = normalizeResourceField(resource?.scope).toLowerCase()
  const parentResource = normalizeResourceField(resource?.parentResource ?? resource?.ParentResource)
  const readable = resource?.name && resource?.functional !== true
  if (!readable) return false
  if (scope === 'master') return true
  return scope === 'operation' && !parentResource
}

export function useInitialResourceSync() {
  const auth = useAuthStore()
  const resourceIo = useResourceIoStore()

  function getInitialResourceNames(resources = auth.authorizedResources || []) {
    return (resources || [])
      .filter(isInitialSyncResource)
      .map((resource) => resource.name)
      .filter(Boolean)
  }

  async function syncInitialResources(options = {}) {
    const resourceNames = getInitialResourceNames()
    return resourceIo.syncResources(resourceNames, {
      showLoading: options.showLoading === true,
      showError: options.showError === true
    })
  }

  return {
    getInitialResourceNames,
    syncInitialResources
  }
}
