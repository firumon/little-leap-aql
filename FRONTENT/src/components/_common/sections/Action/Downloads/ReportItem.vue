<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @click="$emit('click')"
  />
  <q-fab-action
    v-else
    :color="resolvedColor"
    :icon="resolvedIcon"
    :label="resolvedLabel"
    :label-position="finalProps.labelPosition"
    :external-label="finalProps.externalLabel"
    :label-class="finalProps.labelClass"
    @click="$emit('click')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'DownloadsReportItem' })

const props = defineProps({
  page: { type: String, required: true },
  report: { type: Object, required: true },
  color: { type: String, default: 'deep-orange-6' },
  labelPosition: { type: String, default: 'right' },
  externalLabel: { type: Boolean, default: true },
  labelClass: { type: String, default: 'text-weight-bold bg-white text-grey-9 q-px-sm q-py-xs shadow-1 rounded-borders' }
})

defineEmits(['click'])

const preparedProps = computed(() => ({
  report: props.report,
  color: props.color,
  icon: props.report.icon || 'picture_as_pdf',
  label: props.report.label || props.report.name,
  labelPosition: props.labelPosition,
  externalLabel: props.externalLabel,
  labelClass: props.labelClass
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'DownloadsReportItem',
  page: props.page,
  preparedProps
})

const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(props.report) : c
})

const resolvedIcon = computed(() => {
  const i = finalProps.value.icon
  return typeof i === 'function' ? i(props.report) : i
})

const resolvedLabel = computed(() => {
  const l = finalProps.value.label
  return typeof l === 'function' ? l(props.report) : l
})
</script>
