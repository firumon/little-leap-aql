<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { requestNotificationPermission, subscribeToPush } from 'src/utils/notifications'
import { useQuasar } from 'quasar'

// Use your actual VAPID public key here
const VAPID_PUBLIC_KEY = 'BI-L6k-1_rY9m5_nL0E3X7pA_your_vapid_key_here'

onMounted(async () => {
  const authStore = useAuthStore()
  const $q = useQuasar()

  document.addEventListener('swUpdated', (event) => {
    const registration = event.detail
    $q.notify({
      message: 'App has been updated. Please refresh to use the latest version.',
      color: 'primary',
      icon: 'cloud_download',
      timeout: 0,
      position: 'top',
      actions: [
        {
          label: 'Refresh',
          color: 'white',
          handler: () => {
            if (registration && registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
            window.location.reload()
          }
        },
        { label: 'Dismiss', color: 'white' }
      ]
    })
  })
  
  // Sync token with Service Worker on app load
  if (authStore.token) {
    authStore.notifyServiceWorker(authStore.token)
  }

  // Handle Notifications
  const granted = await requestNotificationPermission()
  if (granted && authStore.token) {
    try {
      const subscription = await subscribeToPush(VAPID_PUBLIC_KEY)
      console.log('[App] Push Subscription:', subscription)
      // TODO: Send subscription to your backend (GAS)
    } catch (error) {
      console.error('[App] Push subscription failed:', error)
    }
  }
})
</script>
