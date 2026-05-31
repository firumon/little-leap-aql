<template>
  <q-page-sticky :position="position" :offset="offset" class="fab-sticky" v-if="hasWritePermission">
    <q-btn
      round
      unelevated
      :icon="icon"
      :color="color"
      class="fab-btn"
      @click="navigateToAdd"
    >
      <q-tooltip anchor="top middle" self="bottom middle">{{ tooltip }}</q-tooltip>
    </q-btn>
  </q-page-sticky>
</template>

<script setup>
import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav.js'

defineOptions({ name: 'DataAddFAB' })

const props = defineProps({
  position: {
    type: String,
    default: 'bottom-right'
  },
  offset: {
    type: Array,
    default: () => [18, 18]
  },
  icon: {
    type: String,
    default: 'add'
  },
  color: {
    type: String,
    default: 'primary'
  },
  tooltip: {
    type: String,
    default: 'Add New'
  },
  // Allows overriding the permission check action
  action: {
    type: String,
    default: 'create'
  },
  // Allows overriding the resource checked (defaults to active resource in view)
  targetResource: {
    type: String,
    default: null
  },
  // Allows overriding the click event handler to trigger custom methods instead of nav
  customClick: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])
const { permissions, allowed } = useResourceConfig()
const nav = useResourceNav()

const hasWritePermission = computed(() => {
  // If targetResource is provided, check allowed for that resource, otherwise check permissions of active resource
  if (props.targetResource) {
    return allowed(props.action, props.targetResource)
  }
  return permissions.value?.canWrite || allowed(props.action)
})

function navigateToAdd(event) {
  if (props.customClick) {
    emit('click', event)
    return
  }
  const overrideParams = {}
  if (props.targetResource) {
    overrideParams.resourceSlug = props.targetResource
  }
  nav.goTo('add', overrideParams)
}
</script>

<style scoped>
.fab-btn {
  width: 58px;
  height: 58px;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary, #0f766e), var(--master-primary-700, #0f766e));
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.fab-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(15, 118, 110, 0.45);
}

.fab-sticky {
  z-index: 30;
}
</style>
