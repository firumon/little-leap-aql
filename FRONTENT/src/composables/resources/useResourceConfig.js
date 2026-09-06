import { computed, unref } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useRouteConfig } from './useRouteConfig'
import {
  OPERATORS,
  normalizeOperator,
  evaluateFilter,
  resolveTokenContext
} from 'src/utils/tokenEvaluator'
import { singularize, pluralize } from 'src/utils/appHelpers'

// Both spellings a name can take. Stripping one trailing `s` (as this used to) never
// matched an `-ies` resource: `outletDelivery` vs `outletdeliverie`.
const nameForms = (value) => {
  const lower = String(value || '').toLowerCase().trim()
  const singular = singularize(lower)
  return new Set([lower, singular, pluralize(singular)])
}

export function findResourceConfig(auth, nameOrSlug) {
  if (!nameOrSlug) return null
  const resources = Array.isArray(auth.resources) ? auth.resources : []
  const queryForms = nameForms(nameOrSlug)
  return resources.find((r) => {
    for (const form of nameForms(r.name)) {
      if (queryForms.has(form)) return true
    }
    return false
  }) || null
}

function checkSingleAction(resConfig, action) {
  if (!resConfig) return false
  // `(?=[A-Z])` matters: the prefix is only stripped from the `canCancel` FORM. A bare
  // action name that merely starts with the letters "can" must survive intact —
  // `'cancel'` was being cut to `'cel'` and checked as `canCel`, so every `cancel`
  // permission in the app failed closed no matter what the role granted.
  const cleanAction = String(action || '').trim().replace(/^can(?=[A-Z])/, '')
  const actionLower = cleanAction.toLowerCase()

  // Standard CRUD checks
  if (actionLower === 'read') return !!resConfig.permissions?.canRead
  if (actionLower === 'write' || actionLower === 'create') return !!resConfig.permissions?.canWrite
  if (actionLower === 'update') return !!resConfig.permissions?.canUpdate
  if (actionLower === 'delete') return !!resConfig.permissions?.canDelete

  // Dynamic action checks - resolving directly from permissions.
  // A workflow action (Approve, MarkDelivered, Reallocate) is only a column in the
  // permissions sheet when someone added one. With no column at all the flag is
  // `undefined`, not `false` — so fall back to update/write instead of failing closed
  // and blocking a user the sheet never meant to block.
  const pascalAction = cleanAction.charAt(0).toUpperCase() + cleanAction.slice(1)
  const flag = resConfig.permissions?.[`can${pascalAction}`]
  if (flag !== undefined && flag !== null && flag !== '') return !!flag
  return !!(resConfig.permissions?.canUpdate || resConfig.permissions?.canWrite)
}

function checkActionsList(resConfig, actions) {
  if (!Array.isArray(actions)) return false
  if (!actions.length) return true
  return actions.every((act) => checkSingleAction(resConfig, act))
}

// ─── Declarative permission rules ─────────────────────────────────────────────
//
// Grammar (one rule per string):
//   'update'                 -> action on the active resource
//   'OutletRestocks:create'  -> action on a named resource
//
// Record-scoped rules ('Resource:action:$Field') are NOT implemented yet. A third
// segment is ignored, never enforced, so do not write one expecting it to gate.

export function parsePermissionRule (rule) {
  const raw = String(rule || '').trim()
  if (!raw) return null
  const [first, second] = raw.split(':').map((part) => part.trim())
  if (!second) return { resource: '', action: first }
  return { resource: first, action: second }
}

// The rules NOT granted, as `[{ rule, resource, action }]`. Reactive when read
// inside a computed: it tracks the auth store and the config it is given.
export function explainMissingRules (rules, context = {}) {
  const list = Array.isArray(rules) ? rules : (rules ? [rules] : [])
  if (!list.length) return []

  const auth = useAuthStore()
  const gaps = []

  for (const rule of list) {
    const parsed = parsePermissionRule(rule)
    if (!parsed || !parsed.action) continue

    const resConfig = parsed.resource
      ? findResourceConfig(auth, parsed.resource)
      : (unref(context.config) || null)

    if (!resConfig || !checkSingleAction(resConfig, parsed.action)) {
      gaps.push({
        rule: String(rule),
        resource: resConfig?.name || parsed.resource || '(active)',
        action: parsed.action
      })
    }
  }

  return gaps
}

export function evalPermissionRules (rules, context = {}) {
  return explainMissingRules(rules, context).length === 0
}


/**
 * Resolves the current resource configuration from route params + auth store.
 * Used by all resource pages (index, view, add, edit, action).
 */
