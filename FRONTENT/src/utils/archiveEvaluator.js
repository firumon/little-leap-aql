import { prepareCondition, evaluatePreparedFilter, resolveTokenContext } from 'src/utils/tokenEvaluator'
import { singularize } from 'src/utils/appHelpers'

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

export function prepareArchiveCondition(node, ctx = {}) {
  if (!node || typeof node !== 'object') return null

  if (Array.isArray(node.items)) {
    return {
      type: 'group',
      logic: (node.logic || 'AND').toUpperCase(),
      items: node.items.map((item) => prepareArchiveCondition(item, ctx)).filter(Boolean)
    }
  }

  if (node.relation) {
    return {
      type: 'relation',
      relation: node.relation,
      condition: prepareArchiveCondition(node.condition, ctx)
    }
  }

  if (node.column) {
    return prepareCondition(node, ctx, { strictColumn: false })
  }

  return null
}

export function evaluatePreparedArchiveCondition(prepared, record) {
  if (!prepared) return true
  if (!record) return false

  if (prepared.type === 'group') {
    const items = prepared.items || []
    if (!items.length) return true
    if (prepared.logic === 'OR') {
      return items.some((item) => evaluatePreparedArchiveCondition(item, record))
    }
    return items.every((item) => evaluatePreparedArchiveCondition(item, record))
  }

  if (prepared.type === 'relation') {
    const target = resolveRelationValue(record, prepared.relation)
    if (target === undefined) return false

    if (Array.isArray(target)) {
      if (!target.length) return true
      return target.every((child) => evaluatePreparedArchiveCondition(prepared.condition, child))
    }

    if (target && typeof target === 'object') {
      return evaluatePreparedArchiveCondition(prepared.condition, target)
    }

    return evaluatePreparedArchiveCondition(prepared.condition, {})
  }

  if (prepared.type === 'condition') {
    return evaluatePreparedFilter(prepared, record)
  }

  return true
}

export function evaluateArchiveCondition(condition, record, ctx = null) {
  const context = ctx || resolveTokenContext()
  const prepared = prepareArchiveCondition(condition, context)
  return evaluatePreparedArchiveCondition(prepared, record)
}
