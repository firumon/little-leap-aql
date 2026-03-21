import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { callGasApi } from 'src/services/gasApi'
import { clearAllSyncCursors, syncAllMasterResources } from 'src/services/masterRecords'
import { clearAllClientStorage, setAuthorizedResources, reinitializeDB } from 'src/utils/db'

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const token = ref(localStorage.getItem('token') || null)
  const resources = ref(JSON.parse(localStorage.getItem('resources')) || [])
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

  function persistUser() {
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function persistResources() {
    localStorage.setItem('resources', JSON.stringify(resources.value))
  }

  // Actions
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
    return callGasApi(action, payload, {
      ...options,
      requireAuth: options.requireAuth !== false,
      token: token.value
    })
  }

  async function login(email, password) {
    loading.value = true
    try {
      const data = await callAuthApi('login', { email, password }, { requireAuth: false })

      if (data.success) {
        token.value = data.token
        user.value = data.user
        resources.value = Array.isArray(data.resources) ? data.resources : []

        // Persist to local storage
        localStorage.setItem('token', data.token)
        persistUser()
        persistResources()

        // Sync token to HW if possible
        notifyServiceWorker(data.token)

        // Clear stale sync cursors from previous session so first fetch is a full sync
        clearAllSyncCursors()

        // Background tasks for IndexedDB
        // We don't await these to prevent login from hanging if IDB is slow
        setAuthorizedResources(resources.value, true).catch(err => console.warn('IDB sync error:', err))
        reinitializeDB().catch(err => console.warn('DB init error:', err))

        isGlobalSyncing.value = true
        Promise.resolve(syncAllMasterResources())
          .catch((err) => {
            console.warn('Global master sync error:', err)
          })
          .finally(() => {
            isGlobalSyncing.value = false
          })

        return { success: true }
      }

      return { success: false, message: data.message || 'Login failed' }
    } catch (error) {
      return { success: false, message: error?.message || 'Login failed' }
    } finally {
      loading.value = false
    }
  }

  async function updateAvatar(avatarUrl) {
    const data = await callAuthApi('updateAvatar', { avatarUrl }, {
      showLoading: true,
      loadingMessage: 'Updating avatar...',
      successMessage: 'Avatar updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update avatar' }
    }

    if (user.value) {
      user.value.avatar = data.avatarUrl || avatarUrl
      persistUser()
    }

    return { success: true }
  }

  async function updateName(name) {
    const data = await callAuthApi('updateName', { name }, {
      showLoading: true,
      loadingMessage: 'Updating name...',
      successMessage: 'Name updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update name' }
    }

    if (user.value) {
      user.value.name = data.name || name
      persistUser()
    }

    return { success: true }
  }

  async function updateEmail(email) {
    const data = await callAuthApi('updateEmail', { email }, {
      showLoading: true,
      loadingMessage: 'Updating email...',
      successMessage: 'Email updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update email' }
    }

    if (user.value) {
      user.value.email = data.email || email
      persistUser()
    }

    return { success: true }
  }

  async function updatePassword(currentPassword, newPassword) {
    const data = await callAuthApi('updatePassword', { currentPassword, newPassword }, {
      showLoading: true,
      loadingMessage: 'Updating password...',
      successMessage: 'Password updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update password' }
    }

    return { success: true }
  }

  async function logout() {
    // 1. Clear in-memory state first so UI reacts immediately
    user.value = null
    token.value = null
    resources.value = []
    isGlobalSyncing.value = false

    // 2. Perform navigation as soon as possible
    if (router) {
      router.push('/login').catch(() => {})
    } else {
      window.location.hash = '/login'
    }

    // 3. Cleanup storage in background
    try {
      notifyServiceWorker(null)
      closeDBInServiceWorker()
      await clearAllClientStorage()
    } catch (e) {
      console.warn('Logout cleanup error:', e)
    }
  }

  return {
    // State
    user,
    token,
    resources,
    loading,
    isGlobalSyncing,

    // Getters
    isAuthenticated,
    userProfile,
    userRole,
    userDesignation,
    userAccessRegion,
    authorizedResources,

    // Actions
    login,
    updateAvatar,
    updateName,
    updateEmail,
    updatePassword,
    logout,
    notifyServiceWorker,
    callAuthApi
  }
})
