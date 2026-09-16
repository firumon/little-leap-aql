import { findResourceConfig } from 'src/composables/resources/useResourceConfig'

const SCOPE_WEIGHTS = {
  master: 1,
  operation: 2,
  accounts: 2.5
}

export function multiplierOf (item) {
  if (!item || item.multiplier === undefined || item.multiplier === null) return 1
  const n = Number(item.multiplier)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, 2)
}

function normalizeVerbWeight (action) {
  if (action === true) return 1
  const clean = String(action || '').trim().replace(/^can(?=[A-Z])/, '')
  const lower = clean.toLowerCase()
  if (lower === 'read' || lower === 'delete') return 1.5
  if (lower === 'update') return 2
  if (lower === 'create' || lower === 'write') return 3
  return 2.5
}

function resolvePermissionWeight (actionOrList) {
  if (Array.isArray(actionOrList)) {
    if (!actionOrList.length) return 0
    return Math.max(...actionOrList.map((a) => normalizeVerbWeight(a)))
  }
  return normalizeVerbWeight(actionOrList)
}

export function scoreDashboardItem (item, auth, ownerResource = '') {
  if (!item) return 0
  const mult = multiplierOf(item)
  if (mult === 0) return 0

  let sumResourceScore = 0
  const p = item.permission

  if (p) {
    if (typeof p === 'string' || Array.isArray(p) || p === true) {
      const resName = ownerResource || item.resource || ''
      const cfg = findResourceConfig(auth, resName)
      if (cfg) {
        if (cfg.parentResource) {
          sumResourceScore += 0.75
        } else {
          const scopeKey = String(cfg.scope || 'master').toLowerCase()
          const scopeWeight = SCOPE_WEIGHTS[scopeKey] || 1
          sumResourceScore += resolvePermissionWeight(p) * scopeWeight
        }
      }
    } else if (typeof p === 'object') {
      for (const [resName, verb] of Object.entries(p)) {
        const cfg = findResourceConfig(auth, resName)
        if (!cfg) continue
        if (cfg.parentResource) {
          sumResourceScore += 0.75
        } else {
          const scopeKey = String(cfg.scope || 'master').toLowerCase()
          const scopeWeight = SCOPE_WEIGHTS[scopeKey] || 1
          sumResourceScore += resolvePermissionWeight(verb) * scopeWeight
        }
      }
    }
  }

  let userScore = 0
  if (item.auth === true) userScore += 3
  if (item.users === true) userScore += 5

  return (sumResourceScore + userScore) * mult
}

