<template>
  <component
    :is="resolvedComponent"
    v-slot="{ color, icon, activeIcon, direction, verticalActionsAlign, tooltip }"
    v-if="resolvedComponent"
    v-bind="finalProps"
  >
    <slot />
  </component>
  <q-fab
    v-else
    :color="finalProps.color"
    :icon="finalProps.icon"
    :active-icon="finalProps.activeIcon"
    :direction="finalProps.direction"
    :vertical-actions-align="finalProps.verticalActionsAlign"
    class="fab-btn"
  >
    <q-tooltip anchor="center left" self="center right" :offset="[10, 0]">
      {{ finalProps.tooltip }}
    </q-tooltip>
    <slot />
  </q-fab>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'AdditionalActionsFabBtn' })

const props = defineProps({
  actions: { type: Array, required: true },
  page: { type: String, required: true },
  color: { type: String, default: 'secondary' },
  icon: { type: String, default: 'bolt' },
  activeIcon: { type: String, default: 'close' },
  direction: { type: String, default: 'up' },
  verticalActionsAlign: { type: String, default: 'right' },
  tooltip: { type: String, default: 'More Actions' }
})

const preparedProps = computed(() => ({
  actions: props.actions,
  color: props.color,
  icon: props.icon,
  activeIcon: props.activeIcon,
  direction: props.direction,
  verticalActionsAlign: props.verticalActionsAlign,
  tooltip: props.tooltip
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'AdditionalActionsFabBtn',
  page: props.page,
  preparedProps
})
</script>

<style scoped>
.fab-btn {
  width: 56px;
  height: 56px;
  box-shadow: 0 8px 24px rgba(15, 43, 74, 0.3);
  transition: transform 180ms ease;
}
.fab-btn:active {
  transform: scale(0.95);
}
</style>
