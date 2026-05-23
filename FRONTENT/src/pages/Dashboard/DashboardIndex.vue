<template>
  <q-page padding class="bg-grey-1">
    <!-- Header -->
<!--    <div class="row items-center justify-between q-mb-xl">
      <div class="column">
        <h1 class="text-h4 text-weight-bold text-slate-800 q-ma-none font-outfit">
          Dashboard Overview
        </h1>
        <div class="text-subtitle2 text-grey-6 q-mt-xs">
          Real-time metrics, analytics pipelines, and transactional queues
        </div>
      </div>
      <q-btn
        icon="refresh"
        color="primary"
        round
        flat
        class="bg-white shadow-1"
        :loading="loading"
        @click="triggerManualRefresh"
      >
        <q-tooltip>Refresh Live Feeds</q-tooltip>
      </q-btn>
    </div>-->

    <!-- Active Grid packed into clean rows -->
    <div v-if="packedRows.length > 0">
      <div
        v-for="(row, rowIndex) in packedRows"
        :key="rowIndex"
        class="row q-col-gutter-md q-mb-md"
      >
        <div
          v-for="widget in row"
          :key="widget.metadata.id"
          :class="[
            'col-12',
            widget.metadata.config.layout?.sm ? `col-sm-${widget.metadata.config.layout.sm}` : '',
            widget.metadata.config.layout?.md ? `col-md-${widget.metadata.config.layout.md}` : 'col-md-4',
            widget.metadata.config.layout?.lg ? `col-lg-${widget.metadata.config.layout.lg}` : 'col-lg-3'
          ]"
        >
          <component
            :is="getWidgetComponent(widget.metadata.config.type)"
            :widget-config="widget"
            :widget-value="widgetValues[widget.metadata.id]"
            :loading="loading"
          />
        </div>
      </div>
    </div>

    <!-- Empty State / No widgets assigned -->
    <div
      v-else-if="!loading"
      class="column items-center justify-center q-pa-xl text-center empty-state-container shadow-1"
    >
      <q-icon name="dashboard_customize" size="5rem" class="text-primary opacity-30 q-mb-lg" />
      <h2 class="text-h5 text-weight-bold text-slate-800 q-ma-none">
        No active dashboard widgets
      </h2>
      <p class="text-body2 text-grey-6 q-mt-sm">
        Your current role permissions or dynamic dashboard settings do not have any active widgets assigned at this time.
      </p>
    </div>

    <!-- Page Loading Skeleton -->
    <div v-else class="row q-col-gutter-md">
      <div v-for="i in 3" :key="i" class="col-12 col-sm-6 col-md-4">
        <q-card class="skeleton-widget-card overflow-hidden">
          <q-card-section class="q-pa-lg">
            <q-skeleton type="text" width="50%" class="q-mb-md" />
            <q-skeleton type="rect" height="60px" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useDashboard } from 'src/composables/_dashboard/useDashboard'
import { useResourceIoStore } from 'src/stores/resourceIo'

// Import widgets directly to register in gateway assembler
import MetricWidget from 'src/components/_dashboard/MetricWidget.vue'
import BarChartWidget from 'src/components/_dashboard/BarChartWidget.vue'
import DonutChartWidget from 'src/components/_dashboard/DonutChartWidget.vue'
import TimelineWidget from 'src/components/_dashboard/TimelineWidget.vue'

const { activeWidgets, widgetValues, loading } = useDashboard()
const resourceIo = useResourceIoStore()

function getWidgetComponent(type) {
  const components = {
    MetricWidget,
    BarChartWidget,
    DonutChartWidget,
    TimelineWidget
  }
  return components[type] || null
}

// Greedy 12-Column Grid-Packing Algorithm (packs based on desktop md size)
const packedRows = computed(() => {
  const rows = []
  const queue = [...activeWidgets.value]

  while (queue.length > 0) {
    const currentRow = []
    let remainingSpace = 12

    let idx = 0
    while (idx < queue.length) {
      const widget = queue[idx]
      // Default to 4 columns if layout md is unspecified
      const layoutWidth = Number(widget.metadata.config.layout?.md || 4)

      if (layoutWidth <= remainingSpace) {
        currentRow.push(widget)
        remainingSpace -= layoutWidth
        queue.splice(idx, 1) // Remove from queue
      } else {
        idx++ // Try next widget in the queue to fit remainingSpace
      }
    }

    rows.push(currentRow)
  }
  return rows
})

// Dynamic manual refresh of dashboard dependencies
async function triggerManualRefresh() {
  const uniqueResources = new Set()
  activeWidgets.value.forEach((w) => {
    const ds = w.metadata.dataSource
    if (ds) {
      if (ds.resource) uniqueResources.add(ds.resource)
      if (Array.isArray(ds.resources)) {
        ds.resources.forEach((r) => uniqueResources.add(r))
      }
    }
  })

  const resourcesList = Array.from(uniqueResources)
  if (resourcesList.length > 0) {
    try {
      await resourceIo.syncResources(resourcesList, { showLoading: true })
    } catch (err) {
      console.error('Manual dashboard sync failed:', err)
    }
  }
}
</script>

<style lang="scss" scoped>
.empty-state-container {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-top: 40px;
}

.skeleton-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  height: 180px;
}
</style>
