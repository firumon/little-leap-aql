import { reactive, unref } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { textOrRef } from 'src/utils/appHelpers'
import { useResourceConfig, findResourceConfig, normalizeAdditionalActions } from './useResourceConfig'
import {
  buildFieldOptions,
  buildSourceFieldGroup,
  buildTargetFieldGroups,
  isTargetActive,
  resolveRecordTemplate,
  resolveTargetKey
} from './additionalActionsSchema'

/**
 * The AdditionalActions REQUEST PIPELINE — one workflow action, taken apart into
 * single-responsibility steps.
 *
 * `useAdditionalActions` owns *eligibility* (which actions a record may offer)
 * and *dispatch intent* (navigate vs. open the dialog). This module owns
 * everything between an action name and an `executeAction` request envelope:
 *
 *   resolveAction        name            -> normalized config
 *   actionTitle          config, record  -> dialog heading
 *   actionSubtitle       config, record  -> dialog subheading
 *   actionFieldGroups    config, record  -> render-ready field groups (+ seeds)
 *   createActionForm     config, record  -> reactive flat form, seeded
 *   validateActionForm   form            -> '' | first error message
 *   extractActionPayload form            -> { fields, targetFields }
 *   buildActionRequest   name + data     -> executeAction envelope
 *   dispatchActionRequests envelope(s)   -> { success, error, response }
 *   executeAdditionalAction              -> build + dispatch in one call
 *
 * Every step takes MINIMAL developer input. The resource config, the sheet
 * headers, the select-option records, the signed-in user and the transport are
 * all resolved here rather than threaded in by the caller — so
 * `buildActionRequest('Postpone', { record, data: { Comment: 'x' } })` is the
 * whole surface a page needs.
 *
 * Two consumers today:
 *   `useAdditionalActionsDialog` — drives the popup with the same steps.
 *   `usePageState.includeAdditionalAction` — queues an envelope into a batch
 *     submission, so a workflow action can ride alongside record writes.
 *
 * Canonical spec: Documents/AQL_ACTION_SYSTEM.md §7
 */

// ---------------------------------------------------------------------------
// Pure helpers (no store access — exported for callers that already hold groups)
// ---------------------------------------------------------------------------

/** The human label an action reads as: its `label`, else its key. */
export function actionLabelOf (action) {
  return action?.label || action?.action || 'Action'
}

/**
 * Picks the caller-supplied value for one field, accepting every address form a
 * developer might reasonably reach for.
 *
 * Source fields answer to the derived header (`ProgressPostponedComment`) OR the
 * short authored name (`Comment`) — the short name is what the JSON declares, so
 * demanding the derived header would push a server-side naming rule onto the
 * page. Target fields answer to the flat address (`newVisit.Date`) or a nested
 * bag (`{ newVisit: { Date } }`), and deliberately NOT to a bare column name: two
 * targets may both carry `Date`.
 *
 * Returns `undefined` when nothing was supplied, so the field's seed survives.
 */
export function pickSuppliedValue (values, group, field) {
  if (!values || typeof values !== 'object') return undefined
  if (values[field.address] !== undefined) return values[field.address]

  if (group.key) {
    const bag = values[group.key]
    if (bag && typeof bag === 'object' && bag[field.name] !== undefined) return bag[field.name]
    return undefined
  }

  if (values[field.name] !== undefined) return values[field.name]
  if (values[field.header] !== undefined) return values[field.header]
  return undefined
}

/**
 * Flat `address -> value` map for a set of groups: the caller's value when it
 * supplied one, else the field's own seed (a `from`/`value` prefill), else ''.
 */
export function seedActionValues (groups, values) {
  const form = {}
  for (const group of groups) {
    for (const field of group.fields) {
      const supplied = pickSuppliedValue(values, group, field)
      form[field.address] = supplied !== undefined ? supplied : (field.seed ?? '')
    }
  }
  return form
}

/**
 * Splits a flat form into the two wire buckets.
 *
 * `fields` is keyed by derived header (the long-standing executeAction
 * contract); `targetFields` by target key then literal column. Only user-facing
 * values travel — everything a target copies or defaults is resolved server-side
 * from the trusted config.
 *
 * EVERY typed target value is sent, including those belonging to a target whose
 * `when` gate does not pass: the server ignores a skipped target's values, and a
 * `when` keyed on `field` reads exactly these, so filtering here would hand the
 * server a payload that cannot satisfy the gate it is about to evaluate.
 */
