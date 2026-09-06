import { effectScope, computed, watch } from 'vue'

// Derived columns declared by Layer 2 and run by pageState. The domain says WHAT depends
// on what; the writing happens here, so the UI only ever reads nodes.
export function usePageStateDerive ({ registry, mutations, actions }) {
  // Its own scope: applyNodes is often called from a submit handler, outside any
  // component scope, where a bare watch would leak for the life of the tab.
  const scope = effectScope()
  const stoppers = new Map()

  // Shut while a draft is being restored. A restored draft is already a fully
  // derived snapshot, so re-running handlers over it would wipe its child rows.
  let paused = 0

  // An `on` address names a reactive slice of the tree. Layer 2 is pure, so it can only
  // describe the slice — never hold a ref to it.
  function sourceFor (on) {
    const spec = typeof on === 'string' ? { field: on } : (on || {})
    if (spec.control !== undefined) {
      return computed(() => mutations.getControls(spec.control, null, spec.resource, spec.role))
    }
    if (spec.action !== undefined) {
      return computed(() => actions.getActions(spec.action, null, spec.resource, spec.role))
    }
    const bound = registry.useNode(spec.resource, spec.role)
    if (spec.children === true) return computed(() => bound.node.value.children)
    if (spec.children) return bound.children(spec.children)
    if (spec.records) return computed(() => bound.node.value.records)
    // `record` names the whole record or one of its columns; `field` is the older spelling.
    const field = spec.field || (typeof spec.record === 'string' ? spec.record : '')
    if (field) return computed(() => bound.node.value.record[field])
    return computed(() => bound.node.value.record)
  }

  function keyFor (entry) {
    if (entry.key) return entry.key
    const spec = typeof entry.on === 'string' ? { field: entry.on } : (entry.on || {})
    return [
      spec.resource || '', spec.role || '',
      spec.children === true ? '*' : (spec.children || ''),
      spec.field || (typeof spec.record === 'string' ? spec.record : ''),
      spec.control || '', spec.action || '',
      spec.records ? 'records' : '', spec.record === true ? 'record' : ''
    ].join('::')
  }

  // Re-registering the same key REPLACES it. Hydrating twice must not stack two writers
  // on one column.
  function register (entries = [], api) {
    for (const entry of entries) {
      if (!entry || typeof entry.handler !== 'function') continue
      const key = keyFor(entry)
      stoppers.get(key)?.()
      scope.run(() => {
        const source = sourceFor(entry.on)
        const stop = watch(source, (value, previous) => {
          if (paused) return
          entry.handler(value, api, previous)
        }, {
          deep: entry.deep !== false,
          immediate: entry.immediate !== false
        })
        stoppers.set(key, stop)
      })
    }
  }

  function clear () {
    for (const stop of stoppers.values()) stop()
    stoppers.clear()
    paused = 0
  }

  return {
    register,
    clear,
    pause: () => { paused++ },
    resume: () => { if (paused > 0) paused-- },
    isPaused: () => paused > 0,
    stop: () => { clear(); scope.stop() },
    count: () => stoppers.size
  }
}
