import { prepareCondition, evaluatePreparedFilter, resolveTokenContext } from 'src/utils/tokenEvaluator'
import { singularize, pluralize } from 'src/utils/appHelpers'

function resolveResourceNameFromDataStore(dataStore, name) {
  if (!dataStore || !name) return name
  const hdrs = dataStore.headers || {}
  if (hdrs[name]) return name

  const lower = name.toLowerCase()
  for (const res in hdrs) {
    if (res.toLowerCase() === lower) return res
    if (singularize(res).toLowerCase() === lower) return res
    if (pluralize(res).toLowerCase() === lower) return res
  }
  return name
}

function resolveRelationValue(record, relationName) {
  if (!record || !relationName) return undefined
  const clean = relationName.replace(/^\$/, '')
  const lower = clean.toLowerCase()
  const sing = singularize(clean).toLowerCase()

  const candidates = [
    '$' + clean,
    '$' + lower,
    '$' + sing,
    '$' + clean + 's',
    '$' + lower + 's'
  ]

  for (const key of candidates) {
    if (key in record || record[key] !== undefined) {
      return record[key]
    }
  }

  return undefined
}

async function resolveRelationPathRecords(rootRecord, relationPath, evalContext = {}) {
  if (!rootRecord || !relationPath) return []

  const segments = relationPath.split('.').map((s) => s.trim()).filter(Boolean)
  if (!segments.length) return [rootRecord]

  const { dataStore, recordApi } = evalContext
  let currentRecords = [rootRecord]

  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s]
    const nextRecords = []

    if (dataStore && typeof dataStore.seedResourceFromCache === 'function') {
      const normRes = resolveResourceNameFromDataStore(dataStore, segment)
      if (normRes && !dataStore.hasRows(normRes)) {
        await dataStore.seedResourceFromCache(normRes).catch(() => {})
      }
    }

    for (let i = 0; i < currentRecords.length; i++) {
      const rec = currentRecords[i]
      if (!rec) continue

      let resolved = resolveRelationValue(rec, segment)
      if (resolved === undefined || resolved === null) {
        if (recordApi && rec.Code) {
          const recRes = rec._resource || evalContext.resourceName
          if (recRes) {
            const enriched = recordApi.enrich(recRes, rec.Code)
            resolved = resolveRelationValue(enriched, segment)
          }
        }
      }

      if (resolved === undefined || resolved === null) continue

      if (Array.isArray(resolved)) {
        for (let j = 0; j < resolved.length; j++) {
          if (resolved[j]) nextRecords.push(resolved[j])
        }
      } else if (typeof resolved === 'object') {
        nextRecords.push(resolved)
      }
    }

    currentRecords = nextRecords
    if (!currentRecords.length) break
  }

  return currentRecords
}

export function prepareArchiveCondition(node, ctx = {}) {
  if (!node || typeof node !== 'object') return null

  if (Array.isArray(node.items)) {
    return {
      type: 'group',
      logic: (node.logic || 'AND').toUpperCase(),
      items: node.items.map((item) => prepareArchiveCondition(item, ctx)).filter(Boolean)
    }
  }

  if (node.relation && node.condition && typeof node.condition === 'object' && !node.column) {
    const sub = prepareArchiveCondition(node.condition, ctx)
    if (!sub) return null
    if (sub.type === 'condition') {
      sub.relation = node.relation + (sub.relation ? '.' + sub.relation : '')
      return sub
    }
    return {
      type: 'relation',
      relation: node.relation,
      condition: sub
    }
  }

  if (node.column) {
    const prepared = prepareCondition(node, ctx, { strictColumn: false })
    if (!prepared) return null
    return {
      type: 'condition',
      relation: (node.relation || '').toString().trim(),
      ...prepared
    }
  }

  return null
}

export async function evaluatePreparedArchiveCondition(prepared, record, evalContext = {}) {
  if (!prepared) return true
  if (!record) return false

  if (prepared.type === 'group') {
    const items = prepared.items || []
    if (!items.length) return true

    if (prepared.logic === 'OR') {
      for (let i = 0; i < items.length; i++) {
        const matches = await evaluatePreparedArchiveCondition(items[i], record, evalContext)
        if (matches) return true
      }
      return false
    }

    for (let i = 0; i < items.length; i++) {
      const matches = await evaluatePreparedArchiveCondition(items[i], record, evalContext)
      if (!matches) return false
    }
    return true
  }

  if (prepared.type === 'condition') {
    const relationPath = prepared.relation
    if (!relationPath) {
      return evaluatePreparedFilter(prepared, record)
    }

    const targets = await resolveRelationPathRecords(record, relationPath, evalContext)
    if (!targets || !targets.length) {
      return prepared.operator === 'empty'
    }

    for (let i = 0; i < targets.length; i++) {
      if (!evaluatePreparedFilter(prepared, targets[i])) {
        return false
      }
    }
    return true
  }

  if (prepared.type === 'relation') {
    const targets = await resolveRelationPathRecords(record, prepared.relation, evalContext)
    if (!targets || !targets.length) return false
    for (let i = 0; i < targets.length; i++) {
      const matches = await evaluatePreparedArchiveCondition(prepared.condition, targets[i], evalContext)
      if (!matches) return false
    }
    return true
  }

  return true
}

export async function evaluateArchiveCondition(condition, record, ctx = null, evalContext = {}) {
  const context = ctx || resolveTokenContext()
  const prepared = prepareArchiveCondition(condition, context)
  return evaluatePreparedArchiveCondition(prepared, record, evalContext)
}
