import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { apiClient } from 'src/services/apiClient'

export default boot(({ app }) => {
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = apiClient
})

export { apiClient as api }
