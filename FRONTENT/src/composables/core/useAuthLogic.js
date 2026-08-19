/**
 * useAuthLogic — Auth workflow composable (extracted from auth store)
 * Handles login, logout, and profile update workflows
 * Uses auth store for state management
 * Orchestrates stores and notifications
 */

import { Notify, Loading } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useInitialResourceSync } from 'src/composables/resources/useInitialResourceSync'
import { usePollingStore } from 'src/stores/polling'

export function useAuthLogic() {
  const auth = useAuthStore()
  const initialResourceSync = useInitialResourceSync()
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
      if (showError) {
        Notify.create({ type: 'negative', message: 'Action failed: ' + error.message })
      }
      return { success: false, error: error.message }
    }
  }

  async function login(email, password) {
    try {
      const data = await auth.loginRequest(email, password)

      if (data.success) {
        // Holds the data store's cache seeding until the session cache is ready.
        const dataStore = useDataStore()
        dataStore.beginCacheReset()
        auth.applySessionData(data.data || {})

        auth.initializeClientSession(true)
          .catch(() => {})
          .finally(() => dataStore.endCacheReset())

        // Background global sync
        auth.isGlobalSyncing = true
        Promise.resolve(initialResourceSync.syncInitialResources())
          .catch(() => {})
          .finally(() => {
            auth.isGlobalSyncing = false
          })

        const polling = usePollingStore()
        polling.start()

        return { success: true }
      }

      return { success: false, message: data.error || data.message || 'Login failed' }
    } catch (error) {
      return { success: false, message: error?.message || 'Login failed' }
    }
  }

  /**
   * Re-establishes an already-authenticated session after a page reload.
   *
   * `login()` is the only thing that bootstraps the client — it initialises the
   * IndexedDB session, hydrates resource status, and starts polling. A refresh
   * never goes through it, so without this the app comes back with an empty
   * `resourceStatus` (no resource is `initiated`, so a poll would have nothing
   * to ask about) and a polling store that was never started at all.
   *
   * The one deliberate difference from login is `resetCursors: false`. Login
   * wipes the sync cursors because it is starting a new session; a reload must
   * preserve `lastDataUpdatedAt` / `lastSyncAt` / `hasHydratedOnce`, or every
   * refresh would re-download every resource from scratch.
   *
   * Deliberately does NOT re-run `syncInitialResources()`: the cache survives
   * the reload, and the first poll picks up anything that changed while the tab
   * was gone. Refetching everything on every refresh would be pure waste.
   */
  async function restoreSession() {
    if (!auth.isAuthenticated) return { success: false, message: 'No session to restore' }

    const polling = usePollingStore()

    try {
      // Awaited so resource status is populated before the first poll fires.
      await auth.initializeClientSession(false)
    } catch (error) {
      // A cache-init failure must not leave the app without a heartbeat; the
      // poll can still run against whatever status the pages populate lazily.
      console.error('[useAuthLogic] Session restore failed to initialise cache:', error)
    }

    polling.start()
    return { success: true }
  }

  async function updateAvatar(avatarUrl) {
    const data = await auth.updateAvatarRequest(avatarUrl)
    if (!data.success) {
      return { success: false, message: data.error || data.message || 'Failed to update avatar' }
    }

    auth.patchUserData({ avatar: data.data?.avatarUrl || avatarUrl })
    Notify.create({ type: 'positive', message: 'Avatar updated successfully' })

    return { success: true }
  }

  async function updateName(name) {
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
    const polling = usePollingStore()
    polling.stop()
    auth.clearSessionState()
    // The store's watcher skips its wipe on an empty list, so clear these here.
    useDataStore().resetSeedState()

    try {
      await auth.clearClientSession()
    } catch (_) {}

    // Navigation is handled by the caller (component/page/store)
    // This composable is UI/routing-agnostic
    return { success: true }
  }

  return {
    login,
    logout,
    restoreSession,
    updateAvatar,
    updateName,
    updateEmail,
    updatePassword,
    callAuthApi
  }
}

