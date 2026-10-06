import { singularize, pluralize } from 'src/utils/appHelpers'
import { prepareFilter, evaluatePreparedFilter } from 'src/utils/tokenEvaluator'

export function appOptionGroupFor (optionsMap = {}, resourceName = '', header = '') {
  const name = String(resourceName || '').trim()
  const column = String(header || '').trim()
  if (!name || !column) return []

  const colVariants = new Set([column, singularize(column), pluralize(column)])
  for (const variant of new Set([name, singularize(name), pluralize(name)])) {
    for (const col of colVariants) {
      const group = optionsMap[`${variant}${col}`]
      if (Array.isArray(group) && group.length) {
        return group.map((value) => ({ label: String(value), value }))
      }
    }
  }
  return []
}

function getAppOptions (field, resourceName, authStore) {
  const map = authStore?.appOptionsMap || {}
  if (field.appOptionGroup && Array.isArray(map[field.appOptionGroup])) {
    return map[field.appOptionGroup].map((v) => ({ label: String(v), value: v }))
  }
  return appOptionGroupFor(map, resourceName, field.header)
}

function getExistingOptions (field, resourceName, dataStore) {
  const records = dataStore?.getRecords?.(resourceName) || []
  const seen = new Set()
  const options = []
  for (const r of records) {
    const raw = r[field.header]
    const val = raw != null ? String(raw).trim() : ''
    if (val && !seen.has(val.toLowerCase())) {
      seen.add(val.toLowerCase())
      options.push({ label: val, value: val })
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label))
  return options
}

export function resolveDynamicFieldOptions (field, { resourceName, dataStore, authStore } = {}) {
  if (!field || !field.source) return null

  const source = field.source
  const raw = typeof source === 'string' ? source.trim() : ''
  const lower = raw.toLowerCase()

  if (lower === 'existing' || lower === 'own') {
    return getExistingOptions(field, resourceName, dataStore)
  }

  if (lower === 'appoption' || lower === 'appoptions') {
    return getAppOptions(field, resourceName, authStore)
  }

  if (
    lower === 'appoption & existing' ||
    lower === 'existing & appoption' ||
    lower === 'appoption + existing' ||
    lower === 'existing + appoption' ||
    lower === 'appoptions & existing' ||
    lower === 'existing & appoptions' ||
    lower === 'appoptions+own' ||
    lower === 'own+appoptions'
  ) {
    const base = getAppOptions(field, resourceName, authStore)
    const seen = new Set(base.map((o) => String(o.value ?? '').trim().toLowerCase()).filter(Boolean))
    const merged = [...base]

    const existing = getExistingOptions(field, resourceName, dataStore)
    for (const opt of existing) {
      const key = String(opt.value ?? '').trim().toLowerCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        merged.push(opt)
      }
    }
    return merged
  }

  const isObj = typeof source === 'object' && source !== null
  const targetResource = isObj ? (source.resource || source.name) : source
  if (targetResource && typeof targetResource === 'string') {
    const records = dataStore?.getRecords?.(targetResource) || []
    const valCol = (isObj ? source.value : null) || field.sourceValue || 'Code'
    const labelCol = (isObj ? source.label : null) || field.sourceLabel || valCol
    const filterRule = (isObj ? source.filter : null) || field.sourceFilter

    let filtered = records
    if (filterRule) {
      let filterTree = null
      if (Array.isArray(filterRule)) {
        filterTree = {
          type: 'group',
          logic: 'and',
          items: filterRule.map((c) => ({
            type: 'condition',
            column: c.column || c.field,
            operator: c.op || c.operator || 'eq',
            value: c.value
          }))
        }
      } else if (typeof filterRule === 'object') {
        if (filterRule.column || filterRule.field) {
          filterTree = {
            type: 'condition',
            column: filterRule.column || filterRule.field,
            operator: filterRule.op || filterRule.operator || 'eq',
            value: filterRule.value
          }
        } else {
          const items = Object.entries(filterRule).map(([col, val]) => {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              return {
                type: 'condition',
                column: col,
                operator: val.op || val.operator || 'eq',
                value: val.value
              }
            }
            return {
              type: 'condition',
              column: col,
              operator: 'eq',
              value: val
            }
          })
          filterTree = { type: 'group', logic: 'and', items }
        }
      }

      if (filterTree) {
        const prepared = prepareFilter(filterTree, { user: authStore?.user }, { strictColumn: false })
        filtered = records.filter((row) => evaluatePreparedFilter(prepared, row))
      }
    }

    const seen = new Set()
    const options = []
    for (const r of filtered) {
      const val = r[valCol]
      if (val === undefined || val === null || val === '') continue
      const strVal = String(val).trim()
      if (seen.has(strVal.toLowerCase())) continue
      seen.add(strVal.toLowerCase())

      const rawLabel = r[labelCol]
      const strLabel = rawLabel != null ? String(rawLabel).trim() : ''
      const lbl = (labelCol === valCol || !strLabel || strLabel === strVal)
        ? strVal
        : `${strLabel} (${strVal})`

      options.push({ label: lbl, value: val })
    }
    return options
  }

  return null
}