export function useResourceConfig(resourceNameOverride) {
  const auth = useAuthStore()

  // Decided ONCE from the raw argument, not its unwrapped value: useRouteConfig()
  // calls inject() and must run synchronously inside setup().
  const hasOverride = !!resourceNameOverride
  const routeCfg = hasOverride ? null : useRouteConfig()

  const overrideName = computed(() => {
    if (!hasOverride) return ''
    return typeof resourceNameOverride === 'function'
      ? resourceNameOverride()
      : unref(resourceNameOverride)
  })

  const activeConfig = computed(() => {
    if (hasOverride) {
      return findResourceConfig(auth, overrideName.value)
    }
    return routeCfg.resourceConfig.value
  })

  const scope = computed(() => hasOverride ? (activeConfig.value?.scope || 'master') : routeCfg.scope.value)
  const resourceSlug = computed(() => hasOverride ? (activeConfig.value?.slug || '') : routeCfg.resourceSlug.value)
  const resourceName = computed(() => activeConfig.value?.name || '')

  const customUIName = computed(() => activeConfig.value?.ui?.customUIName || 'AQL')

  const resourceHeaders = computed(() => {
    const h = activeConfig.value?.headers
    return Array.isArray(h) ? h : []
  })

  const resolvedFields = computed(() => {
    const uiFields = activeConfig.value?.ui?.fields
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

  const additionalActions = computed(() =>
    normalizeAdditionalActions(activeConfig.value?.additionalActions)
  )

  const permissions = computed(() => activeConfig.value?.permissions || {})

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

    const resConfig = targetResourceName ? findResourceConfig(auth, targetResourceName) : activeConfig.value
    if (!resConfig) return false

    // 2. Array of actions on a single resource
    if (Array.isArray(query)) {
      return checkActionsList(resConfig, query)
    }

    // 3. Single action on a single resource
    return checkSingleAction(resConfig, query)
  }

  const missing = (query, targetResourceName) => {
    if (!query) return [{ resource: targetResourceName || resourceName.value || '(unknown)', action: '*' }]

    if (typeof query === 'object' && !Array.isArray(query)) {
      const gaps = []
      for (const [resName, actQuery] of Object.entries(query)) {
        const resConfig = findResourceConfig(auth, resName)
        if (!resConfig) {
          gaps.push({ resource: resName, action: '*' })
          continue
        }
        const actions = Array.isArray(actQuery) ? actQuery : [actQuery]
        for (const act of actions) {
          if (!checkSingleAction(resConfig, act)) gaps.push({ resource: resName, action: String(act) })
        }
      }
      return gaps
    }

    const name = targetResourceName || resourceName.value || '(unknown)'
    const resConfig = targetResourceName ? findResourceConfig(auth, targetResourceName) : activeConfig.value
    if (!resConfig) return [{ resource: name, action: '*' }]

    const actions = Array.isArray(query) ? query : [query]
    return actions
      .filter((act) => !checkSingleAction(resConfig, act))
      .map((act) => ({ resource: resConfig.name || name, action: String(act) }))
  }

  const requiredHeaders = computed(() => {
    const raw = activeConfig.value?.requiredHeaders || ''
    return raw ? raw.split(',').map(h => h.trim()).filter(Boolean) : []
  })

  // APP.Resources.DefaultValues — backend-authored seed values for this resource.
  const defaultValues = computed(() => activeConfig.value?.defaultValues || {})

  return {
    config: activeConfig,
    scope,
    resourceSlug,
    resourceName,
    customUIName,
    resourceHeaders,
    resolvedFields,
    requiredHeaders,
    defaultValues,
    additionalActions,
    permissions,
    allowed,
    missing,
    evalRules: (rules, context = {}) =>
      evalPermissionRules(rules, { config: activeConfig, ...context }),
    missingRules: (rules, context = {}) =>
      explainMissingRules(rules, { config: activeConfig, ...context })
  }
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// A plain SHEET ROW for one resource: the backend's default values, then the caller's,
// with every key the sheet does not have dropped. `_action` survives because build()
// reads it off the row and strips it itself.
export function resourceRow (resource, ...sources) {
  const { resourceHeaders, defaultValues } = useResourceConfig(resource)
  const merged = Object.assign({}, defaultValues?.value || {},
    ...sources.map((source) => (isPlainObject(source) ? source : {})))

  const headers = resourceHeaders?.value || []
  // No headers means the config has not landed yet. Dropping every key would silently
  // empty the row, so an unknown schema keeps what it was given.
  if (!headers.length) return merged

  const allowed = new Set([...headers, '_action'])
  return Object.keys(merged).reduce((row, key) => {
    if (allowed.has(key)) row[key] = merged[key]
    return row
  }, {})
}

// Parses the sheet's raw `additionalActions` (array or JSON string) into action configs.
// Exported because additionalActionsPipeline needs it for an ARBITRARY resource.
export function normalizeAdditionalActions(raw) {
  let parsed = []
  if (Array.isArray(raw)) parsed = raw
  else if (typeof raw === 'string' && raw) {
    try { parsed = JSON.parse(raw.trim()) } catch { parsed = [] }
  }
  return parsed.map(normalizeAction).filter(Boolean)
}

function normalizeAction(a) {
  if (!a || !a.action) return null
  // WHITELIST — a key not copied here is dropped before any component sees it.
  const base = {
    action: a.action,
    label: a.label || a.action,
    icon: a.icon || '',
    color: a.color || 'primary',
    confirm: !!a.confirm,
    // Offered on a page with NO record in context (the Index FAB cluster). It acts on the
    // resource, not on a row, so it is never listed among a row's own actions.
    resourceLevel: a.resourceLevel === true,
    // Optional dialog heading templates — `"{$outlet.Name} • {Code}"`.
    // Presentational only; resolved client-side by `resolveRecordTemplate`.
    title: a.title || '',
    subtitle: a.subtitle === undefined ? undefined : a.subtitle
  }
  const kind = a.kind === 'navigate' ? 'navigate' : 'mutate'
  if (kind === 'navigate') {
    const nav = a.navigate || {}
    return {
      ...base,
      kind,
      navigate: {
        // A route name from router/routes.js — see useResourceNav's target list.
        target: nav.target || 'record',
        pageSlug: nav.pageSlug || '',
        // Explicit `_action/:action` segment; falls back to pageSlug at dispatch.
        action: nav.action || '',
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
  // Passed through as authored: every target key is validated server-side.
  const targets = Array.isArray(m.targets)
    ? m.targets
    : (Array.isArray(a.targets) ? a.targets : [])
  if (targets.length) mutateBase.targets = targets

  mutateBase.visibleWhen = normalizeVisibleWhen(a.visibleWhen)
  return mutateBase
}

// Flattens `visibleWhen` into an AND list of `{ column, op, value }`, canonicalising
// legacy `ne`/`nin` spellings through the token evaluator.
function normalizeVisibleWhen(v) {
  if (v == null) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr
    .map((c) => {
      if (!c || typeof c !== 'object' || !c.column) return null
      const op = normalizeOperator(c.op)
      if (!VISIBLE_WHEN_OPS.has(op)) return null
      // A null value would stringify to "null" in the evaluator's literal path, where the
      // original comparison read it as a blank. Pin it to '' so that stays true.
      return { column: c.column, op, value: c.value == null ? '' : c.value }
    })
    .filter(Boolean)
}

const VISIBLE_WHEN_OPS = new Set(OPERATORS)

// Whether ONE action should be offered for `record`. Conditions run through the shared
// token evaluator, so a `visibleWhen` value may be a dynamic token like a list filter.
// `strictColumn: false` keeps a condition naming a missing column evaluating as blank.
export function isActionVisible(action, record, ctx) {
  const conds = Array.isArray(action?.visibleWhen) ? action.visibleWhen : []
  if (!conds.length) return true
  if (!record || typeof record !== 'object') return true

  const filter = {
    type: 'group',
    logic: 'AND',
    items: conds.map((c) => ({ type: 'condition', ...c }))
  }
  return evaluateFilter(filter, record, ctx || resolveTokenContext(), { strictColumn: false })
}

// The comparison half of a target's `when` gate. GAS/actionTargets.gs mirrors this
// exactly and is its matched pair; keep the two in step. An unknown op returns true.
export function evaluateConditionOp(op, cell, value) {
  const isEmpty = cell == null || cell === ''
  switch (op) {
    case 'eq': return String(cell ?? '') === String(value ?? '')
    case 'ne': return String(cell ?? '') !== String(value ?? '')
    case 'in': {
      const arr = Array.isArray(value) ? value : [value]
      return arr.map(String).includes(String(cell ?? ''))
    }
    case 'nin': {
      const arr = Array.isArray(value) ? value : [value]
      return !arr.map(String).includes(String(cell ?? ''))
    }
    case 'empty': return isEmpty
    case 'notEmpty': return !isEmpty
    default: return true
  }
}
