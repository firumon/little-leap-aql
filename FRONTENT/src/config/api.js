export const GAS_URL = (import.meta.env.VITE_GAS_URL || '').trim()
export const GAS_CONTENT_TYPE = 'text/plain'

if (!GAS_URL && import.meta.env.DEV) {
  console.warn('VITE_GAS_URL is not set in environment variables. Falling back to dynamic tenant config.')
}
