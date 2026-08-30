import {reactive, computed, unref, onUnmounted} from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig, isActionVisible } from './useResourceConfig'
import { useResourceNav } from './useResourceNav'
import { useAdditionalActionsPipeline, actionLabelOf, actionFailureMessage } from './additionalActionsPipeline'
import { usePageState } from './pageState'

// The AdditionalActions runtime — the one place workflow-action logic lives.
// Eligibility, visibleWhen gating, navigate-vs-mutate dispatch, input collection
// and submission all resolve here. The mechanics of turning one action into a
// request live in `additionalActionsPipeline.js`.
//
// The popup owns its OWN `usePageState` instance rather than the host page's: a
// dialog action must not be blocked by an unrelated form error on the page, and
// index pages have no pageState at all. With no nodes, build() emits just this
// action, so the dialog and a batched `includeAdditionalAction()` submit through
// the identical pipeline.
//
// Dialog state is a MODULE-LEVEL singleton: an index page renders one trigger per
// row, and without a shared instance fifty rows would mount fifty dialogs.
//
// Canonical spec: Documents/UI_ACTION_SYSTEM.md §7

// ---------------------------------------------------------------------------
// Shared dialog state — one per app, however many triggers are mounted.
// ---------------------------------------------------------------------------
const dialog = reactive({
  open: false,
  resource: '',
  record: null,
  action: null,
  outcome: '',
  submitting: false,
  error: ''
})

// Navigate targets whose route carries a `:code` segment.
const TARGETS_NEEDING_CODE = new Set(['view', 'edit', 'action', 'record'])

// ---------------------------------------------------------------------------
// Trigger surface
// ---------------------------------------------------------------------------

/**
 * @param {string} [resourceName] - resolve config by NAME. Omit to follow the
 *        active route, which is what a page-level cluster wants; pass a name to
 *        work outside a resource page (a list row, a dashboard card).
 */
export function useAdditionalActions (resourceName = null) {
  const explicit = unref(resourceName) || undefined
  const { additionalActions, permissions, resourceName: activeName } = useResourceConfig(explicit)
  const nav = useResourceNav()

  /**
   * The actions a given record can currently offer.
   *
   * The one gate, in order: the caller's `only`/`exclude` filter, then the
   * `can<Action>` permission flag, then `visibleWhen` against this record.
   *
   * The permission check tests for an EXPLICIT `false`: most actions carry no
   * `can<Action>` flag at all, and an absent flag means "not permission-
   * controlled" rather than "denied".
   */
  function actionsFor (record, { only, exclude } = {}) {
    if (!record) return []
    const allow = Array.isArray(only) && only.length ? only.map(String) : null
    const deny = Array.isArray(exclude) && exclude.length ? exclude.map(String) : null

    return (additionalActions.value || []).filter((action) => {
      const name = String(action?.action ?? '')
      if (!name) return false
      if (allow && !allow.includes(name)) return false
      if (deny && deny.includes(name)) return false
      if (permissions.value?.[`can${name}`] === false) return false
      return isActionVisible(action, record)
    })
  }

  /**
   * Presentation-ready entries for a host that renders its own buttons —
   * `ResourceActions` folds these straight into its FAB cluster.
   *
   * Each entry carries the resolver name, the presentation props the host merges
   * with its own context, and a bound `run()`. The host never touches `kind`,
   * `visibleWhen`, or permissions.
   *
   * @returns {Array<{key, name, actionName, action, props, run}>}
   */
  function entriesFor (record, options = {}) {
    return actionsFor(record, options).map((action) => ({
      key: `additional:${action.action}`,
      name: action.action,
      // Matches the per-item resolver convention ResourceActions already uses, so
      // a tenant may still override one workflow FAB item on disk.
      actionName: `ResourceAction${pascal(action.action)}`,
      action,
      props: {
        icon: action.icon || 'bolt',
        color: action.color || 'primary',
        label: action.label || action.action,
        tooltip: action.label || action.action
      },
      run: () => runAction(action, record)
    }))
  }

  /**
   * The one dispatch point. `navigate` actions route immediately — they collect
   * nothing; `mutate` actions open the shared dialog.
   */
  function runAction (action, record) {
    if (action?.kind === 'navigate') {
      // `navigate.target` is a route name (see useResourceNav) — an unknown value
      // is rejected there rather than silently rewritten here.
      const target = action.navigate?.target || 'record'
      const slug = action.navigate?.pageSlug || ''
      const params = {
        scope: action.navigate?.scope,
        resourceSlug: action.navigate?.resourceSlug,
        pageSlug: slug
      }
      // `_action/:action` is its own segment, NOT `:pageSlug` — an action target
      // authored with only a pageSlug would otherwise push an empty :action param.
      if (target === 'action') params.action = action.navigate?.action || slug
      if (TARGETS_NEEDING_CODE.has(target)) params.code = action.navigate?.code || record?.Code
      nav.goTo(target, params)
      return
    }
    openAction(action, record)
  }

  function openAction (action, record) {
    // Read at click time, not setup: with no explicit name this follows the route.
    dialog.resource = explicit || activeName.value
    dialog.record = record
    dialog.action = action
    dialog.outcome = action?.columnValue || ''
    dialog.error = ''
    dialog.open = true
  }

  return { additionalActions, actionsFor, entriesFor, runAction, openAction }
}

