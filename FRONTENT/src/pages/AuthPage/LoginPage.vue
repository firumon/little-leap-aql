<template>
  <div class="login-page flex-grow-1">
    <h2 class="text-h6 text-weight-medium text-white q-mt-none q-mb-xs">Welcome back</h2>
    <p class="login-subtitle q-mb-lg">Sign in to continue to your dashboard</p>

    <q-form @submit="handleLogin" class="q-gutter-md">
      <q-input dark outlined v-model="loginForm.identifier" label="Username or Email" lazy-rules
        class="login-input" :rules="[val => val && val.length > 0 || 'Please enter your unique identifier']">
        <template v-slot:prepend>
          <q-icon name="person" />
        </template>
      </q-input>

      <q-input dark outlined :type="showPassword ? 'text' : 'password'" v-model="loginForm.password" label="Password"
        lazy-rules class="login-input" :rules="[val => val && val.length > 0 || 'Please enter your password']">
        <template v-slot:prepend>
          <q-icon name="lock" />
        </template>
        <template v-slot:append>
          <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer"
            @click="showPassword = !showPassword" />
        </template>
      </q-input>

      <div>
        <q-btn label="Sign In" type="submit" color="secondary" text-color="primary" class="full-width login-btn"
          no-caps unelevated :loading="loading" />
      </div>

      <div class="text-center">
        <q-btn flat dense no-caps class="login-link" size="sm" label="Forgot password?" />
      </div>

      <div class="login-version text-center">v{{ version }}</div>
    </q-form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useLoginPage } from 'src/composables/layout/useLoginPage'
import pkg from '../../../package.json'

const { loginForm, loading, handleLogin } = useLoginPage()
const version = pkg.version
const showPassword = ref(false)
</script>

<style scoped lang="scss">
.login-page {
  animation: fadeIn 0.4s ease-out;
}

.login-subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.login-input :deep(.q-field__control) {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.login-input :deep(.q-field__prepend .q-icon),
.login-input :deep(.q-field__append .q-icon) {
  color: rgba(255, 255, 255, 0.5);
}

.login-btn {
  border-radius: 10px;
  padding: 11px 0;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.login-link {
  color: rgba(255, 255, 255, 0.6);
}

.login-version {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.28);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
