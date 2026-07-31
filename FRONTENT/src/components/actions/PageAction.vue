<template>
  <div class="aql-page-action-container">
    <!-- Add/Edit/Action pages: the sticky form actions bar, dispatched through
         pageState (single source of truth — see usePageState.js). Resolved through
         useActionResolver so a tenant can swap the whole bar, or just modify its
         props, at any of the 10 `_ui/` tiers. -->
    <component
      :is="resolvedFormActions"
      v-if="showFormActions"
      v-bind="formActionsProps"
      @submit="handleAction('submit')"
      @reset="handleAction('reset')"
      @cancel="handleAction('cancel')"
      @action="handleAction"
    />

    <!-- CRUD Actions FAB — visibility beyond this gate is driven reactively inside
         CrudActions.vue itself (record presence + edit-mode), or explicitly suppressed
         by a CrudActions JS modifier returning show:false / hide:true. -->
    <component
      :is="resolvedCrudActions"
      v-if="showCrudActions"
      :page="props.page"
      v-bind="crudActionsProps"
    />

    <!-- Report downloads. Self-dispatching (it delegates to useReports, never to
         pageState), so it takes no @-handler here. It renders nothing when the
         resource has no matching reports, or when a `resourcereports.js` modifier
         returns show:false / hide:true. -->
    <component
      :is="resolvedResourceReports"
      v-if="showResourceReports"
      :page="props.page"
      v-bind="resourceReportsProps"
    />
  </div>
</template>

<script setup>
/**
 * Root action container of the Action subsystem.
 *
 * Mounted by `Page.vue` as `<Action action="PageAction" />` whenever the page's
 * base contract lists `PageAction` in `sections`. It owns the submission
 * lifecycle for Add/Edit/Action pages and decides which action cluster is live
 * for the current route:
 *   - add / edit / action → `FormActions` (sticky bar)
 *   - everything else     → `CrudActions` (floating FABs)
 *
 * Both clusters are mounted through `useActionResolver`, so each is overridable
 * on its own at any of the 10 `_ui/` tiers. See Documents/AQL_ACTION_SYSTEM.md.
 *
 * Every action — built-in (`submit` / `reset` / `cancel`) or custom (`nextStep`,
 * `saveDraft`, …) — funnels through one dispatcher, `handleAction(actionName)`.
 * A handler is looked up as `props[actionName]` (declared for the built-ins,
 * arriving via `$attrs` for custom keys), so a single `pageaction.js` modifier can
 * intercept, replace, or extend any action without a new prop per action.
 */
import { computed, inject, useAttrs } from 'vue'
import { useQuasar } from 'quasar'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { executeActionRequest } from 'src/composables/resources/usePageState'
import CrudActions from './CrudActions.vue'
import FormActions from './FormActions.vue'
import ResourceReports from './ResourceReports.vue'

defineOptions({ name: 'ActionsPageAction', inheritAttrs: false })

const props = defineProps({
  page:     { type: String, required: true },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null },
  // Ordered button list handed to FormActions. Left null so FormActions' own
  // default (['reset', 'submit']) applies unless a modifier/BP sets it.
  actions:  { type: Array, default: null },
  // Report-download cluster on non-form pages. `false` suppresses it outright; an
  // object is spread onto ResourceReports (e.g. { mode: 'toolbar', position:
  // 'bottom-right' }). Finer control lives in a `resourcereports.js` JS modifier.
  reports:  { type: [Boolean, Object], default: true },
  // Page-contract gate mirroring `noActions` (which suppresses this whole
  // component from Page.vue). Arrives from pageProps, so a page contract or page
  // JS modifier can drop just the report cluster while keeping the CRUD FABs.
  noReports: { type: Boolean, default: false },

  // ── Unified action handlers ────────────────────────────────────────────────
  // One handler per action key, signature `(actionName, ctx) => result`, where
  // ctx = { pageState, resourceConfig, resourceRecord, nav }. The built-ins are
  // declared here; a custom key (e.g. `nextStep`) is supplied the same way and
  // picked up from $attrs. Return values drive the dispatcher:
  //   false | { valid: false, message } → abort (message is notified)
  //   Array                             → treated as `{ requests: [...] }`
  //   Object                            → merged into the pageState call options
  //   undefined | true                  → continue with the built-in default
  submit:  { type: Function, default: null },
  reset:   { type: Function, default: null },
  cancel:  { type: Function, default: null },

  // ── Declarative submission-lifecycle overrides (all resolvable via a
  // _ui/[UiName]/components/[scope]/[Resource]/[page]/pageaction.js modifier
  // — the existing 10-tier action-override lookup, no new resolution path) ──
  // Payload-transform interceptor: (requests, ctx) => requests.
  modifyPayload:   { type: Function, default: null },
  // Nav target after a successful submit: 'view' | 'index' | function(code, ctx).
  // Defaults: add -> view (with new code) or index; edit/action -> view.
  successRoute:    { type: [String, Function], default: null },
  successMessage:  { type: [String, Function], default: '' },
  onSubmitSuccess: { type: Function, default: null },
  onSubmitError:   { type: Function, default: null },
  submitLabel:     { type: [String, Function], default: null }
})

