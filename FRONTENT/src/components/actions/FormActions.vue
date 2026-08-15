<template>
  <div class="aql-form-actions-spacer">
    <div class="aql-form-actions-bar shadow-up-3">
      <!-- Flex/alignment/gap all come from .aql-form-actions-content in custom.scss.
           Quasar's q-gutter-* is deliberately NOT used here: its negative top margin
           on the container fights strict vertical centering of the buttons. -->
      <!-- The step-change fade is driven by STATE (`meta.stepping`), not by a
           TransitionGroup around the buttons. A per-button enter/leave transition
           was tried first and is the wrong tool here: `<Action>` resolves its
           component asynchronously, so a button's first DOM element is the
           resolver's spinner and the enter lifecycle can be left stranded on
           `-enter-from` — a permanently invisible (opacity 0) action bar. A class
           toggled off a timer-backed flag has no lifecycle to strand: the flag is
           always cleared by PageAction's own setTimeout. -->
      <div
        class="aql-form-actions-content"
        :class="{ 'aql-form-actions-content--stepping': stepping }"
      >
        <Action
          v-for="entry in resolvedActions"
          :key="entry.id"
          :action="entry.action"
          v-bind="entry.props"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Sticky bottom form-actions bar for Add/Edit/Action pages.
 *
 * The bar owns layout and the "breeze" chrome only; every button inside it is
 * mounted through `<Action>` → `useActionResolver`, so each one
 * (`FormActionSubmit`, `FormActionReset`, `FormActionCancel`, or any custom
 * `FormAction<Name>`) is independently overridable via the 10-tier `_ui/` lookup.
 *
 * Which buttons appear is driven by the `actions` prop:
 *   ['reset', 'submit']            → default
 *   ['cancel', 'submit']           → discard-and-leave instead of in-place reset
 *   ['cancel', 'draft', 'submit']  → resolves FormActionCancel / FormActionDraft /
 *                                    FormActionSubmit; unknown keys emit `action`
 *
 * Entries may be a bare string or an object `{ name, ...props }` whose extra keys
 * are merged over the per-key defaults below.
 *
 * All chrome (spacer height, gradient, blur, delayed slide-up entrance) lives in
 * `src/css/custom.scss` under `.aql-form-actions-*` — see ARCHITECTURE RULES §7.
 */
import { computed, inject } from 'vue'
import Action from 'components/Action.vue'

defineOptions({ name: 'ActionsFormActions', inheritAttrs: false })

const props = defineProps({
  // Ordered list of buttons to render (left → right).
  actions:  { type: Array, default: () => ['reset', 'submit'] },

  // Resolver context — explicit props win, injected resourceConfig is the fallback.
  page:     { type: String, default: null },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null },

  // Per-button presentation (each also overridable via `actionProps`).
  submitLabel: { type: [String, Function], default: 'Save' },
  resetLabel:  { type: [String, Function], default: 'Reset' },
  cancelLabel: { type: [String, Function], default: 'Cancel' },
  submitIcon:  { type: [String, Function], default: 'check' },
  resetIcon:   { type: [String, Function], default: 'restart_alt' },
  cancelIcon:  { type: [String, Function], default: 'close' },
  submitColor: { type: [String, Function], default: 'primary' },
  resetColor:  { type: [String, Function], default: 'grey-7' },
  cancelColor: { type: [String, Function], default: 'grey-7' },

  // Submit-only gate (e.g. an action page awaiting an outcome selection).
  disabled:    { type: [Boolean, Function], default: false },

  // Escape hatch: extra props merged per action key, e.g. { submit: { icon: 'send' } }.
  actionProps: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['submit', 'reset', 'cancel', 'action'])

const resourceConfig = inject('resourceConfig', null)
const pageState = inject('pageState', null)

// Raised by PageAction's next/back built-ins for a short settle window around a
// wizard step change, and always cleared by its timer. Drives the bar's fade and
// mirrors the `disable` every FormAction* button already applies for it.
const stepping = computed(() => !!pageState?.meta?.stepping)

const resolvedScope    = computed(() => props.scope    ?? resourceConfig?.scope?.value        ?? 'master')
const resolvedResource = computed(() => props.resource ?? resourceConfig?.resourceSlug?.value ?? '')
const resolvedUiName   = computed(() => props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL')

// Shared lookup context handed to every `<Action>` placeholder in the bar.
const resolverContext = computed(() => ({
  page:     props.page,
  scope:    resolvedScope.value,
  resource: resolvedResource.value,
  uiName:   resolvedUiName.value
}))

// Per-key presentation + intent wiring. Unknown keys fall through to a generic
// `action` emit so a tenant-supplied FormAction<Name> still reaches its container.
const entryDefaults = computed(() => ({
  submit: {
    label: props.submitLabel,
    icon: props.submitIcon,
    color: props.submitColor,
    disabled: props.disabled,
    onClick: () => emit('submit')
  },
  reset: {
    label: props.resetLabel,
    icon: props.resetIcon,
    color: props.resetColor,
    onClick: () => emit('reset')
  },
  cancel: {
    label: props.cancelLabel,
    icon: props.cancelIcon,
    color: props.cancelColor,
    onClick: () => emit('cancel')
  }
}))

// 'submit' → 'FormActionSubmit'; an already-qualified 'FormActionDraft' passes
// through unchanged.
function actionComponentName (name) {
  const key = String(name || '').trim()
  if (!key) return ''
  if (/^formaction/i.test(key)) return key
  return `FormAction${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

// Maps an entry key onto its entryDefaults/actionProps slot: 'submit' and
// 'FormActionSubmit' must hit the same slot.
function defaultsKey (name) {
  return String(name || '').toLowerCase().replace(/^formaction/, '')
}

function normalizeEntry (entry) {
  if (typeof entry === 'string') return { key: entry, extra: {} }
  const { name, action, ...extra } = entry || {}
  return { key: name || action || '', extra }
}

const resolvedActions = computed(() => {
  // Occurrence counter per resolved component name. The key must be IDENTITY,
  // not position: on a wizard page ['next'] → ['back','next'] moves Continue
  // from index 0 to 1, and an index-based key would make the TransitionGroup
  // tear it down and re-create it — animating a button that never left. The
  // counter only kicks in for the (unusual) case of the same action listed twice.
  const seen = {}
  return (props.actions || [])
    .map((entry) => {
      const { key, extra } = normalizeEntry(entry)
      const action = actionComponentName(key)
      if (!action) return null

      const lookupKey = defaultsKey(key)
      const defaults = entryDefaults.value[lookupKey] || {
        onClick: () => emit('action', key)
      }

      seen[action] = (seen[action] || 0) + 1

      return {
        id: seen[action] > 1 ? `${action}-${seen[action]}` : action,
        action,
        props: {
          ...resolverContext.value,
          ...defaults,
          ...(props.actionProps[lookupKey] || {}),
          ...extra
        }
      }
    })
    .filter(Boolean)
})
</script>
