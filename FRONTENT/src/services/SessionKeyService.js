const GENERATION_STORAGE_KEY = 'sessionGeneration'

const paramsCache = new Map()
const codeCache = new Map()

function deriveParams(token) {
  if (paramsCache.has(token)) return paramsCache.get(token)

  const parts = (token || '').toString().trim().split('-')
  let params = null
  if (parts.length >= 4) {
    const genPrime = parseInt(parts[0], 16)
    const letterShift = parseInt(parts[1], 16)
    const digitShift = parseInt(parts[2], 16)
    const genOffset = parseInt(parts[3], 16)
    if ([genPrime, letterShift, digitShift, genOffset].every(Number.isFinite) && genPrime > 0) {
      params = { genPrime, letterShift, digitShift, genOffset }
    }
  }

  paramsCache.set(token, params)
  return params
}

export function deriveSessionCode(token, letterShift, digitShift) {
  const cacheKey = `${token}|${letterShift}|${digitShift}`
  if (codeCache.has(cacheKey)) return codeCache.get(cacheKey)

  const reversed = (token || '').toString().replace(/-/g, '').toUpperCase().split('').reverse()
  let code = ''
  for (const char of reversed) {
    if (char >= '0' && char <= '9') {
      code += String((Number(char) + digitShift) % 10)
    } else {
      code += String(char.charCodeAt(0) + letterShift)
    }
  }

  codeCache.set(cacheKey, code)
  return code
}

export function resetSessionGeneration() {
  localStorage.setItem(GENERATION_STORAGE_KEY, '1')
}

export function clearSessionGeneration() {
  localStorage.removeItem(GENERATION_STORAGE_KEY)
}

function nextGeneration() {
  const current = Number.parseInt(localStorage.getItem(GENERATION_STORAGE_KEY) || '', 10)
  const generation = Number.isFinite(current) && current > 0 ? current : 1
  localStorage.setItem(GENERATION_STORAGE_KEY, String(generation + 1))
  return generation
}

export function createSessionKey(token) {
  const params = deriveParams(token)
  if (!params) return null

  const uuidCode = deriveSessionCode(token, params.letterShift, params.digitShift)
  const encodedGen = (BigInt(nextGeneration()) * BigInt(params.genPrime)) + BigInt(params.genOffset)
  return (BigInt(uuidCode) + encodedGen).toString()
}

export function buildSessionPayload(basePayload = {}) {
  const token = basePayload.token
  if (!token) return basePayload

  const sessionKey = createSessionKey(token)
  if (!sessionKey) return basePayload

  return { ...basePayload, sessionKey }
}
