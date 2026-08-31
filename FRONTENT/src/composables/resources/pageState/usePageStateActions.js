import { computed } from 'vue'
import { batchRef } from '../resourceRequests'
import { useAdditionalActionsPipeline } from '../additionalActionsPipeline'

// Workflow actions queued INTO this page's own batch, so a record and the action
// stamping it either both land or neither does. Entries here are pure domain
// models — the executeAction wire format is put on by build().

export const DEFAULT_ACTION_ROLE = '$default'
const DEFAULT_ROLE = DEFAULT_ACTION_ROLE

// The address of a queued action: `resource#role::action::code`. The code half keeps
// a per-row batch of stamps apart; an entry queued for the page's own record leaves
// it empty, so the same action queued twice updates one entry.
export function actionKeyFor (resource, actionName, role = DEFAULT_ACTION_ROLE, code = '') {
  const codeKey = typeof code === 'string' ? code : (code?.$ref || '')
  return `${resource}#${role || DEFAULT_ACTION_ROLE}::${actionName}::${codeKey}`
}

const segments = (path) => String(path).split('.').filter(Boolean)

export function getNested (source, path) {
  if (!path) return source
  return segments(path).reduce((value, key) => (value == null ? undefined : value[key]), source)
}

export function setNested (target, path, value) {
  const keys = segments(path)
  if (!keys.length) return target
  const last = keys.pop()
  const parent = keys.reduce((node, key) => {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {}
    return node[key]
  }, target)
  parent[last] = value
  return target
}

export function usePageStateActions ({ state, registry }) {
  const actionPipeline = useAdditionalActionsPipeline()

  const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

  // Omit `options.code` and it resolves to the node's own code when editing, else
  // `batchRef('<Resource>.latest.code')` — so create + act on it is one batch.
  function includeAdditionalAction (actionName, data = {}, options = {}) {
    const { resource, role, code, record, outcome } = options
    const { name, role: r } = registry.resolveTarget(resource || state.primaryKey, role)
    if (!name) {
      console.warn('[usePageState] includeAdditionalAction needs a resource — none resolved for:', actionName)
      return null
    }

    // Read-only lookup: queuing an action must never CREATE a node, or an
    // otherwise-empty page would start building a create request for it.
    const node = registry.peekNode(name, r)

    const resolvedCode = code !== undefined && code !== null && code !== ''
      ? code
      : (node?.code || batchRef(`${name}.latest.code`))

    // The pipeline resolves the config, the field schema and the seeds; only its
    // resolved parts are kept, never the wire envelope. build() rebuilds that.
    const request = actionPipeline.buildActionRequest(actionName, {
      resource: name,
      record: record || node?.record || null,
      code: resolvedCode,
      data,
      outcome
    })
    if (!request) return null

    // Keyed WITH the code, exactly as applyNodes keys a node's own actions. Keyed without
    // it, the same action on the same record landed twice - once from a card, once from
    // the Layer 2 chain - and only one of the two could ever be removed again.
    const key = actionKeyFor(name, actionName, r, request.payload.code)
    const entry = {
      key,
      resource: name,
      code: request.payload.code,
      actionConfig: {
        action: request.payload.actionName,
        column: request.payload.column,
        columnValue: request.payload.columnValue
      },
      data: {
        fields: request.payload.fields || {},
        ...(request.payload.targetFields ? { targets: request.payload.targetFields } : {})
      },
      reload: []
    }
    const existing = state.actions.findIndex((e) => e.key === key)
    if (existing >= 0) state.actions.splice(existing, 1, entry)
    else state.actions.push(entry)

    return entry
  }

  function excludeAdditionalAction (actionName = null, { resource, role } = {}) {
    if (!actionName) {
      state.actions.splice(0)
      return
    }
    const index = state.actions.indexOf(findEntry(actionName, resource, role))
    if (index >= 0) state.actions.splice(index, 1)
  }

  // ── Queued actions, addressed by NAME - they have no index ─────────────────

  // The exact entry for this page's own record first, else the first per-row
  // entry for the same action, so a batch of stamps is still readable by name.
  function findEntry (actionName, resource, role) {
    const { name, role: r } = registry.resolveTarget(resource || state.primaryKey, role)
    if (!name) return null
    const exact = actionKeyFor(name, actionName, r)
    const prefix = `${name}#${r || DEFAULT_ROLE}::${actionName}::`
    return state.actions.find((entry) => entry.key === exact) ||
      state.actions.find((entry) => String(entry.key).startsWith(prefix)) || null
  }

  // `path` is a dot address into the entry's DATA — 'fields.Comment',
  // 'targets.nextVisit.Date', 'columnValue'. Omit it for the whole data object.
  function getActions (actionName, path = null, resource, role) {
    const entry = findEntry(actionName, resource, role)
    if (!entry) return path ? undefined : null
    return path ? getNested(entry.data, path) : entry.data
  }

  // setActions(name, null, resource, role)               — remove
  // setActions(name, { fields }, resource, role)         — queue/replace the data
  // setActions(name, 'fields.Comment', v, resource, role) — write one address
  function setActions (actionName, pathOrData, valueOrResource, resource, role) {
    if (pathOrData === null) {
      return excludeAdditionalAction(actionName, { resource: valueOrResource, role: resource })
    }
    if (typeof pathOrData !== 'string') {
      return includeAdditionalAction(actionName, pathOrData || {}, { resource: valueOrResource, role: resource })
    }

    const entry = findEntry(actionName, resource, role) ||
      includeAdditionalAction(actionName, {}, { resource, role })
    if (!entry) return null
    if (!isPlainObject(entry.data)) entry.data = {}
    setNested(entry.data, pathOrData, valueOrResource)
    return entry
  }

  // v-model straight onto one action field:
  //   pageState.useActions('Complete', 'fields.Comment')
  function useActions (actionName, path = null, resource, role) {
    return computed({
      get: () => getActions(actionName, path, resource, role),
      set: (value) => (path
        ? setActions(actionName, path, value, resource, role)
        : setActions(actionName, value, resource, role))
    })
  }

  return {
    includeAdditionalAction,
    excludeAdditionalAction,
    getActions,
    setActions,
    useActions
  }
}
