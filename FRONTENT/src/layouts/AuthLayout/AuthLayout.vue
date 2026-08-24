<template>
  <q-layout view="lHh Lpr lFf" class="auth-layout">
    <q-page-container>
      <div class="auth-wrapper flex flex-center q-pa-lg">
        <div class="auth-panel">
          <div class="brand-section q-mb-xl">
            <img src="~assets/logo.png" class="brand-logo q-mb-md" />
            <h1 class="text-h4 text-weight-bold q-mt-none q-mb-xs">AQL</h1>
            <div class="brand-tagline">Management System</div>
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
    e.preventDefault();
    setDeferredPrompt(e);
  });
});
</script>

<style lang="scss">
.auth-layout {
  background: linear-gradient(160deg, $primary 0%, $dark 100%);
  min-height: 100vh;
}

.auth-wrapper {
  min-height: 100vh;
}

.auth-panel {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  color: rgba(255, 255, 255, 0.88);
}

.auth-panel .q-item__label--caption {
  color: rgba(255, 255, 255, 0.55);
}

.brand-logo {
  width: 56px;
  height: 56px;
  display: block;
}

.brand-section {
  h1 {
    letter-spacing: -1px;
    color: #fff;
    line-height: 1.1;
  }
}

.brand-tagline {
  font-size: 0.9rem;
  color: $secondary;
  letter-spacing: 0.5px;
}

.auth-layout .text-grey-8,
.auth-layout .text-grey-7 {
  color: rgba(255, 255, 255, 0.65) !important;
}
</style>