// Local, not `appHelpers.toPascalCase`: this builds a COMPONENT lookup name from
// an action key (`SendBack` stays `SendBack`), never a sheet column, so it must
// not lowercase the tail the way the header-deriving helpers do.
function pascal (value) {
  const raw = String(value ?? '').trim()
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''
}

// ---------------------------------------------------------------------------
// Dialog surface — used by the single dialog instance at the layout root.
// ---------------------------------------------------------------------------

export function useAdditionalActionsDialog () {
  const $q = useQuasar()
  // Route-following by default; every step below is handed `dialog.resource`
  // explicitly, because a trigger on a list row may target a resource that is
  // not the page's own.
  const pipeline = useAdditionalActionsPipeline()
  // The dialog's own submission channel. No nodes are ever created on it, so
  // `validationErrors` stays empty and build() emits only the queued action.
  const pageState = usePageState({}, { persist: false })

  const action = computed(() => dialog.action)
  const record = computed(() => dialog.record)
  const actionName = computed(() => String(action.value?.action || ''))

  const isMultiOutcome = computed(() => {
    const options = action.value?.columnValueOptions
    return Array.isArray(options) && options.length > 0
  })
  const outcomeOptions = computed(() => action.value?.columnValueOptions || [])

  const column = computed(() => action.value?.column || 'Progress')
  const columnValue = computed(() => dialog.outcome || action.value?.columnValue || '')

  // Field groups in render order: the source record first, then one group per
  // target that asks the user for something. Derived by the pipeline, so the
  // dialog and a batched `includeAdditionalAction()` see the identical schema.
  const groups = computed(() => {
    if (!action.value) return []
    return pipeline.actionFieldGroups(action.value, {
      record: record.value,
      outcome: columnValue.value,
      resource: dialog.resource
    })
  })

  // The queued entry this dialog is editing. Held so submit can check the code
  // it resolved before sending.
  let queued = null

  // Source fields live under `fields`, target fields under `targets` — the two
  // wire buckets `extractActionPayload` already splits them into.
  function fieldPath (group, field) {
    return group.key ? `targets.${field.address}` : `fields.${field.address}`
  }

  function readField (group, field) {
    const value = pageState.getActions(actionName.value, fieldPath(group, field), dialog.resource)
    return value === undefined || value === null ? '' : value
  }

  function writeField (group, field, value) {
    pageState.setActions(actionName.value, fieldPath(group, field), value, dialog.resource)
  }

  // Re-queue with empty data, so every field falls back to its own seed.
  function syncForm () {
    pageState.excludeAdditionalAction()
    queued = null
    if (!action.value) return
    queued = pageState.includeAdditionalAction(actionName.value, {}, {
      resource: dialog.resource,
      code: record.value?.Code,
      record: record.value,
      outcome: columnValue.value
    })
  }

  // `validateActionForm` reads a FLAT address map — the shape a `when` gate keyed
  // on `field` resolves against — so the queued buckets are folded back into one.
  function flatForm () {
    const values = {}
    for (const group of groups.value) {
      for (const field of group.fields) values[field.address] = readField(group, field)
    }
    return values
  }

  function validate () {
    return pipeline.validateActionForm(action.value, {
      record: record.value,
      form: flatForm(),
      outcome: columnValue.value,
      resource: dialog.resource,
      groups: groups.value
    })
  }

  async function submit () {
    const invalid = validate()
    if (invalid) {
      dialog.error = invalid
      return false
    }

    // A `$ref` code means no record code reached the queue — the dialog always
    // acts on a record that already exists, so that is not executable here.
    if (!queued || typeof queued.code !== 'string' || !queued.code) {
      dialog.error = 'Action is not executable.'
      return false
    }

    dialog.submitting = true
    dialog.error = ''
    try {
      const { success, response } = await pageState.run({ notify: false })
      if (!success) {
        // Stay open with the message inline — the user keeps what they typed and
        // can correct it, which a dismissable toast would not allow.
        dialog.error = actionFailureMessage(response) || 'Request failed.'
        return false
      }

      $q.notify({
        type: 'positive',
        message: `${actionLabelOf(action.value)} completed`,
        position: 'top'
      })
      close()
      return true
    } catch (err) {
      dialog.error = err?.message || 'Action failed.'
      return false
    } finally {
      dialog.submitting = false
    }
  }

  function close () {
    pageState.excludeAdditionalAction()
    queued = null
    dialog.open = false
    dialog.action = null
    dialog.record = null
    dialog.error = ''
  }

  function setOutcome (value) {
    dialog.outcome = value
  }

  return {
    dialog,
    groups,
    isMultiOutcome,
    outcomeOptions,
    column,
    columnValue,
    readField,
    writeField,
    syncForm,
    submit,
    close,
    setOutcome
  }
}
