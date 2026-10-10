<template>
  <div class="landing-page flex-grow-1 flex flex-center">
    <div class="full-width">
      <div v-show="!showInstructions">
        <p class="text-body1 text-grey-8 q-mb-xl">
          Welcome to the next generation of distribution management.
          To access the platform, please install the application on your device.
        </p>

        <div class="full-width text-center">
          <q-btn
            unelevated
            rounded
            color="secondary"
            text-color="primary"
            size="lg"
            @click="handleInstall"
            class="q-px-xl q-py-sm"
            label="Install App"
            icon-right="get_app"
          />

          <div class="q-mt-md">
            <q-btn flat color="secondary" @click="showInstructions = true" label="How to install manually?" />
          </div>

        </div>
      </div>

      <div v-show="showInstructions" class="text-left animate-fade">
        <h2 class="text-h6 q-mb-md">Installation Guide</h2>
        <q-list dense>
          <q-item>
            <q-item-section avatar><q-icon name="smartphone" color="secondary" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">iOS / Safari</q-item-label>
              <q-item-label caption>Tap the 'Share' icon and select 'Add to Home Screen'</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section avatar><q-icon name="laptop" color="secondary" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">Android / Chrome</q-item-label>
              <q-item-label caption>Tap the three dots in the corner and select 'Install app'</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div class="text-center q-mt-lg">
          <q-btn flat color="grey-7" @click="showInstructions = false" label="Back" />
        </div>
      </div>

      <div class="landing-version text-center q-mt-lg">v{{ version }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { presentInstallPrompt } from 'src/utils/pwa-utils'
import pkg from '../../../package.json'

const $q = useQuasar()
const showInstructions = ref(false)
const version = pkg.version

async function handleInstall() {
  const outcome = await presentInstallPrompt()

  if (outcome === 'accepted') {
    $q.notify({
      type: 'positive',
      message: 'Installing AQL...',
      position: 'top'
    })
  } else if (outcome === 'dismissed') {
    $q.notify({
      type: 'warning',
      message: 'Installation dismissed',
      position: 'top'
    })
  } else {
    // outcome === 'not-available'
    showInstructions.value = true
    $q.notify({
      message: 'Please follow the manual installation guide.',
      color: 'info',
      position: 'top'
    })
  }
}
</script>

<style scoped>
.landing-page {
  animation: slideIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-fade {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.landing-version {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.28);
}
</style>