const $q = useQuasar()
const nav = useResourceNav()
const { code: routeCode } = useRouteConfig()
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState = inject('pageState', null)
const attrs = useAttrs()

const pageKey = computed(() => (props.page || '').toLowerCase())
const isAdd = computed(() => pageKey.value === 'add')
const isEdit = computed(() => pageKey.value === 'edit')
const isAction = computed(() => pageKey.value === 'action')
const showFormActions = computed(() => isAdd.value || isEdit.value || isAction.value)

const resourceName = computed(() => resourceConfig?.resourceName?.value || '')

// Action-page field config forwarded via pageProps (see usePageOrchestrator.js /
// usePageResolver.js) — read from $attrs rather than re-deriving it here.
const currentActionConfig = computed(() => attrs.currentActionConfig || null)
const actionForm = computed(() => attrs.actionForm || {})
const selectedOutcome = computed(() => attrs.selectedOutcome || '')
const resolvedActionFields = computed(() => attrs.resolvedActionFields || [])

const submitDisabled = computed(() =>
  isAction.value && attrs.isMockMultiOutcome ? !selectedOutcome.value : false
)

const resolvedSubmitLabel = computed(() => {
  const custom = evalProp(props.submitLabel, resourceRecord?.record?.value, modifierCtx())
  if (custom) return custom
  if (isAdd.value) return 'Create'
  if (isEdit.value) return 'Save'
  return currentActionConfig.value?.label || 'Execute'
})

function evalProp (val, ...args) {
  return typeof val === 'function' ? val(...args) : val
}

function modifierCtx () {
  return { pageState, resourceConfig, resourceRecord, nav }
}

function defaultNavigate (code) {
  if (isAdd.value) {
    if (code) nav.goTo('view', { code })
    else nav.goTo('index')
  } else {
    nav.goTo('view')
  }
}

// ── Unified action dispatcher ─────────────────────────────────────────────────
//
// Every button in the bar routes here. One pipeline for built-ins and custom keys:
//   1. Resolve a handler as props[actionName] (declared prop, or $attrs for a
//      custom key), and await it with (actionName, ctx).
//   2. Abort on `false` / `{ valid: false }`, notifying `message` when present.
//   3. Normalize whatever it returned into pageState call options.
//   4. Run the built-in default for submit/reset/cancel; dispatch a custom action
//      only when its handler actually produced requests/build.
//
const BUILT_IN_ACTIONS = ['submit', 'reset', 'cancel']

// Built-ins are declared props; custom keys ride in on $attrs. Reading each from its
// own source keeps `actions: ['reset', 'nextStep', 'submit']` working from a single
// modifier export without a custom key ever shadowing a declared prop.
function resolveHandler (actionName) {
  const source = BUILT_IN_ACTIONS.includes(actionName) ? props[actionName] : attrs[actionName]
  return typeof source === 'function' ? source : null
}

// `false` / `{ valid:false }` are handled before this; everything else becomes
// options for pageState.submit()/run(). An array is shorthand for `{ requests }`.
function normalizeActionResult (result) {
  if (!result || result === true) return {}
  if (Array.isArray(result)) return { requests: result }
  if (typeof result !== 'object') return {}
  const { valid, message, ...options } = result
  return options
}

