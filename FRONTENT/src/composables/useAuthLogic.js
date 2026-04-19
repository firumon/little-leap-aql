/**
 * useAuthLogic — Auth workflow composable (extracted from auth store)
 * Handles login, logout, and profile update workflows
 * Uses auth store for state management
 * Orchestrates services and notifications
 */

import { Notify, Loading } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { executeGasApi } from 'src/services/GasApiService'
import { syncAllMasterResources } from 'src/services/ResourceRecordsService'
import { setAuthorizedResources, reinitializeDB, clearAllClientStorage } from 'src/services/IndexedDbService'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('useAuthLogic')

export function useAuthLogic() {
  const auth = useAuthStore()
  // Note: Router is intentionally NOT used here (no Vue context in store)
  // Navigation is handled by the caller (component/page)

  async function callAuthApi(action, payload = {}, options = {}) {
    const {
      requireAuth = true,
      showLoading = false,
      loadingMessage = 'Processing...',
      successMessage = null,
      showError = true
    } = options

    if (showLoading) {
      Loading.show({ message: loadingMessage })
    }

    try {
      const response = await executeGasApi(action, payload, {
        requireAuth,
        token: auth.token
      })

      if (showLoading) {
        Loading.hide()
      }

      if (!response.success && showError) {
        Notify.create({ type: 'negative', message: response.error || response.message || 'Action failed' })
      } else if (response.success && successMessage) {
        Notify.create({ type: 'positive', message: successMessage })
      }

      return response
    } catch (error) {
      if (showLoading) {
        Loading.hide()
      }
      logger.error('Auth API call failed', { action, error: error.message })
      if (showError) {
        Notify.create({ type: 'negative', message: 'Action failed: ' + error.message })
      }
      return { success: false, error: error.message }
    }
  }

  async function login(email, password) {
    logger.info('Login attempt', { email })
    try {
      const data = await callAuthApi('login', { email, password }, { requireAuth: false })

      if (data.success) {
        auth.token = data.data?.token || data.token
        auth.user = data.data?.user || data.user
        auth.resources = Array.isArray(data.data?.resources || data.resources) ? (data.data?.resources || data.resources) : []
        auth.appConfig = (data.data?.appConfig || data.appConfig) && typeof (data.data?.appConfig || data.appConfig) === 'object' ? (data.data?.appConfig || data.appConfig) : {}
        auth.appOptions = (data.data?.appOptions || data.appOptions) && typeof (data.data?.appOptions || data.appOptions) === 'object' ? (data.data?.appOptions || data.appOptions) : {}

        // Persist to local storage
        localStorage.setItem('token', auth.token)
        localStorage.setItem('user', JSON.stringify(auth.user))
        localStorage.setItem('resources', JSON.stringify(auth.resources))
        localStorage.setItem('appConfig', JSON.stringify(auth.appConfig || {}))
        localStorage.setItem('appOptions', JSON.stringify(auth.appOptions || {}))

        // Sync token to service worker if possible
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SET_AUTH_TOKEN',
            token: auth.token
          })
        }

        // Background tasks for IndexedDB
        setAuthorizedResources(auth.resources, true).catch(err => logger.warn('IDB sync error', { error: err.message }))
        reinitializeDB().catch(err => logger.warn('DB init error', { error: err.message }))

        // Background global sync
        auth.isGlobalSyncing = true
        Promise.resolve(syncAllMasterResources())
          .catch((err) => {
            logger.warn('Global master sync error', { error: err.message })
          })
          .finally(() => {
            auth.isGlobalSyncing = false
          })

        logger.info('Login successful')
        return { success: true }
      }

      return { success: false, message: data.error || data.message || 'Login failed' }
    } catch (error) {
      logger.error('Login failed', { error: error.message })
      return { success: false, message: error?.message || 'Login failed' }
    }
  }

  async function updateAvatar(avatarUrl) {
    logger.debug('Updating avatar')
    const data = await callAuthApi('updateAvatar', { avatarUrl }, {
      showLoading: true,
      loadingMessage: 'Updating avatar...',
      successMessage: 'Avatar updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update avatar' }
    }

    if (auth.user) {
      auth.user.avatar = data.data?.avatarUrl || avatarUrl
      localStorage.setItem('user', JSON.stringify(auth.user))
    }

    return { success: true }
  }

  async function updateName(name) {
    logger.debug('Updating name')
    const data = await callAuthApi('updateName', { name }, {
      showLoading: true,
      loadingMessage: 'Updating name...',
      successMessage: 'Name updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update name' }
    }

    if (auth.user) {
      auth.user.name = data.data?.name || name
      localStorage.setItem('user', JSON.stringify(auth.user))
    }

    return { success: true }
  }

  async function updateEmail(email) {
    logger.debug('Updating email')
    const data = await callAuthApi('updateEmail', { email }, {
      showLoading: true,
      loadingMessage: 'Updating email...',
      successMessage: 'Email updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update email' }
    }

    if (auth.user) {
      auth.user.email = data.data?.email || email
      localStorage.setItem('user', JSON.stringify(auth.user))
    }

    return { success: true }
  }

  async function updatePassword(currentPassword, newPassword) {
    logger.debug('Updating password')
    const data = await callAuthApi('updatePassword', { currentPassword, newPassword }, {
      showLoading: true,
      loadingMessage: 'Updating password...',
      successMessage: 'Password updated successfully'
    })
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update password' }
    }

    return { success: true }
  }

  async function logout() {
    logger.info('Logging out')

    // 1. Clear in-memory state first so UI reacts immediately
    auth.user = null
    auth.token = null
    auth.resources = []
    auth.appConfig = {}
    auth.appOptions = {}
    auth.isGlobalSyncing = false

    // 2. Cleanup storage in background
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLOSE_DB'
        })
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_AUTH_TOKEN',
          token: null
        })
      }
      await clearAllClientStorage()
      logger.info('Logout completed')
    } catch (e) {
      logger.warn('Logout cleanup error', { error: e.message })
    }

    // 3. Navigation is handled by the caller (component/page/store)
    // This composable is UI/routing-agnostic
  }

  return {
    login,
    logout,
    updateAvatar,
    updateName,
    updateEmail,
    updatePassword,
    callAuthApi
  }
}

