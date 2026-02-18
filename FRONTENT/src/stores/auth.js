import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

/**
 * Replace this with your actual Google Apps Script Web App URL
 * after deploying auth.gs as a Web App.
 */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwax5j9YZ7m-nwpC-t1MH4BDltfwfjTEz6kxO7xoyMhIRwC2Wnmf22pNk8iBw_AB2tACg/exec'

const API_HEADERS = {
  'Content-Type': 'text/plain'
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const token = ref(localStorage.getItem('token') || null)
  const loading = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!token.value)
  const userProfile = computed(() => user.value)
  const userRole = computed(() => user.value?.role || 'User')

  function persistUser() {
    localStorage.setItem('user', JSON.stringify(user.value))
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
    if (requireAuth && !token.value) {
      return { success: false, message: 'Not authenticated' }
    }

    const requestBody = {
      action,
      ...(requireAuth ? { token: token.value } : {}),
      ...payload
    }

    try {
      const response = await axios.post(GAS_URL, requestBody, { headers: API_HEADERS })
      return response.data
    } catch (error) {
      return { success: false, message: 'Unable to connect to service' }
    }
  }

  async function login(email, password) {
    loading.value = true
    try {
      const data = await callAuthApi('login', { email, password }, false)

      if (data.success) {
        token.value = data.token
        user.value = data.user

        // Persist to local storage
        localStorage.setItem('token', data.token)
        persistUser()

        // Notify Service Worker for token injection
        notifyServiceWorker(data.token)

        return { success: true }
      }

      return { success: false, message: data.message || 'Login failed' }
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
    localStorage.removeItem('token')
    localStorage.removeItem('user')

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
    loading,

    // Getters
    isAuthenticated,
    userProfile,
    userRole,

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

