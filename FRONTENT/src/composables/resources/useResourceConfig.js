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
export function useResourceConfig(resourceNameOverride) {
  const auth = useAuthStore()

  // WHETHER there is an override is decided ONCE, here, from the raw argument —
  // deliberately NOT from its unwrapped value.
  //
  // `useRouteConfig()` calls `useRoute()`, which is an `inject()`: it is only
  // legal during `setup()` and must therefore run synchronously on this line for
  // the route-resolved case, never deferred into a `computed()` that first
  // evaluates after setup has returned. So the branch that selects it cannot be
  // reactive — a ref whose value arrives later could not retroactively make the
  // injection legal.
  //
  // This costs nothing, because the three computeds below already branched on
  // this same raw truthiness: a ref or getter is an object and has always taken
  // the override path regardless of what it holds, and `''`/`undefined` has
  // always taken the route path. Behaviour is unchanged for every caller; the
  // only difference is that the route is no longer touched when it is not read,
  // so a domain composable calling `useResourceConfig('SomeResource')` from a
  // PageAction submit handler (outside setup — UI_RESOURCE_DOMAIN_LOGIC §3.2/§6)
  // no longer trips the `inject()` warning.
  const hasOverride = !!resourceNameOverride
  const routeCfg = hasOverride ? null : useRouteConfig()

  // The override's VALUE, unlike its presence, may legitimately be reactive.
  // Normalised the same way `useRecord` normalises its own override.
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

    // Determine target resource config. `activeConfig` is the local computed —
    // `config` is only the name this composable RETURNS it under, so referencing
    // `config.value` here threw a ReferenceError (ES modules are strict mode) on
    // every allowed() call that omitted an explicit target resource.
    const resConfig = targetResourceName ? findResourceConfig(auth, targetResourceName) : activeConfig.value
    if (!resConfig) return false

    // 2. Array of actions on a single resource
    if (Array.isArray(query)) {
      return checkActionsList(resConfig, query)
    }

    // 3. Single action on a single resource
    return checkSingleAction(resConfig, query)
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
    allowed
  }
}

/**
 * Parses + normalizes a resource's raw `additionalActions` (an array, or the JSON
 * string the sheet stores) into the action configs every consumer sees.
 *
 * Module-scope and exported deliberately: `useResourceConfig` needs it for the
 * ACTIVE resource, but `additionalActionsPipeline` needs it for an ARBITRARY one
 * (a page queuing a workflow action against another resource), and neither may
 * grow its own copy of the whitelist below.
 */
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
  // WHITELIST — anything not copied here is dropped before any component sees
  // it. Add new AdditionalActions keys HERE as well as to the authoring UI, or
  // they will vanish silently (see the `targets` note below).
  const base = {
    action: a.action,
    label: a.label || a.action,
    icon: a.icon || '',
    color: a.color || 'primary',
    confirm: !!a.confirm,
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
  // Multi-record targets (AQL_ACTION_SYSTEM.md §7). This normalizer rebuilds
  // each action from a key WHITELIST, so anything not copied here is silently
  // dropped before a component ever sees it — which is exactly how `targets`
  // went missing while icon/color/label/visibleWhen all survived, making the
  // FAB look correct while the dialog rendered only its source field.
  //
  // Passed through as authored: every target key is validated server-side
  // against the trusted config, so re-deriving the shape here would only add a
  // second place for the contract to drift.
  const targets = Array.isArray(m.targets)
    ? m.targets
    : (Array.isArray(a.targets) ? a.targets : [])
  if (targets.length) mutateBase.targets = targets

  mutateBase.visibleWhen = normalizeVisibleWhen(a.visibleWhen)
  return mutateBase
}

/**
 * Normalizes `visibleWhen` into a flat AND list of `{ column, op, value }`.
 *
 * Operators are canonicalised through the token evaluator, so the legacy `ne` / `nin`
 * spellings all over the seed configs in `GAS/syncAppResources.gs` land on `neq` / `not_in`
 * and every schema already in a sheet keeps evaluating.
 */
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

/**
 * Whether ONE action should be offered for `record`.
 *
 * Conditions run through the shared token evaluator, so a `visibleWhen` value may be a
 * dynamic token exactly as a list-view filter may — `{ column: 'Date', op: 'lte', value:
 * '$startOfDay:0' }` hides an action on future-dated records, and `$userCode` / `$userRoles`
 * gate one on the signed-in user. Plain literals behave as they always did, save that the
 * comparison is now case-insensitive (matching list-view filters).
 *
 * `strictColumn: false` keeps the original posture that a condition naming a column the
 * record does not carry is evaluated against a blank rather than failing outright.
 *
 * @param {Object} action - a normalized action config
 * @param {Object} record - the record under test
 * @param {Object} [ctx] - token context `{ user }`; read from the auth store when omitted.
 */
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

/**
 * The comparison half of a target's `when` gate — the `eq`/`ne`/`in`/`nin`/
 * `empty`/`notEmpty` grammar used by `additionalActionsSchema.isTargetActive`.
 * The server's `evaluateActionTargetCondition` in GAS/actionTargets.gs mirrors
 * this exactly and is its matched pair; keep the two in step.
 *
 * `visibleWhen` no longer routes through here — it evaluates via
 * `src/utils/tokenEvaluator`, which additionally accepts dynamic tokens and the
 * ordered/`contains` operators. Targets stay on this narrower grammar because
 * the SERVER is the authority on them and only understands these six ops.
 *
 * An unknown op returns true, so a malformed condition does not constrain.
 */
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
