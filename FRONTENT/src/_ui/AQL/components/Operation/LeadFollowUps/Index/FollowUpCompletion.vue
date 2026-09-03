<template>
  <LinearProgress :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import LinearProgress from 'components/sections/LinearProgress.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexFollowUpCompletion', inheritAttrs: false })

const { index } = useFollowUpIndexContext()

// A bar, not a gauge: this is a backlog queue draining, not a same-day target.
const items = computed(() => {
  const { due, responded } = index.dueCompletion.value
  // Nothing due means nothing to complete, and an empty bar would read as failure.
  if (!due) return []

  return [{
    label: 'Follow-up Completion',
    value: responded,
    max: due,
    color: responded >= due ? 'positive' : 'primary'
  }]
})
</script>
