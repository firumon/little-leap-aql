import { computed } from 'vue'

// The friendly write API. Every mutation resolves its node through the registry,
// so no consumer ever assigns into a node or a child row directly.
export function usePageStateMutations ({ state, registry, hydrate }) {
  const { ensureNode, peekNode, childBucket, toResourceName, resolveTarget } = registry

  const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

  // A row may arrive as { _action, data } or as a bare record body.
  const toRow = (row) => (isPlainObject(row) && 'data' in row
    ? { _action: row._action || 'create', data: { ...row.data } }
    : { _action: 'create', data: { ...row } })

  // setResource('X', payload) | setResource('X', 'role', payload) | setResource(payload)
  function resourceArgs (a, b, c) {
    if (c !== undefined) return { target: a, role: b, payload: c }
    if (b !== undefined) return { target: a, role: undefined, payload: b }
    return { target: { resource: a?.resource, role: a?.role }, role: undefined, payload: a }
  }

  // Writes a plain node-shaped object into a node. `replace` clears what the
  // payload leaves out; otherwise the payload is merged in. `controls` is only
  // ever touched when the payload names it — it is working state, not record data.
  function writeNode (target, role, payload, replace) {
    if (!isPlainObject(payload)) throw new Error('[pageState] setResource needs a node-shaped object')
    const { name } = resolveTarget(target, role)
    if (!name) throw new Error('[pageState] setResource needs a resource name')

    const children = payload.children || []
    const records = payload.records || []
    const many = payload.many !== undefined ? payload.many === true : records.length > 0
    if (many && children.length) {
      throw new Error(`[pageState] "${name}" cannot be many:true and carry children — build() drops the children.`)
    }

    const node = ensureNode(target, role)
    if (payload.code !== undefined) node.code = payload.code
    if (payload.many !== undefined || records.length) node.many = many

    const record = payload.record || {}
    if (replace) for (const key of Object.keys(node.record)) if (!(key in record)) delete node.record[key]
    Object.assign(node.record, record)

    if (payload.children || replace) {
      const buckets = children.map((b) => ({ resource: toResourceName(b.resource), records: (b.records || []).map(toRow) }))
      if (replace) node.children.splice(0, node.children.length, ...buckets)
      else {
        for (const bucket of buckets) {
          const existing = childBucket(node, bucket.resource)
          if (existing) existing.records.splice(0, existing.records.length, ...bucket.records)
          else node.children.push(bucket)
        }
      }
    }

    if (payload.records || replace) {
      const rows = records.map(toRow)
      if (replace) node.records.splice(0, node.records.length, ...rows)
      else node.records.push(...rows)
    }

    if (payload.controls) {
      // Drop only the { header, value } half — the { name, codeType } schema half
      // is re-seeded by strategy.controls and must survive.
      if (replace) {
        for (let i = node.controls.length - 1; i >= 0; i--) if (node.controls[i].header !== undefined) node.controls.splice(i, 1)
      }
      for (const ctrl of payload.controls) {
        if (ctrl?.header === undefined) continue
        const existing = node.controls.find((c) => c.header === ctrl.header)
        if (existing) existing.value = ctrl.value
        else node.controls.push({ header: ctrl.header, value: ctrl.value })
      }
    }

    hoistBatchExtras(payload)
    return node
  }

  function toActionEntry (entry) {
    if (!isPlainObject(entry)) return null
    const request = entry.request || (entry.action === 'executeAction' ? entry : null)
    if (!request) {
      throw new Error('[pageState] an `actions` entry needs a ready executeAction request — use includeAdditionalAction for config-driven ones')
    }
    const resource = entry.resource || request.resource
    const actionName = entry.actionName || request.payload?.actionName
    return { key: entry.key || `${resource}::${actionName}`, resource, actionName, request }
  }

  // `reload` and `actions` on a payload belong to the BATCH, not the node. Several
  // nodes contribute to one batch, so hoisting is always additive — a later
  // setResource must never wipe what an earlier one asked for.
  function hoistBatchExtras (payload) {
    for (const name of payload.reload || []) {
      if (name && !state.reload.includes(name)) state.reload.push(name)
    }
    for (const entry of payload.actions || []) {
      const normalized = toActionEntry(entry)
      if (!normalized) continue
      const at = state.actions.findIndex((e) => e.key === normalized.key)
      if (at >= 0) state.actions.splice(at, 1, normalized)
      else state.actions.push(normalized)
    }
  }

  function setResource (a, b, c) {
    const { target, role, payload } = resourceArgs(a, b, c)
    return writeNode(target, role, payload, true)
  }

  function updateResource (a, b, c) {
    const { target, role, payload } = resourceArgs(a, b, c)
    return writeNode(target, role, payload, false)
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

  // `node.record` is reserved for canonical headers sent to GAS. Custom UI or
  // wizard-only fields live in `node.controls` so they never leak into payloads.
  function setControlField (resource, header, value, role) {
    const node = ensureNode(resource, role)
    const entry = node.controls.find((c) => c.header === header)
    if (entry) entry.value = value
    else node.controls.push({ header, value })
    return node
  }

  function getControlField (resource, header, role) {
    return peekNode(resource, role)?.controls.find((c) => c.header === header)?.value
  }

  // Page-level controls — same [{ header, value }] shape as a node's, but they
  // live on `state` so they outlive any node. Pass `resource` (and `role`) to
  // address a node's controls instead. Writes create the node; reads never do.
  function controlList (resource, role, create) {
    if (!toResourceName(resource)) return state.controls
    return create ? ensureNode(resource, role).controls : (peekNode(resource, role)?.controls || null)
  }

  function setControl (header, value, resource, role) {
    const list = controlList(resource, role, true)
    const entry = list.find((c) => c.header === header)
    if (entry) entry.value = value
    else list.push({ header, value })
    return value
  }

  function getControl (header, fallback = null, resource, role) {
    const value = controlList(resource, role, false)?.find((c) => c.header === header)?.value
    return value === undefined || value === null ? fallback : value
  }

  // Writable computed, so a template can v-model a control directly.
  function useControl (header, fallback = null, resource, role) {
    return computed({
      get: () => getControl(header, fallback, resource, role),
      set: (value) => setControl(header, value, resource, role)
    })
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
    const bucket = childBucket(ensureNode(resource), childResource)
    if (bucket && bucket.records[index]) bucket.records[index].data = { ...bucket.records[index].data, ...patch }
  }

  function removeChild (resource, childResource, index) {
    const bucket = childBucket(ensureNode(resource), childResource)
    if (bucket) bucket.records.splice(index, 1)
  }

  // `updateChild` merges `data` only, so this is the way to soft-delete a
  // persisted row ('deactivate') or restore it ('update').
  function setChildAction (resource, childResource, index, action) {
    const entry = childBucket(ensureNode(resource), childResource)?.records[index]
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
    ensureNode(resource).records.splice(index, 1)
  }

  function selectOption (resource, field, value) {
    return setField(resource, field, value)
  }

  return {
    load,
    setResource,
    updateResource,
    setField,
    setFields,
    setControlField,
    getControlField,
    setControl,
    getControl,
    useControl,
    addChild,
    updateChild,
    removeChild,
    setChildAction,
    addRecord,
    updateRecord,
    removeRecord,
    selectOption
  }
}
