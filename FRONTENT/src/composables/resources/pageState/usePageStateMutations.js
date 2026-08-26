// The friendly write API. Every mutation resolves its node through the registry,
// so no consumer ever assigns into a node or a child row directly.
export function usePageStateMutations ({ registry, hydrate }) {
  const { ensureNode, peekNode, childBucket, toResourceName } = registry

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
  function setControlField (resource, header, value) {
    const node = ensureNode(resource)
    const entry = node.controls.find((c) => c.header === header)
    if (entry) entry.value = value
    else node.controls.push({ header, value })
    return node
  }

  function getControlField (resource, header, role) {
    return peekNode(resource, role)?.controls.find((c) => c.header === header)?.value
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
    selectOption
  }
}
