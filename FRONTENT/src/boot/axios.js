import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { apiClient } from 'src/services/ApiClientService'

export default boot(async ({ app }) => {
  // 1. Check if ?t= is present in the current URL
  const urlParams = new URLSearchParams(window.location.search)
  const tParam = (urlParams.get('t') || urlParams.get('tenant') || '').trim()
  const masterGasUrl = (import.meta.env.VITE_MASTER_GAS_URL || '').trim()

  let activeUrl = localStorage.getItem('aql_tenant_url')
  let activeTenant = localStorage.getItem('aql_tenant_code')

  if (tParam) {
    // If the URL parameter matches what is already cached, just clean the URL and use it
    if (activeTenant === tParam && activeUrl) {
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (masterGasUrl) {
      // Otherwise, fetch the new tenant's URL from the Master Apps Script
      try {
        const response = await axios.post(masterGasUrl, {
          action: 'getTenantUrl',
          tenantCode: tParam
        }, {
          headers: { 'Content-Type': 'text/plain' }
        })

        // Expecting a plain text URL string from the Master
        const returnedUrl = typeof response.data === 'string' 
          ? response.data.trim() 
          : response.data?.url

        if (returnedUrl && returnedUrl.startsWith('https://')) {
          activeUrl = returnedUrl
          activeTenant = tParam
          
          // Save to local storage for long-term persistence
          localStorage.setItem('aql_tenant_url', activeUrl)
          localStorage.setItem('aql_tenant_code', activeTenant)
          
          console.log(`[Tenant Resolver] Successfully resolved and cached tenant "${tParam}": ${activeUrl}`)
        } else {
          console.error('[Tenant Resolver] Invalid URL returned from Master Apps Script:', response.data)
        }
      } catch (err) {
        console.error('[Tenant Resolver] Failed to contact Master Apps Script:', err)
      } finally {
        // Always clean the URL parameters to keep the address bar neat
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } else {
      console.error('[Tenant Resolver] VITE_MASTER_GAS_URL is not set in environment variables.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  // 2. Set the API client's base URL (fallback to build-time env URL if nothing is cached)
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
