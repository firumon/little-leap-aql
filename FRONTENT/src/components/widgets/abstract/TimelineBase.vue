<template>
  <div
    ref="el"
    class="aql-widget aql-widget-timeline"
    :class="direction === 'horizontal' ? 'aql-widget-timeline--horizontal' : 'aql-widget-timeline--vertical'"
  >
    <div v-if="!hasValidData" class="aql-widget-empty">
      <slot name="empty">
        <q-icon :name="emptyIcon" size="28px" :color="emptyIconColor" />
        <div class="aql-widget-empty__text">
          <Renderable :value="emptyText" />
        </div>
      </slot>
    </div>

    <!-- Vertical Timeline -->
    <template v-else-if="direction === 'vertical'">
      <div
        v-for="(it, idx) in visibleItems"
        :key="idx"
        class="aql-widget-timeline__item"
      >
        <div class="aql-widget-timeline__marker-col">
          <div
            v-if="showConnector && idx < visibleItems.length - 1"
            class="aql-widget-timeline__connector"
          />
          <div
            class="aql-widget-timeline__marker-wrap"
            :style="{ color: itemColor(it) }"
          >
            <slot name="marker" :item="it" :index="idx">
              <Renderable
                v-if="it.marker"
                :value="it.marker"
                :item="it"
              />
              <div
                v-else-if="markerShape === 'dot'"
                class="aql-widget-timeline__dot"
                :style="{ backgroundColor: itemColor(it) }"
              />
              <q-icon
                v-else
                :name="it.icon || 'circle'"
                size="14px"
                :style="{ color: itemColor(it) }"
              />
            </slot>
          </div>
        </div>

        <div class="aql-widget-timeline__content">
          <div class="aql-widget-timeline__header">
            <span class="aql-widget-timeline__label">
              <slot name="label" :item="it" :index="idx">
                <Renderable :value="it.label" :item="it" />
              </slot>
            </span>
            <span class="aql-widget-timeline__date">
              <slot name="date" :item="it" :index="idx">
                <Renderable :value="it.formattedDate" :item="it" />
              </slot>
            </span>
          </div>

          <div
            v-if="tierAtLeast(tier, 'standard') && it.caption"
            class="aql-widget-timeline__caption"
          >
            <slot name="caption" :item="it" :index="idx">
              <Renderable :value="it.caption" :item="it" />
            </slot>
          </div>
        </div>
      </div>
    </template>

    <!-- Horizontal Timeline -->
    <template v-else>
      <div class="aql-widget-timeline__row">
        <div
          v-for="(it, idx) in visibleItems"
          :key="idx"
          class="aql-widget-timeline__h-item"
        >
          <div v-if="tier !== 'micro'" class="aql-widget-timeline__h-label">
            <slot name="label" :item="it" :index="idx">
              <Renderable :value="it.label" :item="it" />
            </slot>
          </div>

          <div class="aql-widget-timeline__h-track">
            <div
              v-if="showConnector && idx < visibleItems.length - 1"
              class="aql-widget-timeline__h-connector"
            />
            <div
              class="aql-widget-timeline__marker-wrap"
              :style="{ color: itemColor(it) }"
            >
              <slot name="marker" :item="it" :index="idx">
                <Renderable
                  v-if="it.marker"
                  :value="it.marker"
                  :item="it"
                />
                <div
                  v-else-if="markerShape === 'dot'"
                  class="aql-widget-timeline__dot"
                  :style="{ backgroundColor: itemColor(it) }"
                />
                <q-icon
                  v-else
                  :name="it.icon || 'circle'"
                  size="14px"
                  :style="{ color: itemColor(it) }"
                />
              </slot>
            </div>
          </div>

          <div class="aql-widget-timeline__h-date">
            <slot name="date" :item="it" :index="idx">
              <Renderable :value="it.formattedDate" :item="it" />
            </slot>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export const ROW_HEIGHTS = {
  standard: 48,
  compact: 34
}
</script>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import { tierAtLeast } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  direction: {
    type: String,
    default: 'vertical',
    validator: (v) => ['vertical', 'horizontal'].includes(v)
  },
  markerShape: {
    type: String,
    default: 'dot',
    validator: (v) => ['dot', 'icon'].includes(v)
  },
  showConnector: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: 'primary'
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'timeline'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, height, tier } = useWidgetTier()

function formatTimelineDate (dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).trim().split('-')
  if (parts.length === 3) {
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const d = Number(parts[2])
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    }
  }
  const dt = new Date(dateStr)
  return isNaN(dt.getTime()) ? String(dateStr) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function itemColor (it) {
  if (it.color) return resolveCssColor(it.color)
  return resolveCssColor(props.color)
}

const hasValidData = computed(() => {
  return Array.isArray(props.items) && props.items.length > 0
})

const formattedItems = computed(() => {
  return (props.items || []).map((it) => ({
    ...it,
    formattedDate: formatTimelineDate(it.date)
  }))
})

const visibleItems = computed(() => {
  const list = formattedItems.value
  if (!list.length) return []

  if (props.direction === 'horizontal') {
    const limit = tier.value === 'micro' ? 2 : tier.value === 'compact' ? 3 : 5
    return list.slice(0, limit)
  }

  if (tier.value === 'micro') {
    return list.slice(0, 3)
  }

  const h = height.value || 120
  const rowH = tierAtLeast(tier.value, 'standard') ? ROW_HEIGHTS.standard : ROW_HEIGHTS.compact
  const maxRows = Math.max(2, Math.floor(h / rowH))
  return list.slice(0, maxRows)
})
</script>
