export const GAS_URL = (import.meta.env.VITE_GAS_URL || '').trim()
export const GAS_CONTENT_TYPE = 'text/plain'

if (!GAS_URL) {
  throw new Error('Missing VITE_GAS_URL. Set it in FRONTENT/.env before running or building.')
}
