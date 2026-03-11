import { apiClient } from 'src/services/apiClient'
import { Notify, Loading } from 'quasar'

function getErrorMessage(error) {
  const responseMessage = error?.response?.data?.message
  if (responseMessage) {
    return responseMessage
  }

  if (error?.message) {
    return error.message
  }

  return 'Unable to connect to service'
}

export async function callGasApi(action, payload = {}, options = {}) {
  const { 
    requireAuth = true, 
    token = null,
    showLoading = false,
    loadingMessage = 'Processing...',
    successMessage = null,
    showError = true
  } = options

  if (showLoading) {
    Loading.show({ message: loadingMessage })
  }

  const authToken = token || localStorage.getItem('token')

  if (requireAuth && !authToken) {
    if (showLoading) Loading.hide()
    const msg = 'Not authenticated'
    if (showError) Notify.create({ type: 'negative', message: msg })
    return { success: false, message: msg }
  }

  const requestBody = {
    action,
    ...(requireAuth ? { token: authToken } : {}),
    ...payload
  }

  try {
    const response = await apiClient.post('', requestBody)
    const data = response?.data

    if (showLoading) Loading.hide()

    if (data && typeof data === 'object') {
      if (!data.success && showError) {
        Notify.create({ type: 'negative', message: data.message || 'Action failed' })
      } else if (data.success && successMessage) {
        Notify.create({ type: 'positive', message: successMessage })
      }
      return data
    }

    if (showError) Notify.create({ type: 'negative', message: 'Invalid service response' })
    return { success: false, message: 'Invalid service response' }
  } catch (error) {
    if (showLoading) Loading.hide()
    const msg = getErrorMessage(error)
    if (showError) Notify.create({ type: 'negative', message: msg })
    return { success: false, message: msg }
  }
}
