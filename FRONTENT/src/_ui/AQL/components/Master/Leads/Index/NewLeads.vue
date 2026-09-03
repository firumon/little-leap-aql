<template>
  <WorkList
    title="New Leads"
    :items="items"
    :limit="5"
    :buffer-percent="40"
    :layout="['label', 'caption']"
    :label="leadName"
    :caption="leadPlace"
    :meta-layout="['chip']"
    :chip="ageLabel"
    chip-color="primary"
    chip-outline
  />
</template>

<script setup>
import { computed } from 'vue'
import WorkList from 'components/sections/WorkList.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexNewLeads', inheritAttrs: false })

const { index, hoursAgoLabel } = useLeadIndexContext()

// 5 rows drawn, 7 read from the source: limit 5 with a 40% buffer.
const items = computed(() => index.newLeads.value)

const leadName = (lead) => lead.displayName
const leadPlace = (lead) => [lead.type, lead.placeLabel].filter(Boolean).join(' · ')
const ageLabel = (lead) => hoursAgoLabel(lead.CreatedAt)
</script>
