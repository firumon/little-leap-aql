/**
 * Service Logger — environment-controlled debug logging
 * Usage: const logger = createLogger('ServiceName')
 *        logger.debug('message') — only logs if VITE_ENABLE_LOGS=true
 */

function shouldLog(level = 'debug') {
  if (typeof import.meta.env === 'undefined') return false
  const enableLogs = import.meta.env.VITE_ENABLE_LOGS === 'true' ||
                     import.meta.env.VITE_ENABLE_LOGS === '1'
  return enableLogs
}

export function createLogger(serviceName) {
  return {
    debug: (msg, data) => {
      if (shouldLog('debug')) {
        const logData = data ? ` | ${JSON.stringify(data)}` : ''
        console.log(`[${serviceName}:DEBUG] ${msg}${logData}`)
      }
    },
    info: (msg, data) => {
      if (shouldLog('info')) {
        const logData = data ? ` | ${JSON.stringify(data)}` : ''
        console.log(`[${serviceName}:INFO] ${msg}${logData}`)
      }
    },
    warn: (msg, data) => {
      const logData = data ? ` | ${JSON.stringify(data)}` : ''
      console.warn(`[${serviceName}:WARN] ${msg}${logData}`)
    },
    error: (msg, data) => {
      const logData = data ? ` | ${JSON.stringify(data)}` : ''
      console.error(`[${serviceName}:ERROR] ${msg}${logData}`)
    }
  }
}

export function standardizeResponse(success, data = null, error = null) {
  return {
    success: !!success,
    data: success ? data : null,
    error: !success ? (error || 'Unknown error') : null,
    timestamp: Date.now()
  }
}

export const logger = {
  system: createLogger('AQL-System'),
  isEnabled: () => shouldLog('debug')
}

