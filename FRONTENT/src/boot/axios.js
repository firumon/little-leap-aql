import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { apiClient } from 'src/services/ApiClientService'

export default boot(async ({ app }) => {
  const urlParams = new URLSearchParams(window.location.search)
  const tParam = (urlParams.get('t') || urlParams.get('tenant') || '').trim()
  const masterGasUrl = (import.meta.env.VITE_MASTER_GAS_URL || '').trim()

  let activeUrl = localStorage.getItem('aql_tenant_url')
  let activeTenant = localStorage.getItem('aql_tenant_code')

  if (tParam) {
    const prevTenantCode = activeTenant
    let targetUrl = ''
    let targetName = tParam
    let targetCode = tParam

    if (masterGasUrl) {
      try {
        const response = await axios.post(masterGasUrl, {
          action: 'getTenantUrl',
          tenantCode: tParam
        }, {
          headers: { 'Content-Type': 'text/plain' }
        })

        const resData = response.data || {}
        if (resData.url) {
          targetUrl = resData.url
          targetName = resData.name || tParam
          targetCode = resData.code || tParam
        }
      } catch (err) {
        console.error('[Tenant Resolver] Failed to contact Master Apps Script:', err)
      }
    }

    if (!targetUrl && activeTenant && activeTenant.toUpperCase() === tParam.toUpperCase() && activeUrl) {
      targetUrl = activeUrl
      targetCode = activeTenant
    }

    if (targetUrl) {
      if (prevTenantCode && prevTenantCode.toUpperCase() !== targetCode.toUpperCase()) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('resources')
        localStorage.removeItem('appConfig')
        localStorage.removeItem('appOptions')
      }

      activeUrl = targetUrl
      activeTenant = targetCode

      localStorage.setItem('aql_tenant_url', activeUrl)
      localStorage.setItem('aql_tenant_code', activeTenant)

      let aqlTenants = null
      const rawTenants = localStorage.getItem('aql_tenants')
      if (rawTenants) {
        try {
          const parsed = JSON.parse(rawTenants)
          if (Array.isArray(parsed)) aqlTenants = parsed
        } catch (_) {}
      }

      if (!aqlTenants) {
        aqlTenants = []
        if (prevTenantCode) {
          aqlTenants.push({
            code: prevTenantCode,
            name: prevTenantCode
          })
        }
      }

      const exists = aqlTenants.some(
        t => (t.code || '').trim().toUpperCase() === targetCode.toUpperCase()
      )

      if (!exists) {
        aqlTenants.push({
          code: targetCode,
          name: targetName
        })
      } else {
        const item = aqlTenants.find(
          t => (t.code || '').trim().toUpperCase() === targetCode.toUpperCase()
        )
        if (item && targetName && item.name === item.code && targetName !== item.code) {
          item.name = targetName
        }
      }

      localStorage.setItem('aql_tenants', JSON.stringify(aqlTenants))
    }

    window.history.replaceState({}, document.title, window.location.pathname)
  } else if (activeTenant && !localStorage.getItem('aql_tenants')) {
    localStorage.setItem('aql_tenants', JSON.stringify([{
      code: activeTenant,
      name: activeTenant
    }]))
  }

  const finalBaseUrl = activeUrl || (import.meta.env.VITE_GAS_URL || '').trim()

  if (finalBaseUrl) {
    apiClient.defaults.baseURL = finalBaseUrl
  } else {
    console.warn('[Tenant Resolver] No tenant selected. Please open the app using your tenant link.')
  }

  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = apiClient
})

export { apiClient as api }
