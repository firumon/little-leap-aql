<template>
  <StreamCard
    :title="finalTitle"
    :items="consumptions"
    :list="list"
    empty-title="No consumptions recorded"
    empty-text="No stock consumption has been counted for this outlet yet."
    empty-icon="point_of_sale"
  />
</template>

<script setup>
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewConsumptions', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Consumptions' }
})

const { evaluate, consumptions, consumptionMeta, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption'],
  content: [
    (row) => text(row.Date) || 'No date set',
    (row) => [text(row.Code), text(row.Username)].filter(Boolean).join(' · ')
  ],
  metaLayout: ['chip'],
  chip: (row) => consumptionMeta(row).label,
  chipColor: (row) => consumptionMeta(row).color,
  clickable: true,
  onClick: (row) => openRecord('outlet-consumptions', row?.Code)
}))
</script>
