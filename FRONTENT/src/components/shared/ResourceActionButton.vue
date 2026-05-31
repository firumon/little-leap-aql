<template>
  <q-btn
    v-if="shouldRender"
    v-bind="$attrs"
    :color="color"
    :icon="icon"
    :label="label"
    :loading="loading"
    :disable="isButtonDisabled"
    :push="push"
    :glossy="glossy"
    :flat="flat"
    :round="round"
    :dense="dense"
    :unelevated="unelevated"
    :outline="outline"
    :fab="fab"
    @click="handleClick"
  >
    <slot />
    <q-tooltip v-if="!hasPermission && !hideIfUnauthorized">
      You do not have permission to execute this action.
    </q-tooltip>
  </q-btn>
</template>

<script setup>
import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

defineOptions({ name: 'ResourceActionButton' })

const props = defineProps({
  // Permission Gating params
  // Can be a String (e.g. 'create'), Array (e.g. ['read', 'update']), or Object (e.g. { outletPayment: 'create' })
  action: {
    type: [String, Array, Object],
    default: null
  },
  // Optional specific resource name to check permissions against
  targetResource: {
    type: String,
    default: null
  },
  // If true, the button won't render at all if unauthorized. If false, renders disabled with a tooltip.
  hideIfUnauthorized: {
    type: Boolean,
    default: true
  },
  // Quasar QBtn standard styling props forwarder
  color: {
    type: String,
    default: 'primary'
  },
  icon: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  disable: {
    type: Boolean,
    default: false
  },
  push: {
    type: Boolean,
    default: false
  },
  glossy: {
    type: Boolean,
    default: false
  },
  flat: {
    type: Boolean,
    default: false
  },
  round: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  },
  unelevated: {
    type: Boolean,
    default: false
  },
  outline: {
    type: Boolean,
    default: false
  },
  fab: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const { allowed } = useResourceConfig()

// Compute permission state
const hasPermission = computed(() => {
  if (!props.action) return true
  return allowed(props.action, props.targetResource)
})

// Control visibility of the button
const shouldRender = computed(() => {
  if (hasPermission.value) return true
  return !props.hideIfUnauthorized
})

// Control disabled state of the button
const isButtonDisabled = computed(() => {
  if (props.disable) return true
  return !hasPermission.value
})

function handleClick(event) {
  if (isButtonDisabled.value) return
  emit('click', event)
}
</script>
