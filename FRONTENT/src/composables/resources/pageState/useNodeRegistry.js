import { reactive, computed, unref } from 'vue'

// The role a consumer gets when it addresses a resource by name alone.
export const DEFAULT_ROLE = '$default'

function uid () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Owns node storage and addressing. Read nodes through useNode/ensureNode/hasNode,
// never `state.nodes` or `state.index`. Roles are names, never positions.
export function useNodeRegistry ({ state, strategy = {}, optionResolver = () => [] }) {
  function createNode (resource, { code = null, many = false } = {}) {
    return reactive({
      resource,
      code,
      many,
      record: {},
      children: [],
      records: [],
      // Extra keys merged into the built request's payload, for the few GAS writes that
      // take one beside the record (linkedPurchaseRequisitionCode).
      payload: {},
      // Dual-purpose: { name, codeType } seeded by strategy.controls, and
      // { header, value } upserted by setControlField for non-schema fields.
      controls: [],
      options: {}
    })
  }

  // Consumers may pass a string, a ref, or a getter, so a component whose active
  // resource changes on navigation binds once at setup.
  function toResourceName (resource) {
    return typeof resource === 'function' ? resource() : unref(resource)
  }

  // A target is 'Outlets', a ref/getter of it, or { resource, role }.
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

  // Build order. An address keeps the slot it first claimed, so re-attaching or
  // removing and re-adding a node cannot reorder the batch and break a `$ref`.
  const slotOfAddress = new Map()
  const slotOfId = new Map()
  let nextSlot = 0

  function claimSlot (name, role, id) {
    const address = `${name}::${role}`
    if (!slotOfAddress.has(address)) slotOfAddress.set(address, nextSlot++)
    slotOfId.set(id, slotOfAddress.get(address))
  }

  // THE only place a node enters. Re-attaching a (resource, role) drops the
  // previous node, so a re-init cannot orphan an unaddressable entry.
  function attachNode (name, role, node) {
    const id = uid()
    if (!state.index[name]) state.index[name] = {}
    const previous = state.index[name][role]
    if (previous) {
      state.nodes.delete(previous)
      slotOfId.delete(previous)
    }
    state.index[name][role] = id
    state.nodes.set(id, node)
    claimSlot(name, role, id)
    return id
  }

  // Drops ONE node. Queued actions are left alone — a caller that also wants the
  // action gone calls excludeAdditionalAction itself.
  function removeNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    if (!id) return false
    state.nodes.delete(id)
    slotOfId.delete(id)
    delete state.index[name][r]
    if (!Object.keys(state.index[name]).length) delete state.index[name]
    return true
  }

  // THE only place every node leaves. Both structures clear together — a stale
  // uid would resolve to a blank node and silently build an empty payload.
  function detachAll () {
    state.nodes = new Map()
    state.index = {}
    state.actions.splice(0)
    slotOfAddress.clear()
    slotOfId.clear()
    nextSlot = 0
  }

  function initResource (resource, { role, code = null, many = false, fields = {}, isPrimaryKey = false, reset = false, onReset } = {}) {
    const { name, role: r } = resolveTarget(resource, role)
    if (reset) onReset?.(name)

    const node = createNode(name, { code, many })
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

  function ensureNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    return (id ? state.nodes.get(id) : null) || initResource(name, { role: r })
  }

  // Read-only lookup — must NOT create a node the way ensureNode does.
  function peekNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    return id ? state.nodes.get(id) || null : null
  }

  function hasNode (target, role) {
    const { name, role: r } = resolveTarget(target, role)
    const id = nodeIdFor(name, r)
    return !!id && state.nodes.has(id)
  }

  // True once ANY node is attached. Lets a container with no business knowing
  // the resource (PageAction) tell an initialized form page from a blank one.
  const hasNodes = computed(() => state.nodes.size > 0)

  // The single place that knows the child bucket layout.
  function childBucket (node, childResource) {
    const name = toResourceName(childResource)
    return node.children.find(c => c.resource === name) || null
  }

  // Slot order — the order each address FIRST appeared. Request order depends on
  // this, and a `$ref` breaks if it moves.
  function eachNode (visit) {
    const entries = []
    for (const [id, node] of state.nodes) entries.push([slotOfId.get(id) ?? Infinity, node])
    entries.sort((a, b) => a[0] - b[0])
    for (const [, node] of entries) visit(node)
  }

  // Same slot order, plus the readable address. For snapshots and drafts, so a
  // restored draft re-claims its slots in the order they were first claimed.
  function eachAddressedNode (visit) {
    const entries = []
    for (const [name, roles] of Object.entries(state.index)) {
      for (const [role, id] of Object.entries(roles)) {
        const node = state.nodes.get(id)
        if (node) entries.push([slotOfId.get(id) ?? Infinity, node, { name, role, id }])
      }
    }
    entries.sort((a, b) => a[0] - b[0])
    for (const [, node, address] of entries) visit(node, address)
  }

  // THE read accessor. `node` is ALWAYS an object — a missing node resolves to a
  // blank one, so every returned computed is safe to read before initResource has
  // run, or after removeNode. The blank is created per call: a shared one let a
  // v-model bound while the node was missing leak into every other missing node.
  function useNode (resource, role = DEFAULT_ROLE) {
    const blank = createNode('')
    const target = computed(() => resolveTarget(resource, role))
    const nodeId = computed(() => nodeIdFor(target.value.name, target.value.role))
    const node = computed(() => (nodeId.value && state.nodes.get(nodeId.value)) || blank)
    const exists = computed(() => !!nodeId.value && state.nodes.has(nodeId.value))
    const record = computed(() => node.value.record)
    // Changes when the node is REPLACED, not when a field is edited — consumers
    // key one-shot hydration off this so a reset re-seeds from the server.
    const identifier = computed(() => nodeId.value)
    const options = computed(() => {
      const n = node.value
      const out = {}
      for (const ctrl of n.controls) {
        if (ctrl.codeType) out[ctrl.name] = optionResolver(ctrl.codeType, n)
      }
      return out
    })
    function children (childResource) {
      return computed(() => childBucket(node.value, childResource)?.records || [])
    }
    return { node, exists, record, identifier, options, children }
  }

  return {
    createNode,
    toResourceName,
    resolveTarget,
    nodeIdFor,
    attachNode,
    removeNode,
    detachAll,
    initResource,
    ensureNode,
    peekNode,
    hasNode,
    hasNodes,
    childBucket,
    eachNode,
    eachAddressedNode,
    useNode
  }
}
