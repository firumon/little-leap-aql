import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useRouteConfig } from './useRouteConfig'

function findResourceConfig(auth, nameOrSlug) {
  if (!nameOrSlug) return null
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  const queryClean = String(nameOrSlug).toLowerCase().trim().replace(/s$/, '')
  return resources.find((r) => {
    const rNameClean = String(r.name || '').toLowerCase().trim().replace(/s$/, '')
    return rNameClean === queryClean
  }) || null
}

function checkSingleAction(resConfig, action) {
  if (!resConfig) return false
  const cleanAction = String(action || '').trim().replace(/^can/, '')
  const actionLower = cleanAction.toLowerCase()

  // Standard CRUD checks
  if (actionLower === 'read') return !!resConfig.permissions?.canRead
  if (actionLower === 'write' || actionLower === 'create') return !!resConfig.permissions?.canWrite
  if (actionLower === 'update') return !!resConfig.permissions?.canUpdate
  if (actionLower === 'delete') return !!resConfig.permissions?.canDelete

  // Dynamic action checks - resolving directly from permissions
  const pascalAction = cleanAction.charAt(0).toUpperCase() + cleanAction.slice(1)
  return !!resConfig.permissions?.[`can${pascalAction}`]
}

function checkActionsList(resConfig, actions) {
  if (!Array.isArray(actions)) return false
  if (!actions.length) return true
  return actions.every((act) => checkSingleAction(resConfig, act))
}

/**
 * Resolves the current resource configuration from route params + auth store.
 * Used by all resource pages (index, view, add, edit, action).
 */
export function useResourceConfig() {
  const {
    scope,
    resourceSlug,
    resourceName,
    code,
    pageName,
    pageSlug,
    level,
    resourceConfig
  } = useRouteConfig()

  const auth = useAuthStore()

  const resourceHeaders = computed(() => {
    const h = resourceConfig.value?.headers
    return Array.isArray(h) ? h : []
  })

  const resolvedFields = computed(() => {
    const uiFields = resourceConfig.value?.ui?.fields
    if (Array.isArray(uiFields) && uiFields.length) {
      return uiFields
    }

    return (resourceHeaders.value || [])
      .filter((header) => !['Code', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(header))
      .map((header) => ({
        header,
        label: header.replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: header === 'Status' ? 'status' : 'text',
        required: false
      }))
  })

  const additionalActions = computed(() => {
    const raw = resourceConfig.value?.additionalActions
    let parsed = []
    if (Array.isArray(raw)) parsed = raw
    else if (typeof raw === 'string' && raw) {
      try { parsed = JSON.parse(raw.trim()) } catch { parsed = [] }
    }
    return parsed.map(normalizeAction).filter(Boolean)
  })

  function normalizeAction(a) {
    if (!a || !a.action) return null
    const base = {
      action: a.action,
      label: a.label || a.action,
      icon: a.icon || '',
      color: a.color || 'primary',
      confirm: !!a.confirm
    }
    const kind = a.kind === 'navigate' ? 'navigate' : 'mutate'
    if (kind === 'navigate') {
      const nav = a.navigate || {}
      return {
        ...base,
        kind,
        navigate: {
          target: nav.target || 'record-page',
          pageSlug: nav.pageSlug || '',
          resourceSlug: nav.resourceSlug || null,
          scope: nav.scope || null
        },
        visibleWhen: normalizeVisibleWhen(a.visibleWhen)
      }
    }
    const m = a.mutate || {}
    const mutateBase = {
      ...base,
      kind,
      column: m.column || a.column || 'Progress',
      columnValue: m.columnValue || a.columnValue || '',
      columnValueOptions: Array.isArray(m.columnValueOptions)
        ? m.columnValueOptions
        : (Array.isArray(a.columnValueOptions) ? a.columnValueOptions : []),
      fields: Array.isArray(m.fields)
        ? m.fields
        : (Array.isArray(a.fields) ? a.fields : [])
    }
    mutateBase.visibleWhen = normalizeVisibleWhen(a.visibleWhen)
    return mutateBase
  }

  function normalizeVisibleWhen(v) {
    if (v == null) return []
    const arr = Array.isArray(v) ? v : [v]
    const validOps = new Set(['eq', 'ne', 'in', 'nin', 'empty', 'notEmpty'])
    return arr
      .map((c) => {
        if (!c || typeof c !== 'object' || !c.column) return null
        const op = validOps.has(c.op) ? c.op : null
        if (!op) return null
        return { column: c.column, op, value: c.value }
      })
      .filter(Boolean)
  }

  const permissions = computed(() => resourceConfig.value?.permissions || {})

  const allowed = (query, targetResourceName) => {
    if (!query) return false

    // 1. Multi-Resource Map (Object Query)
    if (typeof query === 'object' && !Array.isArray(query)) {
      return Object.entries(query).every(([resName, actQuery]) => {
        const resConfig = findResourceConfig(auth, resName)
        if (!resConfig) return false
        if (Array.isArray(actQuery)) {
          return checkActionsList(resConfig, actQuery)
        }
        return checkSingleAction(resConfig, actQuery)
      })
    }

    // Determine target resource config
    const resConfig = targetResourceName ? findResourceConfig(auth, targetResourceName) : resourceConfig.value
    if (!resConfig) return false

    // 2. Array of actions on a single resource
    if (Array.isArray(query)) {
      return checkActionsList(resConfig, query)
    }

    // 3. Single action on a single resource
    return checkSingleAction(resConfig, query)
  }

  return {
    scope,
    resourceSlug,
    resourceName,
    code,
    pageName,
    pageSlug,
    level,
    resourceConfig,
    resourceHeaders,
    resolvedFields,
    additionalActions,
    permissions,
    allowed
  }
}

export function isActionVisible(action, record) {
  const conds = Array.isArray(action?.visibleWhen) ? action.visibleWhen : []
  if (!conds.length) return true
  if (!record || typeof record !== 'object') return true
  return conds.every((c) => evalCondition(c, record))
}

function evalCondition(c, record) {
  const cell = record[c.column]
  const isEmpty = cell == null || cell === ''
  switch (c.op) {
    case 'eq': return String(cell ?? '') === String(c.value ?? '')
    case 'ne': return String(cell ?? '') !== String(c.value ?? '')
    case 'in': {
      const arr = Array.isArray(c.value) ? c.value : [c.value]
      return arr.map(String).includes(String(cell ?? ''))
    }
    case 'nin': {
      const arr = Array.isArray(c.value) ? c.value : [c.value]
      return !arr.map(String).includes(String(cell ?? ''))
    }
    case 'empty': return isEmpty
    case 'notEmpty': return !isEmpty
    default: return true
  }
}
