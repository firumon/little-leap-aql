<template>
  <q-card class="dashboard-widget-card metric-widget overflow-hidden relative-position" :class="`theme-${themeColor}`">
    <div class="glow-effect"></div>
    <q-card-section class="q-pa-lg">
      <div v-if="loading" class="q-gutter-sm">
        <q-skeleton type="text" width="60%" class="bg-white opacity-20" />
        <q-skeleton type="rect" height="48px" class="q-mt-md bg-white opacity-10" />
        <q-skeleton type="text" width="40%" class="bg-white opacity-20 q-mt-sm" />
      </div>
      <div v-else class="column justify-between full-height">
        <div class="row items-center justify-between no-wrap q-mb-md">
          <span class="widget-title text-subtitle2 text-weight-medium text-grey-3 ellipsis">
            {{ widgetConfig.metadata.config.title }}
          </span>
          <q-avatar size="42px" class="widget-icon-container text-white" :icon="widgetConfig.metadata.config.icon || 'analytics'" />
        </div>

        <div class="column">
          <div class="metric-value text-h3 text-weight-bold text-white q-my-xs">
            {{ displayValue }}
          </div>
          <div class="text-caption text-grey-4 ellipsis row items-center q-gutter-xs">
            <span>Active Record Queue</span>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  widgetConfig: {
    type: Object,
    required: true
  },
  widgetValue: {
    type: [Number, String],
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const themeColor = computed(() => props.widgetConfig.metadata.config.color || 'primary')

const displayValue = computed(() => {
  if (props.widgetValue === null || props.widgetValue === undefined) return '0'
  if (typeof props.widgetValue === 'number') {
    return props.widgetValue.toLocaleString()
  }
  return String(props.widgetValue)
})
</script>

<style lang="scss" scoped>
.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  height: 180px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.15);

    .widget-icon-container {
      transform: scale(1.1) rotate(5deg);
    }
    .glow-effect {
      opacity: 0.2;
    }
  }
}

.glow-effect {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.1;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.widget-icon-container {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(4px);
  transition: transform 0.3s ease;
}

/* Premium HSL Theme Styling */
.theme-primary {
  background: linear-gradient(135deg, hsl(220, 60%, 25%) 0%, hsl(220, 50%, 15%) 100%);
  .glow-effect { background: hsl(220, 100%, 65%); }
}
.theme-orange {
  background: linear-gradient(135deg, hsl(25, 75%, 28%) 0%, hsl(25, 70%, 15%) 100%);
  .glow-effect { background: hsl(25, 100%, 60%); }
}
.theme-blue {
  background: linear-gradient(135deg, hsl(200, 75%, 25%) 0%, hsl(200, 70%, 15%) 100%);
  .glow-effect { background: hsl(200, 100%, 60%); }
}
.theme-purple {
  background: linear-gradient(135deg, hsl(275, 60%, 28%) 0%, hsl(275, 50%, 15%) 100%);
  .glow-effect { background: hsl(275, 100%, 65%); }
}
.theme-teal {
  background: linear-gradient(135deg, hsl(170, 70%, 22%) 0%, hsl(170, 60%, 12%) 100%);
  .glow-effect { background: hsl(170, 100%, 55%); }
}
.theme-green {
  background: linear-gradient(135deg, hsl(140, 60%, 22%) 0%, hsl(140, 50%, 12%) 100%);
  .glow-effect { background: hsl(140, 100%, 50%); }
}
</style>
