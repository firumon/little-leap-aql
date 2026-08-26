import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'

const CHECK_SETTLE_MS = 1500

export function usePwaUpdate () {
  const $q = useQuasar()

  const isSupported = ref(typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  const isChecking = ref(false)
  const isUpdating = ref(false)
  const updateAvailable = ref(false)
  const isRegistered = ref(false)
  const lastCheckedAt = ref(null)
  const lastError = ref('')

  const currentVersion = process.env.APP_VERSION || 'dev'
  const appName = process.env.APP_NAME || 'AQL'
  const buildTime = process.env.BUILD_TIME || ''

  let registration = null
  let reloading = false
  let listenersBound = false

  const status = computed(() => {
    if (!isSupported.value) return { label: 'Not supported', color: 'grey-6', icon: 'block' }
    if (isUpdating.value) return { label: 'Updating', color: 'orange', icon: 'sync' }
    if (updateAvailable.value) return { label: 'Update ready', color: 'warning', icon: 'system_update_alt' }
    if (isChecking.value) return { label: 'Checking', color: 'info', icon: 'sync' }
    if (isRegistered.value) return { label: 'Active', color: 'positive', icon: 'verified' }
    return { label: 'Inactive', color: 'grey-6', icon: 'cloud_off' }
  })

  const lastCheckedLabel = computed(() => {
    if (!lastCheckedAt.value) return 'Not checked yet'
    return new Date(lastCheckedAt.value).toLocaleString()
  })

  const buildTimeLabel = computed(() => (buildTime ? new Date(buildTime).toLocaleString() : '—'))

  function markAvailable () {
    updateAvailable.value = true
  }

  function watchWorker (worker) {
    if (!worker) return
    if (worker.state === 'installed' || worker.state === 'activated') {
      if (navigator.serviceWorker.controller) markAvailable()
      return
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) markAvailable()
    })
  }

  function bind (reg) {
    registration = reg
    isRegistered.value = !!reg
    if (!reg) return

    if (reg.waiting && navigator.serviceWorker.controller) markAvailable()
    watchWorker(reg.installing)

    reg.addEventListener('updatefound', () => watchWorker(reg.installing))
  }

  function onSwUpdated (event) {
    if (event.detail) registration = event.detail
    markAvailable()
  }

  function onControllerChange () {
    if (!reloading) return
    window.location.reload()
  }

  async function checkForUpdate () {
    lastError.value = ''

    if (!isSupported.value) {
      $q.notify({ message: 'Service workers are not available in this browser.', color: 'grey-8', icon: 'block', position: 'top' })
      return
    }

    if (!registration) {
      registration = await navigator.serviceWorker.getRegistration()
      if (registration) bind(registration)
    }

    if (!registration) {
      lastError.value = 'No service worker is registered. Updates only work in a built (production) app.'
      $q.notify({ message: lastError.value, color: 'grey-8', icon: 'info', position: 'top' })
      return
    }

    isChecking.value = true
    $q.notify({ message: 'Checking for updates…', color: 'info', icon: 'sync', position: 'top', timeout: 1200 })

    try {
      await registration.update()
      await new Promise(resolve => setTimeout(resolve, CHECK_SETTLE_MS))
      lastCheckedAt.value = Date.now()

      if (registration.waiting || registration.installing) markAvailable()

      if (!updateAvailable.value) {
        $q.notify({ message: 'App is up to date.', color: 'positive', icon: 'check_circle', position: 'top' })
      } else {
        $q.notify({ message: 'A new version is ready to install.', color: 'warning', icon: 'system_update_alt', position: 'top' })
      }
    } catch (error) {
      lastError.value = error?.message || 'Update check failed.'
      $q.notify({ message: lastError.value, color: 'negative', icon: 'error', position: 'top' })
    } finally {
      isChecking.value = false
    }
  }

  async function applyUpdate () {
    if (!updateAvailable.value || isUpdating.value) return

    isUpdating.value = true
    reloading = true

    try {
      if (!registration) registration = await navigator.serviceWorker.getRegistration()
      const worker = registration?.waiting || registration?.installing
      if (worker) worker.postMessage({ type: 'SKIP_WAITING' })

      // A new worker that self-claims never fires controllerchange, so reload anyway.
      setTimeout(() => { window.location.reload() }, 1200)
    } catch (error) {
      isUpdating.value = false
      reloading = false
      lastError.value = error?.message || 'Could not apply the update.'
      $q.notify({ message: lastError.value, color: 'negative', icon: 'error', position: 'top' })
    }
  }

  onMounted(async () => {
    if (!isSupported.value) return
    document.addEventListener('swUpdated', onSwUpdated)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    listenersBound = true

    const reg = await navigator.serviceWorker.getRegistration()
    bind(reg || null)
  })

  onBeforeUnmount(() => {
    if (!listenersBound) return
    document.removeEventListener('swUpdated', onSwUpdated)
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  })

  return {
    isSupported,
    isRegistered,
    isChecking,
    isUpdating,
    updateAvailable,
    lastError,
    status,
    lastCheckedAt,
    lastCheckedLabel,
    buildTimeLabel,
    appName,
    currentVersion,
    checkForUpdate,
    applyUpdate
  }
}
