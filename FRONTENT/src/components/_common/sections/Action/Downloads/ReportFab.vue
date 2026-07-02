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
    class="report-fab"
    :loading="finalProps.isGenerating"
    :disable="finalProps.isGenerating"
  >
    <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
      {{ finalProps.tooltip }}
    </q-tooltip>
    <slot />
  </q-fab>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'DownloadsReportFab' })

const props = defineProps({
  page: { type: String, required: true },
  isGenerating: { type: Boolean, default: false },
  reportsCount: { type: Number, default: 0 },
  color: { type: String, default: 'deep-orange-7' },
  icon: { type: String, default: 'picture_as_pdf' },
  activeIcon: { type: String, default: 'close' },
  direction: { type: String, default: 'up' },
  verticalActionsAlign: { type: String, default: 'left' },
  tooltip: { type: String, default: 'Download Reports' }
})

const preparedProps = computed(() => ({
  isGenerating: props.isGenerating,
  reportsCount: props.reportsCount,
  color: props.color,
  icon: props.icon,
  activeIcon: props.activeIcon,
  direction: props.direction,
  verticalActionsAlign: props.verticalActionsAlign,
  tooltip: props.tooltip
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'DownloadsReportFab',
  page: props.page,
  preparedProps
})
</script>

<style scoped>
.report-fab {
  box-shadow: 0 8px 24px rgba(221, 44, 0, 0.3);
  transition: transform 180ms ease;
}
.report-fab:active {
  transform: scale(0.95);
}
</style>
