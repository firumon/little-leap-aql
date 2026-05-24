<template>
  <q-card class="dashboard-widget-card comparison-widget overflow-hidden relative-position" :class="`theme-${themeColor}`">
    <div class="glow-effect"></div>
    <q-card-section class="q-pa-md q-pa-sm-lg full-height">
      <!-- Loading Skeleton State -->
      <div v-if="loading" class="q-gutter-sm">
        <q-skeleton type="text" width="50%" class="bg-white opacity-20" />
        <q-skeleton type="rect" height="48px" class="q-mt-md bg-white opacity-10" />
        <q-skeleton type="text" width="80%" class="bg-white opacity-20 q-mt-sm" />
      </div>

      <!-- Real Content State -->
      <div v-else class="column justify-between full-height">
        <!-- Header Section: Title & Icon -->
        <div class="row items-center justify-between no-wrap q-mb-xs">
          <span class="widget-title text-weight-medium text-grey-3 text-subtitle2 q-pr-xs">
            {{ widgetConfig.metadata.config.title }}
          </span>
          <q-avatar 
            size="42px" 
            class="widget-icon-container text-white shrink-avatar" 
            :icon="widgetConfig.metadata.config.icon || 'compare_arrows'" 
          />
        </div>

        <!-- Metric Value and Trend Badge -->
        <div class="column q-mt-xs">
          <div class="row items-center q-gutter-x-xs no-wrap">
            <span class="metric-value text-weight-bold text-white q-my-none leading-none">
              {{ displayCurrent }}
            </span>
            
            <!-- Trend Badge -->
            <q-badge
              v-if="hasComparison"
              :color="badgeColor"
              text-color="white"
              class="trend-badge q-py-xs q-px-xs text-weight-bold text-caption row items-center no-wrap shadow-1"
            >
              <q-icon :name="trendIcon" size="12px" class="q-mr-xs" />
              <span>{{ displayDifference }}</span>
            </q-badge>
          </div>

          <!-- Explanation Text (Dynamic Description Template) -->
          <div class="text-caption text-grey-3 explanation-text q-mt-sm leading-relaxed">
            {{ explanationText }}
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
    type: Object,
    default: () => null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Configuration Extraction
const config = computed(() => props.widgetConfig.metadata.config || {})
const themeColor = computed(() => config.value.color || 'primary')
const comparisonConfig = computed(() => config.value.comparison || {})

// Value Extraction
const currentVal = computed(() => props.widgetValue?.current ?? 0)
const previousVal = computed(() => props.widgetValue?.previous ?? 0)
const differenceVal = computed(() => props.widgetValue?.difference ?? 0)

const hasComparison = computed(() => {
  return props.widgetValue !== null && 
         props.widgetValue !== undefined && 
         props.widgetValue.current !== undefined && 
         props.widgetValue.previous !== undefined
})

const displayCurrent = computed(() => {
  return currentVal.value.toLocaleString()
})

// Trend Analysis & Styling
const badgeColor = computed(() => {
  if (differenceVal.value === 0) return comparisonConfig.value.neutralColor || 'grey-7'
  
  const isPositive = differenceVal.value > 0
  const isGood = comparisonConfig.value.inverseTrendColor ? !isPositive : isPositive
  
  return isGood ? (comparisonConfig.value.positiveColor || 'green-7') : (comparisonConfig.value.negativeColor || 'red-7')
})

const trendIcon = computed(() => {
  if (differenceVal.value > 0) return 'arrow_upward'
  if (differenceVal.value < 0) return 'arrow_downward'
  return 'trending_flat'
})

const displayDifference = computed(() => {
  const absDiff = Math.abs(differenceVal.value).toLocaleString()
  if (differenceVal.value > 0) return `+${absDiff}`
  if (differenceVal.value < 0) return `-${absDiff}`
  return absDiff
})

// Compiled Dynamic Explanation Text
const explanationText = computed(() => {
  if (!hasComparison.value) return 'No comparison data available'

  const unit = comparisonConfig.value.unit || 'items'
  const verb = comparisonConfig.value.verb || 'completed'
  const currentLabel = comparisonConfig.value.currentLabel || 'This Month'
  const previousLabel = comparisonConfig.value.previousLabel || 'Previous Month'
  
  const trendLabels = comparisonConfig.value.trendLabels || {
    up: 'more',
    down: 'less',
    equal: 'equal'
  }

  let trendWord = trendLabels.equal
  if (differenceVal.value > 0) trendWord = trendLabels.up
  if (differenceVal.value < 0) trendWord = trendLabels.down

  const template = comparisonConfig.value.descriptionTemplate || 
    '{currentLabel} {current} {unit} {verb} which is {absDifference} {trend} than that of {previousLabel}\'s {previous}.'

  return template
    .replace('{currentLabel}', currentLabel)
    .replace('{previousLabel}', previousLabel)
    .replace('{current}', currentVal.value.toLocaleString())
    .replace('{previous}', previousVal.value.toLocaleString())
    .replace('{unit}', unit)
    .replace('{verb}', verb)
    .replace('{absDifference}', Math.abs(differenceVal.value).toLocaleString())
    .replace('{trend}', trendWord)
})
</script>

<style lang="scss" scoped>
.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  min-height: 180px;
  height: auto;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.15);

    .widget-icon-container {
      transform: scale(1.05) rotate(5deg);
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
  transition: all 0.3s ease;
}

.widget-title {
  font-size: 0.875rem;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 600px) {
    font-size: 0.75rem;
  }
}

.shrink-avatar {
  flex-shrink: 0;
  
  @media (max-width: 600px) {
    width: 30px !important;
    height: 30px !important;
    min-width: 30px !important;
    font-size: 16px !important;
  }
}

.metric-value {
  font-size: 2.25rem;
  letter-spacing: -0.02em;

  @media (max-width: 600px) {
    font-size: 1.625rem;
  }
}

.trend-badge {
  border-radius: 6px;
  font-size: 0.7rem;
  line-height: 1;
  flex-shrink: 0;
}

.explanation-text {
  font-size: 0.8rem;
  opacity: 0.85;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

  @media (max-width: 600px) {
    font-size: 0.725rem;
    line-height: 1.35;
  }
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
