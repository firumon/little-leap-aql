import { ref, computed } from 'vue'
import { Notify } from 'quasar'

const APPLY_FALLBACK_MS = 15000

const isSupported = ref(typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
const isChecking = ref(false)
const isDownloading = ref(false)
const isPending = ref(false)
const isUpdating = ref(false)
const updateAvailable = ref(false)
const isRegistered = ref(false)
const lastCheckedAt = ref(null)
const lastError = ref('')
const remoteVersion = ref('')

const currentVersion = process.env.APP_VERSION || 'dev'
const appName = process.env.APP_NAME || 'AQL'
const buildTime = process.env.BUILD_TIME || ''

let registration = null
let applying = false
let applyTimer = null
let isWatcherInitialized = false
let coldStartChecked = false
let activeNotify = null
let pendingGuardTimer = null
let workerSeenDuringPending = false

const status = computed(() => {
  if (!isSupported.value) return { label: 'Not supported', color: 'grey-6', icon: 'block' }
  if (isUpdating.value) return { label: 'Applying', color: 'orange', icon: 'sync' }
  if (updateAvailable.value) return { label: 'Update ready', color: 'warning', icon: 'system_update_alt' }
  if (isDownloading.value || isPending.value) return { label: 'Downloading', color: 'info', icon: 'cloud_download' }
  if (isChecking.value) return { label: 'Checking', color: 'info', icon: 'sync' }
  if (isRegistered.value) return { label: 'Active', color: 'positive', icon: 'verified' }
  return { label: 'Inactive', color: 'grey-6', icon: 'cloud_off' }
})

const lastCheckedLabel = computed(() => {
  if (!lastCheckedAt.value) return 'Not checked yet'
  return new Date(lastCheckedAt.value).toLocaleString()
})

const buildTimeLabel = computed(() => (buildTime ? new Date(buildTime).toLocaleString() : '—'))

function clearPendingGuard () {
  if (pendingGuardTimer) {
    clearTimeout(pendingGuardTimer)
    pendingGuardTimer = null
  }
}

function notifyFailedDownload () {
  Notify.create({
    message: 'Update download did not finish. Please check again.',
    color: 'negative',
    icon: 'error',
    position: 'top'
  })
}

function startPendingGuard () {
  clearPendingGuard()
  workerSeenDuringPending = false
  pendingGuardTimer = setTimeout(() => {
    pendingGuardTimer = null
    if (isPending.value && !workerSeenDuringPending && !updateAvailable.value) {
      isPending.value = false
      notifyFailedDownload()
    }
  }, 30000)
}

function onWorkerRedundant () {
  const shouldNotify = isPending.value || isDownloading.value
  clearPendingGuard()
  isPending.value = false
  isDownloading.value = false
  if (shouldNotify) {
    notifyFailedDownload()
  }
}

function showReadyNotify (message = 'Update downloaded. Reload to apply.') {
  if (activeNotify) return
  activeNotify = Notify.create({
    message,
    color: 'warning',
    textColor: 'white',
    icon: 'system_update_alt',
    timeout: 0,
    position: 'top',
    actions: [
      {
        label: 'Reload',
        color: 'white',
        handler: () => {
          applyUpdate()
        }
      }
    ]
  })
}

function markReady () {
  clearPendingGuard()
  isPending.value = false
  isDownloading.value = false
  updateAvailable.value = true
  showReadyNotify('Update downloaded. Reload to apply.')
}

function watchWorker (worker) {
  if (!worker || !navigator.serviceWorker?.controller) return

  if (worker.state === 'installing') {
    workerSeenDuringPending = true
    isDownloading.value = true
  }
  if (worker.state === 'installed') {
    workerSeenDuringPending = true
    markReady()
  }
  if (worker.state === 'redundant') {
    onWorkerRedundant()
  }

  worker.addEventListener('statechange', () => {
    if (worker.state === 'installing') {
      workerSeenDuringPending = true
      isDownloading.value = true
    } else if (worker.state === 'installed') {
      workerSeenDuringPending = true
      markReady()
    } else if (worker.state === 'redundant') {
      onWorkerRedundant()
    }
  })
}

function checkColdStart (reg) {
  if (coldStartChecked) return false
  coldStartChecked = true

  if (typeof window === 'undefined' || !window.sessionStorage) return false
  if (window.sessionStorage.getItem('aql_sw_cold_applied')) {
    window.sessionStorage.removeItem('aql_sw_cold_applied')
    return false
  }

  if (reg?.waiting) {
    window.sessionStorage.setItem('aql_sw_cold_applied', '1')
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    }, { once: true })
    setTimeout(() => {
      window.location.reload()
    }, 3000)
    return true
  }

  return false
}

