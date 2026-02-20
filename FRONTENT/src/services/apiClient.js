import axios from 'axios'
import { GAS_CONTENT_TYPE, GAS_URL } from 'src/config/api'

const apiClient = axios.create({
  baseURL: GAS_URL,
  headers: {
    'Content-Type': GAS_CONTENT_TYPE
  }
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)

export { apiClient }
