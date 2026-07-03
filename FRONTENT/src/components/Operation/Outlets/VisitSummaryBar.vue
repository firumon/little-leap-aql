<template>
  <div v-if="allZero" class="row items-center q-gutter-x-sm text-positive">
    <q-icon name="celebration" size="xs" />
    <span class="text-caption text-weight-medium">All caught up</span>
  </div>
  <div v-else class="row q-gutter-x-xs items-center visit-summary-bar">
    <q-badge
      v-for="chip in chips"
      :key="chip.key"
      :color="chip.color"
      :outline="chip.outline"
      class="visit-summary-bar__chip q-ma-xs"
      :class="{ 'cursor-pointer': chip.items > 0 }"
      @click="chip.items > 0 && $emit('scrollTo', chip.key)"
    >
      <span class="row items-center q-gutter-x-xs">
        <q-icon :name="chip.icon" size="1em" />
        <span>{{ chip.items }} {{ chip.label }}</span>
      </span>
    </q-badge>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'VisitSummaryBar' })

const props = defineProps({
  stats: { type: Object, default: () => ({ overdue: 0, today: 0, thisWeek: 0, future: 0, total: 0 }) }
})

defineEmits(['scrollTo'])

const allZero = computed(() => props.stats.total === 0)

const chips = computed(() => [
  { key: 'overdue', label: 'Overdue', items: props.stats.overdue, icon: 'priority_high', color: 'negative', outline: false },
  { key: 'today', label: 'Today', items: props.stats.today, icon: 'lens', color: 'primary', outline: false },
  { key: 'thisWeek', label: 'This Week', items: props.stats.thisWeek, icon: 'radio_button_unchecked', color: 'grey', outline: true },
  { key: 'future', label: 'Upcoming', items: props.stats.future, icon: 'radio_button_unchecked', color: 'grey', outline: true }
])
</script>

<style scoped>
.visit-summary-bar {
  flex-wrap: wrap;
}

.visit-summary-bar__chip {
  min-height: 24px;
  font-size: 0.75rem;
  padding: 2px 10px;
  border-radius: 12px;
}
</style>
