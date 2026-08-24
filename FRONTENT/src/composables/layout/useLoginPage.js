import { reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { useAppNav } from 'src/composables/core/useAppNav'

export function useLoginPage() {
  const $q = useQuasar()
  const appNav = useAppNav()
  const { login } = useAuthLogic()
  const loading = ref(false)
  const errorMessage = ref('')

  const loginForm = reactive({
    identifier: '',
    password: ''
  })

  async function handleLogin() {
    errorMessage.value = ''
    loading.value = true
    try {
      const result = await login(loginForm.identifier, loginForm.password)
      if (!result.success) {
        const errorMsg = result.message || 'Invalid credentials'
        errorMessage.value = errorMsg
        $q.notify({
          type: 'negative',
          message: errorMsg,
          position: 'top',
          timeout: 3000
        })
        return result
      }

      $q.notify({
        type: 'positive',
        color: 'secondary',
        message: 'Logged in successfully',
        position: 'top',
        timeout: 2000
      })

      await appNav.goTo('dashboard')
      return result
    } finally {
      loading.value = false
    }
  }

  return {
    loginForm,
    loading,
    errorMessage,
    handleLogin
  }
}