function bindRegistration (reg) {
  registration = reg
  isRegistered.value = !!reg
  if (!reg) return

  const coldApplied = checkColdStart(reg)
  if (reg.waiting && !coldApplied) {
    workerSeenDuringPending = true
    markReady()
  }
  if (reg.installing) {
    workerSeenDuringPending = true
    watchWorker(reg.installing)
  }

  reg.addEventListener('updatefound', () => {
    workerSeenDuringPending = true
    watchWorker(reg.installing)
  })
}

function onControllerChange () {
  if (!applying) return
  applying = false
  if (applyTimer) clearTimeout(applyTimer)
  window.location.reload()
}

function onPreloadError (event) {
  event?.preventDefault?.()
  showReadyNotify('New version ready. Tap to reload.')
}

async function fetchRemoteVersion () {
  try {
    const response = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function isNewerVersion (remote, current) {
  if (!remote || !current || remote === current) return false
  if (current === 'dev') return true
  const rParts = String(remote).split('.')
  const cParts = String(current).split('.')
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const rNum = Number(rParts[i])
    const cNum = Number(cParts[i])
    if (Number.isFinite(rNum) && Number.isFinite(cNum)) {
      if (rNum > cNum) return true
      if (rNum < cNum) return false
    } else {
      const cmp = String(rParts[i] || '').localeCompare(String(cParts[i] || ''))
      if (cmp > 0) return true
      if (cmp < 0) return false
    }
  }
  return false
}

export async function checkForUpdate () {
  lastError.value = ''

  if (!isSupported.value) {
    Notify.create({ message: 'Service workers are not available in this browser.', color: 'grey-8', icon: 'block', position: 'top' })
    return
  }

  if (!registration) {
    registration = await navigator.serviceWorker.getRegistration()
    if (registration) bindRegistration(registration)
  }

  isChecking.value = true
  lastCheckedAt.value = new Date()

  try {
    const remote = await fetchRemoteVersion()
    if (remote?.version) remoteVersion.value = remote.version

    if (isNewerVersion(remoteVersion.value, currentVersion) && !updateAvailable.value) {
      isPending.value = true
      startPendingGuard()
    }

    if (registration) {
      await registration.update()
      if (registration.installing || registration.waiting) {
        workerSeenDuringPending = true
      }
      if (registration.waiting) {
        markReady()
      } else if (registration.installing) {
        watchWorker(registration.installing)
      }
    }

    if (updateAvailable.value) {
      Notify.create({ message: 'A new version is ready to install.', color: 'warning', icon: 'system_update_alt', position: 'top' })
    } else if (isDownloading.value || isPending.value) {
      Notify.create({ message: 'Downloading the new version…', color: 'info', icon: 'cloud_download', position: 'top' })
    } else {
      Notify.create({ message: 'App is up to date.', color: 'positive', icon: 'check_circle', position: 'top' })
    }
  } catch (error) {
    clearPendingGuard()
    isPending.value = false
    lastError.value = error?.message || 'Update check failed.'
    Notify.create({ message: lastError.value, color: 'negative', icon: 'error', position: 'top' })
  } finally {
    isChecking.value = false
  }
}

export async function applyUpdate () {
  if (isUpdating.value) return

  clearPendingGuard()
  isPending.value = false
  isUpdating.value = true
  applying = true

  try {
    if (!registration) registration = await navigator.serviceWorker?.getRegistration()
    const worker = registration?.waiting
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' })
      applyTimer = setTimeout(() => {
        if (!applying) return
        applying = false
        window.location.reload()
      }, APPLY_FALLBACK_MS)
    } else {
      window.location.reload()
    }
  } catch (error) {
    isUpdating.value = false
    applying = false
    lastError.value = error?.message || 'Could not apply the update.'
    Notify.create({ message: lastError.value, color: 'negative', icon: 'error', position: 'top' })
  }
}

export async function initPwaWatcher () {
  if (isWatcherInitialized || !isSupported.value) return
  isWatcherInitialized = true

  document.addEventListener('swUpdated', (event) => {
    if (event.detail) registration = event.detail
    markReady()
  })

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
  window.addEventListener('vite:preloadError', onPreloadError)

  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) {
    bindRegistration(reg)
  }
}

export function usePwaUpdate () {
  return {
    isSupported,
    isRegistered,
    isChecking,
    isDownloading,
    isPending,
    isUpdating,
    updateAvailable,
    lastError,
    status,
    lastCheckedAt,
    lastCheckedLabel,
    buildTimeLabel,
    appName,
    currentVersion,
    remoteVersion,
    checkForUpdate,
    applyUpdate,
    initPwaWatcher
  }
}
