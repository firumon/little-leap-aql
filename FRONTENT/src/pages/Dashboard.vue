<template>
  <q-page padding :class="pageClass">
    <div class="relative-position" style="min-height: 120px;">
      <q-inner-loading :showing="!loaded" />
      <TransitionGroup
        tag="div"
        name="dashboard-cell-move"
        class="row items-stretch"
        :class="gridClass"
        :style="gridStyle"
      >
        <div
          v-for="(key, index) in order"
          :key="key"
          class="dashboard-cell"
          :class="{ 'dashboard-cell--hidden': (col[key] ?? 0) <= 0 }"
          :style="cellStyle(key, index)"
        >
          <div class="dashboard-cell__inner">
            <Tile
              v-if="entryByKey[key]"
              v-bind="entryByKey[key]"
              :row-key="key"
              :ui-name="uiName"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import Tile from 'src/components/Tile.vue'
import { useDashboardResolver } from 'src/composables/resources/useDashboardResolver'
import { useDashboardLayout } from 'src/composables/dashboard/useDashboardLayout'

defineOptions({ name: 'AqlDashboardPage' })

const { dashboardProps, items, loaded } = useDashboardResolver()
const uiName = computed(() => dashboardProps.value?.uiName || 'AQL')
const columns = computed(() => dashboardProps.value?.columns ?? 12)
const controlsMinSpan = computed(() => dashboardProps.value?.controlsMinSpan ?? 6)
const gap = computed(() => dashboardProps.value?.gap ?? 0)
const motionMs = computed(() => dashboardProps.value?.motionMs ?? 800)
const staggerMs = computed(() => dashboardProps.value?.staggerMs ?? 100)
const staggerCap = computed(() => dashboardProps.value?.staggerCap ?? 12)
const pageClass = computed(() => dashboardProps.value?.pageClass || '')
const gridClass = computed(() => dashboardProps.value?.gridClass || '')
const gridStyle = computed(() => ({
  margin: `-${gap.value}px`
}))

const { col, order } = useDashboardLayout(items, columns, controlsMinSpan)

const entryByKey = computed(() => {
  const map = {}
  for (const entry of items.value || []) {
    map[entry.key] = entry
  }
  return map
})

const cellStyle = (key, index) => {
  const cols = columns.value || 12
  const width = col.value[key] ?? cols
  const delay = Math.min(index, staggerCap.value) * staggerMs.value
  const duration = motionMs.value

  const base = {
    '--motion-duration': `${duration}ms`,
    '--motion-delay': `${delay}ms`
  }

  if (width <= 0) {
    return {
      ...base,
      flex: '0 0 0%',
      maxWidth: '0%',
      padding: '0',
      overflow: 'hidden'
    }
  }

  return {
    ...base,
    flex: `0 0 calc(${width} / ${cols} * 100%)`,
    maxWidth: `calc(${width} / ${cols} * 100%)`,
    padding: `${gap.value}px`
  }
}
</script>

<style scoped>
.dashboard-cell {
  box-sizing: border-box;
  min-width: 0;
  transition:
    flex var(--motion-duration, 800ms) ease var(--motion-delay, 0ms),
    max-width var(--motion-duration, 800ms) ease var(--motion-delay, 0ms),
    padding var(--motion-duration, 800ms) ease var(--motion-delay, 0ms);
}

.dashboard-cell-move-move {
  transition: transform var(--motion-duration, 800ms) ease var(--motion-delay, 0ms);
}

.dashboard-cell__inner {
  height: 100%;
  width: 100%;
  min-width: 0;
  transform-origin: center center;
  transform: scale(1);
  opacity: 1;
  transition:
    transform var(--motion-duration, 800ms) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0ms),
    opacity var(--motion-duration, 800ms) ease var(--motion-delay, 0ms);
}

.dashboard-cell--hidden .dashboard-cell__inner {
  transform: scale(0);
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--motion-duration, 800ms) ease var(--motion-delay, 0ms),
    opacity var(--motion-duration, 800ms) ease var(--motion-delay, 0ms);
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-cell,
  .dashboard-cell-move-move,
  .dashboard-cell__inner,
  .dashboard-cell--hidden .dashboard-cell__inner {
    transition: none !important;
    transform: none !important;
  }
}
</style>