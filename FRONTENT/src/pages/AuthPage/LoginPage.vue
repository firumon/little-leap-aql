<template>
  <div class="login-page flex-grow-1">
    <div class="text-center q-mb-md">
      <h2 class="text-h5 text-weight-medium q-mb-sm">Sign In</h2>
      <p class="text-caption text-grey-7">Enter your credentials to access your dashboard</p>
    </div>

    <q-form @submit="handleLogin" class="q-gutter-md">
      <q-input filled v-model="loginForm.identifier" label="Username or Email" lazy-rules
        :rules="[val => val && val.length > 0 || 'Please enter your unique identifier']">
        <template v-slot:prepend>
          <q-icon name="person" color="primary" />
        </template>
      </q-input>

      <q-input filled type="password" v-model="loginForm.password" label="Password" lazy-rules
        :rules="[val => val && val.length > 0 || 'Please enter your password']">
        <template v-slot:prepend>
          <q-icon name="lock" color="primary" />
        </template>
      </q-input>

      <div class="q-mt-lg">
        <q-btn label="Login" type="submit" color="primary" class="full-width q-py-sm shadow-2" rounded unelevated
          :loading="loading" />
      </div>

      <div class="text-center q-mt-md">
        <q-btn flat dense color="grey-7" size="sm" label="Forgot Password?" />
      </div>
    </q-form>
  </div>
</template>

<script setup>
import { useLoginPage } from 'src/composables/layout/useLoginPage'

const { loginForm, loading, handleLogin } = useLoginPage()
</script>

<style scoped>
.login-page {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
