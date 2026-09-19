<template>
  <div class="aql-tile-wrapper relative-position">
    <component
      :is="resolvedComponent"
      v-if="!isMissingCustom"
      v-bind="finalProps"
      :loading="loading"
    />

    <q-card
      v-else
      flat
      bordered
      class="aql-widget-tile page-card aql-premium-gradient-card flex flex-center text-center q-pa-sm"
    >
      <div>
        <q-icon name="dashboard_customize" size="28px" color="warning" class="q-mb-xs" />
        <div class="text-caption text-weight-medium text-warning q-mb-xs">
          Tile Not Defined
        </div>
        <div class="text-caption text-grey-7" style="font-size: 10px; line-height: 13px;">
          <strong>{{ tileProps?.name }}</strong> is not defined
          on resource <strong>{{ resource }}</strong>
          <span v-if="scope">
            (scope: <em>{{ scope }}</em>)
          </span>.
        </div>
      </div>
    </q-card>

    <q-inner-loading :showing="loading.state" />
  </div>
</template>

<script>
export default {
  inheritAttrs: false
}
</script>

<script setup>
import { computed } from 'vue'
import Frame from 'src/components/Frame.vue'
import { useWidgetResolver } from 'src/composables/resources/useWidgetResolver'

const componentProps = defineProps({
  rowKey: {
    type: [String, Number],
    default: undefined
  },
  resource: {
    type: String,
    default: ''
  },
  scope: {
    type: String,
    default: ''
  },
  custom: {
    type: Boolean,
    default: false
  },
  hideOnEmpty: {
    type: Boolean,
    default: false
  },
  props: {
    type: Object,
    default: () => ({})
  },
  controls: {
    type: Array,
    default: () => []
  },
  data: {
    type: Object,
    default: null
  },
  resourceLoading: {
    type: Object,
    default: null
  },
  span: {
    type: Number,
    default: 12
  },
  score: {
    type: Object,
    default: () => ({})
  },
  uiName: {
    type: String,
    default: ''
  }
})

const effectiveUiName = computed(() => componentProps.uiName || 'AQL')

const tileProps = computed(() => componentProps.props || {})

const tilePropsFlat = computed(() => {
  const p = tileProps.value
  const { title, subtitle, caption, ...data } = componentProps.data?.value ?? componentProps.data ?? {}
  const text = {
    title: title ?? p.title ?? '',
    subtitle: subtitle ?? p.subtitle ?? '',
    caption: caption ?? p.caption ?? ''
  }
  // Empty keys stay out, so a widget can still use its own fallback text.
  const widgetText = Object.fromEntries(Object.entries(text).filter(([, v]) => v))
  return {
    ...text,
    widget: p.widget ?? '',
    widgetProps: { ...widgetText, ...(p.widgetProps ?? {}) },
    controls: componentProps.controls ?? [],
    data,
    error: p.error ?? '',
    name: p.name ?? '',
    resource: componentProps.resource ?? '',
    scope: componentProps.scope ?? ''
  }
})

const { ready, resolvedComponent, finalProps } = useWidgetResolver(
  tilePropsFlat,
  effectiveUiName
)

const isMissingCustom = computed(() => {
  return componentProps.custom && resolvedComponent.value === Frame
})

const loading = computed(() => {
  const inflight = []
  if (componentProps.resourceLoading?.value) inflight.push('resource')
  if (!ready.value) inflight.push('frame')
  if (componentProps.data?.value?.loading) inflight.push('data')

  return {
    inflight,
    state: inflight.length > 0
  }
})
</script>

<style scoped>
.aql-tile-wrapper {
  height: 100%;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.aql-tile-wrapper > :deep(.q-card) {
  height: 100%;
  width: 100%;
}
</style>