async function handleAction (actionName, extraPayload = null) {
  if (!actionName) return
  const ctx = { ...modifierCtx(), payload: extraPayload }
  const handler = resolveHandler(actionName)

  if (!handler && !BUILT_IN_ACTIONS.includes(actionName)) {
    console.warn('[PageAction] No action handler supplied for:', actionName)
    return
  }

  let options = {}
  if (handler) {
    const result = await handler(actionName, ctx)
    if (result === false || result?.valid === false) {
      if (result?.message) $q.notify({ type: 'negative', message: result.message, position: 'top' })
      return
    }
    options = normalizeActionResult(result)
  }

  switch (actionName) {
    case 'submit':
      await runSubmit(ctx, options)
      return
    case 'reset':
      onReset()
      return
    case 'cancel':
      nav.goBack()
      return
    default:
      // Custom action whose handler produced a dispatchable payload. Without one,
      // the handler is assumed to have done its own work and we stop here.
      if (options.requests || options.build) await pageState?.run(options)
  }
}

async function runSubmit (ctx, options = {}) {
  if (!pageState) return

  if (isAction.value) {
    await runWorkflowAction(ctx, options)
    return
  }

  const callOptions = {
    build: props.modifyPayload ? (bctx) => props.modifyPayload(pageState.build(bctx), ctx) : undefined,
    successMsg: evalProp(props.successMessage, ctx) || undefined,
    ...options
  }
  if (!callOptions.onSuccess) {
    callOptions.onSuccess = async ({ response, code }) => {
      pageState.reset()
      if (props.onSubmitSuccess) await props.onSubmitSuccess({ response, code }, ctx)
      else if (props.successRoute) {
        const target = evalProp(props.successRoute, code, ctx)
        if (target) nav.goTo(target, code ? { code } : {})
        else defaultNavigate(code)
      } else {
        defaultNavigate(code)
      }
    }
  }

  const result = await pageState.submit(callOptions)
  if (!result.success && props.onSubmitError) await props.onSubmitError(result, ctx)
}

async function runWorkflowAction (ctx, options = {}) {
  const cfg = currentActionConfig.value
  if (!cfg) return

  for (const field of resolvedActionFields.value) {
    if (field.required && !(actionForm.value[field.header] || '').toString().trim()) {
      $q.notify({ type: 'negative', message: `${field.label} is required`, position: 'top' })
      return
    }
  }

  const code = resourceRecord?.record?.value?.Code || routeCode.value
  const actionConfig = {
    ...cfg,
    column: attrs.column || cfg.column,
    columnValue: selectedOutcome.value || cfg.columnValue || ''
  }

  let requests = [executeActionRequest(resourceName.value, code, actionConfig, { ...actionForm.value })]
  if (props.modifyPayload) requests = props.modifyPayload(requests, ctx)

  const callOptions = {
    requests,
    successMsg: evalProp(props.successMessage, ctx) || `${cfg.label || cfg.action || 'Action'} completed successfully`,
    ...options
  }
  if (!callOptions.onSuccess) {
    callOptions.onSuccess = async ({ response }) => {
      pageState.reset()
      if (props.onSubmitSuccess) await props.onSubmitSuccess({ response }, ctx)
      else if (props.successRoute) nav.goTo(evalProp(props.successRoute, null, ctx) || 'view')
      else defaultNavigate(null)
    }
  }

  const result = await pageState.run(callOptions)
  if (!result.success && props.onSubmitError) await props.onSubmitError(result, ctx)
}

function onReset () {
  if (!pageState) return
  if (resourceName.value) {
    const original = resourceRecord?.record?.value
    // Swaps in a fresh node/record object for the same resource (no navigation,
    // no notification). On Add, FormRecord.vue's default-seeding watch is keyed
    // on the record object's identity (see FormRecord.vue), so this freshly
    // reseeds the resource's configured default values rather than leaving a
    // blank form. On Edit/Action, re-hydrate from the pristine server record
    // (resourceRecord is never mutated by form input — only pageState.node.record
    // is) so unsaved edits are discarded without losing the original values.
    pageState.initResource(resourceName.value, { isPrimaryKey: true, reset: true, code: original?.Code })
    if (!isAdd.value && original) pageState.load(resourceName.value, original)
  } else {
    pageState.reset()
  }
}

