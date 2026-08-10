/**
 * usePageState — centralized page-level form-state composable + canonical request builders.
 *
 * SINGLE SOURCE OF TRUTH for:
 *   1. The reactive form state shared by the Header / Content / Action sections
 *      (provided at Page.vue, injected by sections — one live instance).
 *   2. The generic GAS request builders (compositeSave / create / update / bulk /
 *      get / executeAction) + response helpers + $ref linking.
 *
 * These builders were previously in `operation/outlets/outletOperationsBatch.js`
 * (outlet-specific folder). They are in fact resource-agnostic (they take the
 * resource name as a parameter), so they now live here and are exported as named
 * functions so every module — Outlets, Procurement, Accounts, HR — imports them
 * from one place. `outletOperationsBatch.js` is being deprecated/removed.
 *
 * All low-level `state.nodes.set(...)` and request assembly happen under the hood.
 * Consumers call ONLY the friendly mutations and the one-call triggers below.
 * Options are derived automatically via `computed` (lazy + memoized).
 *
 * --------------------------------------------------------------------------
 * Encapsulation contract — READ BEFORE ADDING A CONSUMER
 * --------------------------------------------------------------------------
 * PRIVATE (may change without touching consumers):
 *   `state.nodes` (keyed by uid) and `state.index` (resource -> role -> uid) —
 *   the keying scheme is NOT part of the contract; the node object shape
 *   (`resource` / `record` / `children` / `records` / `controls` / `code` /
 *   `many` / `options`); and the child bucket layout
 *   (`{ resource, records }`).
 *
 *   -> READ node state through `useNode(resource, role?)`, never
 *      `state.nodes.get(...)` / `state.index[...]`. `useNode` accepts a string,
 *      a ref, or a getter, so a component whose active resource changes
 *      (Create/Update on navigation) binds ONCE at setup and stays correct.
 *
 * ADDRESSING — one resource may hold several nodes, addressed by ROLE:
 *   useNode('Outlets')                            -> role '$default'
 *   useNode('OutletVisits', 'next')               -> the scheduled-visit node
 *   setField({ resource: 'OutletVisits', role: 'next' }, 'Date', v)
 *
 *   Roles are NAMES, deliberately not ordinals. Workflows create nodes
 *   conditionally (outlet-consumption only makes a complete-visit node when that
 *   checkbox is ticked), so a positional index would shift and silently resolve
 *   to the wrong node — or to the empty node, which builds an empty payload
 *   rather than raising.
 *   -> WRITE node state through the mutations below, never by assigning into
 *      a node or a child row.
 *
 * PUBLIC (a data contract consumers may rely on):
 *   The child row entry `{ _action, data }` — `data` is the record body that
 *   FormChild renders and `_action` is one of 'create' | 'update' | 'deactivate'.
 *   This shape is the interchange format between usePageState and the child
 *   form, and it is also what `defaultBuild` ships to GAS, so it is deliberately
 *   NOT hidden. Read it freely; change it only via `updateChild` (patches
 *   `data`) and `setChildAction` (sets `_action`).
 *
 * --------------------------------------------------------------------------
 * Strategy contract (resource-specific override, optional)
 * --------------------------------------------------------------------------
 *   {
 *     controls(resource)        -> [{ name, codeType? }]   // field schema; codeType -> auto options
 *     getOptions(codeType, node) -> [{ label, value }]      // option lists for XxxCode columns
 *     hydrate(node, raw, ctx)   -> void                     // load existing server record into node
 *     build(ctx)                -> [request]                // override generic request assembly
 *     validate(node, state)     -> [{ field, message }]     // per-node validation
 *   }
 */

import { reactive, computed, toRaw, unref } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from './useResourceConfig'
import { useAdditionalActionsPipeline } from './additionalActionsPipeline'
// Low-level $ref helpers live in appHelpers.js (stateless utils, §2); re-exported
// here so usePageState is the single import surface for consumers.
import { batchRef, isBatchRef, textOrRef, normalizeCodeOrRef } from 'src/utils/appHelpers'
export { batchRef, isBatchRef, textOrRef, normalizeCodeOrRef }

