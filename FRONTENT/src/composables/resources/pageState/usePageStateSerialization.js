import { toRaw } from 'vue'
import { DEFAULT_ROLE } from './useNodeRegistry'

// Node tree <-> plain JSON. `snapshot` is for debug; `serializeDraft`/`applyDraft`
// are the callbacks usePageStateDraft persists to localStorage.
export function usePageStateSerialization ({ state, meta, registry }) {
  // Keyed by the readable address, not the raw uid — a snapshot of uid soup is
  // useless for debugging. Object.fromEntries-style walk: a Map stringifies to {}.
  function snapshot () {
    const out = {}
    registry.eachAddressedNode((node, { name, role }) => {
      out[role === DEFAULT_ROLE ? name : `${name}:${role}`] = node
    })
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
    return JSON.parse(JSON.stringify({ primaryKey: state.primaryKey, currentStep: meta.currentStep, nodes, hasData }))
  }

  function applyDraft (payload) {
    if (!payload || !Array.isArray(payload.nodes)) return false
    for (const entry of payload.nodes) {
      if (!entry?.resource) continue
      const role = entry.role || DEFAULT_ROLE
      // A node the draft carries but the page has not created is a conditional
      // workflow node — the user's own input is what brought it into being.
      const node = registry.peekNode(entry.resource, role) ||
        registry.initResource(entry.resource, { role, code: entry.code, many: entry.many })

      const record = entry.record || {}
      for (const key of Object.keys(node.record)) if (!(key in record)) delete node.record[key]
      Object.assign(node.record, record)

      if (entry.code) node.code = entry.code
      node.many = !!entry.many

      const children = (entry.children || []).map((bucket) => ({
        resource: bucket.resource,
        records: (bucket.records || []).map((r) => ({ _action: r._action || 'create', data: { ...r.data } }))
      }))
      node.children.splice(0, node.children.length, ...children)

      const records = (entry.records || []).map((r) => ({ _action: r._action || 'create', data: { ...r.data } }))
      node.records.splice(0, node.records.length, ...records)

      for (const ctrl of entry.controls || []) {
        if (ctrl?.header === undefined) continue
        const existing = node.controls.find((c) => c.header === ctrl.header)
        if (existing) existing.value = ctrl.value
        else node.controls.push({ header: ctrl.header, value: ctrl.value })
      }
    }
    if (payload.primaryKey) state.primaryKey = payload.primaryKey
    if (payload.currentStep) meta.currentStep = payload.currentStep
    return true
  }

  return { snapshot, serializeDraft, applyDraft }
}