// Explicit props win; injected resourceConfig is only a fallback.
const resolvedScope    = computed(() => props.scope    ?? resourceConfig?.scope?.value        ?? 'master')
const resolvedResource = computed(() => props.resource ?? resourceConfig?.resourceSlug?.value ?? '')
const resolvedUiName   = computed(() => props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL')

// ── Sub-action override resolution (10-tier, via useActionResolver) ────────────
function actionResolverProps (action) {
  return computed(() => ({
    action,
    page:     props.page,
    scope:    resolvedScope.value,
    resource: resolvedResource.value,
    uiName:   resolvedUiName.value
  }))
}

const { resolvedComponent: resolvedFormActions, finalProps: resolvedFormActionsProps } =
  useActionResolver(actionResolverProps('FormActions'), FormActions)

const { resolvedComponent: resolvedCrudActions, finalProps: resolvedCrudActionsProps } =
  useActionResolver(actionResolverProps('CrudActions'), CrudActions)

const { resolvedComponent: resolvedResourceReports, finalProps: resolvedResourceReportsProps } =
  useActionResolver(actionResolverProps('ResourceReports'), ResourceReports)

// A CrudActions JS modifier can suppress the whole action (e.g. a tenant that hides
// CRUD FABs entirely on a given resource) by returning `show: false` / `hide: true`,
// either as a plain boolean or a function evaluated here.
function evalVisibility(val) {
  return typeof val === 'function' ? val() : val
}

const modifierVisible = computed(() => {
  const raw = resolvedCrudActionsProps.value || {}
  if ('show' in raw && evalVisibility(raw.show) === false) return false
  if ('hide' in raw && evalVisibility(raw.hide) === true) return false
  return true
})

// FormActions (the sticky submit/reset bar, above) owns Add/Edit/Action pages
// entirely; every other page defers to CrudActions' own record/edit-mode
// visibility logic.
const showCrudActions = computed(() =>
  !showFormActions.value && modifierVisible.value
)

// Reports float alongside the CRUD cluster on browse/view pages. Form pages are
// owned by the sticky bar, which hosts FormAction* buttons only — no report entry
// is resolvable from `actions` (see FormActions.vue). ResourceReports self-hides
// when the resource has no matching reports, so no config lookup is needed here.
// `noReports` is read from attrs as well as props: a full `pageaction.vue` override
// or an intermediate wrapper may pass it through without it landing on the declared
// prop, and the gate must hold in both cases.
const showResourceReports = computed(() =>
  !showFormActions.value &&
  props.reports !== false &&
  props.noReports !== true &&
  attrs.noReports !== true
)

// JS-modifier props minus the resolver's own lookup keys, then the `reports`
// object from the page contract. Unlike CrudActions this does NOT spread `...attrs`:
// pageProps carry generic presentation keys (`icon`, `color`, `mode`) that would
// silently hijack the report FAB. Record context reaches ResourceReports through
// the injected `resourceRecord` instead, so nothing is lost.
const resourceReportsProps = computed(() => {
  const raw = resolvedResourceReportsProps.value || {}
  const { action, scope, resource, uiName, page, ...modifierProps } = raw
  return {
    scope:    resolvedScope.value,
    resource: resolvedResource.value,
    uiName:   resolvedUiName.value,
    ...modifierProps,
    ...(typeof props.reports === 'object' && props.reports !== null ? props.reports : {})
  }
})

// Forward everything: inherited pageProps attrs (for a full Vue override that needs
// resource/scope/record context) plus whatever a JS modifier returned, minus the
// resolver's own internal lookup keys (action/scope/resource/uiName on `raw` — these
// are resolver bookkeeping, distinct from the same-named keys that may legitimately
// arrive via `attrs`).
const crudActionsProps = computed(() => {
  const raw = resolvedCrudActionsProps.value || {}
  const { action, scope, resource, uiName, page, show, hide, ...modifierProps } = raw
  return { ...attrs, ...modifierProps }
})

// FormActions deliberately does NOT receive `...attrs`: pageProps carries an
// `onCancel` (navigateBack) handler that Vue would bind as a `cancel` listener,
// double-navigating on top of FormActionCancel's own goBack(). Only the explicit
// contract below plus JS-modifier props are forwarded; resolver context stays
// authoritative so the bar's buttons resolve against the right tier.
const formActionsProps = computed(() => {
  const raw = resolvedFormActionsProps.value || {}
  const { action, scope, resource, uiName, page, ...modifierProps } = raw
  return {
    submitLabel: resolvedSubmitLabel.value,
    disabled:    submitDisabled.value,
    ...(props.actions ? { actions: props.actions } : {}),
    ...modifierProps,
    page:     props.page,
    scope:    resolvedScope.value,
    resource: resolvedResource.value,
    uiName:   resolvedUiName.value
  }
})
</script>
