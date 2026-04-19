import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Notify } from 'quasar'

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

  // Backward compatibility: delegate to useAuthLogic composable on-demand
  async function login(email, password) {
    loading.value = true
    try {
      const { useAuthLogic } = await import('src/composables/useAuthLogic')
      const { login: loginFn } = useAuthLogic()
      const result = await loginFn(email, password)
      return result
    } catch (error) {
      Notify.create({ type: 'negative', message: 'Login failed: ' + error.message })
      return { success: false, message: error.message }
    } finally {
      loading.value = false
    }
  }

  async function updateAvatar(avatarUrl) {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { updateAvatar: updateFn } = useAuthLogic()
    return updateFn(avatarUrl)
  }

  async function updateName(name) {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { updateName: updateFn } = useAuthLogic()
    return updateFn(name)
  }

  async function updateEmail(email) {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { updateEmail: updateFn } = useAuthLogic()
    return updateFn(email)
  }

  async function updatePassword(currentPassword, newPassword) {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { updatePassword: updateFn } = useAuthLogic()
    return updateFn(currentPassword, newPassword)
  }

  async function logout() {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { logout: logoutFn } = useAuthLogic()

    // Call composable cleanup
    await logoutFn()

    // Navigate to login - use window.location for reliability
    // (No Vue context needed, works from anywhere)
    window.location.href = '/login'
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

  async function callAuthApi(action, payload = {}, options = {}) {
    const { useAuthLogic } = await import('src/composables/useAuthLogic')
    const { callAuthApi: callFn } = useAuthLogic()
    return callFn(action, payload, options)
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
    userDesignation,
    userAccessRegion,
    authorizedResources,
    appConfigMap,
    appOptionsMap,
    scopeSyncConfig,

    // Actions
    login,
    updateAvatar,
    updateName,
    updateEmail,
    updatePassword,
    logout,
    notifyServiceWorker,
    closeDBInServiceWorker,
    callAuthApi
  }
})
