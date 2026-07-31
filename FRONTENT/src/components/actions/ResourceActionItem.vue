<template>
  <!-- Inside the expandable ResourceActionsFab menu: a real q-fab-action so it
       participates in Quasar's stagger/auto-collapse behaviour. -->
  <q-fab-action
    v-if="visible && asFabAction"
    glossy
    push
    :color="resolvedColor"
    :icon="resolvedIcon"
    :label="resolvedLabel"
    label-position="left"
    external-label
    label-class="aql-resource-action-label"
    :disable="resolvedDisabled"
    @click="onClick"
  />

  <!-- Standalone: a single round floating FAB. -->
  <q-btn
    v-else-if="visible"
    glossy
    push
    round
    fab
    :color="resolvedColor"
    :icon="resolvedIcon"
    class="aql-resource-action-fab"
    :disable="resolvedDisabled"
    @click="onClick"
  >
    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 8]">
      {{ resolvedTooltip }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>
/**
 * Generic base for every item in the ResourceActions FAB cluster.
 *
 * `ResourceActions.vue` mounts one of these per entry through `<Action>` under a
 * per-item action name — `ResourceActionAdd`, `ResourceActionEdit`, and
 * `ResourceAction<Name>` for each AdditionalActions entry (e.g.
 * `ResourceActionApprove`). No base file exists for those names, so `<Action>`'s
 * `fallback` prop routes them all here — which is exactly what makes every item
 * overridable at all 10 `_ui/` tiers as `resourceactionapprove.(vue|js)` etc.
 *
 * Click contract: emits `click` so the container (`ResourceActions`) runs the
 * item's default behaviour (navigate / open the workflow dialog). A `handler`
 * supplied by a JS modifier REPLACES that emit entirely — mirroring
 * `FormActionCancel`'s `cancelHandler` escape hatch — so a tenant can repoint
 * one item's behaviour without touching the container.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'ActionsResourceActionItem', inheritAttrs: false })

const props = defineProps({
  icon:    { type: [String, Function], default: 'bolt' },
  color:   { type: [String, Function], default: 'primary' },
  // Rendered as the external pill label inside the expanded menu.
  label:   { type: [String, Function], default: '' },
  // Standalone-FAB hover text; falls back to `label`.
  tooltip: { type: [String, Function], default: '' },
  disabled: { type: [Boolean, Function], default: false },

  // Visibility gates, mirroring the ResourceActions/ResourceReports modifier contract.
  show: { type: [Boolean, Function], default: true },
  hide: { type: [Boolean, Function], default: false },

  // Set by ResourceActions when this item renders inside the expandable menu.
  asFabAction: { type: Boolean, default: false },

  // JS-modifier escape hatch: replaces the `click` emit (and therefore the
  // container's default behaviour) with a custom `(ctx) => void` handler,
  // ctx = { record, config, pageState, nav }.
  handler: { type: Function, default: null }
})

const emit = defineEmits(['click'])

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState      = inject('pageState', null)
const nav = useResourceNav()

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const resolvedIcon     = computed(() => evalProp(props.icon))
const resolvedColor    = computed(() => evalProp(props.color))
const resolvedLabel    = computed(() => evalProp(props.label))
const resolvedTooltip  = computed(() => evalProp(props.tooltip) || resolvedLabel.value)
const resolvedDisabled = computed(() => evalProp(props.disabled) === true)

const visible = computed(() => {
  if (evalProp(props.show) === false) return false
  if (evalProp(props.hide) === true) return false
  return true
})

function onClick () {
  if (props.handler) {
    props.handler({
      record: resourceRecord?.record?.value || null,
      config: resourceConfig?.config?.value || null,
      pageState,
      nav
    })
    return
  }
  emit('click')
}
</script>
