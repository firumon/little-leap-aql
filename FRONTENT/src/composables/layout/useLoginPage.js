import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { useAppNav } from 'src/composables/core/useAppNav'

export function useLoginPage() {
  const $q = useQuasar()
  const appNav = useAppNav()
  const { login } = useAuthLogic()
  const loading = ref(false)
  const tenantList = ref([])
  const activeTenantCode = ref('')
  const showTenantDialog = ref(false)

  const loginForm = reactive({
    identifier: '',
    password: ''
  })

  function loadTenants() {
    activeTenantCode.value = (localStorage.getItem('aql_tenant_code') || '').trim()
    try {
      const stored = localStorage.getItem('aql_tenants')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          tenantList.value = parsed
        }
      }
    } catch (_) {
      tenantList.value = []
    }
  }

  loadTenants()

  const hasMultipleTenants = computed(() => tenantList.value.length > 1)

  function isCurrentTenant(code) {
    return (code || '').trim().toUpperCase() === activeTenantCode.value.toUpperCase()
  }

  function shiftTenant(tenant) {
    if (!tenant || !tenant.code) return
    window.location.href = window.location.origin + '/?t=' + encodeURIComponent(tenant.code.trim())
  }

  function removeTenant(index) {
    const removed = tenantList.value[index]
    tenantList.value.splice(index, 1)
    localStorage.setItem('aql_tenants', JSON.stringify(tenantList.value))

    if (removed && (removed.code || '').trim().toUpperCase() === activeTenantCode.value.toUpperCase()) {
      if (tenantList.value.length > 0) {
        window.location.href = window.location.origin + '/?t=' + encodeURIComponent(tenantList.value[0].code.trim())
        return
      }
      localStorage.removeItem('aql_tenant_code')
      localStorage.removeItem('aql_tenant_url')
    }

    window.location.reload()
  }

  async function handleLogin() {
    loading.value = true
    try {
      const result = await login(loginForm.identifier, loginForm.password)
      if (!result.success) {
        $q.notify({
          type: 'negative',
          message: result.message || 'Invalid credentials',
          position: 'top',
          timeout: 3000
        })
        return
      }

      $q.notify({
        type: 'positive',
        color: 'secondary',
        message: 'Logged in successfully',
        position: 'top',
        timeout: 2000
      })

      await appNav.goTo('dashboard')
    } finally {
      loading.value = false
    }
  }

  return {
    loginForm,
    loading,
    handleLogin,
    tenantList,
    hasMultipleTenants,
    showTenantDialog,
    isCurrentTenant,
    shiftTenant,
    removeTenant
  }
}
