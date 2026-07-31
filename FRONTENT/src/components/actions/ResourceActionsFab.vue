<template>
  <q-fab
    glossy
    push
    :color="resolvedColor"
    :icon="resolvedIcon"
    :active-icon="resolvedActiveIcon"
    :direction="resolvedDirection"
    vertical-actions-align="right"
    class="aql-resource-action-fab"
  >
    <q-tooltip anchor="center left" self="center right" :offset="[10, 0]">
      {{ resolvedTooltip }}
    </q-tooltip>
    <slot />
  </q-fab>
</template>

<script setup>
/**
 * Expandable trigger of the unified ResourceActions cluster — rendered when the
 * page has more than one action. Hosts one `ResourceActionItem` (as
 * `q-fab-action`) per entry via the default slot; `ResourceActions.vue` resolves
 * it through `useActionResolver` so a tenant can swap or modify it at any of the
 * 10 `_ui/` tiers as `resourceactionsfab.(vue|js)`.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'ActionsResourceActionsFab', inheritAttrs: false })

const props = defineProps({
  color:      { type: [String, Function], default: 'primary' },
  icon:       { type: [String, Function], default: 'more_vert' },
  activeIcon: { type: [String, Function], default: 'close' },
  direction:  { type: [String, Function], default: 'up' },
  tooltip:    { type: [String, Function], default: 'Actions' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const resolvedColor      = computed(() => evalProp(props.color))
const resolvedIcon       = computed(() => evalProp(props.icon))
const resolvedActiveIcon = computed(() => evalProp(props.activeIcon))
const resolvedDirection  = computed(() => evalProp(props.direction))
const resolvedTooltip    = computed(() => evalProp(props.tooltip))
</script>
