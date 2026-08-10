import { reactive, computed, unref } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig, isActionVisible } from './useResourceConfig'
import { useResourceNav } from './useResourceNav'
import { useAdditionalActionsPipeline, actionLabelOf } from './additionalActionsPipeline'

/**
 * The AdditionalActions runtime — the SINGLE place workflow-action logic lives.
 *
 * Every consumer (the embeddable `AdditionalActionsButtons`, the `ResourceActions`
 * FAB cluster, any custom list row) asks this composable which actions a record
 * may offer and hands clicks back to it. Permission gating, `visibleWhen`
 * evaluation, `only`/`exclude` filtering, navigate-vs-mutate dispatch, input
 * collection and submission all resolve here — a component that re-implements any
 * part of it drifts the moment the config contract changes.
 *
 * The MECHANICS of turning one action into a request — field schema, seeding,
 * validation, payload extraction, envelope, dispatch — live next door in
 * `additionalActionsPipeline.js` as small single-responsibility steps. This file
 * consumes them; it does not duplicate them.
 *
 * The POPUP path is deliberately standalone from `usePageState`. `pageState.run()`
 * gates on `validationErrors`, which validates the HOST PAGE's nodes — a dialog
 * action would be blocked by a form error that has nothing to do with it. And
 * `ensureNode()` keys nodes by resource name, so an action targeting the same
 * resource as its page would collide with the page's own node. Dispatch goes
 * straight to the resource IO store, which is where delta hydration lives anyway
 * (`runBatchRequests` → `hydrateResourcePayload`), so reactivity after a write is
 * unaffected.
 *
 * A page that wants the OPPOSITE — a workflow action riding inside its own batch
 * submission, so a new record and the action stamping it land together — uses
 * `usePageState.includeAdditionalAction()`, which drives the same pipeline.
 *
 * Dialog state is a MODULE-LEVEL singleton: an index page renders one trigger per
 * row, and without a shared instance fifty rows would mount fifty dialogs.
 *
 * Canonical spec: Documents/AQL_ACTION_SYSTEM.md §7
 */

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

// Flat address → value. Addresses are the derived header for source fields
// (`ProgressPostponedComment`) and `<targetKey>.<Column>` for target fields
// (`newVisit.Date`), so two targets carrying a `Date` never collide.
const form = reactive({})

// Navigate targets whose route carries a `:code` segment.
const TARGETS_NEEDING_CODE = new Set(['view', 'edit', 'action', 'record'])

function resetForm (fields) {
  Object.keys(form).forEach((key) => delete form[key])
  fields.forEach((field) => { form[field.address] = field.seed ?? '' })
}

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

  const action = computed(() => dialog.action)
  const record = computed(() => dialog.record)

  const isMultiOutcome = computed(() => {
    const options = action.value?.columnValueOptions
    return Array.isArray(options) && options.length > 0
  })
  const outcomeOptions = computed(() => action.value?.columnValueOptions || [])

  const column = computed(() => action.value?.column || 'Progress')
  const columnValue = computed(() => dialog.outcome || action.value?.columnValue || '')

  /**
   * Field groups in render order: the source record first, then one group per
   * target that asks the user for something. Derived by the pipeline, so the
   * dialog and a batched `includeAdditionalAction()` see the identical schema.
   */
  const groups = computed(() => {
    if (!action.value) return []
    return pipeline.actionFieldGroups(action.value, {
      record: record.value,
      outcome: columnValue.value,
      resource: dialog.resource
    })
  })

  const allFields = computed(() => groups.value.flatMap((group) => group.fields))

  function syncForm () {
    resetForm(allFields.value)
  }

  /** Shared context for every pipeline step this dialog drives. */
  function stepContext () {
    return {
      record: record.value,
      form,
      outcome: columnValue.value,
      resource: dialog.resource,
      groups: groups.value
    }
  }

  function validate () {
    return pipeline.validateActionForm(action.value, stepContext())
  }

  async function submit () {
    const invalid = validate()
    if (invalid) {
      dialog.error = invalid
      return false
    }

    const request = pipeline.buildActionRequest(action.value, stepContext())
    if (!request) {
      dialog.error = 'Action is not executable.'
      return false
    }

    dialog.submitting = true
    dialog.error = ''
    try {
      const { success, error } = await pipeline.dispatchActionRequests(request)
      if (!success) {
        // Stay open with the message inline — the user keeps what they typed and
        // can correct it, which a dismissable toast would not allow.
        dialog.error = error
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
    dialog.open = false
    dialog.action = null
    dialog.record = null
    dialog.error = ''
    resetForm([])
  }

  function setOutcome (value) {
    dialog.outcome = value
  }

  return {
    dialog,
    form,
    groups,
    isMultiOutcome,
    outcomeOptions,
    column,
    columnValue,
    syncForm,
    submit,
    close,
    setOutcome
  }
}