// ==========================================================================
// Canonical request builders + response helpers (resource-agnostic — Single Source of Truth)
// ==========================================================================
export function responseFailed (response) {
  return !response?.success || (Array.isArray(response.data) && response.data.some(entry => entry?.success === false))
}
export function failureMessage (response, fallback = 'Request failed.') {
  const failed = Array.isArray(response?.data) ? response.data.find(entry => entry?.success === false) : null
  return failed?.error || failed?.message || response?.error || response?.message || fallback
}
export function batchResultCode (response, index = 0) {
  const entry = Array.isArray(response?.data) ? response.data[index] : null
  return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
}

export function compositeSaveRequest (payload = {}) {
  const { resource, code, data, children } = payload
  return {
    action: 'compositeSave',
    resource,
    payload: { ...(code ? { code: textOrRef(code) } : {}), data, children: children || [] }
  }
}
export function resourceBulkRequest (resource, records = [], cursorResources = []) {
  return {
    action: 'bulk',
    resource,
    payload: { targetResource: resource, records, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}
export function resourceUpdateRequest (resource, code, data = {}, cursorResources = []) {
  return {
    action: 'update',
    resource,
    payload: { code: textOrRef(code), record: data, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}
export function resourceCreateRequest (resource, record = {}, cursorResources = []) {
  return {
    action: 'create',
    resource,
    payload: { record, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}
export function resourceGetRequest (resources = [], payload = {}) {
  const names = Array.isArray(resources) ? resources.filter(Boolean) : [resources].filter(Boolean)
  return { action: 'get', resource: names, payload }
}
export function executeActionRequest (resource, code, actionConfig, fields = {}, cursorResources = []) {
  return {
    action: 'executeAction',
    resource,
    payload: {
      code: textOrRef(code),
      actionName: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields,
      ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {})
    }
  }
}

function uid () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// The role every consumer gets when it addresses a resource by name alone. Keeps
// the 1-node-per-resource case (all of Create/Update/FormChild today) unchanged.
const DEFAULT_ROLE = '$default'

// ==========================================================================
// Composable
// ==========================================================================
export function usePageState (strategy = {}) {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const { requiredHeaders } = useResourceConfig()

  // --- core reactive state ---
  // `nodes` is keyed by an opaque uid, NOT by resource name, so one resource can
  // hold several nodes. `index` is the addressing layer: resource -> role -> uid.
  // Roles are NAMES, never positions — a workflow creates its nodes conditionally
  // (outlet-consumption only makes a complete-visit node when that checkbox is
  // ticked), so an ordinal would silently shift and resolve to the wrong node.
  const state = reactive({
    primaryKey: null,
    nodes: new Map(),
    index: {},
    // Queued `executeAction` envelopes (see includeAdditionalAction). Kept
    // OUTSIDE `nodes` on purpose: an action is not a record body, it carries no
    // controls/children/options, and `defaultBuild` must be free to emit it
    // AFTER every node request so a `$ref` to a record created in the same batch
    // resolves. Entries are `{ key, resource, actionName, request }`.
    pendingActions: []
  })

  // page-level UI meta (shared by Content + Action sections)
  const meta = reactive({
    saving: false,
    submitting: false,
    loading: false,
    currentStep: 1,
    validationErrors: {},
    // Measured height of the FormAction sticky bar (0 until FormAction.vue mounts
    // and reports it) — ResourceActions reads this to keep its FAB clear of the bar.
    formActionsHeight: 0
  })

  // Route-following; `includeAdditionalAction` overrides the resource per call.
  const actionPipeline = useAdditionalActionsPipeline()

  const hydrate = strategy.hydrate || defaultHydrate
  const build = strategy.build || defaultBuild
  const optionResolver = strategy.getOptions || (() => [])
  const emptyNode = createNode('__empty__')

  // ----------------------------------------------------------------------
  // Node factory — everything under the hood
  // ----------------------------------------------------------------------
  function createNode (resource, { code = null, many = false, action = null } = {}) {
    return reactive({
      // NOTE: no `identifier` field — the node's identity IS its Map key (a uid).
      // `useNode(...).identifier` surfaces that key, so consumers keying one-shot
      // work off "this node was replaced" (Update.vue) keep working unchanged.
      resource,
      code,
      many,
      record: {}, // the user-input header/body (v-model target)
      children: [], // composite child rows: [{ resource, records: [{ _action, data }] }]
      records: [], // many:true entries of THIS resource
      // Dual-purpose: { name, codeType } entries seeded by strategy.controls (option-list
      // schema), AND/OR { header, value } entries upserted by setControlField for non-schema
      // custom fields — see setControlField/getControlField. Never read by defaultBuild.
      controls: [],
      options: {}, // per-field option lists (seeded by strategy.getOptions)
      action // workflow action trigger (string key or explicit config)
    })
  }

  // Consumers may hand any mutation/accessor a plain string, a ref, or a getter —
  // components whose active resource changes on navigation (Create/Update) can then
  // bind once at setup instead of re-reading `state.nodes` on every access.
  function toResourceName (resource) {
    return typeof resource === 'function' ? resource() : unref(resource)
  }

  // Every mutation/accessor addresses a node by TARGET, which is any of:
  //   'Outlets'                                 -> resource, default role
  //   ref('Outlets') / () => 'Outlets'          -> same, but reactive
  //   { resource: 'OutletVisits', role: 'next' } -> a specific role
  // Accepting the object form here means no mutation had to grow a `role`
  // parameter — one resolver covers setField/addChild/addRecord/... alike.
  function resolveTarget (target, role) {
    const raw = toResourceName(target)
    if (raw && typeof raw === 'object') {
      return { name: toResourceName(raw.resource), role: raw.role || role || DEFAULT_ROLE }
    }
    return { name: raw, role: role || DEFAULT_ROLE }
  }

  function nodeIdFor (name, role) {
    return state.index[name]?.[role]
  }

  // THE only place a node enters `nodes` + `index`. Re-attaching an existing
  // (resource, role) replaces it and drops the previous node, so a re-init cannot
  // orphan an entry in `nodes` that nothing can address any more.
  function attachNode (name, role, node) {
    const id = uid()
    if (!state.index[name]) state.index[name] = {}
    const previous = state.index[name][role]
    if (previous) state.nodes.delete(previous)
    state.index[name][role] = id
    state.nodes.set(id, node)
    return id
  }

  // THE only place nodes leave. Both structures are cleared together — a stale uid
  // in `index` would resolve to `emptyNode` and silently build an empty payload.
  function detachAll () {
    state.nodes = new Map()
    state.index = {}
    // Queued actions belong to the same page lifecycle as the nodes they ride
    // with — a `$ref` into a batch that no longer exists is worse than nothing.
    state.pendingActions.splice(0)
  }

  function ensureNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    const existing = id ? state.nodes.get(id) : null
    return existing || initResource(name, { role: r })
  }

  // Reactive "is this page's form state initialized at all?" — true once ANY node
  // has been attached, false again after reset()/detachAll(). `state.nodes` is a
  // reactive Map, so reading `.size` here subscribes correctly to set/delete.
  //
  // Deliberately node-COUNT only, not per-resource: consumers that need a specific
  // node still go through `useNode(resource).exists`. This one exists so a container
  // that has no business knowing the resource (PageAction) can tell an initialized
  // form page from an uninitialized one without reaching into `state.nodes` and
  // breaking the encapsulation contract at the top of this file.
  const hasNodes = computed(() => state.nodes.size > 0)

  // Imperative existence check — the supported replacement for `state.nodes.has(...)`.
  // Use `useNode(resource).exists` when a template/computed needs it reactively.
  function hasNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    return !!id && state.nodes.has(id)
  }

  // ----------------------------------------------------------------------
  // PUBLIC MUTATIONS
  // ----------------------------------------------------------------------
  function initResource (resource, { role, code = null, many = false, fields = {}, action = null, isPrimaryKey = false, reset = false } = {}) {
    const { name, role: r } = resolveTarget(resource, role)
    if (reset) resetForResource(name)

    const node = createNode(name, { code, many, action })
    Object.assign(node.record, fields)
    if (strategy.controls) {
      node.controls = strategy.controls(name) || []
      for (const ctrl of node.controls) {
        if (ctrl.codeType) node.options[ctrl.name] = optionResolver(ctrl.codeType, node)
      }
    }
    attachNode(name, r, node)
    if (!state.primaryKey || isPrimaryKey || state.primaryKey !== name) state.primaryKey = name
    return node
  }

  // Flushes stale nodes left over from a previously-visited resource page before
  // the new active resource takes over as primaryKey — called by initResource
  // when { reset: true } (e.g. on a Create/Update page mount or resource switch).
  function resetForResource (resource) {
    detachAll()
    state.primaryKey = toResourceName(resource)
    Object.assign(meta, {
      saving: false,
      submitting: false,
      loading: false,
      currentStep: 1,
      validationErrors: {},
      formActionsHeight: 0
    })
  }

  function load (resource, rawRecord = {}) {
    const node = ensureNode(resource)
    hydrate(node, rawRecord, { raw: rawRecord })
    return node
  }

  function setField (resource, field, value) {
    const node = ensureNode(resource)
    node.record[field] = value
    return node
  }

  function setFields (resource, patch = {}) {
    const node = ensureNode(resource)
    Object.assign(node.record, patch)
    return node
  }

  // Non-schema / transient field storage — `node.record` is reserved exclusively
  // for canonical resource headers sent to GAS (see defaultBuild). A FormRecord
  // `fields` list may reference a header outside the resolved schema (custom UI
  // fields, wizard-only inputs, ...); those values live in `node.controls`
  // instead (upserted by `header`) so they never leak into create/update/bulk
  // payloads while still being reactively readable via `getControlField`/`useNode`.
  function setControlField (resource, header, value) {
    const node = ensureNode(resource)
    const entry = node.controls.find((c) => c.header === header)
    if (entry) entry.value = value
    else node.controls.push({ header, value })
    return node
  }

  // Read-only, so it must NOT create a node the way ensureNode would — resolve
  // through the index and return undefined when the node does not exist yet.
  function getControlField (resource, header, role) {
    const { name, role: r } = resolveTarget(resource, role)
    const id = nodeIdFor(name, r)
    const node = id ? state.nodes.get(id) : null
    return node?.controls.find((c) => c.header === header)?.value
  }

  // Single place that knows the bucket layout, so `node.children` stays private.
  function childBucket (node, childResource) {
    const name = toResourceName(childResource)
    return node.children.find(c => c.resource === name) || null
  }

  function addChild (resource, childResource, row, { action = 'create' } = {}) {
    const node = ensureNode(resource)
    let bucket = childBucket(node, childResource)
    if (!bucket) {
      bucket = { resource: toResourceName(childResource), records: [] }
      node.children.push(bucket)
    }
    bucket.records.push({ _action: action, data: { ...row } })
    return bucket
  }

  function updateChild (resource, childResource, index, patch) {
    const node = ensureNode(resource)
    const bucket = childBucket(node, childResource)
    if (bucket && bucket.records[index]) bucket.records[index].data = { ...bucket.records[index].data, ...patch }
  }

  function removeChild (resource, childResource, index) {
    const node = ensureNode(resource)
    const bucket = childBucket(node, childResource)
    if (bucket) bucket.records.splice(index, 1)
  }

  // Sets a child row's `_action` — `updateChild` deliberately merges `data` only,
  // so this is the supported way to soft-delete ('deactivate') a persisted row or
  // restore it ('update'). Returns the entry, or null when the index is stale.
  function setChildAction (resource, childResource, index, action) {
    const node = ensureNode(resource)
    const entry = childBucket(node, childResource)?.records[index]
    if (!entry) return null
    entry._action = action
    return entry
  }

  function addRecord (resource, row, { action = 'create' } = {}) {
    const node = ensureNode(resource)
    node.many = true
    node.records.push({ _action: action, data: { ...row } })
    return node.records.length - 1
  }

  function updateRecord (resource, index, patch) {
    const node = ensureNode(resource)
    if (node.records[index]) node.records[index].data = { ...node.records[index].data, ...patch }
  }

  function removeRecord (resource, index) {
    const node = ensureNode(resource)
    node.records.splice(index, 1)
  }

  // writes the user's chosen value into record (options themselves are read-only computed)
  function selectOption (resource, field, value) {
    return setField(resource, field, value)
  }

  // ----------------------------------------------------------------------
  // AdditionalActions — workflow actions queued INTO this page's batch
  // ----------------------------------------------------------------------
  // The popup path (`useAdditionalActions` -> AdditionalActionsDialog) dispatches
  // an action on its own, immediately, against a record that already exists. This
  // is the other half: a page that wants the action to travel WITH its own
  // submission, so a record and the action stamping it either both land or
  // neither does — and so the action can address a record this very batch is
  // about to create, via `$ref`.
  //
  // The envelope itself is built by `additionalActionsPipeline`, which resolves
  // the action config, the field schema, the `from`/`value` seeds and the payload
  // buckets internally. Nothing about the executeAction wire format lives here.

  /**
   * Queues a workflow action onto this page's next `submit()` / `build()`.
   *
   * @param {string} actionName - the `AdditionalActions` key, e.g. 'Postpone'.
   * @param {Object} [data]     - user values, addressed by short authored name
   *        (`{ Comment: 'Late' }`), derived header, `'<targetKey>.<Column>'`, or a
   *        nested target bag (`{ newVisit: { Date: '2026-01-04' } }`). Anything
   *        omitted falls back to the field's configured seed.
   * @param {Object} [options]
   * @param {string} [options.resource] - defaults to this page's primary resource.
   * @param {string} [options.role]     - node role, when the resource holds several.
   * @param {string|Object} [options.code] - a concrete record code, or a `$ref`
   *        from `batchRef(...)`. Omit and the code is resolved automatically:
   *        the node's own `code` when editing an existing record, otherwise
   *        `batchRef('<Resource>.latest.code')` — which is what makes
   *        "create a record AND run an action on it" a single batch.
   * @param {Object} [options.record]  - explicit source record for `$record.*`
   *        prefills and `visibleWhen`-style seeding; defaults to the node's record.
   * @param {string} [options.outcome] - overrides `columnValue` on a
   *        multi-outcome action.
   * @returns {Object|null} the queued request, or null when the action is unknown.
   */
  function includeAdditionalAction (actionName, data = {}, options = {}) {
    const { resource, role, code, record, outcome } = options
    const { name, role: r } = resolveTarget(resource || state.primaryKey, role)
    if (!name) {
      console.warn('[usePageState] includeAdditionalAction needs a resource — none resolved for:', actionName)
      return null
    }

    // Read-only node lookup: queuing an action must never CREATE a node, or an
    // otherwise-empty page would start building a create request for it.
    const id = nodeIdFor(name, r)
    const node = id ? state.nodes.get(id) : null

    const resolvedCode = code !== undefined && code !== null && code !== ''
      ? code
      : (node?.code || batchRef(`${name}.latest.code`))

    const request = actionPipeline.buildActionRequest(actionName, {
      resource: name,
      record: record || node?.record || null,
      code: resolvedCode,
      data,
      outcome
    })
    if (!request) return null

    // Keyed by resource + action so calling this twice for the same action
    // UPDATES the queued envelope rather than running the action twice.
    const key = `${name}::${actionName}`
    const entry = { key, resource: name, actionName, request }
    const existing = state.pendingActions.findIndex((e) => e.key === key)
    if (existing >= 0) state.pendingActions.splice(existing, 1, entry)
    else state.pendingActions.push(entry)

    return request
  }

  /** Drops one queued action (or all of them when `actionName` is omitted). */
  function excludeAdditionalAction (actionName = null, { resource } = {}) {
    if (!actionName) {
      state.pendingActions.splice(0)
      return
    }
    const { name } = resolveTarget(resource || state.primaryKey)
    const key = `${name}::${actionName}`
    const index = state.pendingActions.findIndex((e) => e.key === key)
    if (index >= 0) state.pendingActions.splice(index, 1)
  }

  /**
   * The queued envelopes, in call order. `defaultBuild` appends these itself; a
   * `strategy.build` override must append them explicitly or its page silently
   * drops every queued action.
   */
  function additionalActionRequests () {
    return state.pendingActions.map((entry) => entry.request)
  }

  // ----------------------------------------------------------------------
  // useNode — per-section reactive access
  // ----------------------------------------------------------------------
  // THE read accessor — the only supported way for a consumer to observe node state.
  // `resource` may be a string, a ref, or a getter (see toResourceName), so a component
  // whose active resource changes on navigation binds once at setup.
  //
  // A missing node resolves to `emptyNode`, so every returned computed is safe to read
  // before `initResource` has run — consumers never need optional chaining on the node.
  function useNode (resource, role = DEFAULT_ROLE) {
    const target = computed(() => resolveTarget(resource, role))
    // resource -> role -> uid -> node. The role is a NAME, so addressing survives a
    // node being created conditionally or the creation order changing.
    const nodeId = computed(() => nodeIdFor(target.value.name, target.value.role))
    const node = computed(() => (nodeId.value && state.nodes.get(nodeId.value)) || emptyNode)
    const exists = computed(() => !!nodeId.value && state.nodes.has(nodeId.value))
    // Header/body the user is editing — the v-model target for the primary FormRecord.
    const record = computed(() => node.value.record)
    // The node's uid (its Map key). Changes when the node is REPLACED
    // (initResource/reset), not when a field is edited — consumers key one-shot
    // hydration off this so a reset re-seeds from the server.
    const identifier = computed(() => nodeId.value)
    // options derived lazily + memoized; only computed when a template reads them
    const options = computed(() => {
      const n = node.value
      const out = {}
      for (const ctrl of n.controls) {
        if (ctrl.codeType) out[ctrl.name] = optionResolver(ctrl.codeType, n)
      }
      return out
    })
    const validation = computed(() => validateNode(node.value))

    // Child rows for one child resource, as `{ _action, data }` entries (see the
    // encapsulation contract above). `childResource` accepts a string/ref/getter too.
    // Entry identity is stable across reads, so callers may use indexOf for row->index.
    function children (childResource) {
      return computed(() => childBucket(node.value, childResource)?.records || [])
    }

    return { node, exists, record, identifier, options, validation, children }
  }

  // ----------------------------------------------------------------------
  // GENERIC build / hydrate (overridable via strategy)
  // ----------------------------------------------------------------------
  function defaultHydrate (node, raw) {
    Object.assign(node.record, raw || {})
    if (raw && raw.Code) node.code = raw.Code
  }

  function defaultBuild () {
    const requests = []
    // The target resource comes from `node.resource`, NEVER the Map key. Today the
    // key happens to equal the resource name, so this is behaviour-identical — but
    // the key is an addressing concern and the two are not the same thing. Keeping
    // them separate is what lets the key become an alias later (so one resource can
    // hold several nodes, e.g. a visit being completed + a visit being scheduled)
    // without every built request silently inheriting a bogus resource name.
    for (const node of state.nodes.values()) {
      const resource = node.resource
      if (node.many) {
        const records = node.records.map(r => r.data)
        if (records.length) requests.push(resourceBulkRequest(resource, records))
        // a many-node may still carry an action
      } else if (node.children.length) {
        const children = node.children.map(c => ({
          resource: c.resource,
          records: c.records.map(r => ({ _action: r._action || 'create', data: r.data }))
        }))
        const data = { ...node.record }
        requests.push(node.code
          ? compositeSaveRequest({ resource, code: node.code, data, children })
          : compositeSaveRequest({ resource, data, children }))
      } else if (node.code) {
        requests.push(resourceUpdateRequest(resource, node.code, node.record))
      } else if (Object.keys(node.record).length) {
        requests.push(resourceCreateRequest(resource, node.record))
      }
    }
    // Queued workflow actions go LAST, so a `$ref` naming a record this batch
    // creates ('OutletVisits.latest.code') resolves against a row that already
    // exists by the time GAS reaches the executeAction entry.
    requests.push(...additionalActionRequests())
    return requests
  }

  // ----------------------------------------------------------------------
  // TRIGGERS — single under-the-hood lifecycle: state -> request -> server -> response
  // ----------------------------------------------------------------------
  // Every trigger funnels through `run`: it takes the (already-built) requests,
  // sends them via the resource IO store, and returns { success, response, code }
  // back to the caller (the "source function").
  async function run ({ requests, build: buildFn, mode = 'submit', onSuccess, reload = [], notify = true, successMsg } = {}) {
    const errors = validationErrors.value
    if (errors.length > 0) {
      if (notify) {
        $q.notify({
          type: 'negative',
          message: errors[0].message,
          position: 'top'
        })
      }
      return { success: false, response: null, code: '', errors }
    }

    if (!requests) requests = (buildFn || build)({ mode })

    if (Array.isArray(reload) && reload.length > 0) {
      requests.push(resourceGetRequest(reload, {}))
    }

    if (!requests || !requests.length) {
      if (notify) $q.notify({ type: 'warning', message: 'Nothing to submit.', position: 'top' })
      return { success: false, response: null, code: '' }
    }

    meta.submitting = true
    meta.saving = true
    try {
      const response = await resourceIoStore.runBatchRequests(requests)
      const success = !responseFailed(response)
      const code = batchResultCode(response, 0)
      if (!success) {
        if (notify) $q.notify({ type: 'negative', message: failureMessage(response, 'Request failed.'), position: 'top' })
      } else {
        if (notify) $q.notify({ type: 'positive', message: successMsg, position: 'top' })
        if (onSuccess) onSuccess({ response, code })
      }
      return { success, response, code }
    } finally {
      meta.submitting = false
      meta.saving = false
    }
  }

  async function submit (opts = {}) {
    return run({ ...opts, mode: 'submit', successMsg: opts.successMsg || 'Saved successfully.' })
  }

  async function saveDraft (opts = {}) {
    console.warn('saveDraft is deprecated. Use submit() and set Progress to DRAFT instead.')
    return submit({ ...opts, successMsg: 'Draft saved.' })
  }

  // ----------------------------------------------------------------------
  // Validation + lifecycle
  // ----------------------------------------------------------------------
  function validateNode (node) {
    const errors = []
    try {
      const headers = requiredHeaders.value

      if (node.many) {
        node.records.forEach((rec, idx) => {
          if (!rec || rec.status === 'Inactive') return
          headers.forEach(field => {
            const val = rec.data?.[field]
            if (val === undefined || val === null || val === '') {
              errors.push({
                resource: node.resource,
                field,
                message: `Row ${idx + 1}: ${field} is required`,
                index: idx
              })
            }
          })
        })
      } else {
        headers.forEach(field => {
          const val = node.record?.[field]
          if (val === undefined || val === null || val === '') {
            errors.push({
              resource: node.resource,
              field,
              message: `${field} is required`
            })
          }
        })
      }
    } catch (e) {
      console.warn('Generic validation error', e)
    }

    if (strategy.validate) {
      errors.push(...strategy.validate(node, state))
    }
    return errors
  }

  const validationErrors = computed(() => {
    const all = []
    for (const [, node] of state.nodes) all.push(...validateNode(node))
    return all
  })

  // plain (non-reactive) deep copy of the node tree — for send/debug snapshots.
  // Must go through Object.fromEntries: a Map has no enumerable own properties, so
  // JSON.stringify(map) is always "{}".
  // Keyed by the readable address ('Outlets', 'OutletVisits:next'), not by the raw
  // uid — a snapshot of uid soup is useless for debugging.
  function snapshot () {
    const out = {}
    for (const [name, roles] of Object.entries(state.index)) {
      for (const [role, id] of Object.entries(roles)) {
        const node = state.nodes.get(id)
        if (node) out[role === DEFAULT_ROLE ? name : `${name}:${role}`] = node
      }
    }
    return JSON.parse(JSON.stringify(toRaw(out)))
  }

  function reset () {
    detachAll()
    state.primaryKey = null
    Object.assign(meta, {
      saving: false,
      submitting: false,
      loading: false,
      currentStep: 1,
      validationErrors: {},
      formActionsHeight: 0
    })
  }

  return {
    // state + meta
    state,
    meta,
    // mutations
    initResource,
    resetForResource,
    hasNode,
    hasNodes,
    load,
    setField,
    setFields,
    setControlField,
    getControlField,
    addChild,
    updateChild,
    removeChild,
    setChildAction,
    addRecord,
    updateRecord,
    removeRecord,
    selectOption,
    // workflow actions queued into this page's batch (see §6.4 / §7 in PAGE_STATE.md)
    includeAdditionalAction,
    excludeAdditionalAction,
    additionalActionRequests,
    // section helper
    useNode,
    // build / hydrate
    build,
    hydrate,
    // triggers (return { success, response, code })
    submit,
    saveDraft,
    // Low-level dispatch — state/requests -> server -> response, with the same
    // validate/notify/submitting lifecycle as submit(). Exposed for callers
    // (e.g. PageAction.vue) that need to apply a `modifyPayload` interceptor to
    // a request before dispatch.
    run,
    // misc
    validationErrors,
    snapshot,
    reset
  }
}
