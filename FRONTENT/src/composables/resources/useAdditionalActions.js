import { reactive, computed, unref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceConfig, isActionVisible } from './useResourceConfig'
import { useResourceNav } from './useResourceNav'
import {
  buildFieldOptions,
  buildSourceFieldGroup,
  buildTargetFieldGroups,
  isTargetActive,
  resolveTargetKey
} from './additionalActionsSchema'

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
 * Deliberately standalone from `usePageState`. `pageState.run()` gates on
 * `validationErrors`, which validates the HOST PAGE's nodes — an action would be
 * blocked by a form error that has nothing to do with it. And `ensureNode()` keys
 * nodes by resource name, so an action targeting the same resource as its page
 * would collide with the page's own node. Dispatch goes straight to the resource
 * IO store, which is where delta hydration lives anyway (`runBatchRequests` →
 * `hydrateResourcePayload`), so reactivity after a write is unaffected.
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
      const target = action.navigate?.target || 'record-page'
      const params = {
        scope: action.navigate?.scope,
        resourceSlug: action.navigate?.resourceSlug,
        pageSlug: action.navigate?.pageSlug || ''
      }
      if (target === 'record-page') params.code = action.navigate?.code || record?.Code
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
  const auth = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()

  const action = computed(() => dialog.action)
  const record = computed(() => dialog.record)

  const isMultiOutcome = computed(() => {
    const options = action.value?.columnValueOptions
    return Array.isArray(options) && options.length > 0
  })
  const outcomeOptions = computed(() => action.value?.columnValueOptions || [])

  const column = computed(() => action.value?.column || 'Progress')
  const columnValue = computed(() => dialog.outcome || action.value?.columnValue || '')

  function optionsFor (field) {
    const resource = field?.source?.resource
    return buildFieldOptions(
      field,
      resource ? dataStore.getRecords(resource) : [],
      resource ? (dataStore.headers?.[resource] || []) : []
    )
  }

  function headersFor (resource) {
    return resource ? (dataStore.headers?.[resource] || []) : []
  }

  /**
   * Field groups in render order: the source record first, then one group per
   * target that asks the user for something.
   */
  const groups = computed(() => {
    if (!action.value) return []
    const headers = headersFor(dialog.resource)

    const source = buildSourceFieldGroup(action.value, {
      headers,
      columnValue: columnValue.value,
      optionsFor
    })
    const targets = buildTargetFieldGroups(action.value, {
      record: record.value,
      user: auth.user,
      optionsFor,
      headersFor
    })

    return [...(source ? [source] : []), ...targets]
  })

  const allFields = computed(() => groups.value.flatMap((group) => group.fields))

  function syncForm () {
    resetForm(allFields.value)
  }

  /**
   * Finds the configured target behind a rendered group, by the same key the
   * schema addressed its fields with.
   */
  function targetForGroup (groupKey) {
    const targets = Array.isArray(action.value?.targets) ? action.value.targets : []
    return targets.find((target, index) => resolveTargetKey(target, index) === groupKey) || null
  }

  /**
   * A target group whose `when` gate does not currently pass collects nothing —
   * the server will skip the target outright, so demanding its `required` fields
   * would make an OPTIONAL block mandatory and defeat the whole gate.
   *
   * The gate is a client MIRROR (`isTargetActive`); the server re-decides from
   * the trusted config. The two can only disagree on an `expression` gate the
   * browser cannot resolve, and only ever in the lenient direction — the worst
   * case is a required field the client let through and the server rejects.
   */
  function isGroupActive (group) {
    if (!group.key || !group.hasCondition) return true
    const target = targetForGroup(group.key)
    if (!target) return true
    return isTargetActive(target, { record: record.value, form, key: group.key })
  }

  function validate () {
    for (const group of groups.value) {
      if (!isGroupActive(group)) continue
      for (const field of group.fields) {
        if (!field.required) continue
        const value = form[field.address]
        if (value === undefined || value === null || String(value).trim() === '') {
          return `${field.label} is required`
        }
      }
    }
    return ''
  }

  /**
   * Splits the flat form into the two wire buckets.
   *
   * `fields` is keyed by derived header (the long-standing executeAction
   * contract); `targetFields` is keyed by target key then literal column. Only
   * user-facing values travel — everything a target copies or defaults is
   * resolved server-side from the trusted config.
   *
   * EVERY typed target value is sent, including those belonging to a target
   * whose `when` gate does not pass. The server ignores a skipped target's
   * values, and a `when` keyed on `field` reads exactly these — filtering here
   * would hand the server a payload that cannot satisfy the gate it is about to
   * evaluate.
   */
  function buildPayloadFields () {
    const fields = {}
    const targetFields = {}

    for (const group of groups.value) {
      for (const field of group.fields) {
        const value = form[field.address]
        if (!group.key) {
          fields[field.header] = value ?? ''
          continue
        }
        targetFields[group.key] = targetFields[group.key] || {}
        targetFields[group.key][field.header] = value ?? ''
      }
    }

    return { fields, targetFields }
  }

  async function submit () {
    const invalid = validate()
    if (invalid) {
      dialog.error = invalid
      return false
    }

    const { fields, targetFields } = buildPayloadFields()
    const request = {
      action: 'executeAction',
      resource: dialog.resource,
      payload: {
        code: record.value?.Code || '',
        actionName: action.value?.action,
        column: column.value,
        columnValue: columnValue.value,
        fields,
        ...(Object.keys(targetFields).length ? { targetFields } : {})
      }
    }

    dialog.submitting = true
    dialog.error = ''
    try {
      const response = await resourceIoStore.runBatchRequests([request])
      const failure = failureMessage(response)
      if (failure) {
        // Stay open with the message inline — the user keeps what they typed and
        // can correct it, which a dismissable toast would not allow.
        dialog.error = failure
        return false
      }

      $q.notify({
        type: 'positive',
        message: `${action.value?.label || action.value?.action || 'Action'} completed`,
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

/**
 * Extracts the first failure message from a batch response, or '' on success.
 * A batch can report success at the envelope level while an individual entry
 * failed, so both layers are checked.
 */
function failureMessage (response) {
  if (!response?.success) {
    return response?.error || response?.message || 'Request failed.'
  }
  const entries = Array.isArray(response.data) ? response.data : []
  const failed = entries.find((entry) => entry?.success === false)
  if (!failed) return ''
  return failed.error || failed.message || 'Request failed.'
}
