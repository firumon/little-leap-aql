<template>
  <StreamCard
    :title="finalTitle"
    :items="restocks"
    :list="list"
    empty-title="No restocks raised"
    empty-text="No stock has ever been requested for this outlet."
    empty-icon="inventory_2"
  />
</template>

<script setup>
/**
 * Outlets › View › Restocks — Section (tier CP: resource + page).
 *
 * Every restock request raised for this outlet, newest first, with its position in the
 * approval-to-delivery workflow. The chip is painted by `OutletRestocks`' own vocabulary, so
 * "Partially Delivered" reads identically here and on the restock module's own queue (§4.5).
 *
 * The caption names WHO asked, because on an outlet's page the interesting axis is the
 * relationship rather than the document — and `RequestedUser` stores a readable name rather
 * than a user code, so it is safe to surface (§7.2).
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewRestocks', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Restocks' }
})

const { evaluate, restocks, restockMeta, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption'],
  content: [
    (row) => text(row.Date) || 'No date set',
    (row) => [text(row.Code), text(row.RequestedUser)].filter(Boolean).join(' · ')
  ],
  metaLayout: ['chip'],
  chip: (row) => restockMeta(row).label,
  chipColor: (row) => restockMeta(row).color,
  clickable: true,
  onClick: (row) => openRecord('outlet-restocks', row?.Code)
}))
</script>
