import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { callGasApi } from 'src/services/gasApi'
import { setAuthorizedResources } from 'src/utils/db'

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const token = ref(localStorage.getItem('token') || null)
  const resources = ref(JSON.parse(localStorage.getItem('resources')) || [])
  const loading = ref(false)

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

  async function callAuthApi(action, payload = {}, requireAuth = true) {
    return callGasApi(action, payload, {
      requireAuth,
      token: token.value
    })
  }

  async function login(email, password) {
    loading.value = true
    try {
      const data = await callAuthApi('login', { email, password }, false)

      if (data.success) {
        token.value = data.token
        user.value = data.user
        resources.value = Array.isArray(data.resources) ? data.resources : []

        // Persist to local storage
        localStorage.setItem('token', data.token)
        persistUser()
        persistResources()
        // IndexedDB persistence should not block login navigation.
        setAuthorizedResources(resources.value).catch(() => {})

        // Notify Service Worker for token injection
        notifyServiceWorker(data.token)

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
    const data = await callAuthApi('updateAvatar', { avatarUrl })
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
    const data = await callAuthApi('updateName', { name })
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
    const data = await callAuthApi('updateEmail', { email })
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
    const data = await callAuthApi('updatePassword', { currentPassword, newPassword })
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update password' }
    }

    return { success: true }
  }

  function logout() {
    user.value = null
    token.value = null
    resources.value = []
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('resources')

    notifyServiceWorker(null)

    if (router) {
      router.push('/login')
    } else {
      // Fallback if router is not available (e.g. called outside component setup)
      window.location.href = '#/login'
    }
  }

  return {
    // State
    user,
    token,
    resources,
    loading,

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
