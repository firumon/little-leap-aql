import { toRaw } from 'vue'
import { DEFAULT_ROLE } from './useNodeRegistry'

// Node tree <-> plain JSON. `snapshot` is for debug; `serializeDraft`/`applyDraft`
// are the callbacks usePageStateDraft persists to localStorage.
export function usePageStateSerialization ({ state, meta, registry, setResource }) {
  // Keyed by the readable address, not the raw uid — a snapshot of uid soup is
  // useless for debugging. Object.fromEntries-style walk: a Map stringifies to {}.
  function snapshot () {
    const out = {}
    registry.eachAddressedNode((node, { name, role }) => {
      out[role === DEFAULT_ROLE ? name : `${name}:${role}`] = node
    })
    // `$page` cannot collide with a resource name, so the page-level buckets sit
    // alongside the nodes without shadowing one.
    if (state.controls.length || state.reload.length || state.actions.length) {
      out.$page = { controls: state.controls, reload: state.reload, actions: state.actions }
    }
    return JSON.parse(JSON.stringify(toRaw(out)))
  }

  function serializeDraft () {
    const nodes = []
    let hasData = false
    registry.eachAddressedNode((node, { role }) => {
      // Only { header, value } entries are kept — the { name, codeType } schema
      // half is re-seeded by strategy.controls on every initResource.
      const controls = node.controls.filter((c) => c.header !== undefined)
      nodes.push({ resource: node.resource, role, code: node.code, many: node.many, record: node.record, children: node.children, records: node.records, controls })
      if (Object.keys(node.record).length || node.children.length || node.records.length || controls.length) hasData = true
    })
    // Top level, NOT inside a node entry — page controls must restore even when
    // the nodes they relate to do not exist yet.
    const controls = state.controls.filter((c) => c.header !== undefined)
    if (controls.length) hasData = true
    // A queued action is real user intent, so it counts as data worth keeping.
    // `reload` is plumbing — it never makes an otherwise-blank page worth saving.
    const actions = state.actions.filter((entry) => entry?.request)
    if (actions.length) hasData = true
    return JSON.parse(JSON.stringify({
      primaryKey: state.primaryKey, currentStep: meta.currentStep,
      nodes, controls, actions, reload: [...state.reload], hasData
    }))
  }

  function applyDraft (payload) {
    if (!payload || !Array.isArray(payload.nodes)) return false
    // A node the draft carries but the page has not created is a conditional
    // workflow node — the user's own input is what brought it into being.
    for (const entry of payload.nodes) {
      if (!entry?.resource) continue
      setResource({ ...entry, role: entry.role || DEFAULT_ROLE })
    }
    for (const ctrl of payload.controls || []) {
      if (ctrl?.header === undefined) continue
      const existing = state.controls.find((c) => c.header === ctrl.header)
      if (existing) existing.value = ctrl.value
      else state.controls.push({ header: ctrl.header, value: ctrl.value })
    }
    // Additive, like payload hoisting — a restore must not wipe what the page
    // already seeded on mount.
    for (const name of payload.reload || []) {
      if (name && !state.reload.includes(name)) state.reload.push(name)
    }
    for (const entry of payload.actions || []) {
      if (!entry?.key || !entry.request) continue
      const at = state.actions.findIndex((e) => e.key === entry.key)
      if (at >= 0) state.actions.splice(at, 1, entry)
      else state.actions.push(entry)
    }
    if (payload.primaryKey) state.primaryKey = payload.primaryKey
    if (payload.currentStep) meta.currentStep = payload.currentStep
    return true
  }

  return { snapshot, serializeDraft, applyDraft }
}
