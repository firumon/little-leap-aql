<template>
  <q-layout view="lHh Lpr lFf" class="auth-layout">
    <q-page-container>
      <div class="auth-wrapper flex flex-center q-pa-md">
        <div class="glass-container q-pa-xl">
          <div class="brand-section text-center q-mb-lg">
            <img src="~assets/logo.png" style="width: 80px; height: 80px" class="q-mb-sm" />
            <h1 class="text-h4 text-weight-bold q-mt-none q-mb-xs">AQL</h1>
            <div class="text-subtitle1 text-grey-7">Management System</div>
          </div>
          
          <router-view v-slot="{ Component }">
            <transition
              appear
              enter-active-class="animated fadeIn"
              leave-active-class="animated fadeOut"
              mode="out-in"
            >
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted } from 'vue'
import { setDeferredPrompt } from 'src/utils/pwa-utils'

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    setDeferredPrompt(e);
  });
});
</script>

<style lang="scss">
.auth-layout {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.auth-wrapper {
  min-height: 100vh;
}

.glass-container {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  width: 100%;
  max-width: 450px;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.brand-section {
  h1 {
    letter-spacing: -1px;
    background: linear-gradient(45deg, $primary, #4a90e2);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
</style>
