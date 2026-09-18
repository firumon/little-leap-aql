<template>
  <q-card
    flat
    bordered
    class="aql-widget-tile page-card aql-premium-gradient-card"
    :class="$attrs.class"
    :style="cardStyle"
  >
    <div v-if="hasHead" class="aql-widget-tile__head">
      <div class="aql-widget-tile__heading">
        <div v-if="title" class="aql-widget-tile__title">{{ title }}</div>
        <div v-if="subtitle" class="aql-widget-tile__subtitle">{{ subtitle }}</div>
      </div>
      <div class="aql-widget-tile__controls">
        <Controls />
      </div>
    </div>

    <div class="aql-widget-tile__body" :style="bodyStyle">
      <div v-if="error" class="aql-widget-tile__warn">
        <q-icon name="error_outline" size="24px" color="negative" />
        <div class="aql-widget-tile__warn-title text-negative">Error</div>
        <div class="aql-widget-tile__warn-text">{{ error }}</div>
      </div>
      <Widget
        v-else
        :name="widget"
        v-bind="widgetPropsMerged"
        class="aql-widget-fill"
      />
    </div>

    <div v-if="caption" class="aql-widget-tile__foot">{{ caption }}</div>
  </q-card>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import Widget from 'src/components/widgets/Widget.vue'
import { presetOf } from 'src/components/widgets/presetOf.js'
import { useDataControls } from 'src/composables/data/useDataControls.js'

defineOptions({
  name: 'AqlFrame',
  inheritAttrs: false
})

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  controls: { type: Array, default: () => [] },
  caption: { type: String, default: '' },
  error: { type: String, default: '' },
  loading: {
    type: Object,
    default: () => ({ inflight: [], state: false })
  },
  widget: {
    type: String,
    default: ''
  },
  widgetProps: {
    type: Object,
    default: () => ({})
  },
  data: {
    type: Object,
    default: () => ({})
  }
})

const attrs = useAttrs()

const { Controls } = useDataControls(() => props.controls)

const hasHead = computed(() => !!props.title || !!props.subtitle || (Array.isArray(props.controls) && props.controls.length > 0))

const cardStyle = computed(() => attrs.style)

const widgetPropsMerged = computed(() => {
  const d = { ...(props.data || {}) }
  delete d.loading
  delete d.empty
  return { ...(props.widgetProps || {}), ...d }
})

const bodyStyle = computed(() => {
  const name = props.widget
  const preset = name ? presetOf(name) : null

  if (!preset) return {}

  const minHeight = Number(preset.minHeight) || 0
  const aspect = Number(preset.aspect) || 0
  const rowHeight = Number(preset.rowHeight) || 0

  const style = {}

  if (rowHeight > 0) {
    const rawList = props.data?.items ?? props.data?.series?.[0]?.items ?? props.data?.points ?? []
    const count = Array.isArray(rawList) ? rawList.length : 0
    const computedHeight = Math.max(minHeight, count * rowHeight)
    if (computedHeight > 0) {
      style.minHeight = `${computedHeight}px`
    }
  } else if (aspect > 0) {
    style.aspectRatio = String(aspect)
    if (minHeight > 0) {
      style.minHeight = `${minHeight}px`
    }
  } else if (minHeight > 0) {
    style.minHeight = `${minHeight}px`
  }

  return style
})
</script>

<style scoped>
.aql-widget-tile {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  animation: none;
}

.aql-widget-tile__head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  width: 100%;
}

.aql-widget-tile__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.aql-widget-tile__title {
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.aql-widget-tile__subtitle {
  font-size: 10px;
  line-height: 14px;
  opacity: 0.6;
}

.aql-widget-tile__controls {
  flex: 0 1 auto;
  max-width: 100%;
}

.aql-widget-tile__controls :deep(.aql-field-menuselect),
.aql-widget-tile__controls :deep(.aql-field-plainselect),
.aql-widget-tile__controls :deep(.aql-field-chipselect),
.aql-widget-tile__controls :deep(.q-btn),
.aql-widget-tile__controls :deep(.q-chip),
.aql-widget-tile__controls :deep(.q-field) {
  font-size: 11px !important;
}

.aql-widget-tile__controls :deep(.q-btn .q-icon),
.aql-widget-tile__controls :deep(.q-chip .q-icon) {
  font-size: 14px !important;
}

.aql-widget-tile__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  width: 100%;
}

.aql-widget-fill,
.aql-widget-tile__body > * {
  width: 100%;
  height: 100%;
}

.aql-widget-tile__warn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.aql-widget-tile__warn-title {
  font-size: 12px;
  font-weight: 500;
}

.aql-widget-tile__warn-text {
  font-size: 11px;
  opacity: 0.7;
  padding: 0 8px;
}

.aql-widget-tile__foot {
  flex: 0 0 auto;
  font-size: 11px;
  line-height: 16px;
  opacity: 0.55;
  margin-top: 4px;
}
</style>
