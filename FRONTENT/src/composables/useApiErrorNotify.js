import { useQuasar } from 'quasar'

const handledResponses = new WeakSet()

function readApiErrorMessage(result, fallback = 'Request failed') {
  if (!result || typeof result !== 'object') return fallback

  const error = result.error
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim()
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim()
  }

  if (typeof result.message === 'string' && result.message.trim()) return result.message.trim()
  return fallback
}

export function markApiErrorHandled(result) {
  if (result && typeof result === 'object') {
    handledResponses.add(result)
  }
  return result
}

export function wasApiErrorHandled(result) {
  return !!(result && typeof result === 'object' && handledResponses.has(result))
}

export function useApiErrorNotify() {
  const $q = useQuasar()

  function notifyApiError(result, options = {}) {
    if (!result || typeof result !== 'object') return result
    if (!('success' in result) || result.success === true) return result
    if (wasApiErrorHandled(result)) return result

    const message = readApiErrorMessage(result, options.fallbackMessage || 'Request failed')
    $q.notify({
      type: 'negative',
      message,
      position: 'top',
      timeout: options.timeout || 3000
    })
    markApiErrorHandled(result)
    return result
  }

  return {
    notifyApiError,
    markApiErrorHandled,
    wasApiErrorHandled,
    readApiErrorMessage
  }
}
