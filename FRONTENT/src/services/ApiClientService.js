import axios from 'axios'
import { GAS_CONTENT_TYPE, GAS_URL } from 'src/config/api'

/**
 * Ceiling for a single GAS call. Apps Script itself caps an execution at ~6
 * minutes, so anything still open past this is never coming back.
 *
 * Without a timeout a dropped response leaves the request pending forever, and
 * the polling state machine — which restarts its countdown only when a request
 * settles — stays wedged for the rest of the session with nothing to recover it.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 300000

export function createApiClient(config = {}) {
  const client = axios.create({
    baseURL: GAS_URL,
    timeout: DEFAULT_REQUEST_TIMEOUT_MS,
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
