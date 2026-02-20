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
import { reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useRouter } from 'vue-router'

const $q = useQuasar()
const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)

const loginForm = reactive({
  identifier: '',
  password: ''
})

async function handleLogin() {
  loading.value = true
  try {
    const result = await auth.login(loginForm.identifier, loginForm.password)

    if (result.success) {
      $q.notify({
        type: 'positive',
        color: 'secondary',
        message: 'Logged in successfully',
        position: 'top',
        timeout: 2000
      })
      router.push('/dashboard')
    } else {
      $q.notify({
        type: 'negative',
        message: result.message || 'Login failed. Please check your credentials.',
        position: 'top',
        timeout: 3000
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error?.message || 'Login failed. Please try again.',
      position: 'top',
      timeout: 3000
    })
  } finally {
    loading.value = false
  }
}
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
