<template>
  <div class="aql-form-actions-spacer">
    <div class="aql-form-actions-bar shadow-up-3">
      <!-- Flex/alignment/gap all come from .aql-form-actions-content in custom.scss.
           Quasar's q-gutter-* is deliberately NOT used here: its negative top margin
           on the container fights strict vertical centering of the buttons. -->
      <div class="aql-form-actions-content">
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

// 'submit' → 'FormActionSubmit'; an already-qualified 'FormActionDraft' passes through.
function actionComponentName (name) {
  const key = String(name || '').trim()
  if (!key) return ''
  if (/^formaction/i.test(key)) return key
  return `FormAction${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

function normalizeEntry (entry) {
  if (typeof entry === 'string') return { key: entry, extra: {} }
  const { name, action, ...extra } = entry || {}
  return { key: name || action || '', extra }
}

const resolvedActions = computed(() =>
  (props.actions || [])
    .map((entry, index) => {
      const { key, extra } = normalizeEntry(entry)
      const action = actionComponentName(key)
      if (!action) return null

      // 'submit' and 'FormActionSubmit' must hit the same defaults/actionProps entry.
      const lookupKey = String(key).toLowerCase().replace(/^formaction/, '')
      const defaults = entryDefaults.value[lookupKey] || {
        onClick: () => emit('action', key)
      }

      return {
        id: `${index}-${action}`,
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
)
</script>
