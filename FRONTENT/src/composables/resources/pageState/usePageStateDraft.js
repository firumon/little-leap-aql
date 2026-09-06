import { computed, ref, watch } from 'vue'
import { useRouteConfig } from '../useRouteConfig'
import { toPascalCase } from 'src/utils/appHelpers'

const PREFIX = 'aql'
const VERSION = 1
const DEBOUNCE_MS = 300
// A list or a read-only view collects no input, so it gets no draft key.
const NO_DRAFT_PAGES = new Set(['index', 'view'])

function storage () {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

const noop = {
  draftKey: computed(() => ''),
  restoreDraft: () => false,
  persistDraft: () => false,
  clearDraft: () => {},
  hasInitialDraft: computed(() => false),
  initialDraftInfo: computed(() => null),
  restoreInitialDraft: () => false,
  discardInitialDraft: () => {},
  dismissInitialDraft: () => {}
}

// Draft persistence for usePageState. Owns the key, debounce and restore-once
// lifecycle only; `serialize`/`apply` come from usePageState, which owns node shape.
export function usePageStateDraft ({ canPrompt, probe, sources = [], serialize, apply } = {}) {
  let route
  try {
    route = useRouteConfig()
  } catch {
    return noop
  }
  const { resourceName, pageName, pageSlug, action, code } = route

  const draftKey = computed(() => {
    const resource = resourceName.value
    const page = pageName.value
    if (!resource || NO_DRAFT_PAGES.has(page)) return ''
    if (page === 'add') return `${PREFIX}_${resource}_Add`
    if (page === 'edit') return code.value ? `${PREFIX}_${resource}_Edit_${code.value}` : ''
    // A custom or action page is addressed by its own identifier, plus the record
    // code when it has one — the same action on two records must not share a draft.
    const suffix = code.value ? `_${code.value}` : ''
    const name = action.value || pageSlug.value
    return name ? `${PREFIX}_${resource}_${toPascalCase(name)}${suffix}` : ''
  })

  // Gates the restore dialog only. Auto-saving never asks this.
  const canAskToRestore = () => (typeof canPrompt === 'function' ? canPrompt() !== false : canPrompt !== false)

  // The form is only settled once the node the page is about actually exists. On a
  // record page that means the server row has been hydrated (its code is on a node);
  // restoring before that would be overwritten by the hydration that follows.
  const isSettled = () => {
    const { count = 0, codes = [] } = probe?.() || {}
    if (!count) return false
    return code.value ? codes.includes(code.value) : true
  }

  let restoredFor = ''
  let promptedFor = ''
  let timer = null
  // Set by clearDraft. A cleared page re-seeds its defaults, and that alone must
  // not write the blank form back over the clear. See holdsAfterClear().
  let suspended = null

  function read (key) {
    const store = storage()
    if (!store || !key) return null
    const raw = store.getItem(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.v !== VERSION || !Array.isArray(parsed.nodes)) throw new Error('unusable draft shape')
      return parsed
    } catch (err) {
      console.warn(`[usePageState] Discarding unreadable draft "${key}":`, err)
      clearDraft(key)
      return null
    }
  }

  function clearDraft (key = draftKey.value) {
    if (timer) { clearTimeout(timer); timer = null }
    suspended = { key, signature: null }
    try {
      storage()?.removeItem(key)
    } catch (err) {
      console.warn(`[usePageState] Could not clear draft "${key}":`, err)
    }
  }

  // After a clear, the first state we see is the page re-seeding its defaults, so
  // that becomes the baseline. Only state that differs from it is real user input.
  function holdsAfterClear (key, body) {
    if (!suspended || suspended.key !== key) return false
    if (suspended.signature === null) suspended.signature = body
    if (suspended.signature === body) return true
    suspended = null
    return false
  }

  function persistDraft (force = false) {
    const key = draftKey.value
    const store = storage()
    if (!key || !store) return false
    const payload = serialize?.()
    // Nothing worth keeping — and writing here would bury a real draft under the
    // blank state a reset or a post-submit teardown leaves behind.
    if (!payload || !payload.nodes.length || !payload.hasData) return false
    const body = JSON.stringify(payload)
    if (force) suspended = null
    else if (holdsAfterClear(key, body)) return false
    try {
      store.setItem(key, JSON.stringify({ v: VERSION, key, savedAt: Date.now(), ...payload }))
      return true
    } catch (err) {
      console.warn(`[usePageState] Could not save draft "${key}":`, err)
      return false
    }
  }

  function applyPayload (key, payload) {
    if (!payload) return false
    try {
      return apply?.(payload) === true
    } catch (err) {
      console.warn(`[usePageState] Discarding draft "${key}" that failed to restore:`, err)
      clearDraft(key)
      return false
    }
  }

  function restoreDraft (key = draftKey.value) {
    return applyPayload(key, read(key))
  }

  function scheduleSave () {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; persistDraft() }, DEBOUNCE_MS)
  }

  // Held in memory from mount so a later auto-save cannot overwrite the draft the
  // pill is still offering. Set once per key, never by typing in this visit.
  const initialDraft = ref(null)
  const draftHandled = ref(false)

  watch(draftKey, () => {
    restoredFor = ''
    promptedFor = ''
    suspended = null
    initialDraft.value = null
    draftHandled.value = false
    if (timer) { clearTimeout(timer); timer = null }
  })

  // Auto-save was shut until now, so whatever the form already holds has never
  // been written. Without this, the first save waits for one more edit.
  function resumeSaving (key) {
    if (draftKey.value !== key) return
    restoredFor = key
    scheduleSave()
  }

  const hasInitialDraft = computed(() => canAskToRestore() && !draftHandled.value && !!initialDraft.value)

  // A short human summary of the saved work, so the user recognises it.
  function previewOf (payload) {
    const entries = payload.nodes || []
    const main = entries.find((n) => n.resource === payload.primaryKey && n.record && Object.keys(n.record).length) ||
      entries.find((n) => n.record && Object.keys(n.record).length)
    const fields = Object.entries(main?.record || {})
      .filter(([, value]) => value !== '' && value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 6)
      .map(([label, value]) => ({ label, value: String(value) }))
    const rows = entries.reduce((sum, n) => sum + (n.records?.length || 0) +
      (n.children || []).reduce((c, b) => c + (b.records?.length || 0), 0), 0)
    return { resource: main?.resource || payload.primaryKey || '', fields, rows }
  }

  const initialDraftInfo = computed(() => {
    const payload = initialDraft.value
    if (!payload) return null
    return { key: payload.key || draftKey.value, savedAt: payload.savedAt || null, ...previewOf(payload) }
  })

  function dismissInitialDraft () {
    draftHandled.value = true
    initialDraft.value = null
  }

  function restoreInitialDraft () {
    const payload = initialDraft.value
    const key = draftKey.value
    dismissInitialDraft()
    return applyPayload(key, payload)
  }

  function discardInitialDraft () {
    clearDraft(draftKey.value)
    dismissInitialDraft()
  }

  // Runs once per key, and only after the page has settled. A stored draft is
  // only read here — it is never laid on the form until the user asks for it.
  watch(
    [draftKey, () => isSettled()],
    ([key, settled]) => {
      if (!key || !settled || promptedFor === key) return
      promptedFor = key
      initialDraft.value = read(key)
      draftHandled.value = false
      resumeSaving(key)
    },
    { immediate: true, flush: 'post' }
  )

  // Auto-save stays shut until the restore step for this key is done, so the
  // freshly-initialized blank form can never overwrite the stored draft.
  watch(
    sources,
    () => {
      if (!draftKey.value || restoredFor !== draftKey.value) return
      scheduleSave()
    },
    { deep: true }
  )

  return {
    draftKey,
    restoreDraft,
    persistDraft: () => persistDraft(true),
    clearDraft,
    hasInitialDraft,
    initialDraftInfo,
    restoreInitialDraft,
    discardInitialDraft,
    dismissInitialDraft
  }
}
