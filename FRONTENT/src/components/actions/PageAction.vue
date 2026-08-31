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

    <!-- Unified resource-action FAB cluster (CRUD + AdditionalActions) —
         visibility beyond this gate is driven reactively inside
         ResourceActions.vue itself (permissions + record presence + visibleWhen),
         or explicitly suppressed by a ResourceActions JS modifier returning
         show:false / hide:true. -->
    <component
      :is="resolvedResourceActions"
      v-if="showResourceActions"
      v-bind="resourceActionsProps"
    />

    <!-- Report downloads. Self-dispatching (it delegates to useReports, never to
         pageState), so it takes no @-handler here. It renders nothing when the
         resource has no matching reports, or when a `resourcereports.js` modifier
         returns show:false / hide:true. -->
    <component
      :is="resolvedResourceReports"
      v-if="showResourceReports"
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
 * lifecycle for Add/Edit pages and decides which action cluster is live for the
 * current route:
 *   - add / edit      → `FormActions` (sticky bar)
 *   - everything else → `ResourceActions` (unified bottom-right FAB cluster)
 *
 * AdditionalActions are NOT handled here. `ResourceActions` renders them, but
 * owns none of their logic — that lives in `useAdditionalActions.js`, shared with
 * the embeddable `app/AdditionalActionsButtons.vue`, with one dialog mounted in
 * `MainLayout.vue`. See AQL_ACTION_SYSTEM.md §7.
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
import { computed, inject, onBeforeUnmount, unref, useAttrs } from 'vue'
import { useQuasar } from 'quasar'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import ResourceActions from './ResourceActions.vue'
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
  //   { step: n } from next/back        → move to that step instead of ±1
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
const routeConfig = useRouteConfig()
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState = inject('pageState', null)
const attrs = useAttrs()

const pageKey = computed(() => (props.page || '').toLowerCase())
const isAdd = computed(() => pageKey.value === 'add')
const isEdit = computed(() => pageKey.value === 'edit')
// An action route resolves its page key to the ACTION NAME (`/_action/approve`
// → page `approve`), so `pageKey` can never identify one. The route's own
// `meta.page` can, which is why useRouteConfig exposes `pageName` separately.
const isAction = computed(() => routeConfig.pageName.value === 'action')

// ROUTE INTENT — "this URL is a form page". Owns which CLUSTER the page belongs
// to, so ResourceActions/ResourceReports stay gated on the route alone: a popup
// modal opened over a browse page must not suppress the background FAB cluster,
// and an add/edit route must not grow one just because its form has not
// initialized yet.
const isFormRoute = computed(() => isAdd.value || isEdit.value || isAction.value)

// STATE READINESS — "this page's form state actually exists". `hasNodes` is a
// computed ref on the injected pageState; a page that never provided pageState,
// or an older/partial provider without `hasNodes`, falls back to `true` so the
// bar behaves exactly as it did before this gate existed.
const hasFormNodes = computed(() => {
  const flag = pageState?.hasNodes
  return flag === undefined || flag === null ? true : !!unref(flag)
})

// FormActions needs BOTH: the right route AND initialized nodes. Without the
// second half the sticky submit/reset bar renders over a form that has nothing
// to submit — pressing Submit builds an empty batch.
const showFormActions = computed(() => isFormRoute.value && hasFormNodes.value)

const resourceName = computed(() => resourceConfig?.resourceName?.value || '')