export function extractActionPayload (groups, form = {}) {
  const fields = {}
  const targetFields = {}

  for (const group of groups) {
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

/**
 * Extracts the first failure message from a batch response, or '' on success.
 * A batch can report success at the envelope level while an individual entry
 * failed, so both layers are checked.
 */
export function actionFailureMessage (response) {
  if (!response?.success) {
    return response?.error || response?.message || 'Request failed.'
  }
  const entries = Array.isArray(response.data) ? response.data : []
  const failed = entries.find((entry) => entry?.success === false)
  if (!failed) return ''
  return failed.error || failed.message || 'Request failed.'
}

// ---------------------------------------------------------------------------
// The composable
// ---------------------------------------------------------------------------

/**
 * @param {string} [resourceName] - default resource for every step. Omit to
 *        follow the active route. Any step may still override it per call with
 *        `{ resource }`, which is what lets one page queue an action against a
 *        resource other than its own.
 */
export function useAdditionalActionsPipeline (resourceName = null) {
  const explicit = unref(resourceName) || undefined
  const { resourceName: activeName } = useResourceConfig(explicit)
  const auth = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()

  function resolveResourceName (resource) {
    return String(unref(resource) || explicit || activeName.value || '')
  }

  function headersFor (resource) {
    return resource ? (dataStore.headers?.[resource] || []) : []
  }

  function optionsFor (field) {
    const resource = field?.source?.resource
    return buildFieldOptions(
      field,
      resource ? dataStore.getRecords(resource) : [],
      resource ? headersFor(resource) : []
    )
  }

  /**
   * An action name (or an already-normalized config) plus the resource it
   * belongs to. Passing a config object through untouched is what lets the
   * dialog — which already holds the entry the user clicked — reuse every step
   * below without a second config lookup.
   *
   * @returns {{ resource: string, action: Object|null }}
   */
  function resolveAction (actionOrName, { resource } = {}) {
    const name = resolveResourceName(resource)
    const raw = unref(actionOrName)
    if (raw && typeof raw === 'object') return { resource: name, action: raw }

    const key = String(raw ?? '').trim()
    if (!key) return { resource: name, action: null }
    const config = findResourceConfig(auth, name)
    const action = normalizeAdditionalActions(config?.additionalActions)
      .find((entry) => String(entry.action) === key) || null
    return { resource: name, action }
  }

  /** The outcome an action writes — an explicit override, else its configured one. */
  function resolveOutcome (action, outcome) {
    return String(outcome || action?.columnValue || '')
  }

  // --- headings ------------------------------------------------------------

  function actionTitle (actionOrName, record, options = {}) {
    const { action } = resolveAction(actionOrName, options)
    return resolveRecordTemplate(action?.title, record) || actionLabelOf(action)
  }

  /**
   * `subtitle: ""` is a deliberate "no subtitle", so an explicitly-authored
   * empty string must NOT fall back to the Code the way an absent key does.
   */
  function actionSubtitle (actionOrName, record, options = {}) {
    const { action } = resolveAction(actionOrName, options)
    const template = action?.subtitle
    if (template === undefined || template === null) return record?.Code || ''
    return resolveRecordTemplate(template, record)
  }

  // --- field schema --------------------------------------------------------

  /**
   * Render-ready field groups in render order: the source record first, then one
   * group per target that asks the user for something. Every descriptor carries
   * its `seed`, so a `from`/`value` prefill is filled in without the caller
   * resolving a single expression.
   */
  function actionFieldGroups (actionOrName, { record = null, outcome = '', resource } = {}) {
    const { resource: name, action } = resolveAction(actionOrName, { resource })
    if (!action) return []

    const user = auth.user
    const source = buildSourceFieldGroup(action, {
      headers: headersFor(name),
      columnValue: resolveOutcome(action, outcome),
      optionsFor,
      record,
      user
    })
    const targets = buildTargetFieldGroups(action, { record, user, optionsFor, headersFor })

    return [...(source ? [source] : []), ...targets]
  }

  /**
   * A reactive flat form for an action, seeded from the field schema and
   * optionally pre-filled with `values`. Addresses are the derived header for
   * source fields and `<targetKey>.<Column>` for target fields, so two targets
   * carrying a `Date` never collide.
   */
  function createActionForm (actionOrName, options = {}) {
    const groups = options.groups || actionFieldGroups(actionOrName, options)
    return reactive(seedActionValues(groups, options.values))
  }

  // --- validation ----------------------------------------------------------

  function targetForGroup (action, groupKey) {
    const targets = Array.isArray(action?.targets) ? action.targets : []
    return targets.find((target, index) => resolveTargetKey(target, index) === groupKey) || null
  }

  /**
   * A target group whose `when` gate does not currently pass collects nothing —
   * the server will skip the target outright, so demanding its `required` fields
   * would make an OPTIONAL block mandatory and defeat the whole gate.
   *
   * The gate is a client MIRROR (`isTargetActive`); the server re-decides from
   * the trusted config. The two can only disagree on an `expression` gate the
   * browser cannot resolve, and only ever in the lenient direction.
   */
  function isGroupActive (action, group, { record, form }) {
    if (!group.key || !group.hasCondition) return true
    const target = targetForGroup(action, group.key)
    if (!target) return true
    return isTargetActive(target, { record, form, key: group.key })
  }

  /** @returns {string} '' when valid, else the first missing field's message. */
  function validateActionForm (actionOrName, { record = null, form = {}, outcome = '', resource, groups } = {}) {
    const { action } = resolveAction(actionOrName, { resource })
    const list = groups || actionFieldGroups(actionOrName, { record, outcome, resource })

    for (const group of list) {
      if (!isGroupActive(action, group, { record, form })) continue
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

  // --- request envelope ----------------------------------------------------

  /**
   * The `executeAction` envelope for one workflow action.
   *
   * @param {string|Object} actionOrName - action key, or a normalized config.
   * @param {Object}   [opts]
   * @param {Object}   [opts.record]   - the source record; supplies `Code` and
   *                   every `$record.*` prefill when no explicit `code` is given.
   * @param {string|Object} [opts.code] - a concrete record code, or a `$ref`
   *                   (`batchRef('OutletVisits.latest.code')`) naming a record
   *                   created earlier in the SAME batch. Falls back to
   *                   `record.Code`.
   * @param {Object}   [opts.data]     - user values, addressed by short name,
   *                   derived header, `<targetKey>.<Column>`, or a nested target
   *                   bag. Anything omitted falls back to the field's seed.
   * @param {Object}   [opts.form]     - an already-seeded flat form; wins over
   *                   `data` (this is what the dialog passes).
   * @param {string}   [opts.outcome]  - overrides `columnValue` on a
   *                   multi-outcome action.
   * @param {string}   [opts.resource] - overrides the default resource.
   * @returns {Object|null} null when the action is unknown or is a `navigate`
   *                   action, which writes nothing and has no envelope.
   */
  function buildActionRequest (actionOrName, { record = null, code, data, form, outcome = '', resource, groups } = {}) {
    const { resource: name, action } = resolveAction(actionOrName, { resource })
    if (!action) {
      console.warn('[AdditionalActions] Unknown action:', unref(actionOrName), 'on resource:', name)
      return null
    }
    if (action.kind === 'navigate') {
      console.warn('[AdditionalActions] `navigate` actions write nothing and have no request:', action.action)
      return null
    }

    const columnValue = resolveOutcome(action, outcome)
    const list = groups || actionFieldGroups(action, { record, outcome: columnValue, resource: name })
    const values = form || seedActionValues(list, data)
    const { fields, targetFields } = extractActionPayload(list, values)

    // A `$ref` passes through untouched; anything else is coerced to a trimmed
    // string, exactly as the canonical builders in usePageState do.
    const target = code === undefined || code === null || code === '' ? (record?.Code || '') : code

    return {
      action: 'executeAction',
      resource: name,
      payload: {
        code: textOrRef(target),
        actionName: action.action,
        column: action.column || 'Progress',
        columnValue,
        fields,
        ...(Object.keys(targetFields).length ? { targetFields } : {})
      }
    }
  }

  // --- dispatch ------------------------------------------------------------

  /**
   * Sends one envelope or a batch of them.
   *
   * Straight to the resource IO store, which is where delta hydration lives
   * (`runBatchRequests` -> `hydrateResourcePayload`), so a page updates through
   * normal reactivity with no refetch.
   */
  async function dispatchActionRequests (requests) {
    const list = (Array.isArray(requests) ? requests : [requests]).filter(Boolean)
    if (!list.length) return { success: false, error: 'Nothing to submit.', response: null }

    const response = await resourceIoStore.runBatchRequests(list)
    const error = actionFailureMessage(response)
    return { success: !error, error, response }
  }

  /**
   * Build + dispatch in one call — the whole pipeline for a caller that just
   * wants the action to happen.
   *
   * @returns {Promise<{success: boolean, error: string, response: any}>}
   */
  async function executeAdditionalAction (actionOrName, options = {}) {
    const request = buildActionRequest(actionOrName, options)
    if (!request) return { success: false, error: 'Action is not executable.', response: null }
    return dispatchActionRequests(request)
  }

  return {
    resolveAction,
    actionTitle,
    actionSubtitle,
    actionFieldGroups,
    createActionForm,
    validateActionForm,
    extractActionPayload: (actionOrName, options = {}) =>
      extractActionPayload(options.groups || actionFieldGroups(actionOrName, options), options.form),
    buildActionRequest,
    dispatchActionRequests,
    executeAdditionalAction
  }
}
