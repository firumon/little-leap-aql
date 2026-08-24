<template>
  <div class="select-tenant-page flex-grow-1 flex flex-center">
    <div class="full-width">
      <p class="text-body1 text-grey-8 q-mb-lg">
        AQL is a next-generation resource and operations management platform.
        Please enter your tenant code to connect to your workspace.
      </p>

      <q-form @submit="handleSubmit" class="q-gutter-md">
        <q-input
          v-model="tenantCode"
          dark
          outlined
          rounded
          label="Tenant Code"
          placeholder="e.g. AQL"
          class="q-mb-md"
          :rules="[val => !!val || 'Tenant code is required']"
          :disable="loading"
          autofocus
        >
          <template v-slot:prepend>
            <q-icon name="domain" />
          </template>
        </q-input>

        <div v-if="errorMessage" class="text-negative text-center q-mb-md text-weight-bold">
          {{ errorMessage }}
        </div>

        <div>
          <q-btn
            type="submit"
            unelevated
            rounded
            color="secondary"
            text-color="primary"
            size="lg"
            class="full-width q-py-sm"
            label="Connect"
            :loading="loading"
          />
        </div>
      </q-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const MASTER_GAS_URL = 'https://script.google.com/macros/s/AKfycbzf37M3i9UE3NfqprIbUCvX8oeKThVyK3qvoVv-KwFI_6JDnTY-_rjDsjINZyYZELdZ/exec'

const tenantCode = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  const code = tenantCode.value.trim().toUpperCase()
  if (!code) return

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await axios.post(MASTER_GAS_URL, {
      action: 'getTenantUrl',
      tenantCode: code
    }, {
      headers: { 'Content-Type': 'text/plain' }
    })

    const returnedUrl = typeof response.data === 'string'
      ? response.data.trim()
      : response.data?.url

    if (returnedUrl && returnedUrl.startsWith('https://')) {
      // Save details to cache
      localStorage.setItem('aql_tenant_url', returnedUrl)
      localStorage.setItem('aql_tenant_code', code)

      // Perform redirect using window.location to force boot file refresh with the new URL
      window.location.href = window.location.origin + '/?t=' + code
    } else {
      errorMessage.value = returnedUrl || 'Invalid response from Master server.'
    }
  } catch (err) {
    console.error('[Tenant Page] Failed to query master server:', err)
    errorMessage.value = 'Failed to connect. Please verify your connection or tenant code.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.select-tenant-page {
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
</style>
