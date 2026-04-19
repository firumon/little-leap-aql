import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

/**
 * Resolves the current resource configuration from route params + auth store.
 * Used by all resource pages (list, view, add, edit, action).
 */
export function useResourceConfig() {
  const route = useRoute()
  const auth = useAuthStore()

  const resourceSlug = computed(() => route.params.resourceSlug || '')
  const scope = computed(() => route.params.scope || 'masters')
  const code = computed(() => route.params.code || '')
  const action = computed(() => route.meta?.action || route.params.action || 'list')
  const level = computed(() => route.meta?.level || 'resource')

  const config = computed(() => {
    const resources = Array.isArray(auth.resources) ? auth.resources : []

    // Match by route path (most reliable)
    const currentPath = `/${scope.value}/${resourceSlug.value}`
    const byRoutePath = resources.find((entry) => {
      const menus = Array.isArray(entry?.ui?.menus) ? entry.ui.menus : []
      return menus.some(m => m.route === currentPath)
    })
    if (byRoutePath) return byRoutePath

    // Fallback: match by resource name derived from slug
    const slugLower = resourceSlug.value.toLowerCase().replace(/-/g, '')
    return resources.find((entry) => {
      const name = (entry?.name || '').toLowerCase()
      return name === slugLower || name === slugLower + 's' || name.replace(/s$/, '') === slugLower.replace(/s$/, '')
    }) || null
  })

  const resourceName = computed(() => config.value?.name || '')
  const customUIName = computed(() => config.value?.ui?.customUIName || '')

  const resourceHeaders = computed(() => {
    const h = config.value?.headers
    return Array.isArray(h) ? h : []
  })

  const resolvedFields = computed(() => {
    const uiFields = config.value?.ui?.fields
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
    const raw = config.value?.additionalActions
    let parsed = []
    if (Array.isArray(raw)) parsed = raw
    else if (typeof raw === 'string' && raw) {
      try { parsed = JSON.parse(raw.trim()) } catch { parsed = [] }
    }
    return parsed.map(normalizeAction).filter(Boolean)
  })

  /**
   * Normalizes an action entry so every consumer sees a consistent shape:
   *   { action, label, icon, color, confirm, kind, ...mutateFields?, navigate? }
   * - Legacy rows without `kind` are treated as `kind: 'mutate'`.
   * - For 'mutate' kind, column/columnValue/columnValueOptions/fields stay flat
   *   to preserve existing consumer code (useActionFields, deriveActionStampHeaders).
   * - For 'navigate' kind, `navigate` holds { target, pageSlug, resourceSlug?, scope? }.
   */
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
        }
      }
    }
    // mutate — lift nested mutate{} or keep legacy flat fields
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

  /**
   * Normalize visibleWhen to an array of {column, op, value}.
   * Absent / null / [] → [] (treated as always visible by isActionVisible).
   * Accepts single object or array of conditions.
   */
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

  const permissions = computed(() => config.value?.permissions || {})

  return {
    route,
    scope,
    resourceSlug,
    code,
    action,
    level,
    config,
    resourceName,
    customUIName,
    resourceHeaders,
    resolvedFields,
    additionalActions,
    permissions
  }
}

/**
 * Evaluate whether an action is visible for a given record.
 * - No visibleWhen → visible
 * - All conditions must pass (AND)
 * - Null/undefined/"" treated equal for empty/notEmpty
 */
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
