<template>
  <AgeingBuckets title="Last Activity Age" :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import AgeingBuckets from 'components/sections/AgeingBuckets.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexActivityAge', inheritAttrs: false })

const { index } = useFollowUpIndexContext()

// A blank RespondDate gets its own band. It is not a young follow-up and not an old
// one — it was never answered at all.
const items = computed(() => index.activityAgeBuckets.value)
</script>
