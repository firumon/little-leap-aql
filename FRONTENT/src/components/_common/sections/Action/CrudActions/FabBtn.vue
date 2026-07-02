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

defineOptions({ name: 'CrudActionsFabBtn' })

const props = defineProps({
  permissions: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: String, default: 'primary' },
  icon: { type: String, default: 'menu' },
  activeIcon: { type: String, default: 'close' },
  direction: { type: String, default: 'up' },
  verticalActionsAlign: { type: String, default: 'right' },
  tooltip: { type: String, default: 'Actions' }
})

const preparedProps = computed(() => ({
  permissions: props.permissions,
  color: props.color,
  icon: props.icon,
  activeIcon: props.activeIcon,
  direction: props.direction,
  verticalActionsAlign: props.verticalActionsAlign,
  tooltip: props.tooltip
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'CrudActionsFabBtn',
  page: props.page,
  preparedProps
})
</script>

<style scoped>
.fab-btn {
  width: 56px;
  height: 56px;
  box-shadow: 0 8px 24px rgba(15, 43, 74, 0.3);
  background: linear-gradient(145deg, var(--q-primary), var(--q-primary-dark, #1565c0));
  transition: transform 180ms ease;
}
.fab-btn:active {
  transform: scale(0.95);
}
</style>
