<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { requestNotificationPermission, subscribeToPush } from 'src/utils/notifications'
import { initPwaWatcher } from 'src/composables/core/usePwaUpdate'

const VAPID_PUBLIC_KEY = 'BI-L6k-1_rY9m5_nL0E3X7pA_your_vapid_key_here'

onMounted(async () => {
  const authStore = useAuthStore()

  await initPwaWatcher()

  if (authStore.token) {
    authStore.notifyServiceWorker(authStore.token)
  }

  if (authStore.isAuthenticated) {
    // A reload skips login(), so the session bootstrap must run again here.
    await useAuthLogic().restoreSession()
  }

  const granted = await requestNotificationPermission()
  if (granted && authStore.token) {
    try {
      const subscription = await subscribeToPush(VAPID_PUBLIC_KEY)
      console.log('[App] Push Subscription:', subscription)
    } catch (error) {
      console.error('[App] Push subscription failed:', error)
    }
  }
})
</script>
