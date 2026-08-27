import { reactive, onScopeDispose } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { responseFailed, failureMessage, batchResultCode, resourceGetRequest } from '../resourceRequests'
import { useNodeRegistry } from './useNodeRegistry'
import { usePageStateMutations } from './usePageStateMutations'
import { usePageStateActions } from './usePageStateActions'
import { usePageStateBuild } from './usePageStateBuild'
import { usePageStateValidation } from './usePageStateValidation'
import { usePageStateSerialization } from './usePageStateSerialization'
import { usePageStateDraft } from './usePageStateDraft'
import { usePageStateDerive } from './usePageStateDerive'

function metaDefaults () {
  return {
    saving: false,
    submitting: false,
    currentStep: 1,
    // True for a brief settle window around a wizard step change, so the action
    // bar cannot be double-clicked while its buttons swap for the new step.
    stepping: false
  }
}

// Page-level form state: provided once at Page.vue, injected by the sections.
// Optional strategy: controls, getOptions, hydrate, build, validate.
export function usePageState (strategy = {}, options = {}) {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()

  const state = reactive({
    primaryKey: null,
    nodes: new Map(),
    index: {},
    // Queued executeAction envelopes. Kept OUTSIDE `nodes` on purpose: an action
    // is not a record body, and build must emit it after every node request so a
    // `$ref` to a record created in the same batch resolves.
    actions: [],
    // Resources to re-read once the batch has written. Page level, not per node —
    // a reload is about the batch. Cursors are the transport's job, never ours.
    reload: [],
    // Page-level controls, [{ header, value }]. Outlive every node, so a value the
    // user typed about a node survives that node being removed and re-added.
    controls: []
  })
  const meta = reactive(metaDefaults())

  const optionResolver = strategy.getOptions || (() => [])
  const registry = useNodeRegistry({ state, strategy, optionResolver })

  const actions = usePageStateActions({ state, registry })
  const { defaultHydrate, defaultBuild, reloadNames } = usePageStateBuild({
    state,
    registry,
    additionalActionRequests: actions.additionalActionRequests
  })

  const hydrate = strategy.hydrate || defaultHydrate
  const build = strategy.build || defaultBuild

  const mutations = usePageStateMutations({ state, registry, hydrate })
  const derive = usePageStateDerive({ registry, mutations })
  // Layer 2 declares derivations; they are registered as nodes are hydrated and torn
  // down with the page.
  // Assigned once the API object below exists. A draft restore can hydrate nodes before
  // then, and a handler with no pageState to write to has nothing to do.
  let pageApi = null
  mutations.bindDerive((entries) => { if (pageApi) derive.register(entries, pageApi) })
  onScopeDispose(() => derive.stop())
  const { validationErrors, nodeValidation } = usePageStateValidation({ state, registry, strategy })
  const { snapshot, serializeDraft, applyDraft } = usePageStateSerialization({ state, meta, registry, setResource: mutations.setResource })

  const draft = usePageStateDraft({
    enabled: () => {
      const fromOptions = typeof options.persist === 'function' ? options.persist() : options.persist
      return fromOptions !== false && strategy.persist !== false
    },
    probe: () => ({ count: state.nodes.size, codes: [...state.nodes.values()].map((n) => n.code).filter(Boolean) }),
    sources: [state, () => meta.currentStep],
    serialize: serializeDraft,
    apply: applyDraft
  })

  function resetMeta () {
    Object.assign(meta, metaDefaults())
  }

  // Flushes nodes left over from a previously-visited resource page before the
  // new active resource takes over as primaryKey.
  function resetForResource (resource) {
    derive.clear()
    registry.detachAll()
    state.controls.splice(0)
    state.reload.splice(0)
    state.primaryKey = registry.toResourceName(resource)
    resetMeta()
  }

  function initResource (resource, opts = {}) {
    return registry.initResource(resource, { ...opts, onReset: resetForResource })
  }

  // Replaces the re-read list. Cursors are added by the transport, so this is
  // only ever resource names.
  function setReload (resources = []) {
    const names = (Array.isArray(resources) ? resources : [resources]).filter(Boolean)
    state.reload.splice(0, state.reload.length, ...new Set(names))
    return state.reload
  }

  function reset () {
    derive.clear()
    registry.detachAll()
    state.controls.splice(0)
    state.reload.splice(0)
    state.primaryKey = null
    resetMeta()
  }

  // useNode gains `validation` here — the registry deliberately knows nothing
  // about required headers or the strategy's validate hook.
  function useNode (resource, role) {
    const bound = registry.useNode(resource, role)
    return { ...bound, validation: nodeValidation(bound.node) }
  }

  // Every trigger funnels through here: state -> requests -> server -> response.
  async function run ({ requests, build: buildFn, mode = 'submit', onSuccess, reload = [], notify = true, successMsg } = {}) {
    const errors = validationErrors.value
    if (errors.length > 0) {
      if (notify) $q.notify({ type: 'negative', message: errors[0].message, position: 'top' })
      return { success: false, response: null, code: '', errors }
    }

    if (requests) {
      // Externally supplied requests never went through build(), so the re-read
      // has to be appended here instead.
      const names = reloadNames(reload)
      if (names.length) requests.push(resourceGetRequest(names, {}))
    } else {
      requests = (buildFn || build)({ mode, reload })
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
        // Only a success clears the draft — a failure must leave the user's work
        // in storage so a reload can still bring it back.
        draft.clearDraft()
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

  const api = {
    state,
    meta,
    initResource,
    resetForResource,
    hasNode: registry.hasNode,
    hasNodes: registry.hasNodes,
    removeNode: registry.removeNode,
    setReload,
    ...mutations,
    ...actions,
    useNode,
    build,
    hydrate,
    submit,
    saveDraft,
    // Low-level dispatch, same validate/notify/submitting lifecycle as submit().
    // Exposed for callers that apply a `modifyPayload` interceptor before dispatch.
    run,
    draftKey: draft.draftKey,
    persistDraft: draft.persistDraft,
    restoreDraft: draft.restoreDraft,
    clearDraft: draft.clearDraft,
    validationErrors,
    snapshot,
    reset,
    // Derivations declared outside an envelope, for a page that needs one of its own.
    derive: (entries) => derive.register(entries, pageApi),
    clearDerive: derive.clear
  }

  pageApi = api
  return api
}
