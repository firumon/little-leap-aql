<template>
  <q-card
    flat
    bordered
    class="aql-widget-tile page-card aql-premium-gradient-card"
    :style="tileStyle"
  >
    <div v-if="hasHead" class="aql-widget-tile__head">
      <div class="aql-widget-tile__heading">
        <div v-if="title" class="aql-widget-tile__title">{{ title }}</div>
        <div v-if="subtitle" class="aql-widget-tile__subtitle">{{ subtitle }}</div>
      </div>
      <div v-if="headControls.length" class="aql-widget-tile__controls">
        <q-chip v-for="c in headControls" :key="c.name" dense outline size="sm">
          {{ c.name }}
        </q-chip>
      </div>
    </div>

    <div class="aql-widget-tile__body">
      <Transition name="aql-fade-smooth" mode="out-in">
        <div v-if="!ready" key="loading" class="aql-widget-tile__center">
          <q-spinner-dots color="primary" size="28px" />
        </div>

        <div v-else-if="!resolvedComponent" key="no-widget" class="aql-widget-tile__warn">
          <q-icon name="widgets" size="28px" color="warning" />
          <div class="aql-widget-tile__warn-title">Widget Not Defined</div>
          <div class="aql-widget-tile__warn-text">
            <strong>{{ item.widget }}</strong> is not a widget file.
          </div>
        </div>

        <div v-else-if="error" key="item-error" class="aql-widget-tile__warn">
          <q-icon name="error_outline" size="28px" color="negative" />
          <div class="aql-widget-tile__warn-title text-negative">Dashboard Item Failed</div>
          <div class="aql-widget-tile__warn-text">
            <strong>{{ item.name }}</strong>: {{ error }}
          </div>
        </div>

        <div v-else-if="orphan" key="no-data" class="aql-widget-tile__warn">
          <q-icon name="link_off" size="28px" color="warning" />
          <div class="aql-widget-tile__warn-title">Dashboard Item Not Defined</div>
          <div class="aql-widget-tile__warn-text">
            <strong>{{ source }}</strong> has no data object on
            resource <strong>{{ resource }}</strong>
            <span v-if="scope"> (scope: <em>{{ scope }}</em>)</span>.
          </div>
        </div>

        <component :is="resolvedComponent" v-else key="widget" v-bind="widgetProps" />
      </Transition>
    </div>

    <div v-if="caption" class="aql-widget-tile__foot">{{ caption }}</div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useWidgetResolver } from 'src/composables/resources/useWidgetResolver'

defineOptions({ name: 'AqlWidget' })

const props = defineProps({
  item: { type: Object, required: true },
  data: { type: Object, default: null },
  scope: { type: String, default: '' },
  resource: { type: String, default: '' },
  uiName: { type: String, default: 'AQL' },
  span: { type: Number, default: 12 },
  gridWidth: { type: Number, default: 0 },
  gap: { type: Number, default: 12 },
  rowUnit: { type: Number, default: 40 },
  error: { type: String, default: '' }
})

const FRAME_KEYS = ['name', 'title', 'subtitle', 'caption', 'controls', 'options']

const source = computed(() => props.item.source || props.item.name)
const title = computed(() => props.data?.title || props.item.title || '')
const subtitle = computed(() => props.data?.subtitle || props.item.subtitle || '')
const caption = computed(() => props.data?.caption || props.item.caption || '')
const headControls = computed(() => props.data?.controls || [])
const hasHead = computed(() => !!title.value || !!subtitle.value || headControls.value.length > 0)

const dataProps = computed(() => {
  const out = {}
  for (const [k, v] of Object.entries(props.data || {})) {
    if (!FRAME_KEYS.includes(k)) out[k] = v
  }
  return out
})

const prepared = computed(() => ({
  widget: props.item.widget,
  name: props.item.name,
  scope: props.scope,
  resource: props.resource,
  uiName: props.uiName,
  ...dataProps.value,
  ...(props.item.props || {})
}))

const { ready, customized, resolvedComponent, finalProps } = useWidgetResolver(prepared)

// No data object and no tenant file to supply one. Same idea as Section.vue's
// "Section Not Defined" card.
const orphan = computed(() => !props.data && !customized.value)

const widgetProps = computed(() => {
  const { widget, name, scope, resource, uiName, ...rest } = finalProps.value
  return rest
})

const COLS = 12

const width = computed(() => {
  if (!props.gridWidth) return 0
  const col = (props.gridWidth - (COLS - 1) * props.gap) / COLS
  return props.span * col + (props.span - 1) * props.gap
})

// A span of H covers H rows plus the H-1 gaps between them, so the gap has to be
// in the sum or every tile comes out too tall.
const rows = computed(() => {
  const opts = resolvedComponent.value || {}
  const minHeight = Number(opts.minHeight) || 48
  const aspect = Number(opts.aspect) || 0
  const picture = aspect && width.value
    ? Math.max(minHeight, (width.value - 24) / aspect)
    : minHeight
  const head = hasHead.value
    ? (title.value ? 18 : 0) + (subtitle.value ? 16 : 0) + (headControls.value.length ? 26 : 0) + 6
    : 0
  const foot = caption.value ? 20 : 0
  return Math.ceil((picture + head + foot + 24 + props.gap) / (props.rowUnit + props.gap))
})

const tileStyle = computed(() => ({
  gridColumn: `span ${props.span}`,
  gridRow: `span ${rows.value}`
}))
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
  gap: 8px;
  margin-bottom: 6px;
}

.aql-widget-tile__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.aql-widget-tile__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.aql-widget-tile__subtitle {
  font-size: 11px;
  line-height: 16px;
  opacity: 0.6;
}

.aql-widget-tile__controls {
  flex: 0 0 auto;
}

.aql-widget-tile__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aql-widget-tile__body > * {
  width: 100%;
  height: 100%;
}

.aql-widget-tile__center,
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
  color: var(--q-warning);
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
