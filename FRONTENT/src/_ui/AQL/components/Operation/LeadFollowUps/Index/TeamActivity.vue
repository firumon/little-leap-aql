<template>
  <DistributionBars
    title="Team Activity, Last 48 Hours"
    color="primary"
    :card-class="ui.cardClass"
    :row-stagger-ms="ui.rowStaggerMs"
    :items="items"
  />
</template>

<script setup>
import { computed } from 'vue'
import DistributionBars from 'components/sections/DistributionBars.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexTeamActivity', inheritAttrs: false })

const { index, ui, auth } = useFollowUpIndexContext()

const text = (value) => String(value ?? '').trim()

// One person is stamped as a code on one row and a name on the next, so every alias
// of the signed-in user folds into a single bar.
const myIdentities = computed(() => {
  const me = auth.user.value
  return [me?.name, me?.id, me?.email].map((v) => text(v).toLowerCase()).filter(Boolean)
})

const items = computed(() => {
  const me = auth.user.value
  const myLabel = text(me?.name) || text(me?.id) || 'Me'
  const activity = index.teamActivityLast48h(myIdentities.value, myLabel)
  // A board showing only me is a mirror, not a comparison.
  return activity.sawOthers ? activity.rows : []
})
</script>
