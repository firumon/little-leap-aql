import axios from 'axios'
import { GAS_CONTENT_TYPE, GAS_URL } from 'src/config/api'

export function createApiClient(config = {}) {
  const client = axios.create({
    baseURL: GAS_URL,
    headers: {
      'Content-Type': GAS_CONTENT_TYPE
    },
    ...config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
  )

  return client
}

export const apiClient = createApiClient()
