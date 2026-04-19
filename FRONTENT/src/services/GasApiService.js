import { apiClient } from 'src/services/ApiClientService'
import { createLogger, standardizeResponse } from './_logger'

const logger = createLogger('GasApiService')

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
    logger.warn('GAS API call without auth', { action })
    return standardizeResponse(false, null, 'Not authenticated')
  }

  const requestBody = {
    action,
    ...(requireAuth ? { token: authToken } : {}),
    ...payload
  }

  try {
    logger.debug('Calling GAS API', { action })
    const response = await apiClient.post('', requestBody)
    const data = response?.data

    if (data && typeof data === 'object') {
      // Ensure response has standardized format
      const result = {
        success: data.success !== false,
        data: data.data || data,
        error: data.error || null,
        message: data.message || (data.success !== false ? '' : 'API call failed')
      }
      logger.debug('GAS API success', { action, success: result.success })
      return result
    }

    logger.error('Invalid GAS API response', { action, response: data })
    return standardizeResponse(false, null, 'Invalid service response')
  } catch (error) {
    const errorMsg = getGasApiErrorMessage(error)
    logger.error('GAS API error', { action, error: errorMsg })
    return standardizeResponse(false, null, errorMsg)
  }
}
