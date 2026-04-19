import { apiClient } from 'src/services/ApiClientService'

export function getGasApiErrorMessage(error) {
  const responseMessage = error?.response?.data?.message
  if (responseMessage) {
    return responseMessage
  }

  if (error?.message) {
    return error.message
  }

  return 'Unable to connect to service'
}

export async function executeGasApi(action, payload = {}, options = {}) {
  const {
    requireAuth = true,
    token = null,
    tokenResolver = () => localStorage.getItem('token')
  } = options

  const authToken = token || tokenResolver()
  if (requireAuth && !authToken) {
    return { success: false, message: 'Not authenticated' }
  }

  const requestBody = {
    action,
    ...(requireAuth ? { token: authToken } : {}),
    ...payload
  }

  try {
    const response = await apiClient.post('', requestBody)
    const data = response?.data
    if (data && typeof data === 'object') {
      return data
    }

    return { success: false, message: 'Invalid service response' }
  } catch (error) {
    return { success: false, message: getGasApiErrorMessage(error) }
  }
}
