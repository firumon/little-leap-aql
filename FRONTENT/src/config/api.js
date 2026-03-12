const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzGZHwXaCWfj7rm_k9lz8RP8VrTzdXAcjixaA575S_BCz0ucMZZW39wlufzMy9HyswR/exec'

export const GAS_URL = (import.meta.env.VITE_GAS_URL || DEFAULT_GAS_URL).trim()
export const GAS_CONTENT_TYPE = 'text/plain'
