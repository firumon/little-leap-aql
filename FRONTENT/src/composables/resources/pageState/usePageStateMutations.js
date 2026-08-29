import { computed } from 'vue'
import { useResourceConfig } from '../useResourceConfig'
import { actionKeyFor } from './usePageStateActions'

// The friendly write API. Every mutation resolves its node through the registry,
// so no consumer ever assigns into a node or a child row directly.
export function usePageStateMutations ({ state, registry, hydrate, notify }) {
  const { ensureNode, peekNode, childBucket, toResourceName, resolveTarget } = registry

  const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

  // Set by usePageState once the derive registry exists.
  let deriveSink = null
  const bindDerive = (fn) => { deriveSink = fn }

  // A child row is PLAIN DATA here - `{ SKU, Qty }`, never `{ _action, data }`. That
  // wrapper is the GAS wire format and is put on at build() time. A Layer 2 payload may
  // still arrive wrapped, so it is flattened on the way in.
  const toRow = (row) => {
    if (!isPlainObject(row)) return {}
    if (!('data' in row)) return { ...row }
    return { ...(row._action ? { _action: row._action } : {}), ...row.data }
  }

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

    if (payload.payload) Object.assign(node.payload, payload.payload)

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

    const controls = normalizeControls(payload.controls)
    if (payload.controls) {
      // Drop only the { header, value } half — the { name, codeType } schema half
      // is re-seeded by strategy.controls and must survive.
      if (replace) {
        for (let i = node.controls.length - 1; i >= 0; i--) if (node.controls[i].header !== undefined) node.controls.splice(i, 1)
      }
      for (const ctrl of controls) {
        if (ctrl?.header === undefined) continue
        const existing = node.controls.find((c) => c.header === ctrl.header)
        if (existing) existing.value = ctrl.value
        else node.controls.push({ header: ctrl.header, value: ctrl.value })
      }
    }

    hoistBatchExtras(payload)
    return node
  }

  // An `actions` entry is a PURE domain model — { key, resource, code, actionConfig,
  // data }. The executeAction wire request is built from it at build() time. A node's
  // entry may name the action flat (`{ action, code, data }`) and leave the address off:
  // it then inherits the node's own resource and role.
  function toActionEntry (entry, nodeResource, nodeRole) {
    if (!isPlainObject(entry)) return null
    const resource = entry.resource || nodeResource
    const role = entry.role || nodeRole
    const actionConfig = entry.actionConfig || (entry.action
      ? {
          action: entry.action,
          ...(entry.column ? { column: entry.column } : {}),
          ...(entry.columnValue !== undefined ? { columnValue: entry.columnValue } : {})
        }
      : {})
    const actionName = actionConfig.action || actionConfig.actionName || ''
    if (!resource || !actionName) {
      throw new Error('[pageState] an `actions` entry needs a resource and an action name')
    }
    return {
      key: entry.key || actionKeyFor(resource, actionName, role, entry.code || ''),
      resource,
      code: entry.code,
      actionConfig,
      data: entry.data || {},
      reload: Array.isArray(entry.reload) ? entry.reload : []
    }
  }

  // Every resource this page already writes. GAS returns a written resource in the same
  // response, so asking for it back in the re-read is a wasted round trip.
  const writtenResources = () => new Set([...state.nodes.values()].map((node) => node.resource))

  // `reload` and `actions` on a payload belong to the BATCH, not the node. Several
  // nodes contribute to one batch, so hoisting is always additive — a later
  // setResource must never wipe what an earlier one asked for.
  function hoistBatchExtras (payload) {
    if (payload.derive?.length && deriveSink) deriveSink(payload.derive)
    const written = writtenResources()
    for (const name of payload.reload || []) {
      if (name && !written.has(name) && !state.reload.includes(name)) state.reload.push(name)
    }
    for (const entry of payload.actions || []) {
      const normalized = toActionEntry(entry, payload.resource, payload.role)
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

  // True when a node carries nothing build() would ship — an actions-only or reload-only
  // entry. Writing one would attach an empty node that validates but never sends.
  function isBodylessNode (node) {
    if (!isPlainObject(node)) return true
    if (node.code !== undefined && node.code !== null && node.code !== '') return false
    if (node.children?.length || node.records?.length) return false
    return !Object.keys(node.record || {}).length
  }

  // `[{ header, value }]` or `{ header: value }` — both say the same thing.
  function normalizeControls (controls) {
    if (Array.isArray(controls)) return controls.filter((c) => isPlainObject(c) && c.header !== undefined)
    if (isPlainObject(controls)) return Object.entries(controls).map(([header, value]) => ({ header, value }))
    return []
  }

  // Collapses nodes sharing one address, so builders can be concatenated freely. Without
  // this a second node for the same resource would replace the first when written.
  function mergeNodes (nodes = []) {
    const order = []
    const byAddress = new Map()

    for (const node of nodes) {
      if (!isPlainObject(node) || !node.resource) continue
      const address = `${node.resource}::${node.role || '$default'}`
      const existing = byAddress.get(address)
      if (!existing) {
        byAddress.set(address, {
          ...node,
          record: { ...(node.record || {}) },
          children: (node.children || []).map((b) => ({ ...b, records: [...(b.records || [])] })),
          records: [...(node.records || [])],
          reload: [...(node.reload || [])],
          actions: [...(node.actions || [])],
          derive: [...(node.derive || [])],
          controls: normalizeControls(node.controls),
          permissions: { ...(node.permissions || {}) },
          payload: { ...(node.payload || {}) }
        })
        order.push(address)
        continue
      }
      if (node.code !== undefined) existing.code = node.code
      if (node.many !== undefined) existing.many = node.many
      if (node.successMsg) existing.successMsg = node.successMsg
      if (node.outcome) existing.outcome = node.outcome
      Object.assign(existing.record, node.record || {})
      Object.assign(existing.payload, node.payload || {})
      Object.assign(existing.permissions, node.permissions || {})
      existing.records.push(...(node.records || []))
      existing.reload.push(...(node.reload || []))
      existing.actions.push(...(node.actions || []))
      existing.derive.push(...(node.derive || []))
      existing.controls.push(...normalizeControls(node.controls))
      for (const bucket of node.children || []) {
        const target = existing.children.find((b) => b.resource === bucket.resource)
        if (target) target.records.push(...(bucket.records || []))
        else existing.children.push({ ...bucket, records: [...(bucket.records || [])] })
      }
    }

    return order.map((address) => {
      const merged = byAddress.get(address)
      merged.reload = [...new Set(merged.reload)]
      if (!merged.records.length && merged.many !== true) delete merged.records
      if (!merged.children.length) delete merged.children
      if (!merged.actions.length) delete merged.actions
      if (!merged.derive.length) delete merged.derive
      if (!merged.controls.length) delete merged.controls
      if (!Object.keys(merged.payload).length) delete merged.payload
      return merged
    })
  }

  // `permissions` is `{ action: 'message shown when denied' }`, checked against the
  // node's own resource. The first gap stops the WHOLE batch — a half-applied
  // submission is worse than none.
  function permissionGap (node) {
    if (!isPlainObject(node.permissions) || !node.resource) return null
    const { allowed } = useResourceConfig(node.resource)
    for (const [action, message] of Object.entries(node.permissions)) {
      if (allowed(action, node.resource) === true) continue
      return message || `You are not allowed to ${action} ${node.resource}.`
    }
    return null
  }

  function deny (message) {
    if (notify) notify({ type: 'negative', message: message || 'Access denied.', position: 'top' })
    return { valid: false, success: false, message: message || '' }
  }

  // The one door Layer 2 comes through. Takes a Node or an array of Nodes, gates on
  // their permissions, then mounts record, children, controls, actions, derivations
  // and reloads.
  function applyNodes (nodes = []) {
    const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(isPlainObject)

    // A builder that cannot build a valid submission says so with a bare veto.
    const vetoed = list.find((node) => node.valid === false)
    if (vetoed) return deny(vetoed.message)

    const merged = mergeNodes(list)
    for (const node of merged) {
      const gap = permissionGap(node)
      if (gap) return deny(gap)
    }

    const written = []
    for (const node of merged) {
      if (isBodylessNode(node)) hoistBatchExtras(node)
      else written.push(writeNode({ resource: node.resource, role: node.role }, undefined, node, true))
    }

    // A chain may also say what the page should tell the user and where to land.
    const successMsg = merged.map((node) => node.successMsg).filter(Boolean).pop() || ''
    const outcome = merged.map((node) => node.outcome).filter(Boolean).pop() || null
    return {
      valid: true,
      success: true,
      nodes: written,
      ...(successMsg ? { successMsg } : {}),
      ...(outcome ? { outcome } : {})
    }
  }

  // The address is the LAST thing every mutation takes, and it is optional: no
  // resource means the page's primary one, no role means '$default'.
  const nodeAt = (resource, role) => ensureNode(resource || state.primaryKey, role)

  function load (rawRecord = {}, resource, role) {
    const node = nodeAt(resource, role)
    hydrate(node, rawRecord, { raw: rawRecord })
    return node
  }

  // ── record ────────────────────────────────────────────────────────────────
  // One column, or the whole record when `key` is null.
  function setRecord (key, value, resource, role) {
    const node = nodeAt(resource, role)
    if (key) node.record[key] = value
    else Object.assign(node.record, value || {})
    return node
  }

  function getRecord (key = null, resource, role) {
    const record = peekAt(resource, role)?.record
    if (!record) return key ? undefined : null
    return key ? record[key] : record
  }

  // Reads never create a node; a write does, so a v-model can never land in the blank
  // node useNode() hands back for a missing address.
  function useRecord (key = null, resource, role) {
    return computed({
      get: () => getRecord(key, resource, role),
      set: (value) => setRecord(key, value, resource, role)
    })
  }

  // Page-level controls — same [{ header, value }] shape as a node's, but they
  // live on `state` so they outlive any node. Pass `resource` (and `role`) to
  // address a node's controls instead. Writes create the node; reads never do.
  function controlList (resource, role, create) {
    if (!toResourceName(resource)) return state.controls
    return create ? ensureNode(resource, role).controls : (peekNode(resource, role)?.controls || null)
  }

  function setControls (name, value, resource, role) {
    const list = controlList(resource, role, true)
    const entry = list.find((c) => c.header === name)
    if (entry) entry.value = value
    else list.push({ header: name, value })
    return value
  }

  function getControls (name, fallback = null, resource, role) {
    const value = controlList(resource, role, false)?.find((c) => c.header === name)?.value
    return value === undefined || value === null ? fallback : value
  }

  // Writable computed, so a template can v-model a control directly.
  function useControls (name, fallback = null, resource, role) {
    return computed({
      get: () => getControls(name, fallback, resource, role),
      set: (value) => setControls(name, value, resource, role)
    })
  }


  function addChild (childResource, row, resource, role, { action } = {}) {
    const node = nodeAt(resource, role)
    let bucket = childBucket(node, childResource)
    if (!bucket) {
      bucket = { resource: toResourceName(childResource), records: [] }
      node.children.push(bucket)
    }
    bucket.records.push({ ...(action && action !== 'create' ? { _action: action } : {}), ...row })
    return bucket.records.length - 1
  }

  // Merged in place, never replaced: a row's identity is stable so `indexOf` keeps working.
  function updateChild (childResource, index, patch, resource, role) {
    const row = childBucket(nodeAt(resource, role), childResource)?.records[index]
    if (row) Object.assign(row, patch)
  }

  // `index` may be a getter, so a binding made once still points at the right row after
  // rows are added or removed. Reads never create a node, so `peekNode`, not `nodeAt`.
  const at = (index) => (typeof index === 'function' ? index() : index)
  const peekAt = (resource, role) => peekNode(resource || state.primaryKey, role)

  const childRow = (childResource, index, resource, role) => {
    const node = peekAt(resource, role)
    return node ? childBucket(node, childResource)?.records[at(index)] : undefined
  }

  // One column of one child row, or the whole row when `key` is null.
  function getChildren (childResource, index, key = null, resource, role) {
    const row = childRow(childResource, index, resource, role)
    if (!row) return key ? undefined : null
    return key ? row[key] : row
  }

  // Every child row of one bucket. Reads never create a node, so a missing address is [].
  function getChildRows (childResource, resource, role) {
    const node = peekAt(resource, role)
    return node ? (childBucket(node, childResource)?.records || []) : []
  }

  function setChildren (childResource, index, key, value, resource, role) {
    const row = childRow(childResource, index, resource, role)
    if (!row) return null
    if (key) row[key] = value
    else Object.assign(row, value)
    return row
  }

  // Writable computed over one column, so a template can v-model a child row.
  function useChildren (childResource, index, key = null, resource, role) {
    return computed({
      get: () => getChildren(childResource, index, key, resource, role),
      set: (value) => setChildren(childResource, index, key, value, resource, role)
    })
  }

  // `{ [row[key]]: index }` - the lookup a card needs to go from a code to its row.
  const indexRowsBy = (rows, key) => rows.reduce((map, row, index) => {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') map[String(value).trim()] = index
    return map
  }, {})

  function useChildrenIndex (childResource, key, resource, role) {
    return computed(() => {
      const node = peekAt(resource, role)
      return indexRowsBy(node ? childBucket(node, childResource)?.records || [] : [], key)
    })
  }

  // ── One row of a many-node's `records`, the same three ways ────────────────
  const manyRow = (index, resource, role) => peekAt(resource, role)?.records[at(index)]

  function getRecords (index, key = null, resource, role) {
    const row = manyRow(index, resource, role)
    if (!row) return key ? undefined : null
    return key ? row[key] : row
  }

  // Every row of a many-node, the twin of getChildRows. Reads never create a node.
  function getRecordRows (resource, role) {
    return peekAt(resource, role)?.records || []
  }

  function setRecords (index, key, value, resource, role) {
    const row = manyRow(index, resource, role)
    if (!row) return null
    if (key) row[key] = value
    else Object.assign(row, value)
    return row
  }

  function useRecords (index, key = null, resource, role) {
    return computed({
      get: () => getRecords(index, key, resource, role),
      set: (value) => setRecords(index, key, value, resource, role)
    })
  }

  function useRecordsIndex (key, resource, role) {
    return computed(() => indexRowsBy(peekAt(resource, role)?.records || [], key))
  }

  function removeChild (childResource, index, resource, role) {
    const bucket = childBucket(nodeAt(resource, role), childResource)
    if (bucket) bucket.records.splice(index, 1)
  }

  // `updateChild` merges `data` only, so this is the way to soft-delete a
  // persisted row ('deactivate') or restore it ('update').
  function setChildAction (childResource, index, action, resource, role) {
    const row = childBucket(nodeAt(resource, role), childResource)?.records[index]
    if (!row) return null
    row._action = action
    return row
  }

  function addRecord (row, resource, role, { action } = {}) {
    const node = nodeAt(resource, role)
    node.many = true
    node.records.push({ ...(action && action !== 'create' ? { _action: action } : {}), ...row })
    return node.records.length - 1
  }

  // Merged in place, never replaced, so a row keeps its identity.
  function updateRecord (index, patch, resource, role) {
    const row = nodeAt(resource, role).records[at(index)]
    if (row) Object.assign(row, patch)
  }

  function removeRecord (index, resource, role) {
    nodeAt(resource, role).records.splice(at(index), 1)
  }

  function selectOption (header, value, resource, role) {
    return setRecord(header, value, resource, role)
  }

  return {
    bindDerive,
    load,
    setResource,
    updateResource,
    applyNodes,
    getRecord,
    setRecord,
    useRecord,
    setControls,
    getControls,
    useControls,
    addChild,
    updateChild,
    getChildren,
    getChildRows,
    setChildren,
    useChildren,
    useChildrenIndex,
    getRecords,
    getRecordRows,
    setRecords,
    useRecords,
    useRecordsIndex,
    removeChild,
    setChildAction,
    addRecord,
    updateRecord,
    removeRecord,
    selectOption
  }
}
