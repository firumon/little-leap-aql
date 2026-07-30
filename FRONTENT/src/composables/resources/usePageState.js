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
 * Strategy contract (resource-specific override, optional)
 * --------------------------------------------------------------------------
 *   {
 *     controls(resource)        -> [{ name, codeType? }]   // field schema; codeType -> auto options
 *     getOptions(codeType, node) -> [{ label, value }]      // option lists for XxxCode columns
 *     actionConfigs             -> { actionKey: { action, column, columnValue } }  // for setAction(string)
 *     hydrate(node, raw, ctx)   -> void                     // load existing server record into node
 *     build(ctx)                -> [request]                // override generic request assembly
 *     validate(node, state)     -> [{ field, message }]     // per-node validation
 *   }
 */

import { reactive, computed, toRaw } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig } from './useResourceConfig'
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

// ==========================================================================
// Composable
// ==========================================================================
export function usePageState (strategy = {}) {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const { requiredHeaders } = useResourceConfig()

  // --- core reactive state (one node per resource) ---
  const state = reactive({
    primaryKey: null,
    nodes: new Map()
  })

  // page-level UI meta (shared by Content + Action sections)
  const meta = reactive({
    saving: false,
    submitting: false,
    loading: false,
    currentStep: 1,
    validationErrors: {},
    // Workflow action dialog — set by AdditionalActions/CrudActions-family sub-sections,
    // read by the ActionDialog mounted once in Page.vue so a PageAction container
    // override can never swallow the dialog.
    actionDialog: {
      show: false,
      actionConfig: null
    },
    // Measured height of the FormAction sticky bar (0 until FormAction.vue mounts
    // and reports it) — CrudActions reads this to keep its FAB clear of the bar.
    formActionsHeight: 0
  })

  const hydrate = strategy.hydrate || defaultHydrate
  const build = strategy.build || defaultBuild
  const optionResolver = strategy.getOptions || (() => [])
  const emptyNode = createNode('__empty__')

  // ----------------------------------------------------------------------
  // Node factory — everything under the hood
  // ----------------------------------------------------------------------
  function createNode (resource, { code = null, many = false, action = null } = {}) {
    return reactive({
      identifier: uid(),
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

  function ensureNode (resource) {
    if (!state.nodes.has(resource)) return initResource(resource)
    return state.nodes.get(resource)
  }

  // ----------------------------------------------------------------------
  // PUBLIC MUTATIONS
  // ----------------------------------------------------------------------
  function initResource (resource, { code = null, many = false, fields = {}, action = null, isPrimaryKey = false, reset = false } = {}) {
    if (reset) resetForResource(resource)

    const node = createNode(resource, { code, many, action })
    Object.assign(node.record, fields)
    if (strategy.controls) {
      node.controls = strategy.controls(resource) || []
      for (const ctrl of node.controls) {
        if (ctrl.codeType) node.options[ctrl.name] = optionResolver(ctrl.codeType, node)
      }
    }
    state.nodes.set(resource, node)
    if (!state.primaryKey || isPrimaryKey || state.primaryKey !== resource) state.primaryKey = resource
    return node
  }

  // Flushes stale nodes left over from a previously-visited resource page before
  // the new active resource takes over as primaryKey — called by initResource
  // when { reset: true } (e.g. on a Create/Update page mount or resource switch).
  function resetForResource (resource) {
    state.nodes = new Map()
    state.primaryKey = resource
    Object.assign(meta, {
      saving: false,
      submitting: false,
      loading: false,
      currentStep: 1,
      validationErrors: {},
      actionDialog: { show: false, actionConfig: null },
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

  function getControlField (resource, header) {
    const node = state.nodes.get(resource)
    return node?.controls.find((c) => c.header === header)?.value
  }

  function addChild (resource, childResource, row, { action = 'create' } = {}) {
    const node = ensureNode(resource)
    let bucket = node.children.find(c => c.resource === childResource)
    if (!bucket) {
      bucket = { resource: childResource, records: [] }
      node.children.push(bucket)
    }
    bucket.records.push({ _action: action, data: { ...row } })
    return bucket
  }

  function updateChild (resource, childResource, index, patch) {
    const node = ensureNode(resource)
    const bucket = node.children.find(c => c.resource === childResource)
    if (bucket && bucket.records[index]) bucket.records[index].data = { ...bucket.records[index].data, ...patch }
  }

  function removeChild (resource, childResource, index) {
    const node = ensureNode(resource)
    const bucket = node.children.find(c => c.resource === childResource)
    if (bucket) bucket.records.splice(index, 1)
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

  function setAction (resource, actionName) {
    const node = ensureNode(resource)
    node.action = actionName
    return node
  }

  // writes the user's chosen value into record (options themselves are read-only computed)
  function selectOption (resource, field, value) {
    return setField(resource, field, value)
  }

  // ----------------------------------------------------------------------
  // useNode — per-section reactive access
  // ----------------------------------------------------------------------
  function useNode (resource) {
    const node = computed(() => state.nodes.get(resource) || emptyNode)
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
    return { node, options, validation }
  }

  // ----------------------------------------------------------------------
  // GENERIC build / hydrate (overridable via strategy)
  // ----------------------------------------------------------------------
  function defaultHydrate (node, raw) {
    Object.assign(node.record, raw || {})
    if (raw && raw.Code) node.code = raw.Code
  }

  function resolveActionConfig (action) {
    if (typeof action === 'string') {
      const map = strategy.actionConfigs || {}
      if (map[action]) return map[action]
      return { action, column: 'Progress' }
    }
    return action
  }

  function defaultBuild () {
    const requests = []
    for (const [resource, node] of state.nodes) {
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

      if (node.action) {
        requests.push(executeActionRequest(resource, node.code, resolveActionConfig(node.action), {}))
      }
    }
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

  async function executeAction (resource, actionName, fields = {}, opts = {}) {
    const node = ensureNode(resource)
    const requests = [executeActionRequest(resource, node.code, resolveActionConfig(actionName), fields)]
    return run({ ...opts, requests, successMsg: 'Action completed.' })
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

  // plain (non-reactive) deep copy of the node tree — for send/debug snapshots
  function snapshot () {
    return JSON.parse(JSON.stringify(toRaw(state.nodes)))
  }

  function reset () {
    state.nodes = new Map()
    state.primaryKey = null
    Object.assign(meta, {
      saving: false,
      submitting: false,
      loading: false,
      currentStep: 1,
      validationErrors: {},
      actionDialog: { show: false, actionConfig: null },
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
    load,
    setField,
    setFields,
    setControlField,
    getControlField,
    addChild,
    updateChild,
    removeChild,
    addRecord,
    updateRecord,
    removeRecord,
    setAction,
    selectOption,
    // section helper
    useNode,
    // build / hydrate
    build,
    hydrate,
    // triggers (return { success, response, code })
    submit,
    saveDraft,
    executeAction,
    // Low-level dispatch — state/requests -> server -> response, with the same
    // validate/notify/submitting lifecycle as submit()/executeAction(). Exposed
    // for callers (e.g. PageAction.vue) that need to apply a `modifyPayload`
    // interceptor to an executeAction request before dispatch.
    run,
    // misc
    validationErrors,
    snapshot,
    reset
  }
}
