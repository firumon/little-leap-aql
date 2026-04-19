/**
 * useAuthLogic — Auth workflow composable (extracted from auth store)
 * Handles login, logout, and profile update workflows
 * Uses auth store for state management
 * Orchestrates services and notifications
 */

import { Notify, Loading } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useSyncStore } from 'src/stores/sync'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('useAuthLogic')

export function useAuthLogic() {
  const auth = useAuthStore()
  const syncStore = useSyncStore()
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
      const response = await auth.callAuthApi(action, payload, {
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
      const data = await auth.loginRequest(email, password)

      if (data.success) {
        auth.applySessionData(data.data || {})

        auth.initializeClientSession(true).catch((error) => {
          logger.warn('IDB sync error', { error: error?.message || String(error) })
        })

        // Background global sync
        auth.isGlobalSyncing = true
        Promise.resolve(syncStore.syncAll())
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
    const data = await auth.updateAvatarRequest(avatarUrl)
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update avatar' }
    }

    auth.patchUserData({ avatar: data.data?.avatarUrl || avatarUrl })
    Notify.create({ type: 'positive', message: 'Avatar updated successfully' })

    return { success: true }
  }

  async function updateName(name) {
    logger.debug('Updating name')
    Loading.show({ message: 'Updating name...' })
    const data = await auth.updateNameRequest(name)
    Loading.hide()
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update name' }
    }

    auth.patchUserData({ name: data.data?.name || name })
    Notify.create({ type: 'positive', message: 'Name updated successfully' })

    return { success: true }
  }

  async function updateEmail(email) {
    logger.debug('Updating email')
    Loading.show({ message: 'Updating email...' })
    const data = await auth.updateEmailRequest(email)
    Loading.hide()
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update email' }
    }

    auth.patchUserData({ email: data.data?.email || email })
    Notify.create({ type: 'positive', message: 'Email updated successfully' })

    return { success: true }
  }

  async function updatePassword(currentPassword, newPassword) {
    logger.debug('Updating password')
    Loading.show({ message: 'Updating password...' })
    const data = await auth.updatePasswordRequest(currentPassword, newPassword)
    Loading.hide()
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update password' }
    }

    Notify.create({ type: 'positive', message: 'Password updated successfully' })
    return { success: true }
  }

  async function logout() {
    logger.info('Logging out')

    auth.clearSessionState()

    try {
      await auth.clearClientSession()
      logger.info('Logout completed')
    } catch (e) {
      logger.warn('Logout cleanup error', { error: e.message })
    }

    // Navigation is handled by the caller (component/page/store)
    // This composable is UI/routing-agnostic
    return { success: true }
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