const resolvedSubmitLabel = computed(() => {
  const custom = evalProp(props.submitLabel, resourceRecord?.record?.value, modifierCtx())
  if (custom) return custom
  return isAdd.value ? 'Create' : 'Save'
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
// Actions the dispatcher can complete on its own when no handler is supplied.
// `next`/`back` are wizard step moves: they have a default but NOT a declared
// prop, so a page overrides them through $attrs like any other custom key.
const BUILT_IN_ACTIONS = ['submit', 'reset', 'cancel', 'next', 'back']

// The subset of built-ins that are also declared props above. Everything else —
// `next`, `back`, and any tenant key — rides in on $attrs. Reading each from its
// own source keeps `actions: ['reset', 'nextStep', 'submit']` working from a single
// modifier export without a custom key ever shadowing a declared prop.
const HANDLER_PROPS = ['submit', 'reset', 'cancel']

function resolveHandler (actionName) {
  const source = HANDLER_PROPS.includes(actionName) ? props[actionName] : attrs[actionName]
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

// ── Wizard step settling ──────────────────────────────────────────────────────
//
// A step change swaps the bar's whole button list at once (['back','next'] →
// ['back','submit'], …). Rendering that swap on the same tick as the click both
// looks like a glitch and leaves a window where a second click lands on a button
// that has already been replaced — advancing two steps from one double-click.
//
// So a step move holds `meta.stepping` for a short settle window. Every
// FormAction* button reads it exactly like `meta.submitting` and disables, the
// bar dims through the swap (`.aql-form-actions-content--stepping`), and repeat
// clicks are dropped before the page's own validation runs.
//
// TIMING IS THE WHOLE POINT: the flag is claimed SYNCHRONOUSLY as the click is
// accepted, not after the step actually moves. `handleAction` awaits the page's
// `next` handler, and `await` yields to a microtask even for a synchronous
// handler — so a guard that only latched after that await let every click of a
// double-click sail straight through it and advanced the wizard two or three
// steps at once. Claim first, release on veto.
// The move is staged so the swap itself is never on screen:
//   t=0            claim → bar fades OUT (`--stepping`, 180ms in custom.scss)
//   t=FADE         currentStep changes while the bar is invisible
//   t=FADE+SETTLE  release → the new button set fades IN
// Keep STEP_FADE_MS in step with the transition duration on
// `.aql-form-actions-content`.
const STEP_FADE_MS = 180
const STEP_SETTLE_MS = 60
const STEP_ACTIONS = ['next', 'back']
let stepTimers = []

function clearStepTimers () {
  stepTimers.forEach(clearTimeout)
  stepTimers = []
}

function claimStep () {
  if (!pageState) return
  clearStepTimers()
  pageState.meta.stepping = true
}

function releaseStep () {
  if (!pageState) return
  clearStepTimers()
  pageState.meta.stepping = false
}

// `target` is the step a handler asked for by returning `{ step: n }` — a wizard that
// skips a step it has nothing to ask on. It travels through the SAME staged move as a
// plain +1, so a skip is not a second, unfaded way of changing the step.
function moveStep (delta, target = null) {
  if (!pageState) return
  clearStepTimers()
  const asked = Number(target)
  stepTimers.push(setTimeout(() => {
    const current = pageState.meta.currentStep || 1
    pageState.meta.currentStep = Number.isFinite(asked) && asked > 0
      ? asked
      : Math.max(1, current + delta)
  }, STEP_FADE_MS))
  stepTimers.push(setTimeout(releaseStep, STEP_FADE_MS + STEP_SETTLE_MS))
}

onBeforeUnmount(clearStepTimers)

async function handleAction (actionName, extraPayload = null) {
  if (!actionName) return

  const isStepMove = STEP_ACTIONS.includes(actionName)
  if (isStepMove) {
    // Swallow repeat step clicks landing inside the settle window, then claim it
    // for this one — both before the first `await` below.
    if (pageState?.meta?.stepping) return
    claimStep()
  }

  // Claimed synchronously: `run()` only sets `submitting` after the handler is awaited, so
  // both clicks of a double-click got through and dispatched two identical batches.
  const isSubmit = actionName === 'submit'
  if (isSubmit) {
    if (pageState?.meta?.submitting) return
    if (pageState) pageState.meta.submitting = true
  }

  const ctx = { ...modifierCtx(), payload: extraPayload }
  const handler = resolveHandler(actionName)

  if (!handler && !BUILT_IN_ACTIONS.includes(actionName)) {
    if (isStepMove) releaseStep()
    if (isSubmit && pageState) pageState.meta.submitting = false
    console.warn('[PageAction] No action handler supplied for:', actionName)
    return
  }

  let options = {}
  if (handler) {
    const result = await handler(actionName, ctx)
    if (result === false || result?.valid === false) {
      // Vetoed — the step never moves, so hand the buttons straight back rather
      // than leaving them disabled for the rest of the window.
      if (isStepMove) releaseStep()
      if (isSubmit && pageState) pageState.meta.submitting = false
      if (result?.message) $q.notify({ type: 'negative', message: result.message, position: 'top' })
      return
    }
    options = normalizeActionResult(result)
  }

  switch (actionName) {
    case 'submit':
      try {
        await runSubmit(ctx, options)
      } finally {
        // `run()` clears it too, but is not reached when there is nothing to dispatch.
        if (pageState) pageState.meta.submitting = false
      }
      return
    case 'reset':
      onReset()
      return
    case 'cancel':
      // Leaving without saving discards the draft too, same as Reset.
      pageState?.clearDraft?.()
      nav.goBack()
      return
    // Wizard step moves. Owned here rather than by FormActionNext/Back so a page's
    // own handler can validate and veto BEFORE the step changes — a button that
    // moved the step itself would have already advanced by the time the veto
    // resolved. `back` floors at 1 so the bar may render it unconditionally.
    case 'next':
      moveStep(+1, options.step)
      return
    case 'back':
      moveStep(-1, options.step)
      return
    default:
      // Custom action whose handler produced a dispatchable payload. Without one,
      // the handler is assumed to have done its own work and we stop here.
      if (options.requests || options.build) await pageState?.run(options)
  }
}

async function runSubmit (ctx, options = {}) {
  if (!pageState) return

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

function onReset () {
  if (!pageState) return
  // Reset means "throw my unsaved work away", so the stored draft goes too.
  pageState.clearDraft?.()
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
    if (!isAdd.value && original) pageState.load(original, resourceName.value)
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

const { resolvedComponent: resolvedResourceActions, finalProps: resolvedResourceActionsProps } =
  useActionResolver(actionResolverProps('ResourceActions'), ResourceActions)

const { resolvedComponent: resolvedResourceReports, finalProps: resolvedResourceReportsProps } =
  useActionResolver(actionResolverProps('ResourceReports'), ResourceReports)

// A ResourceActions JS modifier can suppress the whole cluster (e.g. a tenant
// that hides every FAB on a given resource) by returning `show: false` /
// `hide: true`, either as a plain boolean or a function evaluated here.
function evalVisibility(val) {
  return typeof val === 'function' ? val() : val
}

const modifierVisible = computed(() => {
  const raw = resolvedResourceActionsProps.value || {}
  if ('show' in raw && evalVisibility(raw.show) === false) return false
  if ('hide' in raw && evalVisibility(raw.hide) === true) return false
  return true
})

// FormActions (the sticky submit/reset bar, above) owns Add/Edit/Action pages
// entirely; every other page defers to ResourceActions' own permission/record/
// visibleWhen visibility logic.
//
// Gated on `isFormRoute`, NOT `showFormActions`: the two are no longer inverses.
// An add/edit route whose nodes have not initialized yet renders NEITHER cluster
// — falling back to the CRUD FABs there would flash an Add/Edit FAB on top of a
// form. Conversely a browse/view page keeps its cluster no matter what a popup
// modal does to pageState.
const showResourceActions = computed(() =>
  !isFormRoute.value && modifierVisible.value
)

// Reports float alongside the CRUD cluster on browse/view pages. Form pages are
// owned by the sticky bar, which hosts FormAction* buttons only — no report entry
// is resolvable from `actions` (see FormActions.vue). ResourceReports self-hides
// when the resource has no matching reports, so no config lookup is needed here.
// `noReports` is read from attrs as well as props: a full `pageaction.vue` override
// or an intermediate wrapper may pass it through without it landing on the declared
// prop, and the gate must hold in both cases.
const showResourceReports = computed(() =>
  !isFormRoute.value &&
  props.reports !== false &&
  props.noReports !== true &&
  attrs.noReports !== true
)

// ── Prop isolation for the floating clusters ─────────────────────────────────
//
// NEITHER cluster receives `...attrs`. `attrs` here is the full `pageProps` object
// from Page.vue — 30+ form/page keys (fields, contents, defaultValues, handlers,
// …) that a FAB has no use for. Spreading them:
//   * leaked generic presentation keys (`icon`, `color`, `mode`, `label`) straight
//     onto the FABs, silently hijacking their appearance;
//   * re-created a large prop object on every page-state change, and each key became
//     a fresh reactive dependency of every child `<Action>` placeholder below —
//     the dependency fan-out behind `RangeError: Maximum call stack size exceeded
//     at removeSub` when Vue unwound those subscriber lists.
// Both clusters get explicit lookup context plus their own modifier props only.
// Record/config context still reaches them through the injected `resourceRecord` /
// `resourceConfig`, so nothing is actually lost.

const resolverContext = computed(() => ({
  page:     props.page,
  scope:    resolvedScope.value,
  resource: resolvedResource.value,
  uiName:   resolvedUiName.value
}))

const resourceReportsProps = computed(() => {
  const raw = resolvedResourceReportsProps.value || {}
  const { action, scope, resource, uiName, page, ...modifierProps } = raw
  return {
    ...resolverContext.value,
    ...modifierProps,
    ...(typeof props.reports === 'object' && props.reports !== null ? props.reports : {})
  }
})

const resourceActionsProps = computed(() => {
  const raw = resolvedResourceActionsProps.value || {}
  // `show`/`hide` are consumed by the visibility gate above, not forwarded.
  const { action, scope, resource, uiName, page, show, hide, ...modifierProps } = raw
  return {
    ...resolverContext.value,
    ...modifierProps
  }
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
    ...(props.actions ? { actions: props.actions } : {}),
    ...modifierProps,
    page:     props.page,
    scope:    resolvedScope.value,
    resource: resolvedResource.value,
    uiName:   resolvedUiName.value
  }
})
</script>
