/**
 * Service Logger — environment-controlled debug logging
 * Usage: const logger = createLogger('ServiceName')
 *        logger.debug('message') — only logs if VITE_ENABLE_LOGS=true
 */

function resolveEnvFlag(value) {
  return value === true || value === 'true' || value === '1'
}

function shouldLog() {
  const processFlag = typeof process !== 'undefined'
    ? process?.env?.ENABLE_LOGS
    : undefined

  const viteFlag = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? (import.meta.env.ENABLE_LOGS ?? import.meta.env.VITE_ENABLE_LOGS)
    : undefined

  return resolveEnvFlag(processFlag) || resolveEnvFlag(viteFlag)
}

function formatLogData(data) {
  if (!data) return ''

  try {
    return ` | ${JSON.stringify(data)}`
  } catch {
    return ' | [unserializable-data]'
  }
}

export function createLogger(serviceName) {
  return {
    debug: (msg, data) => {
      if (shouldLog()) {
        const logData = formatLogData(data)
        console.log(`[${serviceName}:DEBUG] ${msg}${logData}`)
      }
    },
    info: (msg, data) => {
      if (shouldLog()) {
        const logData = formatLogData(data)
        console.log(`[${serviceName}:INFO] ${msg}${logData}`)
      }
    },
    warn: (msg, data) => {
      if (shouldLog()) {
        const logData = formatLogData(data)
        console.warn(`[${serviceName}:WARN] ${msg}${logData}`)
      }
    },
    error: (msg, data) => {
      if (shouldLog()) {
        const logData = formatLogData(data)
        console.error(`[${serviceName}:ERROR] ${msg}${logData}`)
      }
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
  isEnabled: () => shouldLog()
}

