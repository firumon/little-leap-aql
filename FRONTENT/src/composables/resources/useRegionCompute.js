import { findResourceConfig } from './useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from './useRecord'

function normalizeCode (val) {
  return String(val ?? '').trim().toUpperCase()
}

export function computeRegion (resourceName, recordData) {
  if (!resourceName || !recordData || typeof recordData !== 'object') return null

  const config = findResourceConfig(resourceName)
  const rule = config?.accessRegionSource
  const { user } = useAuth()
  const accessRegion = user.value?.accessRegion
  const userRegion = accessRegion?.code ? normalizeCode(accessRegion.code) : ''
  const nameToCode = accessRegion?.regionNames || {}

  const self = rule?.self
  const selfCol = self?.column || 'AccessRegion'
  const rawSelfVal = String(recordData[selfCol] ?? '').trim()

  if (rawSelfVal) {
    if (self?.resolve === true) {
      const resolved = nameToCode[rawSelfVal.toLowerCase()]
      return resolved ? normalizeCode(resolved) : null
    }
    return normalizeCode(rawSelfVal)
  }

  const subjects = Array.isArray(rule?.subject) ? rule.subject : []
  if (!subjects.length) {
    return userRegion || null
  }

  const recordSource = useRecord()
  let reserve = ''
  let i = 0

  while (i < subjects.length) {
    const entry = subjects[i]
    if (!entry) {
      i++
      continue
    }

    if (entry.user === true) {
      return userRegion || null
    }

    const colName = String(entry.column || '').trim()
    const cellVal = String(recordData[colName] ?? '').trim()

    if (!cellVal) {
      if (entry.empty === 'next') {
        i++
        continue
      }
      break
    }

    let targetResourceName = String(entry.resource || '').trim()
    if (!targetResourceName && config?.relations) {
      const rel = config.relations[colName]
      if (typeof rel === 'string') {
        targetResourceName = rel.trim()
      } else if (rel && typeof rel === 'object' && rel.resource) {
        targetResourceName = String(rel.resource || '').trim()
      }
    }

    let successCode = ''
    if (targetResourceName) {
      const subjectRow = recordSource.recordBy(targetResourceName, 'Code', cellVal)
      if (subjectRow) {
        const targetConfig = findResourceConfig(targetResourceName)
        const targetSelf = targetConfig?.accessRegionSource?.self
        const targetSelfCol = targetSelf?.column || 'AccessRegion'
        const rawTargetVal = String(subjectRow[targetSelfCol] ?? '').trim()

        if (rawTargetVal) {
          if (targetSelf?.resolve === true) {
            const mapped = nameToCode[rawTargetVal.toLowerCase()]
            if (mapped) successCode = normalizeCode(mapped)
          } else {
            const norm = normalizeCode(rawTargetVal)
            if (norm) successCode = norm
          }
        }
      }
    }

    if (successCode) {
      return successCode
    }

    if (entry.fail === 'user') {
      reserve = userRegion
      i++
    } else if (typeof entry.fail === 'string' && entry.fail !== '') {
      let jumpIndex = -1
      for (let j = 0; j < subjects.length; j++) {
        if (subjects[j]?.column === entry.fail) {
          jumpIndex = j
          break
        }
      }
      if (jumpIndex !== -1) {
        i = jumpIndex
      } else {
        i++
      }
    } else {
      i++
    }
  }

  return reserve || null
}

export function useRegionCompute () {
  return { computeRegion }
}
