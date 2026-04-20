import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { executeGasApi } from 'src/services/GasApiService'
import { useClientCacheStore } from 'src/stores/clientCache'

function normalizeResponse(response, fallbackData = null) {
  if (response && typeof response === 'object' && 'success' in response) {
    const resolvedData = response?.data?.result ?? response.data ?? fallbackData
    return {
      success: response.success === true,
      data: response.success ? resolvedData : null,
      error: response.success ? null : (response.error || response.message || 'Request failed'),
      message: response.message || ''
    }
  }

  return {
    success: false,
    data: null,
    error: 'Invalid response',
    message: ''
  }
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const auth = ref({
    resources: JSON.parse(localStorage.getItem('resources')) || []
  })
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const token = ref(localStorage.getItem('token') || null)
  const resources = computed({
    get: () => auth.value.resources,
    set: (val) => { auth.value.resources = val }
  })
  const appConfig = ref(JSON.parse(localStorage.getItem('appConfig')) || {})
  const appOptions = ref(JSON.parse(localStorage.getItem('appOptions')) || {})
  const loading = ref(false)
  const isGlobalSyncing = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!token.value)
  const userProfile = computed(() => user.value)
  const userRole = computed(() => {
    if (Array.isArray(user.value?.roles) && user.value.roles.length) {
      return user.value.roles.map((entry) => entry?.name || '').filter(Boolean).join(', ')
    }
    return user.value?.role || 'User'
  })
  const userDesignation = computed(() => user.value?.designation?.name || '')
  const userRoles = computed(() => {
    if (Array.isArray(user.value?.roles) && user.value.roles.length) {
      return user.value.roles.map((entry) => entry?.name || '').filter(Boolean)
    }

    return (user.value?.role || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  })
  const userAccessRegion = computed(() => user.value?.accessRegion || { code: '', isUniverse: true, accessibleCodes: [], accessibleRegions: [] })
  const authorizedResources = computed(() => resources.value)
  const appConfigMap = computed(() => appConfig.value || {})
  const appOptionsMap = computed(() => appOptions.value || {})
  const scopeSyncConfig = computed(() => {
    const config = appConfig.value || {}
    const pickNumber = (value, fallback) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
    }
    return {
      masterSyncTTL: pickNumber(config.MasterSyncTTL ?? config.masterSyncTTL ?? config.mastersyncttl, 900),
      accountsSyncTTL: pickNumber(config.AccountsSyncTTL ?? config.accountsSyncTTL ?? config.accountssyncttl, 60),
      operationsSyncTTL: pickNumber(config.OperationsSyncTTL ?? config.operationsSyncTTL ?? config.operationssyncttl, 300)
    }
  })

  function persistSession() {
    localStorage.setItem('token', token.value || '')
    localStorage.setItem('user', JSON.stringify(user.value))
    localStorage.setItem('resources', JSON.stringify(resources.value || []))
    localStorage.setItem('appConfig', JSON.stringify(appConfig.value || {}))
    localStorage.setItem('appOptions', JSON.stringify(appOptions.value || {}))
  }

  function clearPersistedSession() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('resources')
    localStorage.removeItem('appConfig')
    localStorage.removeItem('appOptions')
  }

  function applySessionData(sessionData = {}) {
    token.value = sessionData?.token || null
    user.value = sessionData?.user || null
    resources.value = Array.isArray(sessionData?.resources) ? sessionData.resources : []
    appConfig.value = sessionData?.appConfig && typeof sessionData.appConfig === 'object' ? sessionData.appConfig : {}
    appOptions.value = sessionData?.appOptions && typeof sessionData.appOptions === 'object' ? sessionData.appOptions : {}
    persistSession()
    notifyServiceWorker(token.value)
  }

  function patchUserData(patch = {}) {
    user.value = {
      ...(user.value || {}),
      ...patch
    }
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function clearSessionState() {
    user.value = null
    token.value = null
    resources.value = []
    appConfig.value = {}
    appOptions.value = {}
    loading.value = false
    isGlobalSyncing.value = false
    clearPersistedSession()
    notifyServiceWorker(null)
  }

  async function requestAuth(action, payload = {}, options = {}) {
    const response = await executeGasApi(action, payload, {
      requireAuth: options.requireAuth !== false,
      token: options.token || token.value
    })

    return normalizeResponse(response)
  }

  function notifyServiceWorker(authToken) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_AUTH_TOKEN',
        token: authToken
      })
    }
  }

  function closeDBInServiceWorker() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLOSE_DB'
      })
    }
  }

  async function initializeClientSession(resetCursors = true) {
    const clientCache = useClientCacheStore()
    await clientCache.initializeDb()
    return clientCache.setAuthorizedResources(resources.value || [], resetCursors)
  }

  async function clearClientSession() {
    const clientCache = useClientCacheStore()
    closeDBInServiceWorker()
    return clientCache.clearAllStorage()
  }

  async function loginRequest(identifier, password) {
    return requestAuth('login', { email: identifier, password }, { requireAuth: false })
  }

  async function updateAvatarRequest(avatarUrl) {
    return requestAuth('updateAvatar', { avatarUrl })
  }

  async function updateNameRequest(name) {
    return requestAuth('updateName', { name })
  }

  async function updateEmailRequest(email) {
    return requestAuth('updateEmail', { email })
  }

  async function updatePasswordRequest(currentPassword, newPassword) {
    return requestAuth('updatePassword', { currentPassword, newPassword })
  }

  async function callAuthApi(action, payload = {}, options = {}) {
    return requestAuth(action, payload, options)
  }

  return {
    // State
    auth,
    user,
    token,
    resources,
    appConfig,
    appOptions,
    loading,
    isGlobalSyncing,

    // Getters
    isAuthenticated,
    userProfile,
    userRole,
    userRoles,
    userDesignation,
    userAccessRegion,
    authorizedResources,
    appConfigMap,
    appOptionsMap,
    scopeSyncConfig,

    // Actions
    applySessionData,
    patchUserData,
    clearSessionState,
    initializeClientSession,
    clearClientSession,
    loginRequest,
    updateAvatarRequest,
    updateNameRequest,
    updateEmailRequest,
    updatePasswordRequest,
    notifyServiceWorker,
    closeDBInServiceWorker,
    callAuthApi
  }
})
